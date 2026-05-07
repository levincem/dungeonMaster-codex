import type { Champion } from '../../types/champion';
import type { ChampionCombat, DamageEvent } from '../runtimeTypes';
import { tickCombatState } from './combatTick';
import { tickCrushingDoors as tickCrushingDoorsSystem } from './tickCrushingDoors';

type DoorToggleCreatureLike = {
    alive: boolean;
    mapIndex: number;
    x: number;
    y: number;
};

type DoorToggleStateLike<TCreature extends DoorToggleCreatureLike> = {
    level: number;
    brokenDoors: Set<string>;
    openDoors: Set<string>;
    crushingDoors: Record<string, { phase: 'closing' | 'bouncing'; timer: number }>;
    creatures: TCreature[];
};

type CombatTickStateLike = {
    party: Champion[];
    championCombat: Record<number, ChampionCombat>;
    damageEvents: DamageEvent[];
};

type DoorTickStateLike<TCreature, TDamageEvent> = {
    crushingDoors: Record<string, { phase: 'closing' | 'bouncing'; timer: number }>;
    openDoors: Set<string>;
    creatures: TCreature[];
    damageEvents: TDamageEvent[];
    floorItems: unknown[];
    spellVisualEvents: unknown[];
};

type DoorTickCreatureLike = DoorToggleCreatureLike & {
    id: string;
    currentHP: number;
};

export function buildStoreToggleDoorPatch<
    TCreature extends DoorToggleCreatureLike,
    TState extends DoorToggleStateLike<TCreature>,
>(
    state: TState,
    x: number,
    y: number,
    deps: {
        hasDoorButton: (level: number, x: number, y: number) => boolean;
        isDoorControlledByMechanism: (level: number, x: number, y: number) => boolean;
        isDoorLockedByWallSensor: (level: number, x: number, y: number) => boolean;
        playDoorMotion: (durationMs: number, volume: number) => void;
        getDoorSoundVolume: (level: number, x: number, y: number) => number;
        doorToggleSoundDurationMs: number;
        doorCloseDurationSeconds: number;
    },
): Partial<TState> | TState {
    const key = `${state.level},${y},${x}`;
    if (state.brokenDoors.has(key)) return state;
    if (!deps.hasDoorButton(state.level, x, y)) return state;
    const next = new Set(state.openDoors);

    if (!next.has(key)) {
        if (deps.isDoorLockedByWallSensor(state.level, x, y)) {
            return state;
        }
        next.add(key);
        const remaining = { ...state.crushingDoors };
        delete remaining[key];
        deps.playDoorMotion(deps.doorToggleSoundDurationMs, deps.getDoorSoundVolume(state.level, x, y));
        return { openDoors: next, crushingDoors: remaining } as Partial<TState>;
    }

    next.delete(key);
    const blocker = state.creatures.find(
        (creature) => creature.alive && creature.mapIndex === state.level && creature.x === x && creature.y === y,
    );
    deps.playDoorMotion(deps.doorToggleSoundDurationMs, deps.getDoorSoundVolume(state.level, x, y));
    if (blocker) {
        return {
            openDoors: next,
            crushingDoors: {
                ...state.crushingDoors,
                [key]: { phase: 'closing', timer: deps.doorCloseDurationSeconds },
            },
        } as Partial<TState>;
    }
    return { openDoors: next } as Partial<TState>;
}

export function buildStoreTickDoorsPatch<
    TCreature extends DoorTickCreatureLike,
    TDamageEvent,
    TFloorItem,
    TSpellVisualEvent,
    TState extends DoorTickStateLike<TCreature, TDamageEvent>,
>(
    state: TState,
    delta: number,
    deps: {
        doorReboundDurationSeconds: number;
        doorRecloseDurationSeconds: number;
        buildCreatureDamageEvent: (
            level: number,
            x: number,
            y: number,
            amount: number,
            creatureId?: string,
        ) => TDamageEvent;
        dropCreatureCarriedItems: (
            creatures: TCreature[],
            floorItems: TFloorItem[],
            creatureId: string,
        ) => {
            creatures: TCreature[];
            floorItems: TFloorItem[];
        };
        normalizeCreatureCellsOnTile: (
            creatures: TCreature[],
            level: number,
            x: number,
            y: number,
        ) => TCreature[];
        buildDeathDustEvent: (level: number, x: number, y: number) => TSpellVisualEvent;
        playWallBump: () => void;
    },
) {
    const basePatch = tickCrushingDoorsSystem<TCreature, TDamageEvent>(
        state,
        delta,
        deps,
    ) as Partial<TState> | null;
    if (!basePatch?.creatures) return basePatch;

    const previousById = new Map(state.creatures.map((creature) => [creature.id, creature]));
    const newlyDead = basePatch.creatures.filter((creature) => {
        const previous = previousById.get(creature.id);
        return previous?.alive && !creature.alive;
    });
    if (newlyDead.length === 0) return basePatch;

    let creatures = basePatch.creatures;
    let floorItems = (basePatch.floorItems ?? state.floorItems) as TFloorItem[];
    let spellVisualEvents = (basePatch.spellVisualEvents ?? state.spellVisualEvents) as TSpellVisualEvent[];

    for (const creature of newlyDead) {
        const dropped = deps.dropCreatureCarriedItems(creatures, floorItems, creature.id);
        creatures = deps.normalizeCreatureCellsOnTile(
            dropped.creatures,
            creature.mapIndex,
            creature.x,
            creature.y,
        );
        floorItems = dropped.floorItems;
        spellVisualEvents = [
            ...spellVisualEvents,
            deps.buildDeathDustEvent(creature.mapIndex, creature.x, creature.y),
        ];
    }

    return {
        ...basePatch,
        creatures,
        floorItems,
        spellVisualEvents,
    } as Partial<TState>;
}

export function buildStoreCombatTickPatch<TState extends CombatTickStateLike>(
    state: TState,
    delta: number,
    now: number,
    damageEventLifetimeMs: number,
) {
    return tickCombatState({
        party: state.party,
        championCombat: state.championCombat,
        damageEvents: state.damageEvents,
        delta,
        now,
        damageEventLifetimeMs,
    }) as Partial<TState> | null;
}

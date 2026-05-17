import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../../types/game';
import type { GameOptions, ChampionVitals } from '../runtimeTypes';
import { normalizeGameOptions } from '../options';

type GameOptionsStateLike = {
    gameOptions: GameOptions;
};

type KillCreatureStateLike = {
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
};

type SleepStateLike = {
    gamePhase: string;
    party: unknown[];
    sleeping: boolean;
    lastCastResult: unknown | null;
};

type WakeUpStateLike = {
    sleeping: boolean;
};

type PauseStateLike = {
    gamePhase: string;
    sleeping: boolean;
    paused: boolean;
    lastCastResult: unknown | null;
};

type KillChampionStateLike = {
    level: number;
    position: [number, number];
    party: Champion[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    deadChampions: Record<number, Champion>;
    selectedChampionIndex: number;
    championVitals: Record<number, ChampionVitals>;
};

export function buildSetGameOptionsPatch<TState extends GameOptionsStateLike>(
    state: TState,
    updater: Partial<GameOptions>,
) {
    const keybindings = updater.keybindings
        ? {
            ...state.gameOptions.keybindings,
            ...updater.keybindings,
        }
        : state.gameOptions.keybindings;
    return {
        gameOptions: normalizeGameOptions({
            ...state.gameOptions,
            ...updater,
            keybindings,
        }),
    };
}

export function buildKillCreaturePatch<TState extends KillCreatureStateLike>(
    state: TState,
    creatureId: string,
    deps: {
        dropCreatureCarriedItems: (
            creatures: CreatureInstance[],
            floorItems: FloorItem[],
            creatureId: string,
        ) => {
                creatures: CreatureInstance[];
                floorItems: FloorItem[];
        };
        normalizeCreatureCellsOnTile: (
            creatures: CreatureInstance[],
            level: number,
            x: number,
            y: number,
        ) => CreatureInstance[];
    },
) {
    const creatures = state.creatures.map((creature) =>
        creature.id === creatureId ? { ...creature, alive: false } : creature,
    );
    const dropped = deps.dropCreatureCarriedItems(creatures, state.floorItems, creatureId);
    const killedCreature = state.creatures.find((creature) => creature.id === creatureId);
    return {
        creatures: killedCreature
            ? deps.normalizeCreatureCellsOnTile(
                dropped.creatures,
                killedCreature.mapIndex,
                killedCreature.x,
                killedCreature.y,
            )
            : dropped.creatures,
        floorItems: dropped.floorItems,
    };
}

export function buildPruneDeadCreaturesPatch<TState extends KillCreatureStateLike>(
    state: TState,
): Pick<TState, 'creatures'> | null {
    const livingCreatures = state.creatures.filter((creature) => creature.alive);
    return livingCreatures.length === state.creatures.length
        ? null
        : { creatures: livingCreatures };
}

export function buildStoreKillChampionPatch<
    TState extends KillChampionStateLike,
    TPatch,
>(
    state: TState,
    championId: number,
    now: number,
    deps: {
        applyChampionDeathDropsToPartyState: (
            state: Omit<TState, 'championVitals'>,
            championIds: readonly number[],
            now: number,
        ) => TPatch | null;
    },
): TPatch | null {
    const vitals = state.championVitals[championId];
    if (!vitals || vitals.hp > 0) return null;

    const {
        championVitals: _championVitals,
        ...deathState
    } = state;
    void _championVitals;
    return deps.applyChampionDeathDropsToPartyState(deathState, [championId], now);
}

export function buildToggleSleepPatch<TState extends SleepStateLike>(
    state: TState,
    deps: {
        isPartyRested: (state: TState) => boolean;
    },
) {
    if (state.gamePhase !== 'exploration' || state.party.length === 0) return null;
    if (deps.isPartyRested(state)) {
        return { sleeping: false };
    }
    return {
        sleeping: !state.sleeping,
        lastCastResult: null,
    };
}

export function buildWakeUpPatch<TState extends WakeUpStateLike>(state: TState) {
    return state.sleeping ? { sleeping: false } : null;
}

export function buildTogglePausePatch<TState extends PauseStateLike>(state: TState) {
    if (
        state.gamePhase !== 'exploration' &&
        state.gamePhase !== 'mirror_open' &&
        state.gamePhase !== 'endgame'
    ) {
        return null;
    }
    if (state.sleeping) return null;
    return {
        paused: !state.paused,
        lastCastResult: null,
    };
}

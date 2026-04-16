import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../../types/game';
import type {
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    PartyShield,
    SpellVisualEvent,
} from '../runtimeTypes';

type PendingSensorEventLike = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type PitEntryTransportState<TPendingSensorEvent extends PendingSensorEventLike> = {
    level: number;
    position: [number, number];
    party: Champion[];
    selectedChampionIndex: number;
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    championVitals: Record<number, ChampionVitals>;
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    deadChampions: Record<number, Champion>;
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    championCombat: Record<number, ChampionCombat>;
    pendingSensorEvents: TPendingSensorEvent[];
    elapsedGameTimeTicks: number;
};

type PitEntryTransportDeps<
    TState extends PitEntryTransportState<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent extends PendingSensorEventLike,
    TPatch extends object,
> = {
    resolvePitLanding: (
        level: number,
        y: number,
        x: number,
        openDoors: Set<string>,
        openWalls: Set<string>,
        openPits: Set<string>,
    ) => { level: number; x: number; y: number } | null;
    buildSensorStateSnapshot: (state: TState) => TSensorState;
    triggerFloorSensors: (
        level: number,
        x: number,
        y: number,
        ss: TSensorState,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
        floorItems: FloorItem[],
        pendingSensorEvents: TPendingSensorEvent[],
        mode: 'enter' | 'leave',
    ) => {
        sensorChanges: Partial<TSensorState>;
        pendingSensorEvents: TPendingSensorEvent[];
    };
    applyPartyTelefragAtSquare: (
        state: Pick<TState, 'creatures' | 'floorItems' | 'spellVisualEvents'>,
        level: number,
        x: number,
        y: number,
    ) => Partial<Pick<TState, 'creatures' | 'floorItems' | 'spellVisualEvents'>> | null;
    applyPartyFallImpactDamage: (
        state: Pick<
            TState,
            | 'level'
            | 'position'
            | 'party'
            | 'championInventories'
            | 'championEquipment'
            | 'floorItems'
            | 'deadChampions'
            | 'selectedChampionIndex'
            | 'damageEvents'
            | 'activeShields'
            | 'activePotionBoosts'
            | 'championCombat'
        >,
        championVitals: Record<number, ChampionVitals>,
        landingLevel: number,
        landingPosition: [number, number],
    ) => Partial<
        Pick<
            TState,
            | 'championVitals'
            | 'damageEvents'
            | 'party'
            | 'floorItems'
            | 'championInventories'
            | 'championEquipment'
            | 'deadChampions'
            | 'selectedChampionIndex'
        >
    > | null;
    applyImmediateTransportSquareEffects: (state: TState, basePatch: TPatch) => TPatch;
    computeMovementCooldown: (state: TState) => number;
};

export function resolveOpenPitEntryTransport<
    TState extends PitEntryTransportState<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent extends PendingSensorEventLike,
    TPatch extends object,
>(
    state: TState,
    x: number,
    y: number,
    ny: number,
    nx: number,
    movedVitals: Record<number, ChampionVitals> | null,
    deps: PitEntryTransportDeps<TState, TSensorState, TPendingSensorEvent, TPatch>,
): { patch: TPatch; fellThroughPit: true } | null {
    const landing = deps.resolvePitLanding(
        state.level + 1,
        ny,
        nx,
        state.openDoors,
        state.openWalls,
        state.openPits,
    );
    if (!landing) return null;

    const ss = deps.buildSensorStateSnapshot(state);
    const leave = deps.triggerFloorSensors(
        state.level,
        x,
        y,
        ss,
        state.championInventories,
        state.championEquipment,
        state.floorItems,
        state.pendingSensorEvents,
        'leave',
    );
    const afterLeave = { ...ss, ...leave.sensorChanges } as TSensorState;
    const enter = deps.triggerFloorSensors(
        landing.level,
        landing.x,
        landing.y,
        afterLeave,
        state.championInventories,
        state.championEquipment,
        state.floorItems,
        leave.pendingSensorEvents,
        'enter',
    );

    const landingPosition: [number, number] = [landing.y, landing.x];
    const postFallVitals = movedVitals ?? state.championVitals;
    const telefragPatch = deps.applyPartyTelefragAtSquare(
        {
            creatures: state.creatures,
            floorItems: state.floorItems,
            spellVisualEvents: state.spellVisualEvents,
        },
        landing.level,
        landing.x,
        landing.y,
    );
    const fallDamageChanges = deps.applyPartyFallImpactDamage(
        state,
        postFallVitals,
        landing.level,
        landingPosition,
    );

    return {
        fellThroughPit: true,
        patch: deps.applyImmediateTransportSquareEffects(state, {
            level: landing.level,
            position: landingPosition,
            lastPartyMoveGameTick: state.elapsedGameTimeTicks,
            movementCooldown: deps.computeMovementCooldown(state),
            ...(movedVitals ? { championVitals: movedVitals } : {}),
            ...leave.sensorChanges,
            ...enter.sensorChanges,
            ...(telefragPatch ?? {}),
            ...(fallDamageChanges ?? {}),
            pendingSensorEvents: enter.pendingSensorEvents,
        } as TPatch),
    };
}

import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../../types/game';
import type {
    ChampionVitals,
    SpellVisualEvent,
} from '../runtimeTypes';

type PendingSensorEventLike = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type TeleporterStepTransportState<TPendingSensorEvent extends PendingSensorEventLike> = {
    level: number;
    position: [number, number];
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    party: Champion[];
    openTeleporters: Set<string>;
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    spellVisualEvents: SpellVisualEvent[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    pendingSensorEvents: TPendingSensorEvent[];
    elapsedGameTimeTicks: number;
};

type TeleporterStepTransportDeps<
    TState extends TeleporterStepTransportState<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent extends PendingSensorEventLike,
    TPatch extends object,
> = {
    resolveProjectileTeleporterTransport: (
        state: Pick<TState, 'openTeleporters'>,
        level: number,
        x: number,
        y: number,
        direction: TState['direction'],
    ) => { level: number; x: number; y: number; direction: TState['direction'] };
    buildSensorStateSnapshot: (state: TState) => TSensorState;
    transitionFloorSensors: (
        level: number,
        fromX: number,
        fromY: number,
        toX: number,
        toY: number,
        partySize: number,
        ss: TSensorState,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
        floorItems: FloorItem[],
        pendingSensorEvents: TPendingSensorEvent[],
    ) => {
        sensorChanges: Partial<TSensorState>;
        pendingSensorEvents: TPendingSensorEvent[];
        blockedMessage?: string;
    };
    applyPartyTelefragAtSquare: (
        state: Pick<TState, 'creatures' | 'floorItems' | 'spellVisualEvents'>,
        level: number,
        x: number,
        y: number,
    ) => Partial<Pick<TState, 'creatures' | 'floorItems' | 'spellVisualEvents'>> | null;
    buildLevelHydrationPatch: (state: TState, level: number) => Partial<TState> | null;
    applyImmediateTransportSquareEffects: (state: TState, basePatch: TPatch) => TPatch;
    computeMovementCooldown: (state: TState) => number;
    playTeleport: () => void;
};

export function resolveTeleporterStepTransport<
    TState extends TeleporterStepTransportState<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent extends PendingSensorEventLike,
    TPatch extends object,
>(
    state: TState,
    ny: number,
    nx: number,
    movedVitals: Record<number, ChampionVitals> | null,
    deps: TeleporterStepTransportDeps<TState, TSensorState, TPendingSensorEvent, TPatch>,
): { patch: TPatch; blockedMessage?: string } | null {
    const tpKey = `${state.level},${ny},${nx}`;
    if (!state.openTeleporters.has(tpKey)) return null;

    const resolvedTransport = deps.resolveProjectileTeleporterTransport(
        state,
        state.level,
        nx,
        ny,
        state.direction,
    );

    deps.playTeleport();

    if (resolvedTransport.level !== state.level) {
        const hydrationPatch = deps.buildLevelHydrationPatch(state, resolvedTransport.level);
        const hydratedState = hydrationPatch
            ? { ...state, ...hydrationPatch } as TState
            : state;
        const telefragPatch = deps.applyPartyTelefragAtSquare(
            {
                creatures: hydratedState.creatures,
                floorItems: hydratedState.floorItems,
                spellVisualEvents: hydratedState.spellVisualEvents,
            },
            resolvedTransport.level,
            resolvedTransport.x,
            resolvedTransport.y,
        );
        return {
            patch: deps.applyImmediateTransportSquareEffects(hydratedState, {
                ...(hydrationPatch ?? {}),
                level: resolvedTransport.level,
                position: [resolvedTransport.y, resolvedTransport.x],
                direction: resolvedTransport.direction,
                lastPartyMoveGameTick: state.elapsedGameTimeTicks,
                movementCooldown: deps.computeMovementCooldown(state),
                ...(movedVitals ? { championVitals: movedVitals } : {}),
                ...(telefragPatch ?? {}),
            } as TPatch),
        };
    }

    const ss = deps.buildSensorStateSnapshot(state);
    const sensorChanges = deps.transitionFloorSensors(
        state.level,
        nx,
        ny,
        resolvedTransport.x,
        resolvedTransport.y,
        state.party.length,
        ss,
        state.championInventories,
        state.championEquipment,
        state.floorItems,
        state.pendingSensorEvents,
    );
    const telefragPatch = deps.applyPartyTelefragAtSquare(
        {
            creatures: state.creatures,
            floorItems: state.floorItems,
            spellVisualEvents: state.spellVisualEvents,
        },
        state.level,
        resolvedTransport.x,
        resolvedTransport.y,
    );

    return {
        blockedMessage: sensorChanges.blockedMessage,
        patch: deps.applyImmediateTransportSquareEffects(state, {
            position: [resolvedTransport.y, resolvedTransport.x],
            direction: resolvedTransport.direction,
            lastPartyMoveGameTick: state.elapsedGameTimeTicks,
            movementCooldown: deps.computeMovementCooldown(state),
            ...(movedVitals ? { championVitals: movedVitals } : {}),
            ...sensorChanges.sensorChanges,
            ...(telefragPatch ?? {}),
            pendingSensorEvents: sensorChanges.pendingSensorEvents,
        } as TPatch),
    };
}

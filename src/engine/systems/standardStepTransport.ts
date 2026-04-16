import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { ChampionVitals, FootprintEntry } from '../runtimeTypes';

type PendingSensorEventLike = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type StandardStepTransportState<TPendingSensorEvent extends PendingSensorEventLike> = {
    level: number;
    position: [number, number];
    party: Champion[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    pendingSensorEvents: TPendingSensorEvent[];
    footprintsUntil: number;
    footprintHistory: FootprintEntry[];
    elapsedGameTimeTicks: number;
};

type StandardStepTransportDeps<
    TState extends StandardStepTransportState<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent extends PendingSensorEventLike,
    TPatch extends object,
> = {
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
    applyImmediateTransportSquareEffects: (state: TState, basePatch: TPatch) => TPatch;
    computeMovementCooldown: (state: TState) => number;
    now: () => number;
};

export function resolveStandardStepTransport<
    TState extends StandardStepTransportState<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent extends PendingSensorEventLike,
    TPatch extends object,
>(
    state: TState,
    x: number,
    y: number,
    nx: number,
    ny: number,
    movedVitals: Record<number, ChampionVitals> | null,
    deps: StandardStepTransportDeps<TState, TSensorState, TPendingSensorEvent, TPatch>,
): { patch: TPatch; blockedMessage?: string } {
    const ss = deps.buildSensorStateSnapshot(state);
    const sensorChanges = deps.transitionFloorSensors(
        state.level,
        x,
        y,
        nx,
        ny,
        state.party.length,
        ss,
        state.championInventories,
        state.championEquipment,
        state.floorItems,
        state.pendingSensorEvents,
    );

    const now = deps.now();
    const footprintChanges = now < state.footprintsUntil
        ? { footprintHistory: [...state.footprintHistory, { x: nx, y: ny, level: state.level, ts: now }] }
        : {};

    return {
        blockedMessage: sensorChanges.blockedMessage,
        patch: deps.applyImmediateTransportSquareEffects(state, {
            position: [ny, nx],
            lastPartyMoveGameTick: state.elapsedGameTimeTicks,
            movementCooldown: deps.computeMovementCooldown(state),
            ...(movedVitals ? { championVitals: movedVitals } : {}),
            ...sensorChanges.sensorChanges,
            pendingSensorEvents: sensorChanges.pendingSensorEvents,
            ...footprintChanges,
        } as TPatch),
    };
}

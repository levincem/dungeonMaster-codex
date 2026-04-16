import type { ChampionEquipment, FloorItem, GameTile } from '../../types/game';
import type { ChampionVitals } from '../runtimeTypes';

type PendingSensorEventLike = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type ClimbDownState<TPendingSensorEvent extends PendingSensorEventLike> = {
    level: number;
    position: [number, number];
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    pendingSensorEvents: TPendingSensorEvent[];
    elapsedGameTimeTicks: number;
};

type ClimbDownDeps<
    TState extends ClimbDownState<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent extends PendingSensorEventLike,
> = {
    getFrontPosition: (position: [number, number], direction: TState['direction']) => { x: number; y: number };
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    resolvePitLanding: (
        level: number,
        y: number,
        x: number,
        openDoors: Set<string>,
        openWalls: Set<string>,
        openPits: Set<string>,
    ) => { level: number; x: number; y: number } | null;
    applyPartyLoadBasedFatigue: (state: TState, amount: number) => Record<number, ChampionVitals> | null;
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
    computeMovementCooldown: (state: TState) => number;
};

export function resolveClimbDownAction<
    TState extends ClimbDownState<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent extends PendingSensorEventLike,
    TPatch extends object,
>(
    state: TState,
    basePatch: TPatch,
    deps: ClimbDownDeps<TState, TSensorState, TPendingSensorEvent>,
): { patch?: TPatch; errorMessage?: string } {
    const { x: pitX, y: pitY } = deps.getFrontPosition(state.position, state.direction);
    const frontTile = deps.getTile(state.level, pitX, pitY);
    if (frontTile?.type !== 'Pit' || !state.openPits.has(`${state.level},${pitY},${pitX}`)) {
        return { errorMessage: 'CLIMB DOWN requiert un puits ouvert devant le groupe.' };
    }

    const landing = deps.resolvePitLanding(
        state.level + 1,
        pitY,
        pitX,
        state.openDoors,
        state.openWalls,
        state.openPits,
    );
    if (!landing) {
        return { errorMessage: 'Impossible de descendre ici.' };
    }

    const climbDownVitals = deps.applyPartyLoadBasedFatigue(state, 25);
    const sensorsBeforeMove = deps.buildSensorStateSnapshot(state);
    const leave = deps.triggerFloorSensors(
        state.level,
        state.position[1],
        state.position[0],
        sensorsBeforeMove,
        state.championInventories,
        state.championEquipment,
        state.floorItems,
        state.pendingSensorEvents,
        'leave',
    );
    const afterLeave = { ...sensorsBeforeMove, ...leave.sensorChanges } as TSensorState;
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

    return {
        patch: {
            ...basePatch,
            level: landing.level,
            position: [landing.y, landing.x],
            lastPartyMoveGameTick: state.elapsedGameTimeTicks,
            movementCooldown: deps.computeMovementCooldown(state),
            ...(climbDownVitals ? { championVitals: climbDownVitals } : {}),
            ...leave.sensorChanges,
            ...enter.sensorChanges,
            pendingSensorEvents: enter.pendingSensorEvents,
        } as TPatch,
    };
}

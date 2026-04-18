import type { ChampionEquipment, FloorItem, GameTile, SensorObject } from '../../types/game';
import type { ChampionVitals } from '../runtimeTypes';

type PendingSensorEventLike = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type ClimbDownRuntimeState<TPendingSensorEvent extends PendingSensorEventLike> = {
    level: number;
    position: [number, number];
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
    hydratedLevels: Set<number>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    pendingSensorEvents: TPendingSensorEvent[];
};

type MovementSensorDepsLike<TSensorState, TPendingSensorEvent extends PendingSensorEventLike> = {
    getTile: (level: number, x: number, y: number) => { objects: unknown[] } | undefined;
    asSensor: (obj: unknown) => SensorObject | null;
    isCreatureOnlyFloorSensor: (sensor: SensorObject) => boolean;
    isGeneratorSensor: (sensor: SensorObject) => boolean;
    isPartyPossessionSensor: (sensor: SensorObject) => boolean;
    isSpecificObjectFloorSensor: (sensor: SensorObject) => boolean;
    getRequiredSensorItemName: (sensor: SensorObject) => string | undefined;
    partyHasRequiredItem: (
        requiredName: string | undefined,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
    ) => boolean;
    tileHasRequiredFloorItem: (
        level: number,
        x: number,
        y: number,
        requiredName: string | undefined,
        floorItems: FloorItem[],
    ) => boolean;
    computeSensorEffect: (sensor: SensorObject, level: number, ss: TSensorState) => Partial<TSensorState>;
    triggerGeneratorSensor: (level: number, sensor: SensorObject, ss: TSensorState) => TSensorState;
    queueOrComputeSensorEffect: (
        sensor: SensorObject,
        level: number,
        ss: TSensorState,
        pendingSensorEvents: TPendingSensorEvent[],
    ) => {
        sensorChanges: Partial<TSensorState>;
        pendingSensorEvents: TPendingSensorEvent[];
    };
    resolveDoorSoundTarget: (sensor: SensorObject, level: number) => { level: number; x: number; y: number } | null;
    playDoorMotion: (target: { level: number; x: number; y: number } | null) => void;
    playPlate: () => void;
    notifyPlateActivated: (level: number, x: number, y: number) => void;
    diffSensorState: (before: TSensorState, after: TSensorState) => Partial<TSensorState>;
};

type ClimbDownRuntimeDepsParams<
    TState extends ClimbDownRuntimeState<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent extends PendingSensorEventLike,
> = {
    getFrontPosition: (position: TState['position'], direction: TState['direction']) => { x: number; y: number };
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    resolvePitLanding: (
        level: number,
        y: number,
        x: number,
        openDoors: Set<string>,
        openWalls: Set<string>,
        openPits: Set<string>,
        deps: {
            getTile: (level: number, x: number, y: number) => GameTile | undefined;
            isWalkable: (
                level: number,
                y: number,
                x: number,
                openDoors: Set<string>,
                openWalls: Set<string>,
                openPits: Set<string>,
            ) => boolean;
        },
    ) => { level: number; x: number; y: number } | null;
    isWalkable: (
        level: number,
        y: number,
        x: number,
        openDoors: Set<string>,
        openWalls: Set<string>,
        openPits: Set<string>,
    ) => boolean;
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
        deps: MovementSensorDepsLike<TSensorState, TPendingSensorEvent>,
        mode: 'enter' | 'leave',
    ) => {
        sensorChanges: Partial<TSensorState>;
        pendingSensorEvents: TPendingSensorEvent[];
    };
    buildMovementSensorDeps: () => MovementSensorDepsLike<TSensorState, TPendingSensorEvent>;
    buildLevelHydrationPatch: (state: TState, level: number) => Partial<TState> | null;
    computeMovementCooldown: (state: TState) => number;
};

export function createClimbDownRuntimeDeps<
    TState extends ClimbDownRuntimeState<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent extends PendingSensorEventLike,
>(
    params: ClimbDownRuntimeDepsParams<TState, TSensorState, TPendingSensorEvent>,
) {
    return {
        getFrontPosition: params.getFrontPosition,
        getTile: params.getTile,
        resolvePitLanding: (
            level: number,
            y: number,
            x: number,
            openDoors: Set<string>,
            openWalls: Set<string>,
            openPits: Set<string>,
        ) => params.resolvePitLanding(
            level,
            y,
            x,
            openDoors,
            openWalls,
            openPits,
            { getTile: params.getTile, isWalkable: params.isWalkable },
        ),
        applyPartyLoadBasedFatigue: params.applyPartyLoadBasedFatigue,
        buildSensorStateSnapshot: params.buildSensorStateSnapshot,
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
        ) => params.triggerFloorSensors(
            level,
            x,
            y,
            ss,
            inventories,
            equipment,
            floorItems,
            pendingSensorEvents,
            params.buildMovementSensorDeps(),
            mode,
        ),
        buildLevelHydrationPatch: params.buildLevelHydrationPatch,
        computeMovementCooldown: params.computeMovementCooldown,
    };
}

export function createStoreClimbDownRuntimeDeps<
    TState extends ClimbDownRuntimeState<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent extends PendingSensorEventLike,
>(
    params: ClimbDownRuntimeDepsParams<TState, TSensorState, TPendingSensorEvent>,
) {
    return createClimbDownRuntimeDeps(params);
}

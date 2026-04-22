import type {
    CardinalDir,
    ChampionEquipment,
    FloorItem,
    GameMap,
    GameTile,
    SensorAction,
    SensorObject,
} from '../../types/game';
import {
    getWallFaceSensorsInRuntimeOrder as getWallFaceSensorsInRuntimeOrderSystem,
    hasWallFaceLocalRotationEffect,
    rotateWallFaceSensors as rotateWallFaceSensorsSystem,
    shouldRotateWallFaceAfterActivation as shouldRotateWallFaceAfterActivationSystem,
} from './sensorRuntime';
import {
    buildSensorStateSnapshot as buildSensorStateSnapshotSystem,
    buildWallLauncherProjectiles as buildWallLauncherProjectilesSystem,
    computeSensorEffect as computeSensorEffectSystem,
    findSensorByIndex as findSensorByIndexSystem,
    findSensorPlacement as findSensorPlacementSystem,
    getSelfRevealingWallSensor as getSelfRevealingWallSensorSystem,
    getSensorStateKey as getSensorStateKeySystem,
    queueOrComputeSensorEffect as queueOrComputeSensorEffectSystem,
    readWallSensorRuntimeData as readWallSensorRuntimeDataSystem,
    resolveDoorSoundTarget as resolveDoorSoundTargetSystem,
    revealSelfWallMountedItems as revealSelfWallMountedItemsSystem,
    WALL_LAUNCHER_SENSOR_TYPES,
    writeWallSensorRuntimeData as writeWallSensorRuntimeDataSystem,
} from './sensorRuntimeCore';
import { dispatchTriggeredSensorEffect as dispatchTriggeredSensorEffectSystem } from './sensorTriggeredEffects';
import { triggerGeneratorSensor as triggerGeneratorSensorSystem } from './sensorGeneratorRuntime';

type MapResolver = (level: number) => GameMap;

type PendingGeneratorSpawnLike = {
    sensorLevel: number;
    sensorIndex: number;
    spawnLevel: number;
    spawnX: number;
    spawnY: number;
    typeId: number;
    hpMultiplier: number;
    creatureCount: number;
    groupId: string;
    remaining: number;
};
type CreaturePositionLike = {
    alive: boolean;
    mapIndex: number;
    x: number;
    y: number;
};
type PendingSensorEventLike = {
    level: number;
    sensorIndex: number;
    remaining: number;
    actionOverride?: SensorAction;
};

export type StoreSensorState<TProjectile, TCreature, TPendingGeneratorSpawn> = {
    openDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    sensorRuntimeData: Record<string, number>;
    sensorRotationOffsets: Record<string, number>;
    visibleTexts: Set<string>;
    projectiles: TProjectile[];
    creatures: TCreature[];
    pendingGeneratorSpawns: TPendingGeneratorSpawn[];
    currentLevel: number;
    currentPosition: [number, number];
    currentDirection: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    elapsedGameTimeTicks: number;
};

export const PUSH_FACE_BY_DIRECTION: Record<string, CardinalDir> = {
    NORTH: 'South',
    SOUTH: 'North',
    EAST: 'West',
    WEST: 'East',
};

const WALL_SENSOR_FACE_MASK: Record<CardinalDir, number> = {
    North: 1,
    East: 2,
    South: 4,
    West: 8,
};

type SensorSnapshotSource<TProjectile, TCreature, TPendingGeneratorSpawn> = Partial<{
    level: number;
    position: [number, number];
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    openDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    sensorRuntimeData: Record<string, number>;
    sensorRotationOffsets: Record<string, number>;
    visibleTexts: Set<string>;
    projectiles: TProjectile[];
    creatures: TCreature[];
    pendingGeneratorSpawns: TPendingGeneratorSpawn[];
    elapsedGameTimeTicks: number;
}>;

type WallLauncherProjectileDeps = {
    resolveWeaponProjectile: (weaponTypeId: number) => { rawName: string; baseDamage: number } | null;
};

type GeneratorRuntimeDeps<
    TState extends StoreSensorState<unknown, TCreature, TPendingGeneratorSpawn>,
    TCreature extends CreaturePositionLike,
    TPendingGeneratorSpawn extends PendingGeneratorSpawnLike,
> = {
    getGeneratorConfig: (level: number, sensorIndex: number) => {
        spawnX: number;
        spawnY: number;
        typeId: number;
        hpMultiplier: number;
        countRaw: number;
        randomized: boolean;
        ticks: number;
    } | null;
    randomInt: (maxExclusive: number) => number;
    canReserveGeneratorGroup: (state: TState, spawnLevel: number) => boolean;
    buildPendingGeneratorSpawnEvent: (
        level: number,
        sensorIndex: number,
        generatorConfig: {
            spawnX: number;
            spawnY: number;
            typeId: number;
            hpMultiplier: number;
            countRaw: number;
            randomized: boolean;
            ticks: number;
        },
        creatureCount: number,
        groupId: string,
    ) => Omit<TPendingGeneratorSpawn, 'remaining'>;
    queuePendingGeneratorSpawnEvent: (
        pendingGeneratorSpawns: TPendingGeneratorSpawn[],
        event: Omit<TPendingGeneratorSpawn, 'remaining'>,
        remaining: number,
    ) => TPendingGeneratorSpawn[];
    retrySeconds: number;
    createGeneratedCreatureGroupInstances: (
        level: number,
        x: number,
        y: number,
        typeId: number,
        hpMultiplier: number,
        creatureCount: number,
        groupId: string,
    ) => TCreature[];
};

type StoreSensorRuntimeParams<
    TState extends StoreSensorState<TProjectile, TCreature, TPendingGeneratorSpawn>,
    TProjectile,
    TCreature extends CreaturePositionLike,
    TPendingGeneratorSpawn extends PendingGeneratorSpawnLike,
> = {
    mapResolver: MapResolver;
    originalTimerTicksToSeconds: (ticks: number) => number;
    getGeneratorConfig: GeneratorRuntimeDeps<TState, TCreature, TPendingGeneratorSpawn>['getGeneratorConfig'];
    randomInt: GeneratorRuntimeDeps<TState, TCreature, TPendingGeneratorSpawn>['randomInt'];
    canReserveGeneratorGroup: GeneratorRuntimeDeps<TState, TCreature, TPendingGeneratorSpawn>['canReserveGeneratorGroup'];
    buildPendingGeneratorSpawnEvent: GeneratorRuntimeDeps<TState, TCreature, TPendingGeneratorSpawn>['buildPendingGeneratorSpawnEvent'];
    queuePendingGeneratorSpawnEvent: GeneratorRuntimeDeps<TState, TCreature, TPendingGeneratorSpawn>['queuePendingGeneratorSpawnEvent'];
    retrySeconds: number;
    createGeneratedCreatureGroupInstances: GeneratorRuntimeDeps<TState, TCreature, TPendingGeneratorSpawn>['createGeneratedCreatureGroupInstances'];
    resolveWeaponProjectile: WallLauncherProjectileDeps['resolveWeaponProjectile'];
    isGeneratorSensor: (sensor: SensorObject) => boolean;
    itemMatchesMechanismRequirement: (item: FloorItem, requiredName: string | undefined) => boolean;
    isWallRevealableObject: (obj: GameTile['objects'][number]) => boolean;
    now?: () => number;
};

export function applySensorActionToSet(
    set: Set<string>,
    key: string,
    action: SensorAction | string,
): Set<string> {
    const hasKey = set.has(key);
    if (action === 'Set') {
        if (hasKey) return set;
        const next = new Set(set);
        next.add(key);
        return next;
    }
    if (action === 'Clear') {
        if (!hasKey) return set;
        const next = new Set(set);
        next.delete(key);
        return next;
    }
    if (action === 'Toggle') {
        const next = new Set(set);
        if (hasKey) next.delete(key);
        else next.add(key);
        return next;
    }
    return set;
}

export function diffStoreSensorState<TState extends StoreSensorState<unknown, unknown, unknown>>(
    before: TState,
    after: TState,
): Partial<TState> {
    const patch: Partial<TState> = {};
    if (after.openDoors !== before.openDoors) patch.openDoors = after.openDoors;
    if (after.openPits !== before.openPits) patch.openPits = after.openPits;
    if (after.openTeleporters !== before.openTeleporters) patch.openTeleporters = after.openTeleporters;
    if (after.openWalls !== before.openWalls) patch.openWalls = after.openWalls;
    if (after.activeSensors !== before.activeSensors) patch.activeSensors = after.activeSensors;
    if (after.firedSensors !== before.firedSensors) patch.firedSensors = after.firedSensors;
    if (after.sensorRuntimeData !== before.sensorRuntimeData) patch.sensorRuntimeData = after.sensorRuntimeData;
    if (after.sensorRotationOffsets !== before.sensorRotationOffsets) patch.sensorRotationOffsets = after.sensorRotationOffsets;
    if (after.visibleTexts !== before.visibleTexts) patch.visibleTexts = after.visibleTexts;
    if (after.projectiles !== before.projectiles) patch.projectiles = after.projectiles;
    if (after.creatures !== before.creatures) patch.creatures = after.creatures;
    if (after.pendingGeneratorSpawns !== before.pendingGeneratorSpawns) {
        patch.pendingGeneratorSpawns = after.pendingGeneratorSpawns;
    }
    return patch;
}

export function partyHasRequiredMechanismItem(
    requiredName: string | undefined,
    inventories: Record<number, FloorItem[]>,
    equipment: Record<number, ChampionEquipment>,
    itemMatchesMechanismRequirement: (item: FloorItem, name: string | undefined) => boolean,
): boolean {
    if (!requiredName) return false;
    for (const inventory of Object.values(inventories)) {
        if (inventory.some((item) => itemMatchesMechanismRequirement(item, requiredName))) return true;
    }
    for (const equip of Object.values(equipment)) {
        if (Object.values(equip ?? {}).some((item) => item && itemMatchesMechanismRequirement(item, requiredName))) {
            return true;
        }
    }
    return false;
}

export function tileHasRequiredMechanismFloorItem(
    level: number,
    x: number,
    y: number,
    requiredName: string | undefined,
    floorItems: FloorItem[],
    itemMatchesMechanismRequirement: (item: FloorItem, name: string | undefined) => boolean,
): boolean {
    if (!requiredName) {
        return floorItems.some((item) =>
            item.mapIndex === level &&
            item.x === x &&
            item.y === y,
        );
    }
    return floorItems.some((item) =>
        item.mapIndex === level &&
        item.x === x &&
        item.y === y &&
        itemMatchesMechanismRequirement(item, requiredName),
    );
}

export function isWallSensorConsumedAtRuntime<TState extends Pick<StoreSensorState<unknown, unknown, unknown>, 'firedSensors'>>(
    level: number,
    sensor: SensorObject,
    state: TState,
): boolean {
    const sensorKey = getSensorStateKeySystem(level, sensor.index);
    return state.firedSensors.has(sensorKey) && (sensor.onceOnly || sensor.type === 17);
}

export function createStoreSensorRuntime<
    TState extends StoreSensorState<TProjectile, TCreature, TPendingGeneratorSpawn>,
    TProjectile,
    TCreature extends CreaturePositionLike,
    TPendingGeneratorSpawn extends PendingGeneratorSpawnLike,
    TPendingSensorEvent extends PendingSensorEventLike,
>(
    params: StoreSensorRuntimeParams<TState, TProjectile, TCreature, TPendingGeneratorSpawn>,
) {
    const getTile = (level: number, x: number, y: number) => params.mapResolver(level).tiles[y]?.[x];

    const getSensorStateKey = (level: number, sensorIndex: number) =>
        getSensorStateKeySystem(level, sensorIndex);

    const buildSensorStateSnapshot = (
        source: SensorSnapshotSource<TProjectile, TCreature, TPendingGeneratorSpawn>,
    ): TState => buildSensorStateSnapshotSystem(source) as unknown as TState;

    const resolveDoorSoundTarget = (sensor: SensorObject, level: number) =>
        resolveDoorSoundTargetSystem(sensor, level, params.mapResolver);

    const getSelfRevealingWallSensor = (tile: GameTile | undefined) =>
        getSelfRevealingWallSensorSystem(tile, params.isWallRevealableObject);

    const findSensorByIndex = (level: number, sensorIndex: number) =>
        findSensorByIndexSystem(level, sensorIndex, params.mapResolver);

    const buildWallLauncherProjectiles = (
        level: number,
        wallX: number,
        wallY: number,
        sensor: SensorObject,
        now: number,
    ): TProjectile[] => buildWallLauncherProjectilesSystem(
        level,
        wallX,
        wallY,
        sensor,
        now,
        params.mapResolver,
        params.resolveWeaponProjectile,
    ) as TProjectile[];

    const readWallSensorRuntimeData = (level: number, sensor: SensorObject, state: TState) =>
        readWallSensorRuntimeDataSystem(level, sensor, state.sensorRuntimeData);

    const writeWallSensorRuntimeData = (
        level: number,
        sensor: SensorObject,
        state: TState,
        nextValue: number,
    ) => writeWallSensorRuntimeDataSystem(level, sensor, state.sensorRuntimeData, nextValue);

    const triggerGeneratorSensor = (
        level: number,
        sensor: SensorObject,
        state: TState,
    ): TState => triggerGeneratorSensorSystem(level, sensor, state, {
        getGeneratorConfig: params.getGeneratorConfig,
        getSpawnTile: getTile,
        getSensorStateKey,
        randomInt: params.randomInt,
        canReserveGeneratorGroup: params.canReserveGeneratorGroup,
        buildPendingGeneratorSpawnEvent: params.buildPendingGeneratorSpawnEvent,
        queuePendingGeneratorSpawnEvent: params.queuePendingGeneratorSpawnEvent,
        retrySeconds: params.retrySeconds,
        createGeneratedCreatureGroupInstances: params.createGeneratedCreatureGroupInstances,
    });

    const rotateWallFaceSensors = (
        level: number,
        x: number,
        y: number,
        face: CardinalDir,
        rotationOffsets: Record<string, number>,
    ) => rotateWallFaceSensorsSystem(level, x, y, face, rotationOffsets, params.mapResolver);

    const getWallFaceSensorsInRuntimeOrder = (
        level: number,
        x: number,
        y: number,
        face: CardinalDir,
        rotationOffsets: Record<string, number>,
    ) => getWallFaceSensorsInRuntimeOrderSystem(level, x, y, face, rotationOffsets, params.mapResolver);

    const shouldRotateWallFaceAfterActivation = (
        level: number,
        x: number,
        y: number,
        face: CardinalDir,
        rotationOffsets: Record<string, number>,
    ) => shouldRotateWallFaceAfterActivationSystem(level, x, y, face, rotationOffsets, params.mapResolver);

    const revealSelfWallMountedItems = (
        floorItems: FloorItem[],
        level: number,
        x: number,
        y: number,
        face: CardinalDir,
    ) => revealSelfWallMountedItemsSystem(floorItems, level, x, y, face);

    const diffSensorState = (before: TState, after: TState) => {
        const patch = diffStoreSensorState(before, after);
        const beforePending = (before as TState & { pendingSensorEvents?: TPendingSensorEvent[] }).pendingSensorEvents;
        const afterPending = (after as TState & { pendingSensorEvents?: TPendingSensorEvent[] }).pendingSensorEvents;
        if (afterPending !== beforePending) {
            return {
                ...patch,
                pendingSensorEvents: afterPending,
            } as unknown as Partial<TState>;
        }
        return patch;
    };

    const dispatchTriggeredSensorEffect = (
        sensor: SensorObject,
        level: number,
        state: TState,
        options?: {
            actionOverride?: SensorAction;
            updateSourceActive?: boolean;
            ignoreTriggeredDelay?: boolean;
        },
    ): Partial<TState> => dispatchTriggeredSensorEffectSystem(sensor, level, state, {
        getTile,
        applyToSet: applySensorActionToSet,
        diffSensorState,
        getSensorStateKey,
        wallLauncherSensorTypes: WALL_LAUNCHER_SENSOR_TYPES,
        findSensorPlacement: (sensorLevel, sensorIndex) =>
            findSensorPlacementSystem(sensorLevel, sensorIndex, params.mapResolver),
        buildWallLauncherProjectiles,
        now: params.now ?? Date.now,
        triggerGeneratorSensor,
        isGeneratorSensor: params.isGeneratorSensor,
        queueDelayedTriggeredSensorEffect: (sensor, sensorLevel, state, actionOverride) => {
            const currentPending = (state as TState & { pendingSensorEvents?: TPendingSensorEvent[] }).pendingSensorEvents ?? [];
            const alreadyQueued = currentPending.some((event) =>
                event.level === sensorLevel &&
                event.sensorIndex === sensor.index &&
                event.actionOverride === actionOverride,
            );
            if (alreadyQueued) return null;
            return {
                pendingSensorEvents: [
                    ...currentPending,
                    {
                        level: sensorLevel,
                        sensorIndex: sensor.index,
                        remaining: params.originalTimerTicksToSeconds(sensor.delay),
                        actionOverride,
                    } as unknown as TPendingSensorEvent,
                ],
            } as unknown as Partial<TState>;
        },
        readWallSensorRuntimeData,
        writeWallSensorRuntimeData,
        hasWallFaceLocalRotationEffect,
        rotateWallFaceSensors,
        wallSensorFaceMask: WALL_SENSOR_FACE_MASK,
    }, options);

    const computeSensorEffect = (
        sensor: SensorObject,
        level: number,
        state: TState,
    ): Partial<TState> => computeSensorEffectSystem(sensor, level, state, {
        getTile,
        dispatchTriggeredSensorEffect,
    });

    const queueOrComputeSensorEffect = (
        sensor: SensorObject,
        level: number,
        state: TState,
        pendingSensorEvents: TPendingSensorEvent[],
    ) => queueOrComputeSensorEffectSystem(sensor, level, state, pendingSensorEvents, {
        computeSensorEffect,
        originalTimerTicksToSeconds: params.originalTimerTicksToSeconds,
        getFiredSensors: (currentState) => currentState.firedSensors,
        setFiredSensors: (_currentState, firedSensors) => ({ firedSensors } as Partial<TState>),
        getSensorStateKey,
    });

    const partyHasRequiredItem = (
        requiredName: string | undefined,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
    ) => partyHasRequiredMechanismItem(
        requiredName,
        inventories,
        equipment,
        params.itemMatchesMechanismRequirement,
    );

    const tileHasRequiredFloorItem = (
        level: number,
        x: number,
        y: number,
        requiredName: string | undefined,
        floorItems: FloorItem[],
    ) => tileHasRequiredMechanismFloorItem(
        level,
        x,
        y,
        requiredName,
        floorItems,
        params.itemMatchesMechanismRequirement,
    );

    return {
        WALL_LAUNCHER_SENSOR_TYPES,
        PUSH_FACE_BY_DIRECTION,
        applyToSet: applySensorActionToSet,
        buildSensorStateSnapshot,
        buildWallLauncherProjectiles,
        computeSensorEffect,
        diffSensorState,
        dispatchTriggeredSensorEffect,
        findSensorByIndex,
        getSelfRevealingWallSensor,
        getSensorStateKey,
        getWallFaceSensorsInRuntimeOrder,
        isWallSensorConsumedAtRuntime,
        partyHasRequiredItem,
        queueOrComputeSensorEffect,
        readWallSensorRuntimeData,
        resolveDoorSoundTarget,
        revealSelfWallMountedItems,
        rotateWallFaceSensors,
        shouldRotateWallFaceAfterActivation,
        tileHasRequiredFloorItem,
        triggerGeneratorSensor,
        writeWallSensorRuntimeData,
    };
}

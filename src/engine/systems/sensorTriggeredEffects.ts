import type {
    CardinalDir,
    GameTile,
    SensorAction,
    SensorObject,
    WallTextObject,
} from '../../types/game';

type SensorPlacement = {
    x: number;
    y: number;
    tile: GameTile;
    sensor: SensorObject;
};

type SensorTriggeredState<TProjectile> = {
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
};

type SensorTriggeredDeps<TState extends SensorTriggeredState<TProjectile>, TProjectile> = {
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    applyToSet: (set: Set<string>, key: string, action: SensorAction) => Set<string>;
    diffSensorState: (before: TState, after: TState) => Partial<TState>;
    getSensorStateKey: (level: number, sensorIndex: number) => string;
    wallLauncherSensorTypes: Set<number>;
    findSensorPlacement: (level: number, sensorIndex: number) => SensorPlacement | null;
    buildWallLauncherProjectiles: (
        level: number,
        x: number,
        y: number,
        sensor: SensorObject,
        nowMs: number,
    ) => TProjectile[];
    now: () => number;
    triggerGeneratorSensor: (level: number, sensor: SensorObject, state: TState) => TState;
    isGeneratorSensor: (sensor: SensorObject) => boolean;
    readWallSensorRuntimeData: (level: number, sensor: SensorObject, state: TState) => number;
    writeWallSensorRuntimeData: (
        level: number,
        sensor: SensorObject,
        state: TState,
        nextData: number,
    ) => TState['sensorRuntimeData'];
    hasWallFaceLocalRotationEffect: (sensor: SensorObject) => boolean;
    rotateWallFaceSensors: (
        level: number,
        x: number,
        y: number,
        face: CardinalDir,
        rotationOffsets: Record<string, number>,
    ) => Record<string, number>;
    wallSensorFaceMask: Record<CardinalDir, number>;
};

export function dispatchTriggeredSensorEffect<TState extends SensorTriggeredState<TProjectile>, TProjectile>(
    sensor: SensorObject,
    level: number,
    state: TState,
    deps: SensorTriggeredDeps<TState, TProjectile>,
    options?: { actionOverride?: SensorAction; updateSourceActive?: boolean },
): Partial<TState> {
    const applyDirectSensorTargetAction = (
        directSensor: SensorObject,
        directLevel: number,
        current: TState,
        action: SensorAction,
    ): Partial<TState> => {
        const targetTile = deps.getTile(directLevel, directSensor.targetX, directSensor.targetY);
        if (!targetTile) return {};
        const targetKey = `${directLevel},${directSensor.targetY},${directSensor.targetX}`;

        if (targetTile.type === 'Door') {
            return { openDoors: deps.applyToSet(current.openDoors, targetKey, action) } as Partial<TState>;
        }
        if (targetTile.type === 'Pit') {
            return { openPits: deps.applyToSet(current.openPits, targetKey, action) } as Partial<TState>;
        }
        if (targetTile.type === 'TrickWall') {
            return { openWalls: deps.applyToSet(current.openWalls, targetKey, action) } as Partial<TState>;
        }
        if (targetTile.type === 'Teleporter') {
            return { openTeleporters: deps.applyToSet(current.openTeleporters, targetKey, action) } as Partial<TState>;
        }

        const textObj = targetTile.objects.find(
            (obj) => obj.category === 'Text' && (obj as WallTextObject).tilePos === directSensor.targetDir,
        ) as WallTextObject | undefined;
        if (!textObj) return {};

        const visibleKey = `${directLevel}_${directSensor.targetX}_${directSensor.targetY}_${textObj.index}`;
        return { visibleTexts: deps.applyToSet(current.visibleTexts, visibleKey, action) } as Partial<TState>;
    };

    const processFloorSquareEvent = (
        sourceSensor: SensorObject,
        sourceLevel: number,
        current: TState,
        sourceAction: SensorAction,
    ): Partial<TState> => {
        const targetTile = deps.getTile(sourceLevel, sourceSensor.targetX, sourceSensor.targetY);
        if (!targetTile || targetTile.type !== 'Floor') return {};

        let nextState = current;
        let changed = false;

        for (const obj of targetTile.objects) {
            if (obj.category !== 'Sensor') continue;
            const targetSensor = obj as SensorObject;
            if (!deps.isGeneratorSensor(targetSensor)) continue;
            if (sourceAction === 'Clear') continue;
            const maybeNext = deps.triggerGeneratorSensor(sourceLevel, targetSensor, nextState);
            if (maybeNext === nextState) continue;
            nextState = maybeNext;
            changed = true;
        }

        return changed ? deps.diffSensorState(current, nextState) : {};
    };

    const processWallSquareEvent = (
        sourceSensor: SensorObject,
        sourceLevel: number,
        current: TState,
        sourceAction: SensorAction,
    ): Partial<TState> => {
        const targetTile = deps.getTile(sourceLevel, sourceSensor.targetX, sourceSensor.targetY);
        if (!targetTile || (targetTile.type !== 'Wall' && targetTile.type !== 'TrickWall')) {
            return {};
        }

        const faceMask = deps.wallSensorFaceMask[sourceSensor.targetDir];
        if (!faceMask) return {};

        let nextState = current;
        let changed = false;
        let pendingLocalRotationFace: CardinalDir | null = null;

        for (const obj of targetTile.objects) {
            if (obj.category !== 'Sensor') continue;
            const targetSensor = obj as SensorObject;
            // Type 5 gate sensors live on the destination wall square and aggregate face bits
            // from remote wall clicks. Their physical facing on that wall does not have to match
            // the source sensor's targetDir, so they must still receive the wall-square event.
            if (targetSensor.type !== 5 && targetSensor.tilePos !== sourceSensor.targetDir) continue;

            if (deps.wallLauncherSensorTypes.has(targetSensor.type)) {
                const targetSensorKey = deps.getSensorStateKey(sourceLevel, targetSensor.index);
                if (targetSensor.onceOnly && nextState.firedSensors.has(targetSensorKey)) continue;

                let launcherState = nextState;
                if (targetSensor.onceOnly) {
                    launcherState = {
                        ...launcherState,
                        firedSensors: new Set([...launcherState.firedSensors, targetSensorKey]),
                    };
                }

                const launchedProjectiles = deps.buildWallLauncherProjectiles(
                    sourceLevel,
                    sourceSensor.targetX,
                    sourceSensor.targetY,
                    targetSensor,
                    deps.now(),
                );
                if (launchedProjectiles.length > 0) {
                    launcherState = {
                        ...launcherState,
                        projectiles: [...launcherState.projectiles, ...launchedProjectiles],
                    };
                }

                if (launcherState !== nextState) {
                    nextState = launcherState;
                    changed = true;
                }
                continue;
            }

            if (targetSensor.type === 5) {
                const currentData = deps.readWallSensorRuntimeData(sourceLevel, targetSensor, nextState);
                let nextData = currentData;
                if (sourceAction === 'Set') nextData = currentData | faceMask;
                else if (sourceAction === 'Clear') nextData = currentData & ~faceMask;
                else if (sourceAction === 'Toggle') nextData = currentData ^ faceMask;

                const nextRuntimeData = deps.writeWallSensorRuntimeData(sourceLevel, targetSensor, nextState, nextData);
                if (nextRuntimeData !== nextState.sensorRuntimeData) {
                    nextState = { ...nextState, sensorRuntimeData: nextRuntimeData };
                    changed = true;
                }

                const mask1 = nextData & 0x000f;
                const mask2 = (nextData & 0x00f0) >> 4;
                const conditionMet = (mask1 === mask2) !== targetSensor.revert;
                const effectiveAction = targetSensor.action === 'Hold'
                    ? (conditionMet ? 'Set' : 'Clear')
                    : (conditionMet ? targetSensor.action : null);
                if (!effectiveAction) continue;

                const gateEffect = dispatchTriggeredSensorEffect(
                    targetSensor,
                    sourceLevel,
                    nextState,
                    deps,
                    { actionOverride: effectiveAction },
                );
                if (Object.keys(gateEffect).length > 0) {
                    nextState = { ...nextState, ...gateEffect } as TState;
                    changed = true;
                }
                if (deps.hasWallFaceLocalRotationEffect(targetSensor)) {
                    pendingLocalRotationFace = targetSensor.tilePos;
                }
                continue;
            }

            if (targetSensor.type === 6) {
                const currentData = deps.readWallSensorRuntimeData(sourceLevel, targetSensor, nextState);
                const nextData = sourceAction === 'Set'
                    ? Math.min(511, currentData + 1)
                    : Math.max(0, currentData - 1);

                const nextRuntimeData = deps.writeWallSensorRuntimeData(sourceLevel, targetSensor, nextState, nextData);
                if (nextRuntimeData !== nextState.sensorRuntimeData) {
                    nextState = { ...nextState, sensorRuntimeData: nextRuntimeData };
                    changed = true;
                }

                const effectiveAction = targetSensor.action === 'Hold'
                    ? ((((nextData === 0) ? 1 : 0) !== (targetSensor.revert ? 1 : 0)) ? 'Set' : 'Clear')
                    : (nextData === 0 ? targetSensor.action : null);
                if (!effectiveAction) continue;

                const countdownEffect = dispatchTriggeredSensorEffect(
                    targetSensor,
                    sourceLevel,
                    nextState,
                    deps,
                    { actionOverride: effectiveAction },
                );
                if (Object.keys(countdownEffect).length > 0) {
                    nextState = { ...nextState, ...countdownEffect } as TState;
                    changed = true;
                }
                if (deps.hasWallFaceLocalRotationEffect(targetSensor)) {
                    pendingLocalRotationFace = targetSensor.tilePos;
                }
            }
        }

        if (pendingLocalRotationFace) {
            const nextRotationOffsets = deps.rotateWallFaceSensors(
                sourceLevel,
                sourceSensor.targetX,
                sourceSensor.targetY,
                pendingLocalRotationFace,
                nextState.sensorRotationOffsets,
            );
            if (nextRotationOffsets !== nextState.sensorRotationOffsets) {
                nextState = { ...nextState, sensorRotationOffsets: nextRotationOffsets };
                changed = true;
            }
        }

        return changed ? deps.diffSensorState(current, nextState) : {};
    };

    const action = options?.actionOverride ?? sensor.action;
    if (action === 'Hold') return {};

    const sensorKey = deps.getSensorStateKey(level, sensor.index);
    if (sensor.onceOnly && state.firedSensors.has(sensorKey)) return {};

    let current: TState = sensor.onceOnly
        ? { ...state, firedSensors: new Set([...state.firedSensors, sensorKey]) }
        : state;

    if (options?.updateSourceActive) {
        const nextActive = deps.applyToSet(current.activeSensors, sensorKey, action);
        if (nextActive !== current.activeSensors) {
            current = { ...current, activeSensors: nextActive };
        }
    }

    if (sensor.isLocal) {
        if (deps.wallLauncherSensorTypes.has(sensor.type)) {
            const placement = deps.findSensorPlacement(level, sensor.index);
            if (placement && (placement.tile.type === 'Wall' || placement.tile.type === 'TrickWall')) {
                const launchedProjectiles = deps.buildWallLauncherProjectiles(
                    level,
                    placement.x,
                    placement.y,
                    sensor,
                    deps.now(),
                );
                if (launchedProjectiles.length > 0) {
                    current = {
                        ...current,
                        projectiles: [...current.projectiles, ...launchedProjectiles],
                    };
                }
            }
        }
        return deps.diffSensorState(state, current);
    }

    const targetTile = deps.getTile(level, sensor.targetX, sensor.targetY);
    if (!targetTile) return deps.diffSensorState(state, current);

    let targetPatch: Partial<TState>;
    if (targetTile.type === 'Wall' || targetTile.type === 'TrickWall') {
        targetPatch = processWallSquareEvent(sensor, level, current, action);
    } else if (targetTile.type === 'Floor') {
        targetPatch = processFloorSquareEvent(sensor, level, current, action);
    } else {
        targetPatch = applyDirectSensorTargetAction(sensor, level, current, action);
    }

    return deps.diffSensorState(state, { ...current, ...targetPatch } as TState);
}

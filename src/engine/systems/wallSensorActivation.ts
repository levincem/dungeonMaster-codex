import type { CardinalDir, FloorItem, GameTile, SensorAction, SensorObject } from '../../types/game';

type SensorStateLike = {
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    openDoors: Set<string>;
    openWalls: Set<string>;
    sensorRotationOffsets: Record<string, number>;
};

type PendingSensorChanges<TSensorState, TPendingSensorEvent> = {
    sensorChanges: Partial<TSensorState>;
    pendingSensorEvents: TPendingSensorEvent[];
};

type WallSensorActivationState<TPendingSensorEvent> = {
    pendingSensorEvents: TPendingSensorEvent[];
    floorItems: FloorItem[];
};

type DoorSoundTarget = { level: number; x: number; y: number } | null;

type WallSensorActivationPatch<TSensorState, TPendingSensorEvent> =
    Partial<TSensorState> & {
        pendingSensorEvents?: TPendingSensorEvent[];
        floorItems?: FloorItem[];
    };

type WallSensorActivationDeps<
    TState extends WallSensorActivationState<TPendingSensorEvent>,
    TSensorState extends SensorStateLike,
    TPendingSensorEvent,
    TAppliedPatch,
> = {
    getTile: (mapIndex: number, x: number, y: number) => GameTile | undefined;
    buildSensorStateSnapshot: (state: TState) => TSensorState;
    getWallFaceSensorsInRuntimeOrder: (
        mapIndex: number,
        x: number,
        y: number,
        face: CardinalDir,
        rotationOffsets: Record<string, number>,
    ) => SensorObject[];
    wallLauncherSensorTypes: Set<number>;
    applyToSet: (set: Set<string>, key: string, action: SensorAction) => Set<string>;
    getSelfRevealingWallSensor: (tile: GameTile | undefined) => SensorObject | null;
    queueOrComputeSensorEffect: (
        sensor: SensorObject,
        mapIndex: number,
        ss: TSensorState,
        pendingSensorEvents: TPendingSensorEvent[],
    ) => PendingSensorChanges<TSensorState, TPendingSensorEvent>;
    resolveDoorSoundTarget: (sensor: SensorObject, level: number) => DoorSoundTarget;
    playDoorMotion: (target: DoorSoundTarget) => void;
    playPlate: () => void;
    shouldRotateWallFaceAfterActivation: (
        mapIndex: number,
        x: number,
        y: number,
        face: CardinalDir,
        rotationOffsets: Record<string, number>,
    ) => boolean;
    rotateWallFaceSensors: (
        mapIndex: number,
        x: number,
        y: number,
        face: CardinalDir,
        rotationOffsets: Record<string, number>,
    ) => Record<string, number>;
    diffSensorState: (before: TSensorState, after: TSensorState) => Partial<TSensorState>;
    revealSelfWallMountedItems: (
        floorItems: FloorItem[],
        mapIndex: number,
        x: number,
        y: number,
        face: CardinalDir,
    ) => FloorItem[];
    applyImmediateTransportSquareEffects: (
        state: TState,
        patch: WallSensorActivationPatch<TSensorState, TPendingSensorEvent>,
    ) => TAppliedPatch;
};

export function activateWallSensor<
    TState extends WallSensorActivationState<TPendingSensorEvent>,
    TSensorState extends SensorStateLike,
    TPendingSensorEvent,
    TAppliedPatch,
>(
    state: TState,
    mapIndex: number,
    x: number,
    y: number,
    sensorIndex: number,
    deps: WallSensorActivationDeps<TState, TSensorState, TPendingSensorEvent, TAppliedPatch>,
): TAppliedPatch | TState {
    const tile = deps.getTile(mapIndex, x, y);
    if (!tile) return state;

    const sensor = tile.objects.find(
        (entry): entry is SensorObject => entry.category === 'Sensor' && entry.index === sensorIndex,
    );
    if (!sensor) return state;

    const ss = deps.buildSensorStateSnapshot(state);
    const face = sensor.tilePos;
    const clickableSensors = deps.getWallFaceSensorsInRuntimeOrder(mapIndex, x, y, face, ss.sensorRotationOffsets)
        .filter((entry) =>
            entry.type === 1 ||
            entry.type === 2 ||
            (entry.isLocal && deps.wallLauncherSensorTypes.has(entry.type)),
        );

    let cur = ss;
    let nextPending = state.pendingSensorEvents;
    let revealedThisTick = false;

    for (const faceSensor of clickableSensors) {
        if (faceSensor.type === 2 && !faceSensor.revert) continue;

        const effectiveClickAction: SensorAction = faceSensor.action === 'Hold' ? 'Set' : faceSensor.action;
        const effectiveFaceSensor = faceSensor.action === 'Hold'
            ? { ...faceSensor, action: effectiveClickAction }
            : faceSensor;
        const sensorKey = `${mapIndex}_${faceSensor.index}`;
        const withVisualState = {
            ...cur,
            activeSensors: deps.applyToSet(cur.activeSensors, sensorKey, effectiveClickAction),
        } as TSensorState;

        const isSelfRevealingWall =
            faceSensor.targetX === 0 &&
            faceSensor.targetY === 0 &&
            deps.getSelfRevealingWallSensor(tile)?.index === faceSensor.index;

        const queued = isSelfRevealingWall
            ? {
                sensorChanges: {
                    openWalls: deps.applyToSet(withVisualState.openWalls, `${mapIndex},${y},${x}`, effectiveClickAction),
                    firedSensors: faceSensor.onceOnly && !withVisualState.firedSensors.has(sensorKey)
                        ? new Set([...withVisualState.firedSensors, sensorKey])
                        : withVisualState.firedSensors,
                } as Partial<TSensorState>,
                pendingSensorEvents: nextPending,
            }
            : deps.queueOrComputeSensorEffect(effectiveFaceSensor, mapIndex, withVisualState, nextPending);

        const { activeSensors: _ignoredQueuedActiveSensors, ...queuedSensorChanges } =
            queued.sensorChanges as Partial<TSensorState>;
        const nextState = { ...withVisualState, ...queuedSensorChanges } as TSensorState;

        if ((faceSensor.sound || faceSensor.type === 1 || faceSensor.type === 2) && Object.keys(queuedSensorChanges).length > 0) {
            deps.playPlate();
        }

        if (queuedSensorChanges.openDoors && queuedSensorChanges.openDoors !== cur.openDoors) {
            deps.playDoorMotion(deps.resolveDoorSoundTarget(faceSensor, mapIndex));
        }

        if (isSelfRevealingWall && !cur.openWalls.has(`${mapIndex},${y},${x}`) && nextState.openWalls.has(`${mapIndex},${y},${x}`)) {
            revealedThisTick = true;
        }

        cur = nextState;
        nextPending = queued.pendingSensorEvents;
    }

    if (clickableSensors.length > 0 && deps.shouldRotateWallFaceAfterActivation(mapIndex, x, y, face, cur.sensorRotationOffsets)) {
        cur = {
            ...cur,
            sensorRotationOffsets: deps.rotateWallFaceSensors(mapIndex, x, y, face, cur.sensorRotationOffsets),
        } as TSensorState;
    }

    const patch = deps.diffSensorState(ss, cur);
    const pendingChanged = nextPending !== state.pendingSensorEvents;
    const nextFloorItems = revealedThisTick
        ? deps.revealSelfWallMountedItems(state.floorItems, mapIndex, x, y, face)
        : state.floorItems;

    return deps.applyImmediateTransportSquareEffects(state, {
        ...patch,
        ...(pendingChanged ? { pendingSensorEvents: nextPending } : {}),
        ...(nextFloorItems !== state.floorItems ? { floorItems: nextFloorItems } : {}),
    });
}

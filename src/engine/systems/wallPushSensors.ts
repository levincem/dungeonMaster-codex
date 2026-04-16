import type { SensorObject } from '../../types/game';

type PendingSensorEventLike = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type SensorStateLike = {
    openDoors: Set<string>;
};

type PendingSensorChangeResult<TSensorState, TPendingSensorEvent> = {
    sensorChanges: Partial<TSensorState>;
    pendingSensorEvents: TPendingSensorEvent[];
};

type WallPushDeps<TSensorState extends SensorStateLike, TPendingSensorEvent extends PendingSensorEventLike> = {
    getTile: (level: number, x: number, y: number) => { type: string; objects: unknown[] } | undefined;
    asSensor: (obj: unknown) => SensorObject | null;
    resolvePushFace: (direction: string) => SensorObject['tilePos'];
    isWallLockSensor: (sensor: SensorObject) => boolean;
    queueOrComputeSensorEffect: (
        sensor: SensorObject,
        level: number,
        ss: TSensorState,
        pendingSensorEvents: TPendingSensorEvent[],
    ) => PendingSensorChangeResult<TSensorState, TPendingSensorEvent>;
    resolveDoorSoundTarget: (sensor: SensorObject, level: number) => { level: number; x: number; y: number } | null;
    playDoorMotion: (target: { level: number; x: number; y: number } | null) => void;
    diffSensorState: (before: TSensorState, after: TSensorState) => Partial<TSensorState>;
};

export function triggerWallPushSensors<
    TSensorState extends SensorStateLike,
    TPendingSensorEvent extends PendingSensorEventLike,
>(
    level: number,
    wx: number,
    wy: number,
    direction: string,
    ss: TSensorState,
    pendingSensorEvents: TPendingSensorEvent[],
    deps: WallPushDeps<TSensorState, TPendingSensorEvent>,
): PendingSensorChangeResult<TSensorState, TPendingSensorEvent> {
    const tile = deps.getTile(level, wx, wy);
    if (!tile || (tile.type !== 'Wall' && tile.type !== 'TrickWall')) {
        return { sensorChanges: {}, pendingSensorEvents };
    }

    const face = deps.resolvePushFace(direction);
    let cur = ss;
    let changed = false;
    let nextPending = pendingSensorEvents;

    for (const obj of tile.objects) {
        const sensor = deps.asSensor(obj);
        if (!sensor || sensor.tilePos !== face) continue;
        if (sensor.type === 1 || sensor.type === 2 || sensor.type === 5 || sensor.type === 127 || deps.isWallLockSensor(sensor)) {
            continue;
        }

        const queued = deps.queueOrComputeSensorEffect(sensor, level, cur, nextPending);
        nextPending = queued.pendingSensorEvents;

        if (Object.keys(queued.sensorChanges).length > 0) {
            if (queued.sensorChanges.openDoors && queued.sensorChanges.openDoors !== cur.openDoors) {
                deps.playDoorMotion(deps.resolveDoorSoundTarget(sensor, level));
            }
            cur = { ...cur, ...queued.sensorChanges } as TSensorState;
            changed = true;
        }
    }

    return {
        sensorChanges: changed ? deps.diffSensorState(ss, cur) : {},
        pendingSensorEvents: nextPending,
    };
}

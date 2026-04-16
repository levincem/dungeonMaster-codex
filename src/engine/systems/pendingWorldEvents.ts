import type { SensorObject } from '../../types/game';

type DoorSoundTarget = { level: number; x: number; y: number } | null;

type PendingSensorEventLike = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type PendingGeneratorSpawnEventLike = {
    spawnLevel: number;
    spawnX: number;
    spawnY: number;
    typeId: number;
    hpMultiplier: number;
    creatureCount: number;
    groupId: string;
    remaining: number;
};

type PendingSensorStateLike<TCreature> = {
    openDoors: Set<string>;
    creatures: TCreature[];
};

type PendingSensorDeps<TSensorState extends PendingSensorStateLike<TCreature>, TCreature> = {
    findSensorByIndex: (level: number, sensorIndex: number) => SensorObject | null;
    computeSensorEffect: (sensor: SensorObject, level: number, ss: TSensorState) => Partial<TSensorState>;
    resolveDoorSoundTarget: (sensor: SensorObject, level: number) => DoorSoundTarget;
    playDoorMotion: (target: DoorSoundTarget) => void;
    playPlate: () => void;
    diffSensorState: (before: TSensorState, after: TSensorState) => Partial<TSensorState>;
};

type PendingGeneratorDeps<TSensorState extends PendingSensorStateLike<TCreature>, TCreature> = {
    hasApproximateOriginalGeneratorCapacity: (ss: TSensorState, spawnLevel: number) => boolean;
    isGeneratorSpawnBlocked: (ss: TSensorState, spawnLevel: number, spawnX: number, spawnY: number) => boolean;
    createGeneratedCreatureGroupInstances: (
        spawnLevel: number,
        spawnX: number,
        spawnY: number,
        typeId: number,
        hpMultiplier: number,
        creatureCount: number,
        groupId: string,
    ) => TCreature[];
    retrySeconds: number;
    diffSensorState: (before: TSensorState, after: TSensorState) => Partial<TSensorState>;
};

export function processPendingSensorEvents<
    TSensorState extends PendingSensorStateLike<TCreature>,
    TPendingSensorEvent extends PendingSensorEventLike,
    TCreature,
>(
    delta: number,
    pendingSensorEvents: TPendingSensorEvent[],
    ss: TSensorState,
    deps: PendingSensorDeps<TSensorState, TCreature>,
): {
    sensorChanges: Partial<TSensorState>;
    pendingSensorEvents: TPendingSensorEvent[];
} {
    let cur = ss;
    const remainingEvents: TPendingSensorEvent[] = [];
    let changed = false;

    for (const event of pendingSensorEvents) {
        const remaining = event.remaining - delta;
        if (remaining > 0) {
            remainingEvents.push({ ...event, remaining });
            continue;
        }

        const sensor = deps.findSensorByIndex(event.level, event.sensorIndex);
        if (!sensor) continue;

        const effect = deps.computeSensorEffect(sensor, event.level, cur);
        if (Object.keys(effect).length <= 0) continue;

        if (effect.openDoors && effect.openDoors !== cur.openDoors) {
            deps.playDoorMotion(deps.resolveDoorSoundTarget(sensor, event.level));
        }

        cur = { ...cur, ...effect } as TSensorState;
        changed = true;

        if (sensor.sound || sensor.type === 6) {
            deps.playPlate();
        }
    }

    return {
        sensorChanges: changed ? deps.diffSensorState(ss, cur) : {},
        pendingSensorEvents: remainingEvents,
    };
}

export function processPendingGeneratorSpawns<
    TSensorState extends PendingSensorStateLike<TCreature>,
    TPendingGeneratorSpawnEvent extends PendingGeneratorSpawnEventLike,
    TCreature,
>(
    delta: number,
    pendingGeneratorSpawns: TPendingGeneratorSpawnEvent[],
    ss: TSensorState,
    deps: PendingGeneratorDeps<TSensorState, TCreature>,
): {
    sensorChanges: Partial<TSensorState>;
    pendingGeneratorSpawns: TPendingGeneratorSpawnEvent[];
} {
    let cur = ss;
    const remainingEvents: TPendingGeneratorSpawnEvent[] = [];
    let changed = false;

    for (const event of pendingGeneratorSpawns) {
        const remaining = event.remaining - delta;
        if (remaining > 0) {
            remainingEvents.push({ ...event, remaining });
            continue;
        }

        if (!deps.hasApproximateOriginalGeneratorCapacity(cur, event.spawnLevel)) {
            remainingEvents.push({ ...event, remaining: deps.retrySeconds });
            continue;
        }

        if (deps.isGeneratorSpawnBlocked(cur, event.spawnLevel, event.spawnX, event.spawnY)) {
            remainingEvents.push({ ...event, remaining: deps.retrySeconds });
            continue;
        }

        const generatedCreatures = deps.createGeneratedCreatureGroupInstances(
            event.spawnLevel,
            event.spawnX,
            event.spawnY,
            event.typeId,
            event.hpMultiplier,
            event.creatureCount,
            event.groupId,
        );
        if (generatedCreatures.length <= 0) continue;

        cur = {
            ...cur,
            creatures: [...cur.creatures, ...generatedCreatures],
        };
        changed = true;
    }

    return {
        sensorChanges: changed ? deps.diffSensorState(ss, cur) : {},
        pendingGeneratorSpawns: remainingEvents,
    };
}

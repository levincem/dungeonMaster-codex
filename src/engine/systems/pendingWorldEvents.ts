import type { SensorObject } from '../../types/game';

import type { SensorAction } from '../../types/game';

type DoorSoundTarget = { level: number; x: number; y: number } | null;

type PendingSensorEventLike = {
    level: number;
    sensorIndex: number;
    remaining: number;
    actionOverride?: SensorAction;
};

export type PendingGeneratorSpawnEventLike = {
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

export function queuePendingGeneratorSpawnEvent<
    TPendingGeneratorSpawnEvent extends PendingGeneratorSpawnEventLike,
>(
    pendingGeneratorSpawns: TPendingGeneratorSpawnEvent[],
    event: Omit<TPendingGeneratorSpawnEvent, 'remaining'>,
    remaining: number,
): TPendingGeneratorSpawnEvent[] {
    const alreadyQueued = pendingGeneratorSpawns.some((pending) =>
        pending.groupId === event.groupId,
    );
    if (alreadyQueued) return pendingGeneratorSpawns;
    return [
        ...pendingGeneratorSpawns,
        { ...event, remaining } as TPendingGeneratorSpawnEvent,
    ];
}

export type PendingSensorStateLike<TCreature> = {
    openDoors: Set<string>;
    creatures: TCreature[];
};

type PendingSensorDeps<TSensorState extends PendingSensorStateLike<TCreature>, TCreature> = {
    findSensorByIndex: (level: number, sensorIndex: number) => SensorObject | null;
    computeSensorEffect: (sensor: SensorObject, level: number, ss: TSensorState) => Partial<TSensorState>;
    dispatchTriggeredSensorEffect: (
        sensor: SensorObject,
        level: number,
        ss: TSensorState,
        options?: { actionOverride?: SensorAction; ignoreTriggeredDelay?: boolean },
    ) => Partial<TSensorState>;
    resolveDoorSoundTarget: (sensor: SensorObject, level: number) => DoorSoundTarget;
    playDoorMotion: (target: DoorSoundTarget) => void;
    playPlate: () => void;
    diffSensorState: (before: TSensorState, after: TSensorState) => Partial<TSensorState>;
};

export type PendingGeneratorDeps<
    TSensorState extends PendingSensorStateLike<TCreature>,
    TPendingGeneratorSpawnEvent extends PendingGeneratorSpawnEventLike,
    TCreature,
> = {
    canMaterializeReservedGeneratorSpawn: (ss: TSensorState, spawnLevel: number) => boolean;
    isGeneratorSpawnBlocked: (ss: TSensorState, spawnLevel: number, spawnX: number, spawnY: number) => boolean;
    materializePendingGeneratorSpawnEvent: (
        event: TPendingGeneratorSpawnEvent,
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
    let remainingEvents: TPendingSensorEvent[] = [];
    let changed = false;

    for (const event of pendingSensorEvents) {
        const remaining = event.remaining - delta;
        if (remaining > 0) {
            remainingEvents.push({ ...event, remaining });
            continue;
        }

        const sensor = deps.findSensorByIndex(event.level, event.sensorIndex);
        if (!sensor) continue;

        const effectState = {
            ...cur,
            pendingSensorEvents: remainingEvents,
        } as TSensorState;

        const effect = event.actionOverride
            ? deps.dispatchTriggeredSensorEffect(
                sensor,
                event.level,
                effectState,
                { actionOverride: event.actionOverride },
            )
            : deps.computeSensorEffect(sensor, event.level, effectState);
        if (Object.keys(effect).length <= 0) continue;

        if (effect.openDoors && effect.openDoors !== cur.openDoors) {
            deps.playDoorMotion(deps.resolveDoorSoundTarget(sensor, event.level));
        }

        cur = { ...cur, ...effect } as TSensorState;
        changed = true;
        const nestedPending = (effect as Partial<TSensorState> & { pendingSensorEvents?: TPendingSensorEvent[] }).pendingSensorEvents;
        remainingEvents = nestedPending ?? remainingEvents;

        // Delayed sensor resolution should not replay the source plate click.
        // The tactile "plate" sound belongs to the moment the trigger is pressed,
        // not to the later deferred effect resolving elsewhere in the dungeon.
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
    deps: PendingGeneratorDeps<TSensorState, TPendingGeneratorSpawnEvent, TCreature>,
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

        if (!deps.canMaterializeReservedGeneratorSpawn(cur, event.spawnLevel)) {
            remainingEvents.push({ ...event, remaining: deps.retrySeconds });
            continue;
        }

        if (deps.isGeneratorSpawnBlocked(cur, event.spawnLevel, event.spawnX, event.spawnY)) {
            remainingEvents.push({ ...event, remaining: deps.retrySeconds });
            continue;
        }

        const generatedCreatures = deps.materializePendingGeneratorSpawnEvent(event);
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

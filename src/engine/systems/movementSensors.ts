import type { ChampionEquipment, FloorItem, SensorAction, SensorObject } from '../../types/game';
import { getTranslations } from '../../i18n';

const runtimeText = getTranslations().runtime;

type PendingSensorEventLike = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type SensorStateLike = {
    openDoors: Set<string>;
    currentDirection?: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    currentLevel?: number;
    currentPosition?: [number, number];
};

function getPartyDirectionOrdinal(direction: SensorStateLike['currentDirection']): number {
    switch (direction) {
        case 'NORTH': return 1;
        case 'EAST': return 2;
        case 'SOUTH': return 3;
        case 'WEST': return 4;
        default: return 1;
    }
}

type PendingSensorChangeResult<TSensorState, TPendingSensorEvent> = {
    sensorChanges: Partial<TSensorState>;
    pendingSensorEvents: TPendingSensorEvent[];
};

type MovementSensorDeps<TSensorState extends SensorStateLike, TPendingSensorEvent extends PendingSensorEventLike> = {
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
    ) => PendingSensorChangeResult<TSensorState, TPendingSensorEvent>;
    resolveDoorSoundTarget: (sensor: SensorObject, level: number) => { level: number; x: number; y: number } | null;
    playDoorMotion: (target: { level: number; x: number; y: number } | null) => void;
    playPlate: () => void;
    notifyPlateActivated: (level: number, x: number, y: number) => void;
    diffSensorState: (before: TSensorState, after: TSensorState) => Partial<TSensorState>;
};

function resolvePresenceSensorAction(
    sensor: Pick<SensorObject, 'action' | 'revert'>,
    mode: 'enter' | 'leave',
): SensorAction {
    if (mode === 'enter') {
        if (sensor.action === 'Hold') return sensor.revert ? 'Clear' : 'Set';
        if (!sensor.revert) return sensor.action;
        if (sensor.action === 'Set') return 'Clear';
        if (sensor.action === 'Clear') return 'Set';
        return sensor.action;
    }

    return sensor.revert ? 'Set' : 'Clear';
}

function applyQueuedSensorEffect<
    TSensorState extends SensorStateLike,
    TPendingSensorEvent extends PendingSensorEventLike,
>(
    cur: TSensorState,
    changed: boolean,
    nextPending: TPendingSensorEvent[],
    sensor: SensorObject,
    level: number,
    deps: Pick<MovementSensorDeps<TSensorState, TPendingSensorEvent>, 'queueOrComputeSensorEffect'>,
): {
    cur: TSensorState;
    changed: boolean;
    nextPending: TPendingSensorEvent[];
} {
    const queued: PendingSensorChangeResult<TSensorState, TPendingSensorEvent> =
        deps.queueOrComputeSensorEffect(sensor, level, cur, nextPending);
    const sensorChanges = queued.sensorChanges;
    if (Object.keys(sensorChanges).length === 0) {
        return {
            cur,
            changed,
            nextPending: queued.pendingSensorEvents,
        };
    }

    return {
        cur: { ...cur, ...sensorChanges } as TSensorState,
        changed: true,
        nextPending: queued.pendingSensorEvents,
    };
}

export function triggerFloorSensors<
    TSensorState extends SensorStateLike,
    TPendingSensorEvent extends PendingSensorEventLike,
>(
    level: number,
    x: number,
    y: number,
    ss: TSensorState,
    inventories: Record<number, FloorItem[]>,
    equipment: Record<number, ChampionEquipment>,
    floorItems: FloorItem[],
    pendingSensorEvents: TPendingSensorEvent[],
    deps: MovementSensorDeps<TSensorState, TPendingSensorEvent>,
    mode: 'enter' | 'leave' = 'enter',
    source: 'party' | 'item' | 'creature' = 'party',
    creatures: Array<{ mapIndex: number; x: number; y: number; alive?: boolean }> = [],
): PendingSensorChangeResult<TSensorState, TPendingSensorEvent> {
    const tile = deps.getTile(level, x, y);
    if (!tile) return { sensorChanges: {}, pendingSensorEvents };

    let cur = ss;
    let changed = false;
    let playedSound = false;
    let nextPending = pendingSensorEvents;
    const tileHasAnyFloorItem = floorItems.some((item) =>
        item.mapIndex === level && item.x === x && item.y === y,
    );
    const tileHasAnyCreature = creatures.some((creature) =>
        creature.mapIndex === level &&
        creature.x === x &&
        creature.y === y &&
        (creature.alive ?? true),
    );
    const tileHasParty =
        source !== 'party' &&
        ss.currentLevel === level &&
        ss.currentPosition?.[1] === x &&
        ss.currentPosition?.[0] === y;

    for (const obj of tile.objects) {
        const sensor = deps.asSensor(obj);
        if (!sensor || sensor.type === 127) continue;
        const isPartyFloorSensor = sensor.type === 3;
        const isSpecificObjectFloorSensor = deps.isSpecificObjectFloorSensor(sensor);
        const isGenericWeightFloorSensor = sensor.type === 1;
        const isCreatureOnlyFloorSensor = deps.isCreatureOnlyFloorSensor(sensor);
        const isObjectOnlyFloorSensor = isSpecificObjectFloorSensor && sensor.type === 4;

        if (source === 'item' && !isObjectOnlyFloorSensor && !isGenericWeightFloorSensor) continue;
        if (source === 'creature' && !isGenericWeightFloorSensor && !isCreatureOnlyFloorSensor) continue;

        // In the original SENSOR.C flow, floor "weight" sensors only trigger when a thing
        // is added to an otherwise empty square. If an item is already resting on the plate,
        // walking onto it must not fire the launcher again.
        if (mode === 'enter' && source === 'party' && isGenericWeightFloorSensor && (tileHasAnyFloorItem || tileHasAnyCreature)) {
            continue;
        }

        if (mode === 'leave') {
            if (sensor.action !== 'Hold' && !sensor.revert) continue;
            if (source === 'party' && isPartyFloorSensor) {
                const queued: {
                    cur: TSensorState;
                    changed: boolean;
                    nextPending: TPendingSensorEvent[];
                } = applyQueuedSensorEffect(
                    cur,
                    changed,
                    nextPending,
                    { ...sensor, action: resolvePresenceSensorAction(sensor, 'leave') },
                    level,
                    deps,
                );
                cur = queued.cur;
                changed = queued.changed;
                nextPending = queued.nextPending;
                continue;
            }
            if (isGenericWeightFloorSensor && (tileHasAnyFloorItem || tileHasAnyCreature || tileHasParty)) continue;
            if (source === 'creature' && isCreatureOnlyFloorSensor && tileHasAnyCreature) continue;
            if (isSpecificObjectFloorSensor) {
                const hasRequiredItem = deps.tileHasRequiredFloorItem(level, x, y, deps.getRequiredSensorItemName(sensor), floorItems);
                if (hasRequiredItem) continue;
            }
            if (source !== 'creature' && (isCreatureOnlyFloorSensor || deps.isGeneratorSensor(sensor) || isObjectOnlyFloorSensor)) continue;
            if (source === 'creature' && (isPartyFloorSensor || deps.isPartyPossessionSensor(sensor) || deps.isGeneratorSensor(sensor) || isObjectOnlyFloorSensor)) continue;
            const queued: {
                cur: TSensorState;
                changed: boolean;
                nextPending: TPendingSensorEvent[];
            } = applyQueuedSensorEffect(
                cur,
                changed,
                nextPending,
                { ...sensor, action: resolvePresenceSensorAction(sensor, 'leave') },
                level,
                deps,
            );
            cur = queued.cur;
            changed = queued.changed;
            nextPending = queued.nextPending;
            continue;
        }

        if (deps.isGeneratorSensor(sensor)) {
            const nextCur = deps.triggerGeneratorSensor(level, sensor, cur);
            if (nextCur !== cur) {
                cur = nextCur;
                changed = true;
                if (sensor.sound && !playedSound) {
                    deps.playPlate();
                    playedSound = true;
                }
            }
            continue;
        }

        if (source !== 'creature' && isCreatureOnlyFloorSensor) continue;
        if (isPartyFloorSensor) {
            const directionMatches =
                sensor.data === 0 ||
                sensor.data === getPartyDirectionOrdinal(cur.currentDirection);
            const shouldTrigger = sensor.revert ? !directionMatches : directionMatches;
            if (!shouldTrigger) continue;
        }
        if (deps.isPartyPossessionSensor(sensor)) {
            const hasRequiredItem = deps.partyHasRequiredItem(deps.getRequiredSensorItemName(sensor), inventories, equipment);
            const shouldTrigger = sensor.revert ? !hasRequiredItem : hasRequiredItem;
            if (!shouldTrigger) continue;
        }
        if (isSpecificObjectFloorSensor) {
            const hasRequiredItem = deps.tileHasRequiredFloorItem(level, x, y, deps.getRequiredSensorItemName(sensor), floorItems);
            const shouldTrigger = sensor.revert ? !hasRequiredItem : hasRequiredItem;
            if (isObjectOnlyFloorSensor && !shouldTrigger) continue;
        }

        const queued = deps.queueOrComputeSensorEffect(
            { ...sensor, action: resolvePresenceSensorAction(sensor, 'enter') },
            level,
            cur,
            nextPending,
        );
        nextPending = queued.pendingSensorEvents;

        if (Object.keys(queued.sensorChanges).length > 0) {
            if (queued.sensorChanges.openDoors && queued.sensorChanges.openDoors !== cur.openDoors) {
                deps.playDoorMotion(deps.resolveDoorSoundTarget(sensor, level));
            }
            cur = { ...cur, ...queued.sensorChanges } as TSensorState;
            changed = true;
            if (sensor.sound && !playedSound) {
                deps.playPlate();
                playedSound = true;
            }
        }
    }

    if (changed) deps.notifyPlateActivated(level, x, y);
    return {
        sensorChanges: changed ? deps.diffSensorState(ss, cur) : {},
        pendingSensorEvents: nextPending,
    };
}

export function transitionFloorSensors<
    TSensorState extends SensorStateLike,
    TPendingSensorEvent extends PendingSensorEventLike,
>(
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
    deps: MovementSensorDeps<TSensorState, TPendingSensorEvent>,
): PendingSensorChangeResult<TSensorState, TPendingSensorEvent> & { blockedMessage?: string } {
    let cur = ss;
    let changed = false;
    let nextPending = pendingSensorEvents;
    let blockedMessage: string | undefined;

    const leave = triggerFloorSensors(
        level,
        fromX,
        fromY,
        cur,
        inventories,
        equipment,
        floorItems,
        nextPending,
        deps,
        'leave',
    );
    nextPending = leave.pendingSensorEvents;
    if (Object.keys(leave.sensorChanges).length > 0) {
        cur = { ...cur, ...leave.sensorChanges } as TSensorState;
        changed = true;
    }

    const isStartingGatePlate = level === 0 && toX === 6 && toY === 9;
    if (isStartingGatePlate && partySize === 0) {
        blockedMessage = runtimeText.chooseAdventurer;
    } else {
        const enter = triggerFloorSensors(
            level,
            toX,
            toY,
            cur,
            inventories,
            equipment,
            floorItems,
            nextPending,
            deps,
            'enter',
        );
        nextPending = enter.pendingSensorEvents;
        if (Object.keys(enter.sensorChanges).length > 0) {
            cur = { ...cur, ...enter.sensorChanges } as TSensorState;
            changed = true;
        }
    }

    return {
        sensorChanges: changed ? deps.diffSensorState(ss, cur) : {},
        pendingSensorEvents: nextPending,
        blockedMessage,
    };
}

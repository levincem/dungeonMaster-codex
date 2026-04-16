import type { ChampionEquipment, FloorItem, SensorObject } from '../../types/game';

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
): PendingSensorChangeResult<TSensorState, TPendingSensorEvent> {
    const tile = deps.getTile(level, x, y);
    if (!tile) return { sensorChanges: {}, pendingSensorEvents };

    let cur = ss;
    let changed = false;
    let playedSound = false;
    let nextPending = pendingSensorEvents;

    for (const obj of tile.objects) {
        const sensor = deps.asSensor(obj);
        if (!sensor || sensor.type === 127) continue;

        if (mode === 'leave') {
            if (sensor.action !== 'Hold') continue;
            if (deps.isCreatureOnlyFloorSensor(sensor) || deps.isGeneratorSensor(sensor) || deps.isSpecificObjectFloorSensor(sensor)) continue;
            const effect = deps.computeSensorEffect({ ...sensor, action: sensor.revert ? 'Set' : 'Clear' }, level, cur);
            if (Object.keys(effect).length > 0) {
                cur = { ...cur, ...effect } as TSensorState;
                changed = true;
            }
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

        if (deps.isCreatureOnlyFloorSensor(sensor)) continue;
        if (deps.isPartyPossessionSensor(sensor)) {
            const hasRequiredItem = deps.partyHasRequiredItem(deps.getRequiredSensorItemName(sensor), inventories, equipment);
            const shouldTrigger = sensor.revert ? !hasRequiredItem : hasRequiredItem;
            if (!shouldTrigger) continue;
        }
        if (deps.isSpecificObjectFloorSensor(sensor)) {
            const hasRequiredItem = deps.tileHasRequiredFloorItem(level, x, y, deps.getRequiredSensorItemName(sensor), floorItems);
            const shouldTrigger = sensor.revert ? !hasRequiredItem : hasRequiredItem;
            if (!shouldTrigger) continue;
        }

        const queued = deps.queueOrComputeSensorEffect(
            sensor.action === 'Hold' ? { ...sensor, action: 'Set' } : sensor,
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
        blockedMessage = 'Choose at least one adventurer, four is better !';
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

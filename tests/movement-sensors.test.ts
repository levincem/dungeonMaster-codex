import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SensorObject } from '../src/types/game.js';
import {
    transitionFloorSensors,
    triggerFloorSensors,
} from '../src/engine/systems/movementSensors.js';

type TestSensorState = {
    openDoors: Set<string>;
    currentDirection?: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    currentLevel?: number;
    currentPosition?: [number, number];
};

function createSensor(overrides: Partial<SensorObject> = {}): SensorObject {
    return {
        category: 'Sensor',
        index: 1,
        tilePos: 'North',
        type: 1,
        data: 0,
        graphic: 0,
        isLocal: false,
        delay: 0,
        sound: true,
        revert: false,
        action: 'Set',
        onceOnly: false,
        targetY: 4,
        targetX: 6,
        targetDir: 'North',
        ...overrides,
    };
}

function createDeps(sensor: SensorObject, overrides: Partial<Parameters<typeof triggerFloorSensors<TestSensorState, { level: number; sensorIndex: number; remaining: number }>>[8]> = {}) {
    const plateActivations: Array<[number, number, number]> = [];
    const doorTargets: Array<{ level: number; x: number; y: number } | null> = [];
    let plateSoundCount = 0;

    const deps = {
        getTile: () => ({ objects: [sensor] }),
        asSensor: (obj: unknown) => (obj && typeof obj === 'object' && 'category' in obj ? obj as SensorObject : null),
        isCreatureOnlyFloorSensor: () => false,
        isGeneratorSensor: () => false,
        isPartyPossessionSensor: () => false,
        isSpecificObjectFloorSensor: () => false,
        getRequiredSensorItemName: () => undefined,
        partyHasRequiredItem: () => true,
        tileHasRequiredFloorItem: () => true,
        computeSensorEffect: () => ({ openDoors: new Set(['0,4,6']) }),
        triggerGeneratorSensor: (_level: number, _sensor: SensorObject, ss: TestSensorState) => ss,
        queueOrComputeSensorEffect: (_sensor: SensorObject, _level: number, _ss: TestSensorState, pending: Array<{ level: number; sensorIndex: number; remaining: number }>) => ({
            sensorChanges: { openDoors: new Set(['0,4,6']) },
            pendingSensorEvents: [...pending, { level: 0, sensorIndex: 99, remaining: 1 }],
        }),
        resolveDoorSoundTarget: () => ({ level: 0, x: 6, y: 4 }),
        playDoorMotion: (target: { level: number; x: number; y: number } | null) => {
            doorTargets.push(target);
        },
        playPlate: () => {
            plateSoundCount += 1;
        },
        notifyPlateActivated: (level: number, x: number, y: number) => {
            plateActivations.push([level, x, y]);
        },
        diffSensorState: (_before: TestSensorState, after: TestSensorState) => ({ openDoors: after.openDoors }),
        ...overrides,
    };

    return { deps, plateActivations, doorTargets, getPlateSoundCount: () => plateSoundCount };
}

test('triggerFloorSensors enter mode applies queued effects and notifies once', () => {
    const sensor = createSensor();
    const { deps, plateActivations, doorTargets, getPlateSoundCount } = createDeps(sensor);

    const result = triggerFloorSensors(
        0,
        6,
        9,
        { openDoors: new Set<string>() },
        {} as Record<number, never>,
        {},
        [],
        [],
        deps,
        'enter',
    );

    assert.deepEqual([...result.sensorChanges.openDoors!], ['0,4,6']);
    assert.deepEqual(result.pendingSensorEvents, [{ level: 0, sensorIndex: 99, remaining: 1 }]);
    assert.deepEqual(plateActivations, [[0, 6, 9]]);
    assert.deepEqual(doorTargets, [{ level: 0, x: 6, y: 4 }]);
    assert.equal(getPlateSoundCount(), 1);
});

test('transitionFloorSensors blocks the empty party at the starting gate plate', () => {
    const sensor = createSensor({ action: 'Hold' });
    const { deps } = createDeps(sensor, {
        getTile: (_level: number, x: number, y: number) => ({ objects: x === 1 && y === 1 ? [sensor] : [] }),
        queueOrComputeSensorEffect: (_sensor: SensorObject, _level: number, _ss: TestSensorState, pending: Array<{ level: number; sensorIndex: number; remaining: number }>) => ({
            sensorChanges: { openDoors: new Set(['leave']) },
            pendingSensorEvents: pending,
        }),
    });

    const result = transitionFloorSensors(
        0,
        1,
        1,
        6,
        9,
        0,
        { openDoors: new Set<string>() },
        {} as Record<number, never>,
        {},
        [],
        [],
        deps,
    );

    assert.equal(result.blockedMessage, 'Choose at least one adventurer, four is better!');
    assert.deepEqual([...result.sensorChanges.openDoors!], ['0,4,6']);
  });

test('triggerFloorSensors only activates type 3 party plates when the facing direction matches', () => {
    const sensor = createSensor({ type: 3, data: 2, requiredObjectName: 'COMPASS' });
    const { deps } = createDeps(sensor);

    const blocked = triggerFloorSensors(
        0,
        6,
        9,
        { openDoors: new Set<string>(), currentDirection: 'NORTH' },
        {},
        {},
        [],
        [],
        deps,
        'enter',
    );

    assert.deepEqual(blocked.sensorChanges, {});
    assert.deepEqual(blocked.pendingSensorEvents, []);

    const triggered = triggerFloorSensors(
        0,
        6,
        9,
        { openDoors: new Set<string>(), currentDirection: 'EAST' },
        {},
        {},
        [],
        [],
        deps,
        'enter',
    );

    assert.deepEqual([...triggered.sensorChanges.openDoors!], ['0,4,6']);
});

test('triggerFloorSensors still requires a floor item for type 4 object-only sensors', () => {
    const sensor = createSensor({ type: 4, requiredObjectName: 'COMPASS' });
    const { deps } = createDeps(sensor, {
        isSpecificObjectFloorSensor: (candidate: SensorObject) => candidate.type === 4,
        tileHasRequiredFloorItem: () => false,
    });

    const result = triggerFloorSensors(
        0,
        6,
        9,
        { openDoors: new Set<string>(), currentDirection: 'NORTH' },
        {},
        {},
        [],
        [],
        deps,
        'enter',
    );

    assert.deepEqual(result.sensorChanges, {});
    assert.deepEqual(result.pendingSensorEvents, []);
});

test('triggerFloorSensors clears hold effects when a type 3 party plate is left', () => {
    const sensor = createSensor({ type: 3, data: 2, action: 'Hold' });
    const { deps } = createDeps(sensor, {
        computeSensorEffect: () => ({ openDoors: new Set<string>() }),
    });

    const result = triggerFloorSensors(
        0,
        6,
        9,
        { openDoors: new Set(['0,4,6']), currentDirection: 'EAST' },
        {},
        {},
        [],
        [],
        deps,
        'leave',
    );

    assert.deepEqual([...result.sensorChanges.openDoors!], []);
});

test('triggerFloorSensors inverts revert Set sensors between enter and leave for creature plates', () => {
    const sensor = createSensor({ type: 2, action: 'Set', revert: true });
    const enterActions: string[] = [];
    const leaveActions: string[] = [];
    const { deps } = createDeps(sensor, {
        isCreatureOnlyFloorSensor: (candidate: SensorObject) => candidate.type === 2,
        queueOrComputeSensorEffect: (effectiveSensor, _level, _ss, pending) => {
            enterActions.push(effectiveSensor.action);
            return {
                sensorChanges: { openDoors: new Set<string>() },
                pendingSensorEvents: pending,
            };
        },
        computeSensorEffect: (effectiveSensor) => {
            leaveActions.push(effectiveSensor.action);
            return { openDoors: new Set(['0,4,6']) };
        },
    });

    triggerFloorSensors(
        0,
        6,
        9,
        { openDoors: new Set<string>() },
        {},
        {},
        [],
        [],
        deps,
        'enter',
        'creature',
        [{ mapIndex: 0, x: 6, y: 9, alive: true }],
    );
    const leave = triggerFloorSensors(
        0,
        6,
        9,
        { openDoors: new Set<string>() },
        {},
        {},
        [],
        [],
        deps,
        'leave',
        'creature',
        [],
    );

    assert.deepEqual(enterActions, ['Clear']);
    assert.deepEqual(leaveActions, ['Set']);
    assert.deepEqual([...leave.sensorChanges.openDoors!], ['0,4,6']);
});

test('triggerFloorSensors keeps a hold plate active when the required floor item remains on it', () => {
    const sensor = createSensor({ type: 4, requiredObjectName: 'COMPASS', action: 'Hold' });
    const { deps } = createDeps(sensor, {
        isSpecificObjectFloorSensor: (candidate: SensorObject) => candidate.type === 4,
        tileHasRequiredFloorItem: () => true,
        computeSensorEffect: () => ({ openDoors: new Set<string>() }),
    });

    const result = triggerFloorSensors(
        0,
        6,
        9,
        { openDoors: new Set(['0,4,6']), currentDirection: 'NORTH' },
        {},
        {},
        [],
        [],
        deps,
        'leave',
    );

    assert.deepEqual(result.sensorChanges, {});
});

test('triggerFloorSensors ignores party-only plates when the source is a dropped item', () => {
    const sensor = createSensor({ type: 3, data: 1 });
    const { deps } = createDeps(sensor);

    const result = triggerFloorSensors(
        0,
        6,
        9,
        { openDoors: new Set<string>(), currentDirection: 'NORTH' },
        {},
        {},
        [],
        [],
        deps,
        'enter',
        'item',
    );

    assert.deepEqual(result.sensorChanges, {});
    assert.deepEqual(result.pendingSensorEvents, []);
});

test('triggerFloorSensors activates generic weight plates when the source is a dropped item', () => {
    const sensor = createSensor({ type: 1, action: 'Hold' });
    const { deps } = createDeps(sensor);

    const result = triggerFloorSensors(
        0,
        25,
        1,
        { openDoors: new Set<string>(), currentDirection: 'NORTH' },
        {},
        {},
        [],
        [],
        deps,
        'enter',
        'item',
    );

    assert.deepEqual([...result.sensorChanges.openDoors!], ['0,4,6']);
    assert.deepEqual(result.pendingSensorEvents, [{ level: 0, sensorIndex: 99, remaining: 1 }]);
});

test('triggerFloorSensors clears revert hold targets while a generic weight plate is held down', () => {
    const sensor = createSensor({ type: 1, action: 'Hold', revert: true });
    const { deps } = createDeps(sensor, {
        queueOrComputeSensorEffect: (effectiveSensor: SensorObject, _level: number, _ss: TestSensorState, pending: Array<{ level: number; sensorIndex: number; remaining: number }>) => ({
            sensorChanges: { openPits: effectiveSensor.action === 'Clear' ? new Set<string>() : new Set(['0,5,24']) } as Partial<TestSensorState>,
            pendingSensorEvents: pending,
        }),
        diffSensorState: (_before: TestSensorState, after: TestSensorState) => after as Partial<TestSensorState>,
    });

    const result = triggerFloorSensors(
        1,
        25,
        3,
        { openDoors: new Set<string>(), currentDirection: 'NORTH' } as TestSensorState,
        {},
        {},
        [],
        [],
        deps,
        'enter',
        'item',
    );

    assert.deepEqual([...(result.sensorChanges as { openPits: Set<string> }).openPits], []);
});

test('triggerFloorSensors activates generic weight plates when the source is a creature stepping on them', () => {
    const sensor = createSensor({ type: 1, action: 'Hold' });
    const { deps } = createDeps(sensor);

    const result = triggerFloorSensors(
        0,
        25,
        1,
        { openDoors: new Set<string>(), currentDirection: 'NORTH' },
        {},
        {},
        [],
        [],
        deps,
        'enter',
        'creature',
        [{ mapIndex: 0, x: 25, y: 1, alive: true }],
    );

    assert.deepEqual([...result.sensorChanges.openDoors!], ['0,4,6']);
    assert.deepEqual(result.pendingSensorEvents, [{ level: 0, sensorIndex: 99, remaining: 1 }]);
});

test('triggerFloorSensors keeps a generic weight hold plate active when an item remains on it after the party leaves', () => {
    const sensor = createSensor({ type: 1, action: 'Hold' });
    const { deps } = createDeps(sensor, {
        computeSensorEffect: () => ({ openDoors: new Set<string>() }),
    });

    const result = triggerFloorSensors(
        0,
        25,
        1,
        { openDoors: new Set(['0,0,27']), currentDirection: 'NORTH' },
        {},
        {},
        [
            {
                id: 'boulder-on-plate',
                mapIndex: 0,
                x: 25,
                y: 1,
                category: 'Misc',
                typeId: 1,
                tilePos: 'North',
            },
        ],
        [],
        deps,
        'leave',
    );

    assert.deepEqual(result.sensorChanges, {});
    assert.deepEqual(result.pendingSensorEvents, []);
});

test('triggerFloorSensors clears a generic weight hold plate when the party leaves and nothing remains on it', () => {
    const sensor = createSensor({ type: 1, action: 'Hold' });
    const { deps } = createDeps(sensor, {
        computeSensorEffect: () => ({ openDoors: new Set<string>() }),
    });

    const result = triggerFloorSensors(
        0,
        25,
        1,
        {
            openDoors: new Set(['0,0,27']),
            currentDirection: 'NORTH',
            currentLevel: 0,
            currentPosition: [1, 25],
        },
        {},
        {},
        [],
        [],
        deps,
        'leave',
        'party',
        [],
    );

    assert.deepEqual([...result.sensorChanges.openDoors!], []);
    assert.deepEqual(result.pendingSensorEvents, []);
});

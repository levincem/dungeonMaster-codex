import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SensorObject } from '../src/types/game.js';
import {
    transitionFloorSensors,
    triggerFloorSensors,
} from '../src/engine/systems/movementSensors.js';

type TestSensorState = {
    openDoors: Set<string>;
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
        {},
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
        {},
        {},
        [],
        [],
        deps,
    );

    assert.equal(result.blockedMessage, 'Choose at least one adventurer, four is better !');
    assert.deepEqual([...result.sensorChanges.openDoors!], ['0,4,6']);
  });

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SensorObject } from '../src/types/game.js';
import {
    processPendingGeneratorSpawns,
    processPendingSensorEvents,
    queuePendingGeneratorSpawnEvent,
} from '../src/engine/systems/pendingWorldEvents.js';

type TestSensorState = {
    openDoors: Set<string>;
    creatures: string[];
};

type PendingGeneratorEvent = {
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

function createSensor(overrides: Partial<SensorObject> = {}): SensorObject {
    return {
        category: 'Sensor',
        index: 5,
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
        targetY: 1,
        targetX: 2,
        targetDir: 'North',
        ...overrides,
    };
}

test('processPendingSensorEvents triggers elapsed events and keeps future ones queued', () => {
    const state: TestSensorState = {
        openDoors: new Set<string>(),
        creatures: [],
    };
    const playedDoors: Array<{ level: number; x: number; y: number } | null> = [];
    let plateCount = 0;

    const result = processPendingSensorEvents(
        1,
        [
            { level: 3, sensorIndex: 5, remaining: 0.5 },
            { level: 3, sensorIndex: 6, remaining: 2 },
        ],
        state,
        {
            findSensorByIndex: (_level, sensorIndex) => (sensorIndex === 5 ? createSensor() : null),
            computeSensorEffect: () => ({ openDoors: new Set(['3,1,2']) }),
            resolveDoorSoundTarget: () => ({ level: 3, x: 2, y: 1 }),
            playDoorMotion: (target) => {
                playedDoors.push(target);
            },
            playPlate: () => {
                plateCount += 1;
            },
            diffSensorState: (_before, after) => ({ openDoors: after.openDoors }),
        },
    );

    assert.deepEqual([...result.sensorChanges.openDoors!], ['3,1,2']);
    assert.deepEqual(result.pendingSensorEvents, [{ level: 3, sensorIndex: 6, remaining: 1 }]);
    assert.deepEqual(playedDoors, [{ level: 3, x: 2, y: 1 }]);
    assert.equal(plateCount, 1);
});

test('processPendingGeneratorSpawns retries blocked spawns and appends successful groups', () => {
    const state: TestSensorState = {
        openDoors: new Set<string>(),
        creatures: ['existing'],
    };

    const result = processPendingGeneratorSpawns(
        1,
        [
            {
                sensorLevel: 0,
                sensorIndex: 1,
                spawnLevel: 3,
                spawnX: 2,
                spawnY: 1,
                typeId: 7,
                hpMultiplier: 2,
                creatureCount: 2,
                groupId: 'group-a',
                remaining: 0.25,
            },
            {
                sensorLevel: 0,
                sensorIndex: 2,
                spawnLevel: 4,
                spawnX: 3,
                spawnY: 4,
                typeId: 9,
                hpMultiplier: 1,
                creatureCount: 1,
                groupId: 'group-b',
                remaining: 0.25,
            },
        ],
        state,
        {
            canMaterializeReservedGeneratorSpawn: (_ss, spawnLevel) => spawnLevel !== 4,
            isGeneratorSpawnBlocked: () => false,
            createGeneratedCreatureGroupInstances: (spawnLevel, spawnX, spawnY, typeId, _hpMultiplier, creatureCount, groupId) =>
                Array.from({ length: creatureCount }, (_, index) => `${groupId}:${spawnLevel}:${spawnX}:${spawnY}:${typeId}:${index}`),
            retrySeconds: 5,
            diffSensorState: (_before, after) => ({ creatures: after.creatures }),
        },
    );

    assert.deepEqual(result.sensorChanges.creatures, [
        'existing',
        'group-a:3:2:1:7:0',
        'group-a:3:2:1:7:1',
    ]);
    assert.deepEqual(result.pendingGeneratorSpawns, [
        {
            sensorLevel: 0,
            sensorIndex: 2,
            spawnLevel: 4,
            spawnX: 3,
            spawnY: 4,
            typeId: 9,
            hpMultiplier: 1,
            creatureCount: 1,
            groupId: 'group-b',
            remaining: 5,
        },
    ]);
});

test('processPendingGeneratorSpawns lets already reserved spawns resolve even if new spawns would be gated', () => {
    const state: TestSensorState = {
        openDoors: new Set<string>(),
        creatures: ['existing'],
    };

    const result = processPendingGeneratorSpawns(
        1,
        [
            {
                sensorLevel: 0,
                sensorIndex: 7,
                spawnLevel: 3,
                spawnX: 5,
                spawnY: 6,
                typeId: 12,
                hpMultiplier: 0,
                creatureCount: 1,
                groupId: 'reserved-group',
                remaining: 0.25,
            },
        ],
        state,
        {
            canMaterializeReservedGeneratorSpawn: () => true,
            isGeneratorSpawnBlocked: () => false,
            createGeneratedCreatureGroupInstances: (spawnLevel, spawnX, spawnY, typeId, _hpMultiplier, creatureCount, groupId) =>
                Array.from({ length: creatureCount }, (_, index) => `${groupId}:${spawnLevel}:${spawnX}:${spawnY}:${typeId}:${index}`),
            retrySeconds: 5,
            diffSensorState: (_before, after) => ({ creatures: after.creatures }),
        },
    );

    assert.deepEqual(result.sensorChanges.creatures, [
        'existing',
        'reserved-group:3:5:6:12:0',
    ]);
    assert.deepEqual(result.pendingGeneratorSpawns, []);
});

test('queuePendingGeneratorSpawnEvent deduplicates exact activations but keeps later reservations distinct', () => {
    const initial = queuePendingGeneratorSpawnEvent(
        [] as PendingGeneratorEvent[],
        {
            sensorLevel: 2,
            sensorIndex: 81,
            spawnLevel: 2,
            spawnX: 9,
            spawnY: 13,
            typeId: 2,
            hpMultiplier: 7,
            creatureCount: 1,
            groupId: 'group-a',
        },
        5,
    );

    const duplicate = queuePendingGeneratorSpawnEvent(
        initial,
        {
            sensorLevel: 2,
            sensorIndex: 81,
            spawnLevel: 2,
            spawnX: 9,
            spawnY: 13,
            typeId: 2,
            hpMultiplier: 7,
            creatureCount: 1,
            groupId: 'group-a',
        },
        5,
    );

    const laterReservation = queuePendingGeneratorSpawnEvent(
        duplicate,
        {
            sensorLevel: 2,
            sensorIndex: 81,
            spawnLevel: 2,
            spawnX: 9,
            spawnY: 13,
            typeId: 2,
            hpMultiplier: 7,
            creatureCount: 1,
            groupId: 'group-b',
        },
        5,
    );

    assert.equal(initial.length, 1);
    assert.equal(duplicate.length, 1);
    assert.equal(laterReservation.length, 2);
    assert.deepEqual(laterReservation.map((event) => event.groupId), ['group-a', 'group-b']);
});

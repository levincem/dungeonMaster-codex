import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SensorObject } from '../src/types/game.js';
import {
    buildPendingGeneratedCreatureGroupId,
    getOriginalGeneratorDisableTicks,
    isGeneratorSpawnBlocked,
    triggerGeneratorSensor,
} from '../src/engine/systems/sensorGeneratorRuntime.js';

type TestCreature = {
    id: string;
    alive: boolean;
    mapIndex: number;
    x: number;
    y: number;
};

type TestPendingGeneratorSpawn = {
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

type TestState = {
    sensorRuntimeData: Record<string, number>;
    creatures: TestCreature[];
    pendingGeneratorSpawns: TestPendingGeneratorSpawn[];
    currentLevel: number;
    currentPosition: [number, number];
    elapsedGameTimeTicks: number;
};

function createSensor(overrides: Partial<SensorObject> = {}): SensorObject {
    return {
        category: 'Sensor',
        index: 4,
        tilePos: 'North',
        type: 11,
        data: 0,
        graphic: 0,
        isLocal: false,
        delay: 0,
        sound: false,
        revert: false,
        action: 'Set',
        onceOnly: false,
        targetY: 0,
        targetX: 0,
        targetDir: 'North',
        ...overrides,
    };
}

test('getOriginalGeneratorDisableTicks decodes extended timer values', () => {
    assert.equal(getOriginalGeneratorDisableTicks(0), 0);
    assert.equal(getOriginalGeneratorDisableTicks(12), 12);
    assert.equal(getOriginalGeneratorDisableTicks(128), 128);
});

test('isGeneratorSpawnBlocked accounts for both party and creature occupancy', () => {
    const state: TestState = {
        sensorRuntimeData: {},
        creatures: [{ id: 'c1', alive: true, mapIndex: 0, x: 3, y: 4 }],
        pendingGeneratorSpawns: [],
        currentLevel: 0,
        currentPosition: [1, 2],
        elapsedGameTimeTicks: 0,
    };

    assert.equal(isGeneratorSpawnBlocked(state, 0, 2, 1), true);
    assert.equal(isGeneratorSpawnBlocked(state, 0, 3, 4), true);
    assert.equal(isGeneratorSpawnBlocked(state, 0, 5, 5), false);
});

test('buildPendingGeneratedCreatureGroupId encodes the generator identity prefix', () => {
    const groupId = buildPendingGeneratedCreatureGroupId(0, 7, 1, 2, 3, 9, 42);

    assert.match(groupId, /^generator_0_7_1_2_3_9_42_/);
});

test('triggerGeneratorSensor appends creatures immediately when the spawn tile is free', () => {
    const state: TestState = {
        sensorRuntimeData: {},
        creatures: [],
        pendingGeneratorSpawns: [],
        currentLevel: 0,
        currentPosition: [0, 0],
        elapsedGameTimeTicks: 20,
    };

    const nextState = triggerGeneratorSensor<TestState, TestCreature, TestPendingGeneratorSpawn>(0, createSensor(), state, {
        getGeneratorConfig: () => ({
            spawnX: 2,
            spawnY: 3,
            typeId: 9,
            hpMultiplier: 2,
            countRaw: 2,
            randomized: false,
            ticks: 6,
        }),
        getSpawnTile: () => ({ x: 2, y: 3, type: 'Floor', objects: [] }),
        getSensorStateKey: (level, sensorIndex) => `${level}_${sensorIndex}`,
        randomInt: () => 0,
        canReserveGeneratorGroup: () => true,
        queuePendingGeneratorSpawnEvent: (pending) => pending,
        retrySeconds: 5,
        createGeneratedCreatureGroupInstances: (level, x, y, typeId, _hpMultiplier, creatureCount, groupId) =>
            Array.from({ length: creatureCount }, (_, index) => ({
                id: `${groupId}:${index}`,
                alive: true,
                mapIndex: level,
                x,
                y,
                typeId,
            })) as TestCreature[],
    });

    assert.equal(nextState.creatures.length, 2);
    assert.equal(nextState.pendingGeneratorSpawns.length, 0);
    assert.equal(nextState.sensorRuntimeData['0_4'], 26);
});

test('triggerGeneratorSensor queues a retry when the spawn tile is blocked', () => {
    const state: TestState = {
        sensorRuntimeData: {},
        creatures: [],
        pendingGeneratorSpawns: [],
        currentLevel: 0,
        currentPosition: [3, 2],
        elapsedGameTimeTicks: 12,
    };

    const nextState = triggerGeneratorSensor<TestState, TestCreature, TestPendingGeneratorSpawn>(0, createSensor(), state, {
        getGeneratorConfig: () => ({
            spawnX: 2,
            spawnY: 3,
            typeId: 9,
            hpMultiplier: 0,
            countRaw: 1,
            randomized: false,
            ticks: 5,
        }),
        getSpawnTile: () => ({ x: 2, y: 3, type: 'Floor', objects: [] }),
        getSensorStateKey: (level, sensorIndex) => `${level}_${sensorIndex}`,
        randomInt: () => 0,
        canReserveGeneratorGroup: () => true,
        queuePendingGeneratorSpawnEvent: (_pending, event, remaining) => [{ ...event, remaining }],
        retrySeconds: 5,
        createGeneratedCreatureGroupInstances: () => [],
    });

    assert.equal(nextState.creatures.length, 0);
    assert.equal(nextState.pendingGeneratorSpawns.length, 1);
    assert.equal(nextState.pendingGeneratorSpawns[0]?.remaining, 5);
    assert.equal(nextState.sensorRuntimeData['0_4'], 17);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FloorItem, GameTile, SensorObject } from '../src/types/game.js';
import { activateWallSensor } from '../src/engine/systems/wallSensorActivation.js';

type TestSensorState = {
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    openDoors: Set<string>;
    openWalls: Set<string>;
    sensorRotationOffsets: Record<string, number>;
};

type TestState = {
    pendingSensorEvents: string[];
    floorItems: FloorItem[];
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

function createDeps(tile: GameTile, overrides: Partial<Parameters<typeof activateWallSensor<TestState, TestSensorState, string, Record<string, unknown>>>[5]> = {}) {
    const plates: number[] = [];
    const doors: Array<{ level: number; x: number; y: number } | null> = [];

    const deps = {
        getTile: () => tile,
        buildSensorStateSnapshot: () => ({
            activeSensors: new Set<string>(),
            firedSensors: new Set<string>(),
            openDoors: new Set<string>(),
            openWalls: new Set<string>(),
            sensorRotationOffsets: {},
        }),
        getWallFaceSensorsInRuntimeOrder: () => tile.objects.filter((entry): entry is SensorObject => entry.category === 'Sensor'),
        wallLauncherSensorTypes: new Set<number>([7, 8]),
        applyToSet: (set: Set<string>, key: string, action: 'Set' | 'Clear' | 'Toggle' | 'Hold') => {
            const next = new Set(set);
            if (action === 'Set') next.add(key);
            if (action === 'Clear') next.delete(key);
            if (action === 'Toggle') {
                if (next.has(key)) next.delete(key); else next.add(key);
            }
            return next;
        },
        getSelfRevealingWallSensor: () => null,
        queueOrComputeSensorEffect: (_sensor: SensorObject, _level: number, _ss: TestSensorState, pending: string[]) => ({
            sensorChanges: { openDoors: new Set(['3,4,6']) },
            pendingSensorEvents: [...pending, 'queued'],
        }),
        resolveDoorSoundTarget: () => ({ level: 3, x: 6, y: 4 }),
        playDoorMotion: (target: { level: number; x: number; y: number } | null) => {
            doors.push(target);
        },
        playPlate: () => {
            plates.push(1);
        },
        shouldRotateWallFaceAfterActivation: () => false,
        rotateWallFaceSensors: () => ({ rotated: 1 }),
        diffSensorState: (_before: TestSensorState, after: TestSensorState) => ({
            activeSensors: after.activeSensors,
            openDoors: after.openDoors,
            openWalls: after.openWalls,
            firedSensors: after.firedSensors,
            sensorRotationOffsets: after.sensorRotationOffsets,
        }),
        revealSelfWallMountedItems: (floorItems: FloorItem[]) => floorItems,
        applyImmediateTransportSquareEffects: (_state: TestState, patch: Record<string, unknown>) => patch,
        ...overrides,
    };

    return { deps, plates, doors };
}

test('activateWallSensor queues effects, plays feedback and returns the applied patch', () => {
    const tile: GameTile = {
        x: 6,
        y: 5,
        type: 'Wall',
        objects: [createSensor()],
    };
    const { deps, plates, doors } = createDeps(tile);

    const result = activateWallSensor(
        { pendingSensorEvents: [], floorItems: [] },
        3,
        6,
        5,
        1,
        deps,
    );

    assert.equal(plates.length, 1);
    assert.deepEqual(doors, [{ level: 3, x: 6, y: 4 }]);
    assert.deepEqual(result, {
        activeSensors: new Set(['3_1']),
        openDoors: new Set(['3,4,6']),
        openWalls: new Set(),
        firedSensors: new Set(),
        sensorRotationOffsets: {},
        pendingSensorEvents: ['queued'],
    });
});

test('activateWallSensor reveals self-revealing walls and exposed items', () => {
    const hiddenItem: FloorItem = {
        id: 'hidden-item',
        category: 'Weapon',
        typeId: 7,
        mapIndex: 3,
        x: 6,
        y: 5,
        tilePos: 'North',
    };
    const revealingSensor = createSensor({
        index: 7,
        onceOnly: true,
        targetX: 0,
        targetY: 0,
    });
    const tile: GameTile = {
        x: 6,
        y: 5,
        type: 'Wall',
        objects: [revealingSensor],
    };
    const { deps } = createDeps(tile, {
        getSelfRevealingWallSensor: () => revealingSensor,
        revealSelfWallMountedItems: () => [hiddenItem],
    });

    const result = activateWallSensor(
        { pendingSensorEvents: [], floorItems: [] },
        3,
        6,
        5,
        7,
        deps,
    );

    assert.deepEqual(result, {
        activeSensors: new Set(['3_7']),
        openDoors: new Set(),
        openWalls: new Set(['3,5,6']),
        firedSensors: new Set(['3_7']),
        sensorRotationOffsets: {},
        floorItems: [hiddenItem],
    });
});

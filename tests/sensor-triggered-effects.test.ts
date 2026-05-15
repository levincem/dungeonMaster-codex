import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameTile, SensorObject } from '../src/types/game.js';
import { dispatchTriggeredSensorEffect } from '../src/engine/systems/sensorTriggeredEffects.js';
import {
    readWallSensorRuntimeData,
    writeWallSensorRuntimeData,
} from '../src/engine/systems/sensorRuntimeCore.js';
import { getGameMap } from '../src/data/mapLoader.js';
import { preloadDungeonData } from '../src/data/dungeonData.js';

type TestState = {
    openDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    sensorRuntimeData: Record<string, number>;
    sensorRotationOffsets: Record<string, number>;
    visibleTexts: Set<string>;
    projectiles: never[];
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
        action: 'Toggle',
        onceOnly: false,
        targetY: 1,
        targetX: 1,
        targetDir: 'North',
        ...overrides,
    };
}

function createState(): TestState {
    return {
        openDoors: new Set<string>(),
        openPits: new Set<string>(),
        openTeleporters: new Set<string>(),
        openWalls: new Set<string>(),
        activeSensors: new Set<string>(),
        firedSensors: new Set<string>(),
        sensorRuntimeData: {},
        sensorRotationOffsets: {},
        visibleTexts: new Set<string>(),
        projectiles: [],
    };
}

function applyPatch(state: TestState, patch: Partial<TestState>): TestState {
    return { ...state, ...patch };
}

test('wall square events reach type 5 gate sensors even when the gate sensor lives on another face of the target wall', () => {
    const gateSensor = createSensor({
        index: 55,
        tilePos: 'South',
        type: 5,
        action: 'Hold',
        data: 0x30,
        targetX: 2,
        targetY: 1,
        targetDir: 'South',
    });
    const targetWall: GameTile = {
        x: 1,
        y: 1,
        type: 'Wall',
        objects: [gateSensor],
    };
    const door: GameTile = {
        x: 2,
        y: 1,
        type: 'Door',
        objects: [],
    };
    const tiles = [
        [{ x: 0, y: 0, type: 'Floor', objects: [] }, { x: 1, y: 0, type: 'Floor', objects: [] }, { x: 2, y: 0, type: 'Floor', objects: [] }],
        [{ x: 0, y: 1, type: 'Floor', objects: [] }, targetWall, door],
        [{ x: 0, y: 2, type: 'Floor', objects: [] }, { x: 1, y: 2, type: 'Floor', objects: [] }, { x: 2, y: 2, type: 'Floor', objects: [] }],
    ] satisfies GameTile[][];

    const getTile = (level: number, x: number, y: number) => {
        assert.equal(level, 1);
        return tiles[y]?.[x];
    };
    const applyToSet = (set: Set<string>, key: string, action: 'Set' | 'Clear' | 'Toggle' | 'Hold') => {
        const next = new Set(set);
        if (action === 'Set') next.add(key);
        if (action === 'Clear') next.delete(key);
        if (action === 'Toggle') {
            if (next.has(key)) next.delete(key);
            else next.add(key);
        }
        return next;
    };
    const diffSensorState = (before: TestState, after: TestState): Partial<TestState> => {
        const patch: Partial<TestState> = {};
        if (after.openDoors !== before.openDoors) patch.openDoors = after.openDoors;
        if (after.sensorRuntimeData !== before.sensorRuntimeData) patch.sensorRuntimeData = after.sensorRuntimeData;
        return patch;
    };

    const deps = {
        getTile,
        applyToSet,
        diffSensorState,
        getSensorStateKey: (level: number, sensorIndex: number) => `${level}_${sensorIndex}`,
        wallLauncherSensorTypes: new Set<number>(),
        findSensorPlacement: () => null,
        buildWallLauncherProjectiles: () => [],
        now: () => 0,
        triggerGeneratorSensor: (_level: number, _sensor: SensorObject, state: TestState) => state,
        isGeneratorSensor: () => false,
        readWallSensorRuntimeData: (level: number, sensor: SensorObject, state: TestState) =>
            readWallSensorRuntimeData(level, sensor, state.sensorRuntimeData),
        writeWallSensorRuntimeData: (
            level: number,
            sensor: SensorObject,
            state: TestState,
            nextValue: number,
        ) => writeWallSensorRuntimeData(level, sensor, state.sensorRuntimeData, nextValue),
        hasWallFaceLocalRotationEffect: () => false,
        rotateWallFaceSensors: (_level: number, _x: number, _y: number, _face: SensorObject['tilePos'], offsets: Record<string, number>) => offsets,
        wallSensorFaceMask: {
            North: 1,
            East: 2,
            South: 4,
            West: 8,
        },
    };

    const northLever = createSensor({
        index: 53,
        targetDir: 'North',
    });
    const eastLever = createSensor({
        index: 54,
        targetDir: 'East',
    });

    let state = createState();
    state = applyPatch(state, dispatchTriggeredSensorEffect(northLever, 1, state, deps));
    assert.equal(state.sensorRuntimeData['1_55'], 0x31);
    assert.equal(state.openDoors.size, 0);

    state = applyPatch(state, dispatchTriggeredSensorEffect(eastLever, 1, state, deps));
    assert.equal(state.sensorRuntimeData['1_55'], 0x33);
    assert.deepEqual([...state.openDoors], ['1,1,2']);
});

test('level 1 double-faced lever routes east-face and west-face actions to different canonical targets', async () => {
    await preloadDungeonData();

    const map = getGameMap(1);
    const wallTile = map.tiles[28]?.[15];
    assert.ok(wallTile);
    assert.equal(wallTile?.type, 'Wall');

    const eastFaceLever = wallTile?.objects.find(
        (obj): obj is SensorObject =>
            obj.category === 'Sensor' &&
            obj.index === 517 &&
            obj.tilePos === 'East',
    );
    const westFaceLever = wallTile?.objects.find(
        (obj): obj is SensorObject =>
            obj.category === 'Sensor' &&
            obj.index === 512 &&
            obj.tilePos === 'West',
    );
    assert.ok(eastFaceLever);
    assert.ok(westFaceLever);

    const eastTargetTile = map.tiles[eastFaceLever!.targetY]?.[eastFaceLever!.targetX];
    const westTargetTile = map.tiles[westFaceLever!.targetY]?.[westFaceLever!.targetX];
    assert.equal(eastTargetTile?.type, 'TrickWall');
    assert.equal(westTargetTile?.type, 'Door');

    const deps = {
        getTile: (level: number, x: number, y: number) => {
            assert.equal(level, 1);
            return map.tiles[y]?.[x];
        },
        applyToSet: (set: Set<string>, key: string, action: 'Set' | 'Clear' | 'Toggle' | 'Hold') => {
            const next = new Set(set);
            if (action === 'Set') next.add(key);
            if (action === 'Clear') next.delete(key);
            if (action === 'Toggle') {
                if (next.has(key)) next.delete(key);
                else next.add(key);
            }
            return next;
        },
        diffSensorState: (before: TestState, after: TestState): Partial<TestState> => {
            const patch: Partial<TestState> = {};
            if (after.openDoors !== before.openDoors) patch.openDoors = after.openDoors;
            if (after.openWalls !== before.openWalls) patch.openWalls = after.openWalls;
            if (after.activeSensors !== before.activeSensors) patch.activeSensors = after.activeSensors;
            return patch;
        },
        getSensorStateKey: (level: number, sensorIndex: number) => `${level}_${sensorIndex}`,
        wallLauncherSensorTypes: new Set<number>(),
        findSensorPlacement: () => null,
        buildWallLauncherProjectiles: () => [],
        now: () => 0,
        triggerGeneratorSensor: (_level: number, _sensor: SensorObject, state: TestState) => state,
        isGeneratorSensor: () => false,
        readWallSensorRuntimeData: (level: number, sensor: SensorObject, state: TestState) =>
            readWallSensorRuntimeData(level, sensor, state.sensorRuntimeData),
        writeWallSensorRuntimeData: (
            level: number,
            sensor: SensorObject,
            state: TestState,
            nextValue: number,
        ) => writeWallSensorRuntimeData(level, sensor, state.sensorRuntimeData, nextValue),
        hasWallFaceLocalRotationEffect: () => false,
        rotateWallFaceSensors: (
            _level: number,
            _x: number,
            _y: number,
            _face: SensorObject['tilePos'],
            offsets: Record<string, number>,
        ) => offsets,
        wallSensorFaceMask: {
            North: 1,
            East: 2,
            South: 4,
            West: 8,
        },
    };

    const eastState = applyPatch(createState(), dispatchTriggeredSensorEffect(eastFaceLever!, 1, createState(), deps));
    assert.deepEqual([...eastState.openWalls], ['1,29,14']);
    assert.equal(eastState.openDoors.size, 0);

    const westState = applyPatch(createState(), dispatchTriggeredSensorEffect(westFaceLever!, 1, createState(), deps));
    assert.deepEqual([...westState.openDoors], ['1,27,16']);
    assert.equal(westState.openWalls.size, 0);
});

test('type 5 self-target wall-square events can retrigger sibling gate effects without recursive loops', () => {
    const teleporter: GameTile = {
        x: 2,
        y: 1,
        type: 'Teleporter',
        objects: [{
            category: 'Teleporter',
            index: 77,
            tilePos: 'North',
            sound: false,
            scope: 'Everything',
            rotationType: 0,
            rotation: 'North',
            destX: 4,
            destY: 1,
            destMap: 1,
        }],
    };
    const flasherGate = createSensor({
        index: 624,
        tilePos: 'North',
        type: 5,
        action: 'Toggle',
        targetX: 2,
        targetY: 1,
        targetDir: 'North',
    });
    const resetGate = createSensor({
        index: 623,
        tilePos: 'North',
        type: 5,
        action: 'Clear',
        targetX: 1,
        targetY: 1,
        targetDir: 'North',
    });
    const wall: GameTile = {
        x: 1,
        y: 1,
        type: 'Wall',
        objects: [resetGate, flasherGate],
    };
    const tiles = [
        [{ x: 0, y: 0, type: 'Floor', objects: [] }, { x: 1, y: 0, type: 'Floor', objects: [] }, { x: 2, y: 0, type: 'Floor', objects: [] }],
        [{ x: 0, y: 1, type: 'Floor', objects: [] }, wall, teleporter],
        [{ x: 0, y: 2, type: 'Floor', objects: [] }, { x: 1, y: 2, type: 'Floor', objects: [] }, { x: 2, y: 2, type: 'Floor', objects: [] }],
    ] satisfies GameTile[][];

    const deps = {
        getTile: (level: number, x: number, y: number) => {
            assert.equal(level, 1);
            return tiles[y]?.[x];
        },
        applyToSet: (set: Set<string>, key: string, action: 'Set' | 'Clear' | 'Toggle' | 'Hold') => {
            const next = new Set(set);
            if (action === 'Set') next.add(key);
            if (action === 'Clear') next.delete(key);
            if (action === 'Toggle') {
                if (next.has(key)) next.delete(key);
                else next.add(key);
            }
            return next;
        },
        diffSensorState: (before: TestState, after: TestState): Partial<TestState> => {
            const patch: Partial<TestState> = {};
            if (after.openTeleporters !== before.openTeleporters) patch.openTeleporters = after.openTeleporters;
            if (after.sensorRuntimeData !== before.sensorRuntimeData) patch.sensorRuntimeData = after.sensorRuntimeData;
            return patch;
        },
        getSensorStateKey: (level: number, sensorIndex: number) => `${level}_${sensorIndex}`,
        wallLauncherSensorTypes: new Set<number>(),
        findSensorPlacement: () => null,
        buildWallLauncherProjectiles: () => [],
        now: () => 0,
        triggerGeneratorSensor: (_level: number, _sensor: SensorObject, state: TestState) => state,
        isGeneratorSensor: () => false,
        readWallSensorRuntimeData: (level: number, sensor: SensorObject, state: TestState) =>
            readWallSensorRuntimeData(level, sensor, state.sensorRuntimeData),
        writeWallSensorRuntimeData: (
            level: number,
            sensor: SensorObject,
            state: TestState,
            nextValue: number,
        ) => writeWallSensorRuntimeData(level, sensor, state.sensorRuntimeData, nextValue),
        hasWallFaceLocalRotationEffect: () => false,
        rotateWallFaceSensors: (_level: number, _x: number, _y: number, _face: SensorObject['tilePos'], offsets: Record<string, number>) => offsets,
        wallSensorFaceMask: {
            North: 1,
            East: 2,
            South: 4,
            West: 8,
        },
    };

    const floorSensor = createSensor({
        index: 625,
        type: 3,
        action: 'Clear',
        targetX: 1,
        targetY: 1,
        targetDir: 'North',
    });

    let state = createState();
    state.openTeleporters = new Set(['1,1,2']);

    state = applyPatch(state, dispatchTriggeredSensorEffect(floorSensor, 1, state, deps));
    assert.equal(state.openTeleporters.has('1,1,2'), false);

    state = applyPatch(state, dispatchTriggeredSensorEffect(resetGate, 1, state, deps));
    assert.equal(state.openTeleporters.has('1,1,2'), true);
});

test('wall square events reach type 6 countdown sensors even when the countdown lives on another face of the target wall', () => {
    const countdown = createSensor({
        index: 77,
        tilePos: 'West',
        type: 6,
        data: 3,
        action: 'Set',
        targetX: 2,
        targetY: 1,
        targetDir: 'North',
    });
    const targetWall: GameTile = {
        x: 1,
        y: 1,
        type: 'Wall',
        objects: [countdown],
    };
    const door: GameTile = {
        x: 2,
        y: 1,
        type: 'Door',
        objects: [],
    };
    const tiles = [
        [{ x: 0, y: 0, type: 'Floor', objects: [] }, { x: 1, y: 0, type: 'Floor', objects: [] }, { x: 2, y: 0, type: 'Floor', objects: [] }],
        [{ x: 0, y: 1, type: 'Floor', objects: [] }, targetWall, door],
        [{ x: 0, y: 2, type: 'Floor', objects: [] }, { x: 1, y: 2, type: 'Floor', objects: [] }, { x: 2, y: 2, type: 'Floor', objects: [] }],
    ] satisfies GameTile[][];

    const deps = {
        getTile: (level: number, x: number, y: number) => {
            assert.equal(level, 1);
            return tiles[y]?.[x];
        },
        applyToSet: (set: Set<string>, key: string, action: 'Set' | 'Clear' | 'Toggle' | 'Hold') => {
            const next = new Set(set);
            if (action === 'Set') next.add(key);
            if (action === 'Clear') next.delete(key);
            if (action === 'Toggle') {
                if (next.has(key)) next.delete(key);
                else next.add(key);
            }
            return next;
        },
        diffSensorState: (before: TestState, after: TestState): Partial<TestState> => {
            const patch: Partial<TestState> = {};
            if (after.openDoors !== before.openDoors) patch.openDoors = after.openDoors;
            if (after.sensorRuntimeData !== before.sensorRuntimeData) patch.sensorRuntimeData = after.sensorRuntimeData;
            return patch;
        },
        getSensorStateKey: (level: number, sensorIndex: number) => `${level}_${sensorIndex}`,
        wallLauncherSensorTypes: new Set<number>(),
        findSensorPlacement: () => null,
        buildWallLauncherProjectiles: () => [],
        now: () => 0,
        triggerGeneratorSensor: (_level: number, _sensor: SensorObject, state: TestState) => state,
        isGeneratorSensor: () => false,
        readWallSensorRuntimeData: (level: number, sensor: SensorObject, state: TestState) =>
            readWallSensorRuntimeData(level, sensor, state.sensorRuntimeData),
        writeWallSensorRuntimeData: (
            level: number,
            sensor: SensorObject,
            state: TestState,
            nextValue: number,
        ) => writeWallSensorRuntimeData(level, sensor, state.sensorRuntimeData, nextValue),
        hasWallFaceLocalRotationEffect: () => false,
        rotateWallFaceSensors: (_level: number, _x: number, _y: number, _face: SensorObject['tilePos'], offsets: Record<string, number>) => offsets,
        wallSensorFaceMask: {
            North: 1,
            East: 2,
            South: 4,
            West: 8,
        },
    };

    const remoteHoldSensor = createSensor({
        index: 70,
        action: 'Clear',
        targetX: 1,
        targetY: 1,
        targetDir: 'North',
    });

    let state = createState();

    state = applyPatch(state, dispatchTriggeredSensorEffect(remoteHoldSensor, 1, state, deps));
    assert.equal(state.sensorRuntimeData['1_77'], 2);
    assert.equal(state.openDoors.size, 0);

    state = applyPatch(state, dispatchTriggeredSensorEffect(remoteHoldSensor, 1, state, deps));
    assert.equal(state.sensorRuntimeData['1_77'], 1);
    assert.equal(state.openDoors.size, 0);

    state = applyPatch(state, dispatchTriggeredSensorEffect(remoteHoldSensor, 1, state, deps));
    assert.equal(state.sensorRuntimeData['1_77'], 0);
    assert.equal(state.openDoors.size, 0);

    state = applyPatch(state, dispatchTriggeredSensorEffect(remoteHoldSensor, 1, state, deps));
    assert.equal(state.sensorRuntimeData['1_77'], 0);
    assert.deepEqual([...state.openDoors], ['1,1,2']);
});

test('floor square events trigger generator actuators on the targeted floor tile', () => {
    const generator = createSensor({
        index: 308,
        type: 6,
        data: 11,
        graphic: 1,
        targetX: 9,
        targetY: 21,
    });
    const floorTarget: GameTile = {
        x: 7,
        y: 1,
        type: 'Floor',
        objects: [generator],
    };
    const floorSource: GameTile = {
        x: 5,
        y: 5,
        type: 'Floor',
        objects: [],
    };
    let generatorTriggerCount = 0;

    const deps = {
        getTile: (level: number, x: number, y: number) => {
            assert.equal(level, 12);
            if (x === 7 && y === 1) return floorTarget;
            if (x === 5 && y === 5) return floorSource;
            return undefined;
        },
        applyToSet: (set: Set<string>, key: string, action: 'Set' | 'Clear' | 'Toggle' | 'Hold') => {
            const next = new Set(set);
            if (action === 'Set') next.add(key);
            if (action === 'Clear') next.delete(key);
            if (action === 'Toggle') {
                if (next.has(key)) next.delete(key);
                else next.add(key);
            }
            return next;
        },
        diffSensorState: (_before: TestState, after: TestState): Partial<TestState> => after,
        getSensorStateKey: (level: number, sensorIndex: number) => `${level}_${sensorIndex}`,
        wallLauncherSensorTypes: new Set<number>(),
        findSensorPlacement: () => null,
        buildWallLauncherProjectiles: () => [],
        now: () => 0,
        triggerGeneratorSensor: (_level: number, sensor: SensorObject, state: TestState) => {
            generatorTriggerCount += 1;
            assert.equal(sensor.index, 308);
            return {
                ...state,
                activeSensors: new Set([...state.activeSensors, 'generator-fired']),
            };
        },
        isGeneratorSensor: (sensor: SensorObject) => sensor.type === 6,
        readWallSensorRuntimeData: (level: number, sensor: SensorObject, state: TestState) =>
            readWallSensorRuntimeData(level, sensor, state.sensorRuntimeData),
        writeWallSensorRuntimeData: (
            level: number,
            sensor: SensorObject,
            state: TestState,
            nextValue: number,
        ) => writeWallSensorRuntimeData(level, sensor, state.sensorRuntimeData, nextValue),
        hasWallFaceLocalRotationEffect: () => false,
        rotateWallFaceSensors: (_level: number, _x: number, _y: number, _face: SensorObject['tilePos'], offsets: Record<string, number>) => offsets,
        wallSensorFaceMask: {
            North: 1,
            East: 2,
            South: 4,
            West: 8,
        },
    };

    const sourceSensor = createSensor({
        index: 400,
        type: 3,
        action: 'Set',
        targetX: 7,
        targetY: 1,
        targetDir: 'North',
    });

    const result = applyPatch(createState(), dispatchTriggeredSensorEffect(sourceSensor, 12, createState(), deps));

    assert.equal(generatorTriggerCount, 1);
    assert.deepEqual([...result.activeSensors], ['generator-fired']);
});

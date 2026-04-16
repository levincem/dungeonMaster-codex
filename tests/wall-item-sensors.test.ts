import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampionEquipment, FloorItem, SensorAction } from '../src/types/game.js';
import {
    applyFirestaffExchangerReward,
    clearAlcoveStateOnPickup,
    triggerAlcoveDepositSensor,
    triggerAnyObjectWallSensor,
    triggerLockSensors,
    triggerObjectExchangerSensor,
} from '../src/engine/systems/wallItemSensors.js';

type SensorState = {
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    openDoors: Set<string>;
    sensorRotationOffsets: Record<string, number>;
};

function createState(overrides: Partial<SensorState> = {}): SensorState {
    return {
        activeSensors: new Set<string>(),
        firedSensors: new Set<string>(),
        openDoors: new Set<string>(),
        sensorRotationOffsets: {},
        ...overrides,
    };
}

function createWeapon(id: string, typeId: number): FloorItem {
    return {
        id,
        category: 'Weapon',
        typeId,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

function createDeps(overrides: Record<string, unknown> = {}) {
    return {
        getTile: () => ({ x: 0, y: 0, type: 'Wall' as const, objects: [] }),
        getWallFaceSensorsInRuntimeOrder: () => [],
        isWallLockSensor: () => false,
        isWallAlcoveSensor: () => false,
        isWallObjectExchangerSensor: () => false,
        isWallSensorConsumedAtRuntime: () => false,
        getRequiredSensorItemName: () => undefined,
        itemMatchesMechanismRequirement: () => false,
        itemToLockData: () => 0,
        isConsumableLockSensor: () => false,
        computeSensorEffect: () => ({}),
        resolveDoorSoundTarget: () => ({ level: 0, x: 0, y: 0 }),
        playDoorMotion: () => undefined,
        shouldRotateWallFaceAfterActivation: () => false,
        rotateWallFaceSensors: () => ({}),
        diffSensorState: (_before: SensorState, after: SensorState) => ({
            activeSensors: after.activeSensors,
            openDoors: after.openDoors,
            sensorRotationOffsets: after.sensorRotationOffsets,
        }),
        applyToSet: (set: Set<string>, key: string, action: SensorAction) => {
            const next = new Set(set);
            if (action === 'Clear') next.delete(key);
            else next.add(key);
            return next;
        },
        buildSensorStateSnapshot: (state: SensorState) => state,
        ...overrides,
    };
}

test('triggerLockSensors consumes a matching inventory item and rotates the wall face', () => {
    const playedTargets: Array<{ level: number; x: number; y: number } | null> = [];
    const sensor = { category: 'Sensor', index: 11, type: 17, data: 99, onceOnly: false, revert: false, tilePos: 'North' } as const;
    const key = createWeapon('key-1', 4);
    const deps = createDeps({
        getWallFaceSensorsInRuntimeOrder: () => [sensor],
        isWallLockSensor: () => true,
        itemToLockData: () => 99,
        isConsumableLockSensor: () => true,
        computeSensorEffect: () => ({ openDoors: new Set(['door-a']) }),
        playDoorMotion: (target: { level: number; x: number; y: number } | null) => playedTargets.push(target),
        shouldRotateWallFaceAfterActivation: () => true,
        rotateWallFaceSensors: () => ({ north: 1 }),
    });

    const result = triggerLockSensors(
        0,
        4,
        5,
        'North',
        createState(),
        { 1: [key] },
        {} as Record<number, ChampionEquipment>,
        deps,
    );

    assert.equal(result.matched, true);
    assert.deepEqual(result.newInventories, { 1: [] });
    assert.deepEqual(Array.from(result.sensorChanges.openDoors ?? []), ['door-a']);
    assert.deepEqual(result.sensorChanges.sensorRotationOffsets, { north: 1 });
    assert.equal(playedTargets.length, 1);
});

test('triggerAlcoveDepositSensor removes the selected item and places it on the alcove tile', () => {
    const sensor = { category: 'Sensor', index: 7, type: 3, tilePos: 'West' } as const;
    const dagger = createWeapon('dagger', 2);
    const deps = createDeps({
        getWallFaceSensorsInRuntimeOrder: () => [sensor],
        isWallAlcoveSensor: () => true,
        rotateWallFaceSensors: () => ({ west: 2 }),
    });

    const result = triggerAlcoveDepositSensor(
        2,
        8,
        9,
        'West',
        createState(),
        { 3: [dagger] },
        {} as Record<number, ChampionEquipment>,
        { championId: 3, itemId: dagger.id, fromSlot: 'inventory' },
        deps,
    );

    assert.equal(result.matched, true);
    assert.deepEqual(result.newInventories, { 3: [] });
    assert.deepEqual(result.depositedItem, { ...dagger, mapIndex: 2, x: 8, y: 9, tilePos: 'West' });
    assert.deepEqual(result.sensorChanges.sensorRotationOffsets, { west: 2 });
});

test('triggerAnyObjectWallSensor treats hold sensors as set when applying the effect', () => {
    const receivedActions: string[] = [];
    const sensor = { category: 'Sensor', index: 2, type: 2, revert: false, action: 'Hold', tilePos: 'East' } as const;
    const deps = createDeps({
        getWallFaceSensorsInRuntimeOrder: () => [sensor],
        computeSensorEffect: (entry: { action: string }) => {
            receivedActions.push(entry.action);
            return { openDoors: new Set(['door-b']) };
        },
    });

    const result = triggerAnyObjectWallSensor(0, 1, 1, 'East', createState(), deps);

    assert.equal(result.matched, true);
    assert.deepEqual(receivedActions, ['Set']);
    assert.deepEqual(Array.from(result.sensorChanges.openDoors ?? []), ['door-b']);
});

test('triggerObjectExchangerSensor skips the Firestaff exchange until the Zokathra unlock has fired', () => {
    const zokathraSensor = { category: 'Sensor', index: 30, type: 17, tilePos: 'South' } as const;
    const firestaffSensor = { category: 'Sensor', index: 31, type: 16, tilePos: 'South' } as const;
    const fallbackSensor = { category: 'Sensor', index: 32, type: 16, tilePos: 'South' } as const;
    const weapon = createWeapon('weapon-1', 7);
    const deps = createDeps({
        getWallFaceSensorsInRuntimeOrder: () => [zokathraSensor, firestaffSensor, fallbackSensor],
        isWallObjectExchangerSensor: (sensor: { index: number }) => sensor.index === 31 || sensor.index === 32,
        getRequiredSensorItemName: (sensor: { index: number }) => {
            if (sensor.index === 30) return 'ZOKATHRA SPELL';
            if (sensor.index === 31) return 'THE FIRESTAFF';
            return undefined;
        },
    });

    const result = triggerObjectExchangerSensor(
        1,
        2,
        3,
        'South',
        createState(),
        { 4: [weapon] },
        {} as Record<number, ChampionEquipment>,
        { championId: 4, itemId: weapon.id, fromSlot: 'inventory' },
        deps,
    );

    assert.equal(result.matched, true);
    assert.deepEqual(result.newInventories, { 4: [] });
    assert.deepEqual(Array.from(result.sensorChanges.activeSensors ?? []), ['1_32']);
});

test('clearAlcoveStateOnPickup clears the active sensor flag and rotates the face', () => {
    const alcoveSensor = { category: 'Sensor', index: 19, type: 3, tilePos: 'North' } as const;
    const item = { ...createWeapon('item-1', 5), mapIndex: 6, x: 7, y: 8, tilePos: 'North' as const };
    const state = createState({
        activeSensors: new Set(['6_19']),
        sensorRotationOffsets: { north: 0 },
    });
    const deps = createDeps({
        getWallFaceSensorsInRuntimeOrder: () => [alcoveSensor],
        isWallAlcoveSensor: () => true,
        rotateWallFaceSensors: () => ({ north: 1 }),
    });

    const result = clearAlcoveStateOnPickup(item, state, deps);

    assert.deepEqual(Array.from(result.activeSensors ?? []), []);
    assert.deepEqual(result.sensorRotationOffsets, { north: 1 });
});

test('applyFirestaffExchangerReward upgrades the base Firestaff and removes the wall reward', () => {
    const baseFirestaff = createWeapon('base-firestaff', 7);
    const reward = {
        ...createWeapon('reward-firestaff', 45),
        mapIndex: 3,
        x: 10,
        y: 11,
        tilePos: 'West' as const,
    };

    const result = applyFirestaffExchangerReward(
        {
            level: 3,
            position: [4, 5],
            championInventories: { 1: [] },
            championEquipment: { 1: {} },
        },
        10,
        11,
        'West',
        baseFirestaff,
        { championId: 1, fromSlot: 'inventory' },
        { 1: [] },
        null,
        [reward],
    );

    assert.equal(result.transformed, true);
    assert.equal(result.nextFloorItems.length, 0);
    assert.equal(result.nextInventories?.[1]?.[0]?.typeId, 45);
    assert.deepEqual(
        result.nextInventories?.[1]?.[0] && {
            mapIndex: result.nextInventories[1][0].mapIndex,
            x: result.nextInventories[1][0].x,
            y: result.nextInventories[1][0].y,
            tilePos: result.nextInventories[1][0].tilePos,
        },
        { mapIndex: 3, x: 5, y: 4, tilePos: 'North' },
    );
});

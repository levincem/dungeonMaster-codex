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
        isOriginalAlcoveWallFace: () => false,
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
        diffSensorState: (before: SensorState, after: SensorState) => ({
            ...(after.activeSensors !== before.activeSensors ? { activeSensors: after.activeSensors } : {}),
            ...(after.firedSensors !== before.firedSensors ? { firedSensors: after.firedSensors } : {}),
            ...(after.openDoors !== before.openDoors ? { openDoors: after.openDoors } : {}),
            ...(after.sensorRotationOffsets !== before.sensorRotationOffsets
                ? { sensorRotationOffsets: after.sensorRotationOffsets }
                : {}),
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

test('triggerLockSensors skips inert persistent locks and advances to the next effective matching lock', () => {
    const processed: number[] = [];
    const inertLock = {
        category: 'Sensor',
        index: 41,
        type: 3,
        data: 99,
        onceOnly: false,
        revert: false,
        tilePos: 'North',
    } as const;
    const consumingLock = {
        category: 'Sensor',
        index: 42,
        type: 4,
        data: 99,
        onceOnly: true,
        revert: false,
        tilePos: 'North',
    } as const;
    const key = createWeapon('key-2', 6);
    const deps = createDeps({
        getWallFaceSensorsInRuntimeOrder: () => [inertLock, consumingLock],
        isWallLockSensor: () => true,
        itemToLockData: () => 99,
        isConsumableLockSensor: (sensor: { index: number }) => sensor.index === 42,
        computeSensorEffect: (sensor: { index: number }, _level: number, state: SensorState) => {
            processed.push(sensor.index);
            if (sensor.index === 41) {
                return { openDoors: state.openDoors };
            }
            return {
                firedSensors: new Set(['0_42']),
                openDoors: new Set(['door-next']),
            };
        },
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

    assert.deepEqual(processed, [41, 42]);
    assert.equal(result.matched, true);
    assert.deepEqual(result.newInventories, { 1: [] });
    assert.deepEqual(Array.from(result.sensorChanges.firedSensors ?? []), ['0_42']);
    assert.deepEqual(Array.from(result.sensorChanges.openDoors ?? []), ['door-next']);
});

test('triggerLockSensors processes the full matching lock sequence on a multi-lock face', () => {
    const processed: number[] = [];
    const firstLock = {
        category: 'Sensor',
        index: 51,
        type: 3,
        data: 77,
        onceOnly: true,
        revert: false,
        tilePos: 'North',
    } as const;
    const secondLock = {
        category: 'Sensor',
        index: 52,
        type: 4,
        data: 77,
        onceOnly: true,
        revert: false,
        tilePos: 'North',
    } as const;
    const key = createWeapon('key-3', 7);
    const deps = createDeps({
        getWallFaceSensorsInRuntimeOrder: () => [firstLock, secondLock],
        isWallLockSensor: () => true,
        itemToLockData: () => 77,
        isConsumableLockSensor: (sensor: { index: number }) => sensor.index === 52,
        computeSensorEffect: (sensor: { index: number }, _level: number, state: SensorState) => {
            processed.push(sensor.index);
            if (sensor.index === 51) {
                return {
                    firedSensors: new Set([...state.firedSensors, '0_51']),
                    openDoors: new Set([...state.openDoors, 'door-first']),
                };
            }
            return {
                firedSensors: new Set([...state.firedSensors, '0_52']),
                openDoors: new Set([...state.openDoors, 'door-second']),
            };
        },
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

    assert.deepEqual(processed, [51, 52]);
    assert.equal(result.matched, true);
    assert.deepEqual(result.newInventories, { 1: [] });
    assert.deepEqual(Array.from(result.sensorChanges.firedSensors ?? []).sort(), ['0_51', '0_52']);
    assert.deepEqual(Array.from(result.sensorChanges.openDoors ?? []).sort(), ['door-first', 'door-second']);
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

test('triggerAnyObjectWallSensor ignores specific-object type 2 sensors so they can be handled by alcove-style deposits', () => {
    const sensor = {
        category: 'Sensor',
        index: 23,
        type: 2,
        data: 138,
        revert: false,
        action: 'Set',
        tilePos: 'North',
    } as const;
    const deps = createDeps({
        getWallFaceSensorsInRuntimeOrder: () => [sensor],
        getRequiredSensorItemName: () => 'CORBAMITE',
        computeSensorEffect: () => {
            throw new Error('specific-object type 2 sensors must not use the any-object fallback');
        },
    });

    const result = triggerAnyObjectWallSensor(0, 1, 1, 'North', createState(), deps);

    assert.equal(result.matched, false);
    assert.deepEqual(result.sensorChanges, {});
});

test('triggerAlcoveDepositSensor supports hold wall niches backed by a mounted item', () => {
    const sensor = {
        category: 'Sensor',
        index: 7,
        type: 1,
        revert: false,
        action: 'Hold',
        tilePos: 'West',
    } as const;
    const coin = {
        id: 'coin-1',
        category: 'Misc' as const,
        typeId: 7,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'West' as const,
    };
    const dagger = createWeapon('dagger-2', 3);
    const deps = createDeps({
        getTile: () => ({ x: 8, y: 9, type: 'Wall' as const, objects: [sensor, coin] }),
        getWallFaceSensorsInRuntimeOrder: () => [sensor],
        computeSensorEffect: () => ({ openDoors: new Set(['door-c']) }),
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
    assert.deepEqual(Array.from(result.sensorChanges.openDoors ?? []), ['door-c']);
});

test('triggerAlcoveDepositSensor supports original alcove-shaped hold sensors with reverse logic', () => {
    const receivedActions: string[] = [];
    const sensor = {
        category: 'Sensor',
        index: 15,
        type: 2,
        revert: true,
        action: 'Hold',
        tilePos: 'West',
    } as const;
    const gem = {
        id: 'gem-1',
        category: 'Misc' as const,
        typeId: 1,
        rawName: 'Blue Gem',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'West' as const,
    };
    const deps = createDeps({
        getTile: () => ({ x: 8, y: 9, type: 'Wall' as const, objects: [sensor] }),
        getWallFaceSensorsInRuntimeOrder: () => [sensor],
        isOriginalAlcoveWallFace: () => true,
        getRequiredSensorItemName: () => 'BLUE GEM',
        itemMatchesMechanismRequirement: () => true,
        computeSensorEffect: (entry: { action: string }) => {
            receivedActions.push(entry.action);
            return { openDoors: new Set(['door-d']) };
        },
    });

    const result = triggerAlcoveDepositSensor(
        2,
        8,
        9,
        'West',
        createState(),
        { 3: [gem] },
        {} as Record<number, ChampionEquipment>,
        { championId: 3, itemId: gem.id, fromSlot: 'inventory' },
        deps,
    );

    assert.equal(result.matched, true);
    assert.deepEqual(result.newInventories, { 3: [] });
    assert.deepEqual(result.depositedItem, { ...gem, mapIndex: 2, x: 8, y: 9, tilePos: 'West' });
    assert.deepEqual(receivedActions, ['Clear']);
    assert.deepEqual(Array.from(result.sensorChanges.openDoors ?? []), ['door-d']);
});

test('triggerAlcoveDepositSensor supports original alcove faces backed by one-shot type 2 specific-object sensors', () => {
    const sensor = {
        category: 'Sensor',
        index: 24,
        type: 2,
        data: 138,
        revert: false,
        action: 'Set',
        onceOnly: true,
        tilePos: 'North',
    } as const;
    const corbamite = {
        id: 'corbamite-1',
        category: 'Misc' as const,
        typeId: 47,
        rawName: 'Corbamite',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North' as const,
    };
    const deps = createDeps({
        getTile: () => ({ x: 8, y: 9, type: 'Wall' as const, objects: [sensor] }),
        getWallFaceSensorsInRuntimeOrder: () => [sensor],
        isOriginalAlcoveWallFace: () => true,
        getRequiredSensorItemName: () => 'CORBAMITE',
        itemMatchesMechanismRequirement: () => true,
        computeSensorEffect: () => ({ openDoors: new Set(['door-e']) }),
    });

    const result = triggerAlcoveDepositSensor(
        2,
        8,
        9,
        'North',
        createState(),
        { 3: [corbamite] },
        {} as Record<number, ChampionEquipment>,
        { championId: 3, itemId: corbamite.id, fromSlot: 'inventory' },
        deps,
    );

    assert.equal(result.matched, true);
    assert.deepEqual(result.newInventories, { 3: [] });
    assert.deepEqual(result.depositedItem, { ...corbamite, mapIndex: 2, x: 8, y: 9, tilePos: 'North' });
    assert.deepEqual(Array.from(result.sensorChanges.openDoors ?? []), ['door-e']);
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

test('clearAlcoveStateOnPickup releases hold wall niches when the last mounted item is removed', () => {
    const holderSensor = {
        category: 'Sensor',
        index: 21,
        type: 1,
        revert: false,
        action: 'Hold',
        tilePos: 'North',
    } as const;
    const item = { ...createWeapon('item-2', 5), mapIndex: 6, x: 7, y: 8, tilePos: 'North' as const };
    const deps = createDeps({
        getTile: () => ({ x: 7, y: 8, type: 'Wall' as const, objects: [holderSensor, item] }),
        getWallFaceSensorsInRuntimeOrder: () => [holderSensor],
        computeSensorEffect: (entry: { action: string }) => ({ openDoors: new Set([`effect-${entry.action}`]) }),
    });

    const result = clearAlcoveStateOnPickup(item, {
        ...createState(),
        floorItems: [item],
    }, deps);

    assert.deepEqual(Array.from(result.openDoors ?? []), ['effect-Clear']);
});

test('clearAlcoveStateOnPickup triggers mounted-item pickup wall buttons even when the runtime sensor has no explicit item name', () => {
    const receivedActions: string[] = [];
    const sensor = {
        category: 'Sensor',
        index: 566,
        type: 2,
        revert: true,
        action: 'Set',
        onceOnly: true,
        tilePos: 'East',
    } as const;
    const item = {
        id: 'diamond-edge-1',
        category: 'Weapon' as const,
        typeId: 15,
        rawName: 'Diamond Edge',
        mapIndex: 10,
        x: 0,
        y: 14,
        tilePos: 'East' as const,
    };
    const deps = createDeps({
        getTile: () => ({ x: 0, y: 14, type: 'Wall' as const, objects: [sensor, item] }),
        getWallFaceSensorsInRuntimeOrder: () => [sensor],
        getRequiredSensorItemName: () => undefined,
        itemMatchesMechanismRequirement: () => false,
        computeSensorEffect: (entry: { action: string }) => {
            receivedActions.push(entry.action);
            return { openDoors: new Set([`effect-${entry.action}`]) };
        },
    });

    const result = clearAlcoveStateOnPickup(item, {
        ...createState(),
        floorItems: [item],
    }, deps);

    assert.deepEqual(receivedActions, ['Set']);
    assert.deepEqual(Array.from(result.openDoors ?? []), ['effect-Set']);
});

test('clearAlcoveStateOnPickup restores original alcove-shaped reverse hold sensors when the last item is removed', () => {
    const receivedActions: string[] = [];
    const holderSensor = {
        category: 'Sensor',
        index: 22,
        type: 2,
        revert: true,
        action: 'Hold',
        tilePos: 'North',
    } as const;
    const item = {
        id: 'item-3',
        category: 'Misc' as const,
        typeId: 1,
        rawName: 'Blue Gem',
        mapIndex: 6,
        x: 7,
        y: 8,
        tilePos: 'North' as const,
    };
    const deps = createDeps({
        getTile: () => ({ x: 7, y: 8, type: 'Wall' as const, objects: [holderSensor] }),
        getWallFaceSensorsInRuntimeOrder: () => [holderSensor],
        isOriginalAlcoveWallFace: () => true,
        getRequiredSensorItemName: () => 'BLUE GEM',
        itemMatchesMechanismRequirement: () => true,
        computeSensorEffect: (entry: { action: string }) => {
            receivedActions.push(entry.action);
            return { openDoors: new Set([`effect-${entry.action}`]) };
        },
    });

    const result = clearAlcoveStateOnPickup(item, {
        ...createState(),
        floorItems: [item],
    }, deps);

    assert.deepEqual(receivedActions, ['Set']);
    assert.deepEqual(Array.from(result.openDoors ?? []), ['effect-Set']);
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

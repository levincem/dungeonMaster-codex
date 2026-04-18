import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    PUSH_FACE_BY_DIRECTION,
    applySensorActionToSet,
    diffStoreSensorState,
    partyHasRequiredMechanismItem,
    tileHasRequiredMechanismFloorItem,
} from '../src/engine/systems/storeSensorRuntime.js';

test('store sensor runtime applies Set, Clear, and Toggle actions on string sets', () => {
    const base = new Set<string>(['door_a']);

    const withAdded = applySensorActionToSet(base, 'door_b', 'Set');
    const withRemoved = applySensorActionToSet(withAdded, 'door_a', 'Clear');
    const withToggledOff = applySensorActionToSet(withRemoved, 'door_b', 'Toggle');
    const withToggledOn = applySensorActionToSet(withToggledOff, 'door_c', 'Toggle');

    assert.deepEqual([...withAdded].sort(), ['door_a', 'door_b']);
    assert.deepEqual([...withRemoved], ['door_b']);
    assert.deepEqual([...withToggledOff], []);
    assert.deepEqual([...withToggledOn], ['door_c']);
    assert.deepEqual([...base], ['door_a']);
});

test('store sensor runtime diffs only the changed sensor state slices', () => {
    const before = {
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
        creatures: [],
        pendingGeneratorSpawns: [],
        currentLevel: 0,
        currentPosition: [0, 0] as [number, number],
        elapsedGameTimeTicks: 0,
    };
    const after = {
        ...before,
        openDoors: new Set<string>(['0,1,2']),
        sensorRuntimeData: { gate: 3 },
    };

    const patch = diffStoreSensorState(before, after);

    assert.deepEqual([...patch.openDoors ?? []], ['0,1,2']);
    assert.deepEqual(patch.sensorRuntimeData, { gate: 3 });
    assert.equal('openPits' in patch, false);
    assert.equal('currentLevel' in patch, false);
});

test('store sensor runtime detects required mechanism items in inventories and equipment', () => {
    const matches = (item: { rawName?: string }, name: string | undefined) => item.rawName === name;
    const inventories = {
        0: [{ rawName: 'Iron Key' }] as Array<{ rawName: string }>,
    } as never;
    const equipment = {
        0: { rightHand: { rawName: 'Torch' }, neck: null },
        1: { chest: { rawName: 'Emerald Key' } },
    } as never;

    assert.equal(partyHasRequiredMechanismItem('Emerald Key', inventories, equipment, matches as never), true);
    assert.equal(partyHasRequiredMechanismItem('Iron Key', inventories, equipment, matches as never), true);
    assert.equal(partyHasRequiredMechanismItem('Ra Key', inventories, equipment, matches as never), false);
    assert.equal(partyHasRequiredMechanismItem(undefined, inventories, equipment, matches as never), false);
});

test('store sensor runtime detects required floor items on the targeted tile only', () => {
    const floorItems = [
        { mapIndex: 1, x: 2, y: 3, rawName: 'Corbum' },
        { mapIndex: 1, x: 4, y: 3, rawName: 'Key of B' },
    ] as Array<{ mapIndex: number; x: number; y: number; rawName: string }>;
    const matches = (item: { rawName?: string }, name: string | undefined) => item.rawName === name;

    assert.equal(
        tileHasRequiredMechanismFloorItem(1, 2, 3, 'Corbum', floorItems as never, matches as never),
        true,
    );
    assert.equal(
        tileHasRequiredMechanismFloorItem(1, 2, 3, 'Key of B', floorItems as never, matches as never),
        false,
    );
    assert.equal(PUSH_FACE_BY_DIRECTION.NORTH, 'South');
    assert.equal(PUSH_FACE_BY_DIRECTION.WEST, 'East');
});

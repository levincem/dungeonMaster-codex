import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DoorObject, GameMap, GameTile } from '../src/types/game.js';
import {
    buildMinimapTileKey,
    computeVisibleMinimapTileMemory,
    mergeMinimapTileMemory,
} from '../src/engine/systems/minimapDiscovery.js';

function createDoorObject(overrides: Partial<DoorObject> = {}): DoorObject {
    return {
        category: 'Door',
        index: 1,
        tilePos: 'North',
        destructChop: false,
        destructFire: false,
        hasButton: false,
        openDirection: 'Horizontal',
        ornate: 0,
        doorType: 1,
        ...overrides,
    };
}

function createTile(
    x: number,
    y: number,
    type: GameTile['type'],
    overrides: Partial<GameTile> = {},
): GameTile {
    return {
        x,
        y,
        type,
        objects: [],
        ...overrides,
    };
}

function buildMap(
    width: number,
    height: number,
    overrides: Record<string, GameTile>,
): GameMap {
    const tiles: GameTile[][] = Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (_, x) => overrides[`${x},${y}`] ?? createTile(x, y, 'Wall')),
    );

    return {
        index: 0,
        name: 'Test Map',
        level: 0,
        width,
        height,
        difficulty: 1,
        tiles,
    };
}

test('minimap discovery does not reveal the corridor behind a closed door', () => {
    const map = buildMap(3, 3, {
        '1,2': createTile(1, 2, 'Floor'),
        '1,1': createTile(1, 1, 'Door', { objects: [createDoorObject()] }),
        '1,0': createTile(1, 0, 'Floor'),
    });

    const updates = computeVisibleMinimapTileMemory({
        map,
        level: 0,
        position: [2, 1],
        direction: 'NORTH',
        openDoors: new Set(),
        openPits: new Set(),
        openTeleporters: new Set(),
        openWalls: new Set(),
    });

    assert.equal(updates[buildMinimapTileKey(0, 1, 1)], 'doorClosed');
    assert.equal(updates[buildMinimapTileKey(0, 0, 1)], undefined);
});

test('minimap memory keeps the last seen door state until the door is seen again', () => {
    const map = buildMap(3, 3, {
        '1,2': createTile(1, 2, 'Floor'),
        '1,1': createTile(1, 1, 'Door', { objects: [createDoorObject()] }),
    });
    const doorKey = buildMinimapTileKey(0, 1, 1);

    const closedUpdates = computeVisibleMinimapTileMemory({
        map,
        level: 0,
        position: [2, 1],
        direction: 'NORTH',
        openDoors: new Set(),
        openPits: new Set(),
        openTeleporters: new Set(),
        openWalls: new Set(),
    });
    let memory = mergeMinimapTileMemory({}, closedUpdates) ?? {};

    assert.equal(memory[doorKey], 'doorClosed');

    const hiddenOpenUpdates = computeVisibleMinimapTileMemory({
        map,
        level: 0,
        position: [2, 1],
        direction: 'SOUTH',
        openDoors: new Set([doorKey]),
        openPits: new Set(),
        openTeleporters: new Set(),
        openWalls: new Set(),
    });
    memory = mergeMinimapTileMemory(memory, hiddenOpenUpdates) ?? memory;

    assert.equal(memory[doorKey], 'doorClosed');

    const visibleOpenUpdates = computeVisibleMinimapTileMemory({
        map,
        level: 0,
        position: [2, 1],
        direction: 'NORTH',
        openDoors: new Set([doorKey]),
        openPits: new Set(),
        openTeleporters: new Set(),
        openWalls: new Set(),
    });
    memory = mergeMinimapTileMemory(memory, visibleOpenUpdates) ?? memory;

    assert.equal(memory[doorKey], 'doorOpen');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRID_SIZE } from '../src/engine/constants.js';
import {
    isFloorItemWallMountedTile,
    resolveFloorItemPresentation,
} from '../src/components/Dungeon/floorItemPresentation.js';
import type { FloorItem, GameTile } from '../src/types/game.js';

function createFloorItem(overrides: Partial<FloorItem> = {}): FloorItem {
    return {
        id: 'item-1',
        category: 'Weapon',
        typeId: 1,
        mapIndex: 0,
        x: 5,
        y: 7,
        tilePos: 'North',
        ...overrides,
    };
}

test('resolveFloorItemPresentation keeps the default placement for unoccupied tiles', () => {
    const presentation = resolveFloorItemPresentation(createFloorItem(), 'NORTH', false);

    assert.deepEqual(presentation.position, [
        5 * GRID_SIZE,
        (-GRID_SIZE / 2) + (GRID_SIZE * 0.38) * 0.22,
        7 * GRID_SIZE - 0.30,
    ]);
    assert.equal(presentation.scale, 1);
});

test('resolveFloorItemPresentation pulls occupied-tile items slightly toward the viewer and lifts them', () => {
    const presentation = resolveFloorItemPresentation(createFloorItem(), 'NORTH', true);

    assert.deepEqual(presentation.position, [
        5 * GRID_SIZE,
        (-GRID_SIZE / 2) + (GRID_SIZE * 0.38) * 0.22 + GRID_SIZE * 0.1,
        7 * GRID_SIZE - 0.30 + GRID_SIZE * 0.14,
    ]);
    assert.equal(presentation.scale, 1.08);
});

test('resolveFloorItemPresentation biases occupied-tile items from the viewer side for each facing', () => {
    const eastFacing = resolveFloorItemPresentation(createFloorItem({ tilePos: 'East' }), 'EAST', true);
    const westFacing = resolveFloorItemPresentation(createFloorItem({ tilePos: 'West' }), 'WEST', true);

    assert.equal(eastFacing.position[0], 5 * GRID_SIZE + 0.30 - GRID_SIZE * 0.14);
    assert.equal(westFacing.position[0], 5 * GRID_SIZE - 0.30 + GRID_SIZE * 0.14);
});

test('isFloorItemWallMountedTile treats opened trick walls as floor placement', () => {
    const closedTrickWall: GameTile = { x: 29, y: 25, type: 'TrickWall', objects: [] };
    const openWalls = new Set<string>(['2,25,29']);

    assert.equal(isFloorItemWallMountedTile(2, { x: 1, y: 2, type: 'Wall', objects: [] }, openWalls), true);
    assert.equal(isFloorItemWallMountedTile(2, closedTrickWall, new Set()), true);
    assert.equal(isFloorItemWallMountedTile(2, closedTrickWall, openWalls), false);
    assert.equal(isFloorItemWallMountedTile(2, { x: 29, y: 25, type: 'Floor', objects: [] }, openWalls), false);
});

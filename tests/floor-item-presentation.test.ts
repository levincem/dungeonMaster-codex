import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRID_SIZE } from '../src/engine/constants.js';
import {
    isFloorItemWallMountedTile,
    resolvePartyTileCameraAnchor,
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

function assertNearlyEqual(actual: number, expected: number, epsilon = 1e-9) {
    assert.ok(
        Math.abs(actual - expected) <= epsilon,
        `Expected ${actual} to be within ${epsilon} of ${expected}`,
    );
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

    assertNearlyEqual(presentation.position[0], 5 * GRID_SIZE);
    assertNearlyEqual(presentation.position[1], (-GRID_SIZE / 2) + (GRID_SIZE * 0.38) * 0.22 + GRID_SIZE * 0.1);
    assertNearlyEqual(presentation.position[2], 7 * GRID_SIZE - 0.30 + GRID_SIZE * 0.14);
    assert.equal(presentation.scale, 1.08);
});

test('resolveFloorItemPresentation biases occupied-tile items from the viewer side for each facing', () => {
    const eastFacing = resolveFloorItemPresentation(createFloorItem({ tilePos: 'East' }), 'EAST', true);
    const westFacing = resolveFloorItemPresentation(createFloorItem({ tilePos: 'West' }), 'WEST', true);

    assertNearlyEqual(eastFacing.position[0], 5 * GRID_SIZE + 0.30 - GRID_SIZE * 0.14);
    assertNearlyEqual(westFacing.position[0], 5 * GRID_SIZE - 0.30 + GRID_SIZE * 0.14);
});

test('resolveFloorItemPresentation pushes party-tile items farther toward the viewer than creature-tile items', () => {
    const presentation = resolveFloorItemPresentation(createFloorItem(), 'NORTH', false, true);

    assertNearlyEqual(presentation.position[0], 5 * GRID_SIZE + 0.135);
    assertNearlyEqual(presentation.position[1], (-GRID_SIZE / 2) + (GRID_SIZE * 0.38) * 0.22 + GRID_SIZE * 0.16);
    assertNearlyEqual(presentation.position[2], 7 * GRID_SIZE + GRID_SIZE * 0.42);
    assert.equal(presentation.scale, 1.16);
});

test('resolveFloorItemPresentation fans party-tile items along the front edge instead of leaving them under the party center', () => {
    const eastFacing = resolveFloorItemPresentation(createFloorItem({ tilePos: 'East' }), 'NORTH', false, true);
    const westFacing = resolveFloorItemPresentation(createFloorItem({ tilePos: 'West' }), 'NORTH', false, true);

    assertNearlyEqual(eastFacing.position[2], 7 * GRID_SIZE + GRID_SIZE * 0.42);
    assertNearlyEqual(westFacing.position[2], 7 * GRID_SIZE + GRID_SIZE * 0.42);
    assert.ok(eastFacing.position[0] !== westFacing.position[0]);
    assert.ok(Math.abs(eastFacing.position[0] - (5 * GRID_SIZE)) <= 0.35);
    assert.ok(Math.abs(westFacing.position[0] - (5 * GRID_SIZE)) <= 0.35);
});

test('resolvePartyTileCameraAnchor keeps current-tile items in front of the camera and rotates their lateral placement with facing', () => {
    const northEast = resolvePartyTileCameraAnchor(createFloorItem({ tilePos: 'East' }), 'NORTH');
    const southEast = resolvePartyTileCameraAnchor(createFloorItem({ tilePos: 'East' }), 'SOUTH');
    const northNorth = resolvePartyTileCameraAnchor(createFloorItem({ tilePos: 'North' }), 'NORTH');
    const southNorth = resolvePartyTileCameraAnchor(createFloorItem({ tilePos: 'North' }), 'SOUTH');

    assert.ok(northEast.forward > 0);
    assert.ok(southEast.forward > 0);
    assert.ok(northEast.vertical < 0);
    assert.ok(southEast.vertical < 0);
    assert.ok(northEast.lateral > 0);
    assert.ok(southEast.lateral < 0);
    assert.ok(northNorth.forward !== southNorth.forward);
});

test('resolvePartyTileCameraAnchor lowers and separates stacked current-tile items while keeping the top item in front', () => {
    const bottom = resolvePartyTileCameraAnchor(createFloorItem({ tilePos: 'North' }), 'NORTH', 0, 3);
    const middle = resolvePartyTileCameraAnchor(createFloorItem({ tilePos: 'North' }), 'NORTH', 1, 3);
    const top = resolvePartyTileCameraAnchor(createFloorItem({ tilePos: 'North' }), 'NORTH', 2, 3);

    assert.ok(bottom.vertical < -GRID_SIZE * 0.3);
    assert.ok(middle.lateral !== bottom.lateral);
    assert.ok(top.lateral !== middle.lateral);
    assert.ok(top.forward > middle.forward);
    assert.ok(middle.forward > bottom.forward);
    assert.ok(top.scale > bottom.scale);
});

test('isFloorItemWallMountedTile treats opened trick walls as floor placement', () => {
    const closedTrickWall: GameTile = { x: 29, y: 25, type: 'TrickWall', objects: [] };
    const openWalls = new Set<string>(['2,25,29']);

    assert.equal(isFloorItemWallMountedTile(2, { x: 1, y: 2, type: 'Wall', objects: [] }, openWalls), true);
    assert.equal(isFloorItemWallMountedTile(2, closedTrickWall, new Set()), true);
    assert.equal(isFloorItemWallMountedTile(2, closedTrickWall, openWalls), false);
    assert.equal(isFloorItemWallMountedTile(2, { x: 29, y: 25, type: 'Floor', objects: [] }, openWalls), false);
});

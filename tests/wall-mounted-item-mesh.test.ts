import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRID_SIZE, WALL_HEIGHT } from '../src/engine/constants.js';
import { getWallMountedItemPresentation } from '../src/components/Dungeon/wallMountedItemPresentation.js';
import type { FloorItem } from '../src/types/game.js';

test('full torch holder faces use the overlay art without re-rendering the mounted torch sprite', () => {
    const wallTorch = {
        id: 'wall-torch',
        category: 'Weapon',
        typeId: 2,
        rawName: 'Torch',
        mapIndex: 1,
        x: 15,
        y: 8,
        tilePos: 'West',
    } as FloorItem;

    const presentation = getWallMountedItemPresentation(1, wallTorch);

    assert.equal(
        presentation.renderSprite,
        false,
        'the full holder overlay already includes the torch and should own the visible art',
    );
    assert.equal(presentation.spriteScale, 1, 'overlay-backed torch holders should not rely on sprite downscaling');
    assert.ok(
        Math.abs(presentation.pickupPlaneWidth - GRID_SIZE * 0.24) < 1e-9,
        'the hidden pickup plane should follow the calibrated full-holder width',
    );
    assert.ok(
        Math.abs(presentation.pickupPlaneHeight - WALL_HEIGHT * 0.92) < 1e-9,
        'the hidden pickup plane should follow the calibrated full-holder height',
    );
});

test('recessed altar wall items still keep their reduced sprite scale', () => {
    const altarItem = {
        id: 'altar-item',
        category: 'Misc',
        typeId: 5,
        rawName: 'Bones',
        mapIndex: 0,
        x: 4,
        y: 18,
        tilePos: 'North',
    } as FloorItem;

    const presentation = getWallMountedItemPresentation(0, altarItem);

    assert.equal(presentation.renderSprite, true, 'altar-mounted items should still render their own sprite');
    assert.ok(
        Math.abs(presentation.spriteScale - 0.42) < 1e-9,
        'recessed altar items should keep the calibrated reduced scale',
    );
});

test('plain wall-mounted items without a support overlay keep their own sprite presentation', () => {
    const genericWallItem = {
        id: 'generic-wall-item',
        category: 'Misc',
        typeId: 1,
        rawName: 'Coin',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    } as FloorItem;

    const presentation = getWallMountedItemPresentation(0, genericWallItem);

    assert.equal(presentation.renderSprite, true, 'plain wall-mounted items should stay visibly rendered');
    assert.equal(presentation.spriteScale, 1, 'plain wall-mounted items should keep the default scale');
    assert.ok(
        Math.abs(presentation.pickupPlaneWidth - GRID_SIZE * 0.42) < 1e-9,
        'plain wall-mounted items should keep the default pickup width',
    );
    assert.ok(
        Math.abs(presentation.pickupPlaneHeight - WALL_HEIGHT * 0.42) < 1e-9,
        'plain wall-mounted items should keep the default pickup height',
    );
});

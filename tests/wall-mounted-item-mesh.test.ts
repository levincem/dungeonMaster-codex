import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRID_SIZE, WALL_HEIGHT } from '../src/engine/constants.js';
import { getWallMountedItemPresentation } from '../src/components/Dungeon/wallMountedItemPresentation.js';
import type { FloorItem } from '../src/types/game.js';

test('full torch holder faces keep a visible mounted torch sprite for pickup feedback', () => {
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
        true,
        'full torch holders should still surface the torch as a visible mounted pickup',
    );
    assert.ok(
        Math.abs(presentation.spriteScale - 0.72) < 1e-9,
        'full torch holders should keep the torch sprite slightly reduced so it sits inside the support art',
    );
    assert.ok(
        Math.abs(presentation.spriteOffsetY - WALL_HEIGHT * 0.08) < 1e-9,
        'the mounted torch sprite should sit slightly above the holder center line',
    );
    assert.match(
        presentation.spriteImagePath ?? '',
        /torch_lit\.png$/,
        'full torch holders should render the mounted torch with the lit torch sprite',
    );
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
    assert.equal(presentation.spriteOffsetY, 0, 'non-holder wall items should keep the default vertical alignment');
});

test('slime outlet wall items inherit the recessed support scale', () => {
    const outletItem = {
        id: 'slime-outlet-key',
        category: 'Misc',
        typeId: 18,
        rawName: 'Gold Key',
        mapIndex: 3,
        x: 10,
        y: 30,
        tilePos: 'North',
    } as FloorItem;

    const presentation = getWallMountedItemPresentation(3, outletItem);

    assert.equal(presentation.renderSprite, true, 'slime outlet wall items should still render their own sprite');
    assert.ok(
        Math.abs(presentation.spriteScale - 0.42) < 1e-9,
        'slime outlet wall items should shrink with the recessed support overlay',
    );
    assert.equal(presentation.spriteOffsetY, 0, 'slime outlet wall items should keep the default vertical alignment');
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
    assert.equal(presentation.spriteOffsetY, 0, 'plain wall-mounted items should keep the default vertical alignment');
    assert.ok(
        Math.abs(presentation.pickupPlaneWidth - GRID_SIZE * 0.42) < 1e-9,
        'plain wall-mounted items should keep the default pickup width',
    );
    assert.ok(
        Math.abs(presentation.pickupPlaneHeight - WALL_HEIGHT * 0.42) < 1e-9,
        'plain wall-mounted items should keep the default pickup height',
    );
});

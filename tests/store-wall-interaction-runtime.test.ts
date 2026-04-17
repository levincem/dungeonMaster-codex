import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FloorItem, GameTile } from '../src/types/game.js';
import {
    applyStoreFrontWallInteractionResult,
    buildStoreChampionItemOnViAltarPatch,
    buildStoreFloorItemOnViAltarPatch,
} from '../src/engine/systems/storeWallInteractionRuntime.js';

function createBonesItem(id: string, championId: number): FloorItem {
    return {
        id,
        category: 'Misc',
        typeId: 5,
        championId,
        mapIndex: 0,
        x: 4,
        y: 17,
        tilePos: 'North',
    };
}

test('applyStoreFrontWallInteractionResult only applies matched patches and plays the plate once', () => {
    const applied: Array<Record<string, unknown>> = [];
    let plates = 0;

    assert.equal(applyStoreFrontWallInteractionResult(
        { matched: false, patch: null, shouldPlayPlate: true },
        {
            applyPatch: (patch) => applied.push(patch),
            playPlate: () => {
                plates += 1;
            },
        },
    ), false);

    assert.equal(applyStoreFrontWallInteractionResult(
        { matched: true, patch: { openDoors: ['0,17,4'] }, shouldPlayPlate: true },
        {
            applyPatch: (patch) => applied.push(patch),
            playPlate: () => {
                plates += 1;
            },
        },
    ), true);

    assert.deepEqual(applied, [{ openDoors: ['0,17,4'] }]);
    assert.equal(plates, 1);
});

test('buildStoreChampionItemOnViAltarPatch decorates the original resurrection patch', () => {
    const bones = createBonesItem('bones-1', 7);
    const touchedTiles: Array<[number, number, number]> = [];
    const tile: GameTile = { x: 4, y: 18, type: 'Wall', objects: [] };
    const patch = buildStoreChampionItemOnViAltarPatch(
        {
            level: 0,
            championInventories: { 1: [bones] },
            championEquipment: { 1: {} },
            floorItems: [],
            activeFloorDrag: null,
        },
        1,
        bones.id,
        'inventory',
        4,
        18,
        'South',
        {
            getTile: (level, x, y) => {
                touchedTiles.push([level, x, y]);
                return tile;
            },
            isAltarWallFaceSystem: (level, x, y, face, getTile) => {
                assert.equal(face, 'South');
                assert.equal(getTile(level, x, y), tile);
                return true;
            },
            buildBaseResurrectionPatch: (_state, deadChampionId, consumedItemId, carriedChampionId) => ({
                deadChampionId,
                consumedItemId,
                carriedChampionId,
            }),
            decorateResurrectionPatch: (_state, basePatch, wallX, wallY, wallFace, carriedBy) => {
                assert.ok(basePatch);
                return {
                    ...basePatch,
                    wallX,
                    wallY,
                    wallFace,
                    carriedBy,
                };
            },
        },
    );

    assert.deepEqual(touchedTiles, [[0, 4, 18]]);
    assert.deepEqual(patch, {
        deadChampionId: 7,
        consumedItemId: 'bones-1',
        carriedChampionId: 1,
        wallX: 4,
        wallY: 18,
        wallFace: 'South',
        carriedBy: { championId: 1, fromSlot: 'inventory' },
    });
});

test('buildStoreFloorItemOnViAltarPatch preserves floor-drag cleanup from the base interaction', () => {
    const bones = createBonesItem('bones-2', 9);

    const patch = buildStoreFloorItemOnViAltarPatch(
        {
            level: 0,
            championInventories: { 1: [] },
            championEquipment: { 1: {} },
            floorItems: [bones],
            activeFloorDrag: { itemId: bones.id },
        },
        bones.id,
        4,
        18,
        'South',
        {
            getTile: () => ({ x: 4, y: 18, type: 'Wall', objects: [] }),
            isAltarWallFaceSystem: () => true,
            buildBaseResurrectionPatch: (_state, deadChampionId, consumedItemId, carriedChampionId) => ({
                deadChampionId,
                consumedItemId,
                carriedChampionId,
            }),
            decorateResurrectionPatch: (_state, basePatch, wallX, wallY, wallFace, carriedBy) => {
                assert.ok(basePatch);
                return {
                    ...basePatch,
                    wallX,
                    wallY,
                    wallFace,
                    carriedBy,
                };
            },
        },
    );

    assert.deepEqual(patch, {
        deadChampionId: 9,
        consumedItemId: 'bones-2',
        carriedChampionId: null,
        wallX: 4,
        wallY: 18,
        wallFace: 'South',
        carriedBy: null,
        activeFloorDrag: null,
    });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import {
    buildUseChampionItemOnViAltarPatch,
    buildUseFloorItemOnViAltarPatch,
} from '../src/engine/systems/viAltarInteraction.js';

function createBones(id: string, championId: number): FloorItem {
    return {
        id,
        category: 'Misc',
        typeId: 5,
        rawName: 'Bones',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
        championId,
    };
}

test('buildUseChampionItemOnViAltarPatch revives bones only on the matching altar face', () => {
    const bones = createBones('bones-1', 7);
    const state = {
        level: 0,
        championInventories: { 1: [bones] },
        championEquipment: { 1: {} as ChampionEquipment },
        floorItems: [] as FloorItem[],
    };

    const patch = buildUseChampionItemOnViAltarPatch(
        state,
        1,
        bones.id,
        'inventory',
        5,
        17,
        'West',
        {
            isAltarWallFace: (_level, x, y, face) => x === 5 && y === 17 && face === 'West',
            buildViAltarResurrectionPatch: (_state, deadChampionId, consumedItemId, carriedBy) => ({
                deadChampionId,
                consumedItemId,
                carriedBy,
            }),
        },
    );

    assert.deepEqual(patch, {
        deadChampionId: 7,
        consumedItemId: bones.id,
        carriedBy: { championId: 1, fromSlot: 'inventory' },
    });

    const wrongFacePatch = buildUseChampionItemOnViAltarPatch(
        state,
        1,
        bones.id,
        'inventory',
        5,
        17,
        'East',
        {
            isAltarWallFace: (_level, x, y, face) => x === 5 && y === 17 && face === 'West',
            buildViAltarResurrectionPatch: () => ({ ok: true }),
        },
    );

    assert.equal(wrongFacePatch, null);
});

test('buildUseChampionItemOnViAltarPatch preserves the equipped hand slot for bone consumption', () => {
    const bones = createBones('bones-hand', 9);
    const state = {
        level: 0,
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: { leftHand: bones } as ChampionEquipment },
        floorItems: [] as FloorItem[],
    };

    const patch = buildUseChampionItemOnViAltarPatch(
        state,
        1,
        bones.id,
        'leftHand',
        5,
        17,
        'West',
        {
            isAltarWallFace: () => true,
            buildViAltarResurrectionPatch: (_state, deadChampionId, consumedItemId, carriedBy) => ({
                deadChampionId,
                consumedItemId,
                carriedBy,
            }),
        },
    );

    assert.deepEqual(patch, {
        deadChampionId: 9,
        consumedItemId: bones.id,
        carriedBy: { championId: 1, fromSlot: 'leftHand' },
    });
});

test('buildUseFloorItemOnViAltarPatch clears floor drag when the altar accepts the bones', () => {
    const bones = createBones('bones-floor', 8);
    const state = {
        level: 0,
        championInventories: {},
        championEquipment: {},
        floorItems: [bones],
        activeFloorDrag: { itemId: bones.id },
    };

    const patch = buildUseFloorItemOnViAltarPatch(
        state,
        bones.id,
        5,
        17,
        'West',
        {
            isAltarWallFace: () => true,
            buildViAltarResurrectionPatch: (_state, deadChampionId, consumedItemId, carriedBy) => ({
                deadChampionId,
                consumedItemId,
                carriedBy,
            }),
        },
    );

    assert.deepEqual(patch, {
        deadChampionId: 8,
        consumedItemId: bones.id,
        carriedBy: null,
        activeFloorDrag: null,
    });
});

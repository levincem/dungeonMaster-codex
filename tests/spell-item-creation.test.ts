import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildPlasmaSpellPatch,
    resolvePlasmaSpellResult,
} from '../src/engine/systems/spellItemCreation.js';

test('resolvePlasmaSpellResult creates the Zokathra item and picks the first free hand', () => {
    const result = resolvePlasmaSpellResult(
        100,
        3,
        [7, 9],
        { leftHand: { id: 'torch', category: 'Weapon', typeId: 2, mapIndex: 0, x: 0, y: 0, tilePos: 'North' } },
        'Zokathra',
        { buildIdSuffix: () => 'zok' },
    );

    assert.equal(result.freeSlot, 'rightHand');
    assert.deepEqual(result.item, {
        id: 'misc_zokathra_100_zok',
        mapIndex: 3,
        x: 9,
        y: 7,
        tilePos: 'North',
        category: 'Misc',
        typeId: 51,
        rawName: 'Zokathra',
    });
});

test('resolvePlasmaSpellResult returns null free slot when both hands are occupied', () => {
    const result = resolvePlasmaSpellResult(
        200,
        1,
        [4, 5],
        {
            rightHand: { id: 'a', category: 'Weapon', typeId: 1, mapIndex: 0, x: 0, y: 0, tilePos: 'North' },
            leftHand: { id: 'b', category: 'Weapon', typeId: 2, mapIndex: 0, x: 0, y: 0, tilePos: 'North' },
        },
        'Zokathra',
        { buildIdSuffix: () => 'full' },
    );

    assert.equal(result.freeSlot, null);
    assert.equal(result.item.id, 'misc_zokathra_200_full');
});

test('buildPlasmaSpellPatch equips the new item when a hand is free', () => {
    const result = {
        item: { id: 'zok', category: 'Misc', typeId: 51 } as never,
        freeSlot: 'rightHand' as const,
    };

    const patch = buildPlasmaSpellPatch({
        championId: 4,
        result,
        currentChampionVitals: { 4: { hp: 10 } } as never,
        nextVitals: { hp: 9 } as never,
        currentChampionEquipment: { 4: { leftHand: { id: 'torch' } } } as never,
        currentEquipment: { leftHand: { id: 'torch' } } as never,
        currentFloorItems: [],
        buildDroppedItem: () => {
            throw new Error('drop builder should not be used when a free slot exists');
        },
    });

    assert.deepEqual(patch, {
        championVitals: { 4: { hp: 9 } },
        championEquipment: {
            4: {
                leftHand: { id: 'torch' },
                rightHand: { id: 'zok', category: 'Misc', typeId: 51 },
            },
        },
    });
});

test('buildPlasmaSpellPatch drops the item on the floor when both hands are occupied', () => {
    const result = {
        item: { id: 'zok', category: 'Misc', typeId: 51 } as never,
        freeSlot: null,
    };

    const patch = buildPlasmaSpellPatch({
        championId: 4,
        result,
        currentChampionVitals: { 4: { hp: 10 } } as never,
        nextVitals: { hp: 8 } as never,
        currentChampionEquipment: { 4: {} } as never,
        currentEquipment: {},
        currentFloorItems: [{ id: 'existing' }] as never,
        buildDroppedItem: (item) => ({ ...item, dropped: true }) as never,
    });

    assert.deepEqual(patch, {
        championVitals: { 4: { hp: 8 } },
        floorItems: [
            { id: 'existing' },
            { id: 'zok', category: 'Misc', typeId: 51, dropped: true },
        ],
    });
});

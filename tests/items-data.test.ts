import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEquippableSlots } from '../src/data/equipment.js';
import { MISC_TYPES, getItemTypeIdByName, getPotionDef, getSourceItemAllowedSlotsMask } from '../src/data/items.js';
import type { FloorItem } from '../src/types/game.js';

test('MISC_TYPES expose source-backed food nutrition without requiring preload side effects', () => {
    assert.equal(MISC_TYPES[33]?.nutrition, 550);
    assert.equal(MISC_TYPES[34]?.nutrition, 350);
    assert.equal(MISC_TYPES[36]?.nutrition, 1400);
});

test('getSourceItemAllowedSlotsMask exposes packaged source masks synchronously', () => {
    assert.equal(getSourceItemAllowedSlotsMask('Potion', 14), 1281);
    assert.equal(getSourceItemAllowedSlotsMask('Weapon', 27), 1472);
});

test('getEquippableSlots can use extracted potion masks without waiting for runtime preload', () => {
    const item: FloorItem = {
        id: 'vi-potion',
        category: 'Potion',
        typeId: 14,
        rawName: 'Vi Potion',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };

    assert.deepEqual(getEquippableSlots(item), ['pocket1', 'pocket2', 'rightHand', 'leftHand']);
});

test('potion lookup resolves canonical names from packaged data and friendly aliases from compatibility mapping', () => {
    assert.equal(getItemTypeIdByName('Potion', 'Vi Potion'), 14);
    assert.equal(getItemTypeIdByName('Potion', 'Empty Flask'), 20);
    assert.equal(getItemTypeIdByName('Potion', 'Health Potion'), 14);
    assert.equal(getItemTypeIdByName('Potion', 'Antidote'), 10);

    assert.equal(getPotionDef(14, 'Health Potion')?.name, 'Vi Potion');
    assert.equal(getPotionDef(10, 'Antidote')?.name, 'Antivenin');
});

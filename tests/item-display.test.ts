import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDisplayedItemName } from '../src/data/itemDisplay.js';

test('getDisplayedItemName appends the facing direction for the compass only', () => {
    assert.equal(
        getDisplayedItemName('Compass', { category: 'Misc', typeId: 0, rawName: 'Compass' }, 'WEST'),
        'Compass (West)',
    );
});

test('getDisplayedItemName leaves other items unchanged', () => {
    assert.equal(
        getDisplayedItemName('Waterskin', { category: 'Misc', typeId: 1, rawName: 'Waterskin' }, 'NORTH'),
        'Empty Waterskin',
    );
});

test('getDisplayedItemName reflects the state of water containers', () => {
    assert.equal(
        getDisplayedItemName('Waterskin', { category: 'Potion', typeId: 24, rawName: 'Waterskin', waterCharges: 2 }, 'NORTH'),
        'Waterskin',
    );
    assert.equal(
        getDisplayedItemName('Water Flask', { category: 'Potion', typeId: 20, rawName: 'Empty Flask', waterCharges: 0 }, 'NORTH'),
        'Empty Flask',
    );
});

test('getDisplayedItemName appends empty state for exhausted charged items only', () => {
    assert.equal(
        getDisplayedItemName('Eye Of Time', { category: 'Weapon', typeId: 0, rawName: 'Eye Of Time', actionCharges: 0 }, 'NORTH'),
        'Eye Of Time (empty)',
    );
    assert.equal(
        getDisplayedItemName('Magical Box (Blue)', { category: 'Misc', typeId: 42, rawName: 'Magical Box (Blue)', actionCharges: 0 }, 'NORTH'),
        'Magical Box (Blue)',
    );
});

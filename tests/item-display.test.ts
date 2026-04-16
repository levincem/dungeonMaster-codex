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
        'Waterskin',
    );
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFloorItemImage } from '../src/data/itemImages.js';

test('getFloorItemImage resolves Rabbit\'s Foot to its dedicated sprite', () => {
    assert.match(
        getFloorItemImage({
            id: 'rabbit-foot',
            category: 'Misc',
            typeId: 46,
            rawName: "Rabbit's Foot",
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
        }),
        /rabbits_foot\.png$/,
    );
});

test('getFloorItemImage resolves Gold Key to its dedicated sprite', () => {
    assert.match(
        getFloorItemImage({
            id: 'gold-key',
            category: 'Misc',
            typeId: 17,
            rawName: 'Gold Key',
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
        }),
        /gold_key\.png$/,
    );
});

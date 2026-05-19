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

test('getFloorItemImage switches to charged weapon variants when available', () => {
    assert.match(
        getFloorItemImage({
            id: 'eye-full',
            category: 'Weapon',
            typeId: 0,
            rawName: 'Eye Of Time',
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
            actionCharges: 5,
        }),
        /eye_of_time_full\.png$/,
    );
    assert.match(
        getFloorItemImage({
            id: 'eye-empty',
            category: 'Weapon',
            typeId: 0,
            rawName: 'Eye Of Time',
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
            actionCharges: 0,
        }),
        /eye_of_time_empty\.png$/,
    );
    assert.match(
        getFloorItemImage({
            id: 'wand-full',
            category: 'Weapon',
            typeId: 35,
            rawName: 'Wand',
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
            actionCharges: 15,
        }),
        /wand_full\.png$/,
    );
    assert.match(
        getFloorItemImage({
            id: 'wand-empty',
            category: 'Weapon',
            typeId: 35,
            rawName: 'Wand',
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
            actionCharges: 0,
        }),
        /wand_empty\.png$/,
    );
});

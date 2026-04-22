import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FloorItem } from '../src/types/game.js';
import { consumeWaterContainer } from '../src/data/waterContainers.js';

function createItem(overrides: Partial<FloorItem>): FloorItem {
    return {
        id: 'item-1',
        category: 'Misc',
        typeId: 0,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
        ...overrides,
    };
}

test('consumeWaterContainer gives one flask ration for a water flask', () => {
    const result = consumeWaterContainer(createItem({
        category: 'Potion',
        typeId: 15,
        waterCharges: 1,
        waterMaxCharges: 1,
    }));

    assert.deepEqual(result, {
        nextItem: {
            ...createItem({
                category: 'Potion',
                typeId: 20,
                rawName: 'Empty Flask',
                waterCharges: 0,
                waterMaxCharges: 1,
            }),
        },
        waterGain: 800,
        staminaGain: 0,
    });
});

test('consumeWaterContainer gives one waterskin ration for a waterskin', () => {
    const result = consumeWaterContainer(createItem({
        category: 'Potion',
        typeId: 24,
        waterCharges: 4,
        waterMaxCharges: 4,
    }));

    assert.ok(result);
    assert.equal(result.waterGain, 1600);
    assert.equal(result.staminaGain, 0);
    assert.equal(result.nextItem.category, 'Potion');
    assert.equal(result.nextItem.typeId, 24);
    assert.equal(result.nextItem.waterCharges, 3);
    assert.equal(result.nextItem.waterMaxCharges, 4);
});

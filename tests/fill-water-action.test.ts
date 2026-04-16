import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FloorItem } from '../src/types/game.js';
import { resolveFillWaterAction } from '../src/engine/systems/fillWaterAction.js';

function createContainer(id: string, overrides: Partial<FloorItem> = {}): FloorItem {
    return {
        id,
        category: 'Potion',
        typeId: 20,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
        waterCharges: 0,
        waterMaxCharges: 1,
        ...overrides,
    };
}

test('resolveFillWaterAction fills a valid container in inventory', () => {
    const emptyFlask = createContainer('flask');
    const filledFlask = createContainer('flask', { typeId: 15, waterCharges: 1 });

    const patch = resolveFillWaterAction(
        {
            state: {
                championInventories: { 1: [emptyFlask] },
                championEquipment: { 1: {} },
            },
            championId: 1,
            itemId: emptyFlask.id,
        },
        {
            canFillWaterContainer: () => true,
            fillWaterContainer: () => filledFlask,
        },
    );

    assert.deepEqual(patch, {
        championInventories: { 1: [filledFlask] },
    });
});

test('resolveFillWaterAction returns null when the item cannot be filled', () => {
    const emptyFlask = createContainer('flask');

    const patch = resolveFillWaterAction(
        {
            state: {
                championInventories: { 1: [emptyFlask] },
                championEquipment: { 1: {} },
            },
            championId: 1,
            itemId: emptyFlask.id,
        },
        {
            canFillWaterContainer: () => false,
            fillWaterContainer: () => null,
        },
    );

    assert.equal(patch, null);
});

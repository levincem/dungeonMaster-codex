import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FloorItem } from '../src/types/game.js';
import { getOriginalThrownObjectExperience } from '../src/engine/systems/originalThrownObjectExperience.js';

function createItem(overrides: Partial<FloorItem> = {}): FloorItem {
    return {
        id: 'item',
        category: 'Misc',
        typeId: 0,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
        ...overrides,
    };
}

test('getOriginalThrownObjectExperience matches the original non-weapon base throw training', () => {
    assert.equal(getOriginalThrownObjectExperience(createItem(), null), 8);
});

test('getOriginalThrownObjectExperience matches the original weapon throw formula', () => {
    assert.equal(
        getOriginalThrownObjectExperience(
            createItem({ category: 'Weapon', typeId: 32, rawName: 'Throwing Star' }),
            { rawClass: 1, kineticEnergy: 19 },
        ),
        16,
    );
});

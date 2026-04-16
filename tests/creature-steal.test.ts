import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import { tryStealChampionItem } from '../src/engine/systems/creatureSteal.js';

function createItem(id: string, category: FloorItem['category'], typeId: number): FloorItem {
    return {
        id,
        category,
        typeId,
        rawName: id,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

test('tryStealChampionItem can steal from inventory using the rotating attempt order', () => {
    const inventory = [createItem('apple', 'Misc', 1), createItem('dagger', 'Weapon', 2)];
    const equipment: ChampionEquipment = {};
    const rolls = [2, 1, 0];
    const result = tryStealChampionItem(inventory, equipment, 10, 5, {
        randomInt: () => rolls.shift() ?? 0,
        isLucky: () => false,
    });

    assert.equal(result.stolenItem?.id, 'dagger');
    assert.deepEqual(result.nextInventory.map((item) => item.id), ['apple']);
    assert.equal(result.shouldFlee, true);
});

test('tryStealChampionItem can remove equipped items when the attempt lands on a slot', () => {
    const necklace = createItem('choker', 'Misc', 3);
    const equipment: ChampionEquipment = { neck: necklace };
    const result = tryStealChampionItem([], equipment, 0, 0, {
        randomInt: () => 0,
        isLucky: () => false,
    });

    assert.equal(result.stolenItem?.id, 'choker');
    assert.equal(result.nextEquipment.neck, undefined);
});

test('tryStealChampionItem returns without theft when luck stops the sequence immediately', () => {
    const inventory = [createItem('coin', 'Misc', 4)];
    const result = tryStealChampionItem(inventory, {}, 25, 40, {
        randomInt: () => 1,
        isLucky: () => true,
    });

    assert.equal(result.stolenItem, null);
    assert.deepEqual(result.nextInventory, inventory);
    assert.equal(result.shouldFlee, false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
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

function createVitals(luck: number): ChampionVitals {
    return {
        hp: 30,
        stamina: 25,
        mana: 5,
        food: 900,
        water: 900,
        currentStats: {
            luck,
            strength: 12,
            dexterity: 14,
            wisdom: 8,
            vitality: 10,
            antiMagic: 4,
            antiFire: 2,
        },
        wounds: {
            rightHand: false,
            leftHand: false,
            head: false,
            torso: false,
            legs: false,
            feet: false,
        },
        poisonEntries: [],
    };
}

test('tryStealChampionItem can steal from inventory using the rotating attempt order', () => {
    const inventory = [createItem('apple', 'Misc', 1), createItem('dagger', 'Weapon', 2)];
    const equipment: ChampionEquipment = {};
    const rolls = [2, 1, 0];
    const result = tryStealChampionItem(inventory, equipment, createVitals(5), 10, {
        randomInt: () => rolls.shift() ?? 0,
        applyLuckCheck: (currentVitals) => ({
            success: false,
            nextVitals: {
                ...currentVitals,
                currentStats: {
                    ...currentVitals.currentStats,
                    luck: (currentVitals.currentStats.luck ?? 0) + 2,
                },
            },
        }),
    });

    assert.equal(result.stolenItem?.id, 'dagger');
    assert.deepEqual(result.nextInventory.map((item) => item.id), ['apple']);
    assert.equal(result.nextVitals.currentStats.luck, 7);
    assert.equal(result.shouldFlee, true);
});

test('tryStealChampionItem can remove equipped items when the attempt lands on a slot', () => {
    const necklace = createItem('choker', 'Misc', 3);
    const equipment: ChampionEquipment = { neck: necklace };
    const result = tryStealChampionItem([], equipment, createVitals(0), 0, {
        randomInt: () => 0,
        applyLuckCheck: (currentVitals) => ({ success: false, nextVitals: currentVitals }),
    });

    assert.equal(result.stolenItem?.id, 'choker');
    assert.equal(result.nextEquipment.neck, undefined);
    assert.equal(result.nextVitals.currentStats.luck, 0);
});

test('tryStealChampionItem returns without theft when luck stops the sequence immediately', () => {
    const inventory = [createItem('coin', 'Misc', 4)];
    const result = tryStealChampionItem(inventory, {}, createVitals(40), 25, {
        randomInt: () => 1,
        applyLuckCheck: (currentVitals) => ({ success: true, nextVitals: currentVitals }),
    });

    assert.equal(result.stolenItem, null);
    assert.deepEqual(result.nextInventory, inventory);
    assert.equal(result.nextVitals.currentStats.luck, 40);
    assert.equal(result.shouldFlee, false);
});

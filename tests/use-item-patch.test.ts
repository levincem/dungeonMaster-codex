import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampionVitals, PartyShield } from '../src/engine/runtimeTypes.js';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import { buildUseItemPatch } from '../src/engine/systems/useItemPatch.js';

function createVitals(overrides: Partial<ChampionVitals> = {}): ChampionVitals {
    return {
        hp: 30,
        stamina: 40,
        mana: 20,
        food: 500,
        water: 500,
        currentStats: {
            luck: 10,
            strength: 10,
            dexterity: 10,
            wisdom: 10,
            vitality: 10,
            antiMagic: 0,
            antiFire: 0,
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
        ...overrides,
    };
}

function createItem(id: string, overrides: Partial<FloorItem> = {}): FloorItem {
    return {
        id,
        category: 'Potion',
        typeId: 15,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
        ...overrides,
    };
}

test('buildUseItemPatch removes consumed equipment and can update active shields', () => {
    const currentShield: PartyShield[] = [];
    const nextShield: PartyShield[] = [{ id: 'shield_1', expiresAt: 1000, defense: 12, kind: 'physical' }];
    const patch = buildUseItemPatch({
        championId: 1,
        itemId: 'potion_1',
        slotKey: 'rightHand',
        inventoryIndex: -1,
        item: createItem('potion_1'),
        inventory: [],
        equipment: { rightHand: createItem('potion_1') },
        currentChampionVitals: { 1: createVitals() },
        currentChampionInventories: {},
        currentChampionEquipment: { 1: { rightHand: createItem('potion_1') } },
        nextVitals: createVitals({ hp: 45 }),
        replacementItem: null,
        shouldConsumeOriginal: true,
        currentActiveShields: currentShield,
        nextActiveShields: nextShield,
    });

    assert.deepEqual(patch, {
        championVitals: { 1: createVitals({ hp: 45 }) },
        championEquipment: { 1: {} },
        activeShields: nextShield,
    });
});

test('buildUseItemPatch replaces inventory items in place without touching shields', () => {
    const inventory = [createItem('waterskin_full'), createItem('torch', { category: 'Weapon', typeId: 2 })];
    const replacementItem = createItem('waterskin_empty', { category: 'Misc', typeId: 1 });
    const currentEquipment: Record<number, ChampionEquipment> = { 2: { leftHand: createItem('dagger', { category: 'Weapon', typeId: 4 }) } };
    const shields: PartyShield[] = [];
    const patch = buildUseItemPatch({
        championId: 2,
        itemId: 'waterskin_full',
        inventoryIndex: 0,
        item: inventory[0]!,
        inventory,
        equipment: currentEquipment[2]!,
        currentChampionVitals: { 2: createVitals() },
        currentChampionInventories: { 2: inventory },
        currentChampionEquipment: currentEquipment,
        nextVitals: createVitals({ water: 1200 }),
        replacementItem,
        shouldConsumeOriginal: false,
        currentActiveShields: shields,
        nextActiveShields: shields,
    });

    assert.deepEqual(patch, {
        championVitals: { 2: createVitals({ water: 1200 }) },
        championInventories: {
            2: [replacementItem, inventory[1]!],
        },
    });
});

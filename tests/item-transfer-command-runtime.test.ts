import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import {
    buildDropCarriedItemRuntimePatch,
    buildEquipItemRuntimePatch,
    buildGiveEquippedItemRuntimePatch,
    buildGiveItemRuntimePatch,
    buildUnequipItemRuntimePatch,
} from '../src/engine/systems/itemTransferCommandRuntime.js';

function createItem(id: string, overrides: Partial<FloorItem> = {}): FloorItem {
    return {
        id,
        category: 'Weapon',
        typeId: 1,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
        ...overrides,
    };
}

test('buildDropCarriedItemRuntimePatch delegates carried-item drops', () => {
    const sword = createItem('sword');
    const state = {
        level: 0,
        position: [4, 5] as [number, number],
        floorItems: [] as FloorItem[],
        championInventories: { 1: [sword] },
        championEquipment: { 1: {} as ChampionEquipment },
    };

    const patch = buildDropCarriedItemRuntimePatch(state, 1, sword.id, 'inventory', {
        dropChampionCarriedItem: (_state, championId, itemId, fromSlot) => ({
            championId,
            itemId,
            fromSlot,
        }),
    });

    assert.deepEqual(patch, {
        championId: 1,
        itemId: 'sword',
        fromSlot: 'inventory',
    });
});

test('buildEquipItemRuntimePatch validates the slot before delegating', () => {
    const sword = createItem('sword');
    const state = {
        championInventories: { 1: [sword] },
        championEquipment: { 1: {} as ChampionEquipment },
        torchBurnStart: {},
    };

    const patch = buildEquipItemRuntimePatch(state, 1, 'rightHand', sword.id, {
        canEquipItemInSlot: (item, slotKey) => item.id === 'sword' && slotKey === 'rightHand',
        equipChampionInventoryItem: (_state, championId, slotKey, itemId) => ({
            championId,
            slotKey,
            itemId,
        }),
    });

    assert.deepEqual(patch, {
        championId: 1,
        slotKey: 'rightHand',
        itemId: 'sword',
    });
});

test('buildEquipItemRuntimePatch returns null when the item is missing or invalid for the slot', () => {
    const state = {
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: {} as ChampionEquipment },
        torchBurnStart: {},
    };

    const patch = buildEquipItemRuntimePatch(state, 1, 'rightHand', 'missing', {
        canEquipItemInSlot: () => true,
        equipChampionInventoryItem: () => ({ ok: true }),
    });

    assert.equal(patch, null);
});

test('buildUnequipItemRuntimePatch delegates unequip operations', () => {
    const state = {
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: { rightHand: createItem('sword') } as ChampionEquipment },
    };

    const patch = buildUnequipItemRuntimePatch(state, 1, 'rightHand', {
        unequipChampionItem: (_state, championId, slotKey) => ({ championId, slotKey }),
    });

    assert.deepEqual(patch, { championId: 1, slotKey: 'rightHand' });
});

test('buildGiveItemRuntimePatch delegates inventory transfers', () => {
    const state = {
        championInventories: {
            1: [createItem('sword')],
            2: [] as FloorItem[],
        },
        championEquipment: {
            1: {} as ChampionEquipment,
            2: {} as ChampionEquipment,
        },
    };

    const patch = buildGiveItemRuntimePatch(state, 1, 2, 'sword', {
        giveChampionInventoryItem: (_state, fromChampionId, toChampionId, itemId) => ({
            fromChampionId,
            toChampionId,
            itemId,
        }),
    });

    assert.deepEqual(patch, {
        fromChampionId: 1,
        toChampionId: 2,
        itemId: 'sword',
    });
});

test('buildGiveEquippedItemRuntimePatch delegates equipped transfers', () => {
    const state = {
        championInventories: {
            1: [] as FloorItem[],
            2: [] as FloorItem[],
        },
        championEquipment: {
            1: { rightHand: createItem('sword') } as ChampionEquipment,
            2: {} as ChampionEquipment,
        },
    };

    const patch = buildGiveEquippedItemRuntimePatch(state, 1, 'rightHand', 2, {
        giveChampionEquippedItem: (_state, fromChampionId, slotKey, toChampionId) => ({
            fromChampionId,
            slotKey,
            toChampionId,
        }),
    });

    assert.deepEqual(patch, {
        fromChampionId: 1,
        slotKey: 'rightHand',
        toChampionId: 2,
    });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FloorItem } from '../src/types/game.js';
import type { EquipSlotKey } from '../src/types/items.js';
import type { Projectile } from '../src/engine/runtimeTypes.js';

function createWeapon(id: string, typeId: number): FloorItem {
    return {
        id,
        category: 'Weapon',
        typeId,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

function createState() {
    const sword = createWeapon('sword', 1);
    const torch = createWeapon('torch', 2);
    const dagger = createWeapon('dagger', 3);

    return {
        sword,
        torch,
        dagger,
        state: {
            championInventories: {
                1: [sword, torch],
                2: [dagger],
            },
            championEquipment: {
                1: {},
                2: {},
            },
            torchBurnStart: {},
        },
    };
}

async function loadInventoryStateModule() {
    return import('../src/engine/systems/inventoryState.js');
}

test('equipChampionInventoryItem equips the item and starts torch burn tracking when needed', async () => {
    const { equipChampionInventoryItem } = await loadInventoryStateModule();
    const { torch, state } = createState();
    const patch = equipChampionInventoryItem(state, 1, 'rightHand', torch.id, 12_345);

    assert.ok(patch);
    assert.deepEqual(patch?.championInventories?.[1], [state.championInventories[1]![0]!]);
    assert.equal(patch?.championEquipment?.[1]?.rightHand?.id, torch.id);
    assert.equal(patch?.torchBurnStart?.[torch.id], 12_345);
});

test('unequipChampionItem moves the equipped item back into inventory', async () => {
    const { unequipChampionItem } = await loadInventoryStateModule();
    const { sword, state } = createState();
    const equippedState = {
        championInventories: { ...state.championInventories, 1: [state.championInventories[1]![1]!] },
        championEquipment: { ...state.championEquipment, 1: { rightHand: sword } },
    };

    const patch = unequipChampionItem(equippedState, 1, 'rightHand');

    assert.ok(patch);
    assert.equal(patch?.championEquipment?.[1]?.rightHand, undefined);
    assert.deepEqual(patch?.championInventories?.[1]?.map((item) => item.id), ['torch', 'sword']);
});

test('unequipChampionItem returns null when the backpack is already full', async () => {
    const { MAX_CHAMPION_INVENTORY_ITEMS, unequipChampionItem } = await loadInventoryStateModule();
    const equippedItem = createWeapon('equipped', 4);
    const fullInventory = Array.from({ length: MAX_CHAMPION_INVENTORY_ITEMS }, (_, index) => createWeapon(`item-${index}`, index + 10));

    const patch = unequipChampionItem(
        {
            championInventories: { 1: fullInventory },
            championEquipment: { 1: { rightHand: equippedItem } },
        },
        1,
        'rightHand',
    );

    assert.equal(patch, null);
});

test('giveChampionInventoryItem transfers an inventory item between champions', async () => {
    const { giveChampionInventoryItem } = await loadInventoryStateModule();
    const { sword, dagger, state } = createState();
    const patch = giveChampionInventoryItem(state, 1, 2, sword.id);

    assert.ok(patch);
    assert.deepEqual(patch?.championInventories?.[1]?.map((item) => item.id), ['torch']);
    assert.deepEqual(patch?.championInventories?.[2]?.map((item) => item.id), [dagger.id, sword.id]);
});

test('giveChampionInventoryItem returns null when the target backpack is full', async () => {
    const { MAX_CHAMPION_INVENTORY_ITEMS, giveChampionInventoryItem } = await loadInventoryStateModule();
    const { sword, state } = createState();
    const fullInventory = Array.from({ length: MAX_CHAMPION_INVENTORY_ITEMS }, (_, index) => createWeapon(`item-${index}`, index + 20));

    const patch = giveChampionInventoryItem(
        {
            ...state,
            championInventories: {
                ...state.championInventories,
                2: fullInventory,
            },
        },
        1,
        2,
        sword.id,
    );

    assert.equal(patch, null);
});

test('giveChampionEquippedItem transfers an equipped item into the target inventory', async () => {
    const { giveChampionEquippedItem } = await loadInventoryStateModule();
    const { sword, dagger, state } = createState();
    const equippedState = {
        championInventories: { ...state.championInventories, 1: [], 2: [dagger] },
        championEquipment: { ...state.championEquipment, 1: { leftHand: sword } },
    };

    const patch = giveChampionEquippedItem(equippedState, 1, 'leftHand', 2);

    assert.ok(patch);
    assert.equal(patch?.championEquipment?.[1]?.leftHand, undefined);
    assert.deepEqual(patch?.championInventories?.[2]?.map((item) => item.id), [dagger.id, sword.id]);
});

test('giveChampionEquippedItem returns null when the target backpack is full', async () => {
    const { MAX_CHAMPION_INVENTORY_ITEMS, giveChampionEquippedItem } = await loadInventoryStateModule();
    const { sword, state } = createState();
    const fullInventory = Array.from({ length: MAX_CHAMPION_INVENTORY_ITEMS }, (_, index) => createWeapon(`item-${index}`, index + 30));

    const patch = giveChampionEquippedItem(
        {
            ...state,
            championInventories: {
                ...state.championInventories,
                2: fullInventory,
            },
            championEquipment: { ...state.championEquipment, 1: { leftHand: sword } },
        },
        1,
        'leftHand',
        2,
    );

    assert.equal(patch, null);
});

test('seedTorchBurnStartFromEquipment only seeds missing lit torches in hand slots', async () => {
    const { seedTorchBurnStartFromEquipment } = await loadInventoryStateModule();
    const torch = createWeapon('torch-seed', 2);
    const other = createWeapon('other', 1);
    const equipment: Partial<Record<EquipSlotKey, FloorItem>> = {
        rightHand: torch,
        leftHand: other,
    };

    const originalNow = Date.now;
    Date.now = () => 777;
    try {
        const seeded = seedTorchBurnStartFromEquipment(equipment, {});
        assert.equal(seeded[torch.id], 777);
        assert.equal(seeded[other.id], undefined);
        assert.strictEqual(seedTorchBurnStartFromEquipment(equipment, seeded), seeded);
    } finally {
        Date.now = originalNow;
    }
});

test('updateChampionItem updates either inventory or equipped containers', async () => {
    const { updateChampionItem } = await loadInventoryStateModule();
    const emptyFlask: FloorItem = {
        id: 'flask',
        category: 'Potion',
        typeId: 20,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
        waterCharges: 0,
        waterMaxCharges: 1,
    };
    const emptyEquippedFlask: FloorItem = {
        ...emptyFlask,
        id: 'equipped-flask',
        category: 'Misc',
        typeId: 40,
    };

    const fillItem = (item: FloorItem) => ({ ...item, waterCharges: 1 });

    const inventoryPatch = updateChampionItem(
        {
            championInventories: { 1: [emptyFlask] },
            championEquipment: { 1: {} },
        },
        1,
        emptyFlask.id,
        fillItem,
    );
    assert.equal(inventoryPatch?.championInventories?.[1]?.[0]?.waterCharges, 1);

    const equipmentPatch = updateChampionItem(
        {
            championInventories: { 1: [] },
            championEquipment: { 1: { rightHand: emptyEquippedFlask } },
        },
        1,
        emptyEquippedFlask.id,
        fillItem,
    );
    assert.equal(equipmentPatch?.championEquipment?.[1]?.rightHand?.waterCharges, 1);
});

test('locateChampionItem resolves inventory and preferred equipment sources consistently', async () => {
    const { locateChampionItem } = await loadInventoryStateModule();
    const waterskin: FloorItem = {
        id: 'waterskin',
        category: 'Potion',
        typeId: 24,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
    const compass: FloorItem = {
        id: 'compass',
        category: 'Misc',
        typeId: 0,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };

    const state = {
        championInventories: { 1: [waterskin] },
        championEquipment: { 1: { rightHand: compass } },
    };

    const inventoryResult = locateChampionItem(state, 1, waterskin.id);
    assert.equal(inventoryResult?.inventoryIndex, 0);
    assert.equal(inventoryResult?.slotKey, undefined);
    assert.equal(inventoryResult?.item.id, waterskin.id);

    const equippedResult = locateChampionItem(state, 1, compass.id, 'rightHand');
    assert.equal(equippedResult?.slotKey, 'rightHand');
    assert.equal(equippedResult?.inventoryIndex, -1);
    assert.equal(equippedResult?.item.id, compass.id);

    assert.equal(locateChampionItem(state, 1, 'missing'), null);
});

test('dropChampionCarriedItem removes a carried item and places it on the current tile', async () => {
    const { dropChampionCarriedItem } = await loadInventoryStateModule();
    const { sword, torch, state } = createState();

    const inventoryDrop = dropChampionCarriedItem(
        {
            ...state,
            level: 4,
            position: [6, 7],
            floorItems: [],
        },
        1,
        sword.id,
        'inventory',
    );
    assert.deepEqual(inventoryDrop?.championInventories?.[1]?.map((item) => item.id), [torch.id]);
    assert.deepEqual(inventoryDrop?.floorItems?.[0], {
        ...sword,
        mapIndex: 4,
        x: 7,
        y: 6,
        tilePos: 'North',
    });

    const equippedDrop = dropChampionCarriedItem(
        {
            championInventories: { 1: [] },
            championEquipment: { 1: { leftHand: torch } },
            level: 2,
            position: [3, 5],
            floorItems: [],
        },
        1,
        torch.id,
        'leftHand',
    );
    assert.equal(equippedDrop?.championEquipment?.[1]?.leftHand, undefined);
    assert.deepEqual(equippedDrop?.floorItems?.[0], {
        ...torch,
        mapIndex: 2,
        x: 5,
        y: 3,
        tilePos: 'North',
    });
});

test('throwChampionCarriedItem removes the source item and appends the projectile', async () => {
    const { throwChampionCarriedItem } = await loadInventoryStateModule();
    const { sword, torch, state } = createState();
    const projectile: Projectile = {
        id: 'projectile-1',
        level: 0,
        x: 1,
        y: 2,
        direction: 'NORTH',
        effect: 'physical',
        damage: [4, 6],
        nextMoveAt: 123,
        physicalItem: sword,
    };

    const inventoryThrow = throwChampionCarriedItem(
        {
            championInventories: { ...state.championInventories, 1: [sword, torch] },
            championEquipment: state.championEquipment,
            projectiles: [],
        },
        1,
        sword.id,
        'inventory',
        projectile,
    );
    assert.deepEqual(inventoryThrow?.championInventories?.[1]?.map((item) => item.id), [torch.id]);
    assert.deepEqual(inventoryThrow?.projectiles, [projectile]);

    const equippedThrow = throwChampionCarriedItem(
        {
            championInventories: { 1: [] },
            championEquipment: { 1: { rightHand: torch } },
            projectiles: [],
        },
        1,
        torch.id,
        'rightHand',
        projectile,
    );
    assert.equal(equippedThrow?.championEquipment?.[1]?.rightHand, undefined);
    assert.deepEqual(equippedThrow?.projectiles, [projectile]);
});

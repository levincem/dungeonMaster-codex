import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';
import type { Projectile } from '../runtimeTypes';

type InventoryCollectionsState = {
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
};

type PositionedItemsState = {
    level: number;
    position: [number, number];
    floorItems: FloorItem[];
};

type ProjectileState = {
    projectiles: Projectile[];
};

type TorchState = {
    torchBurnStart: Record<string, number>;
};

export const MAX_CHAMPION_INVENTORY_ITEMS = 17;

export type LocatedChampionItem = {
    inventory: FloorItem[];
    equipment: ChampionEquipment;
    inventoryIndex: number;
    slotKey?: EquipSlotKey;
    item: FloorItem;
};

export function canChampionInventoryAcceptItem(inventory: FloorItem[]): boolean {
    return inventory.length < MAX_CHAMPION_INVENTORY_ITEMS;
}

export function locateChampionItem(
    state: InventoryCollectionsState,
    championId: number,
    itemId: string,
    preferredSlot?: EquipSlotKey | 'inventory',
): LocatedChampionItem | null {
    const inventory = state.championInventories[championId] ?? [];
    const equipment = state.championEquipment[championId] ?? {};
    const inventoryIndex = inventory.findIndex((entry) => entry.id === itemId);

    const slotKey =
        preferredSlot && preferredSlot !== 'inventory' && equipment[preferredSlot]?.id === itemId
            ? preferredSlot
            : (Object.entries(equipment).find(([, entry]) => entry?.id === itemId)?.[0] as EquipSlotKey | undefined);
    const item = slotKey ? equipment[slotKey] : inventoryIndex >= 0 ? inventory[inventoryIndex] : undefined;
    if (!item) return null;

    return {
        inventory,
        equipment,
        inventoryIndex,
        ...(slotKey ? { slotKey } : {}),
        item,
    };
}

export function seedTorchBurnStartFromEquipment(
    equipment: ChampionEquipment | undefined,
    currentTorchBurnStart: Record<string, number>,
): Record<string, number> {
    if (!equipment) return currentTorchBurnStart;

    let next = currentTorchBurnStart;
    for (const slot of ['rightHand', 'leftHand'] as const) {
        const item = equipment[slot];
        if (!item || item.category !== 'Weapon' || item.typeId !== 2) continue;
        if (next[item.id] !== undefined) continue;
        if (next === currentTorchBurnStart) next = { ...currentTorchBurnStart };
        next[item.id] = Date.now();
    }
    return next;
}

export function equipChampionInventoryItem(
    state: InventoryCollectionsState & TorchState,
    championId: number,
    slotKey: EquipSlotKey,
    itemId: string,
    now = Date.now(),
): Partial<InventoryCollectionsState & TorchState> | null {
    const inventory = state.championInventories[championId] ?? [];
    const item = inventory.find((entry) => entry.id === itemId);
    if (!item) return null;

    const currentEquipment = state.championEquipment[championId] ?? {};
    const displaced = currentEquipment[slotKey];
    const nextInventory = inventory.filter((entry) => entry.id !== itemId);
    if (displaced) nextInventory.push(displaced);

    const nextTorchBurnStart =
        item.category === 'Weapon' && item.typeId === 2 && !state.torchBurnStart[item.id]
            ? { ...state.torchBurnStart, [item.id]: now }
            : state.torchBurnStart;

    return {
        championInventories: { ...state.championInventories, [championId]: nextInventory },
        championEquipment: { ...state.championEquipment, [championId]: { ...currentEquipment, [slotKey]: item } },
        ...(nextTorchBurnStart !== state.torchBurnStart ? { torchBurnStart: nextTorchBurnStart } : {}),
    };
}

export function unequipChampionItem(
    state: InventoryCollectionsState,
    championId: number,
    slotKey: EquipSlotKey,
): Partial<InventoryCollectionsState> | null {
    const currentEquipment = state.championEquipment[championId] ?? {};
    const item = currentEquipment[slotKey];
    if (!item) return null;

    const inventory = state.championInventories[championId] ?? [];
    if (!canChampionInventoryAcceptItem(inventory)) return null;
    const nextEquipment = { ...currentEquipment };
    delete nextEquipment[slotKey];

    return {
        championInventories: { ...state.championInventories, [championId]: [...inventory, item] },
        championEquipment: { ...state.championEquipment, [championId]: nextEquipment },
    };
}

export function giveChampionInventoryItem(
    state: InventoryCollectionsState,
    fromChampionId: number,
    toChampionId: number,
    itemId: string,
): Partial<InventoryCollectionsState> | null {
    const fromInventory = state.championInventories[fromChampionId] ?? [];
    const item = fromInventory.find((entry) => entry.id === itemId);
    if (!item) return null;

    const toInventory = state.championInventories[toChampionId] ?? [];
    if (fromChampionId !== toChampionId && !canChampionInventoryAcceptItem(toInventory)) return null;
    return {
        championInventories: {
            ...state.championInventories,
            [fromChampionId]: fromInventory.filter((entry) => entry.id !== itemId),
            [toChampionId]: [...toInventory, item],
        },
    };
}

export function giveChampionEquippedItem(
    state: InventoryCollectionsState,
    fromChampionId: number,
    slotKey: EquipSlotKey,
    toChampionId: number,
): Partial<InventoryCollectionsState> | null {
    const fromEquipment = state.championEquipment[fromChampionId] ?? {};
    const item = fromEquipment[slotKey];
    if (!item) return null;

    const toInventory = state.championInventories[toChampionId] ?? [];
    if (!canChampionInventoryAcceptItem(toInventory)) return null;
    const nextEquipment = { ...fromEquipment };
    delete nextEquipment[slotKey];

    return {
        championEquipment: { ...state.championEquipment, [fromChampionId]: nextEquipment },
        championInventories: { ...state.championInventories, [toChampionId]: [...toInventory, item] },
    };
}

export function updateChampionItem(
    state: InventoryCollectionsState,
    championId: number,
    itemId: string,
    updateItem: (item: FloorItem) => FloorItem | null,
): Partial<InventoryCollectionsState> | null {
    const located = locateChampionItem(state, championId, itemId);
    if (!located) return null;

    if (located.slotKey === undefined) {
        const item = located.item;
        const nextItem = updateItem(item);
        if (!nextItem) return null;
        return {
            championInventories: {
                ...state.championInventories,
                [championId]: located.inventory.map((entry, index) => (index === located.inventoryIndex ? nextItem : entry)),
            },
        };
    }

    const nextItem = updateItem(located.item);
    if (!nextItem) return null;
    return {
        championEquipment: {
            ...state.championEquipment,
            [championId]: { ...located.equipment, [located.slotKey]: nextItem },
        },
    };
}

export function dropChampionCarriedItem(
    state: InventoryCollectionsState & PositionedItemsState,
    championId: number,
    itemId: string,
    fromSlot: EquipSlotKey | 'inventory',
): Partial<InventoryCollectionsState & PositionedItemsState> | null {
    const [y, x] = state.position;

    if (fromSlot === 'inventory') {
        const inventory = state.championInventories[championId] ?? [];
        const item = inventory.find((entry) => entry.id === itemId);
        if (!item) return null;
        return {
            championInventories: {
                ...state.championInventories,
                [championId]: inventory.filter((entry) => entry.id !== itemId),
            },
            floorItems: [...state.floorItems, { ...item, mapIndex: state.level, x, y, tilePos: 'North' }],
        };
    }

    const equipment = state.championEquipment[championId] ?? {};
    const item = equipment[fromSlot];
    if (!item || item.id !== itemId) return null;
    const nextEquipment = { ...equipment };
    delete nextEquipment[fromSlot];
    return {
        championEquipment: {
            ...state.championEquipment,
            [championId]: nextEquipment,
        },
        floorItems: [...state.floorItems, { ...item, mapIndex: state.level, x, y, tilePos: 'North' }],
    };
}

export function throwChampionCarriedItem(
    state: InventoryCollectionsState & ProjectileState,
    championId: number,
    itemId: string,
    fromSlot: EquipSlotKey | 'inventory',
    projectile: Projectile,
): Partial<InventoryCollectionsState & ProjectileState> | null {
    if (fromSlot === 'inventory') {
        const inventory = state.championInventories[championId] ?? [];
        if (!inventory.some((entry) => entry.id === itemId)) return null;
        return {
            championInventories: {
                ...state.championInventories,
                [championId]: inventory.filter((entry) => entry.id !== itemId),
            },
            projectiles: [...state.projectiles, projectile],
        };
    }

    const equipment = state.championEquipment[championId] ?? {};
    const item = equipment[fromSlot];
    if (!item || item.id !== itemId) return null;
    return {
        championEquipment: {
            ...state.championEquipment,
            [championId]: {
                ...equipment,
                [fromSlot]: undefined,
            },
        },
        projectiles: [...state.projectiles, projectile],
    };
}

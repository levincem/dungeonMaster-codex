import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';

type InventoryCollectionsState = {
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
};

type DropCollectionsState = InventoryCollectionsState & {
    level: number;
    position: [number, number];
    floorItems: FloorItem[];
};

type TorchState = {
    torchBurnStart: Record<string, number>;
};

type DropCarriedItemRuntimeDeps<TState extends DropCollectionsState, TPatch> = {
    dropChampionCarriedItem: (
        state: TState,
        championId: number,
        itemId: string,
        fromSlot: EquipSlotKey | 'inventory',
    ) => TPatch | null;
};

type EquipItemRuntimeDeps<TState extends InventoryCollectionsState & TorchState, TPatch> = {
    canEquipItemInSlot: (item: FloorItem, slotKey: EquipSlotKey) => boolean;
    equipChampionInventoryItem: (
        state: TState,
        championId: number,
        slotKey: EquipSlotKey,
        itemId: string,
    ) => TPatch | null;
};

type UnequipItemRuntimeDeps<TState extends InventoryCollectionsState, TPatch> = {
    unequipChampionItem: (
        state: TState,
        championId: number,
        slotKey: EquipSlotKey,
    ) => TPatch | null;
};

type GiveItemRuntimeDeps<TState extends InventoryCollectionsState, TPatch> = {
    giveChampionInventoryItem: (
        state: TState,
        fromChampionId: number,
        toChampionId: number,
        itemId: string,
    ) => TPatch | null;
};

type GiveEquippedItemRuntimeDeps<TState extends InventoryCollectionsState, TPatch> = {
    giveChampionEquippedItem: (
        state: TState,
        fromChampionId: number,
        slotKey: EquipSlotKey,
        toChampionId: number,
    ) => TPatch | null;
};

export function buildDropCarriedItemRuntimePatch<
    TState extends DropCollectionsState,
    TPatch,
>(
    state: TState,
    championId: number,
    itemId: string,
    fromSlot: EquipSlotKey | 'inventory',
    deps: DropCarriedItemRuntimeDeps<TState, TPatch>,
): TPatch | null {
    return deps.dropChampionCarriedItem(state, championId, itemId, fromSlot);
}

export function buildEquipItemRuntimePatch<
    TState extends InventoryCollectionsState & TorchState,
    TPatch,
>(
    state: TState,
    championId: number,
    slotKey: EquipSlotKey,
    itemId: string,
    deps: EquipItemRuntimeDeps<TState, TPatch>,
): TPatch | null {
    const item = (state.championInventories[championId] ?? []).find((entry) => entry.id === itemId);
    if (!item || !deps.canEquipItemInSlot(item, slotKey)) return null;
    return deps.equipChampionInventoryItem(state, championId, slotKey, itemId);
}

export function buildUnequipItemRuntimePatch<
    TState extends InventoryCollectionsState,
    TPatch,
>(
    state: TState,
    championId: number,
    slotKey: EquipSlotKey,
    deps: UnequipItemRuntimeDeps<TState, TPatch>,
): TPatch | null {
    return deps.unequipChampionItem(state, championId, slotKey);
}

export function buildGiveItemRuntimePatch<
    TState extends InventoryCollectionsState,
    TPatch,
>(
    state: TState,
    fromChampionId: number,
    toChampionId: number,
    itemId: string,
    deps: GiveItemRuntimeDeps<TState, TPatch>,
): TPatch | null {
    return deps.giveChampionInventoryItem(state, fromChampionId, toChampionId, itemId);
}

export function buildGiveEquippedItemRuntimePatch<
    TState extends InventoryCollectionsState,
    TPatch,
>(
    state: TState,
    fromChampionId: number,
    slotKey: EquipSlotKey,
    toChampionId: number,
    deps: GiveEquippedItemRuntimeDeps<TState, TPatch>,
): TPatch | null {
    return deps.giveChampionEquippedItem(state, fromChampionId, slotKey, toChampionId);
}

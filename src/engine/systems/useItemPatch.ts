import type { ChampionVitals, PartyShield } from '../runtimeTypes';
import type { EquipSlotKey } from '../../types/items';
import type { ChampionEquipment, FloorItem } from '../../types/game';

type BuildUseItemPatchArgs = {
    championId: number;
    itemId: string;
    slotKey?: EquipSlotKey;
    inventoryIndex: number;
    item: FloorItem;
    inventory: FloorItem[];
    equipment: ChampionEquipment;
    currentChampionVitals: Record<number, ChampionVitals>;
    currentChampionInventories: Record<number, FloorItem[]>;
    currentChampionEquipment: Record<number, ChampionEquipment>;
    nextVitals: ChampionVitals;
    replacementItem: FloorItem | null;
    shouldConsumeOriginal: boolean;
    currentActiveShields: PartyShield[];
    nextActiveShields: PartyShield[];
};

export type UseItemPatch = {
    championVitals: Record<number, ChampionVitals>;
    championInventories?: Record<number, FloorItem[]>;
    championEquipment?: Record<number, ChampionEquipment>;
    activeShields?: PartyShield[];
};

export function buildUseItemPatch({
    championId,
    itemId,
    slotKey,
    inventoryIndex,
    item,
    inventory,
    equipment,
    currentChampionVitals,
    currentChampionInventories,
    currentChampionEquipment,
    nextVitals,
    replacementItem,
    shouldConsumeOriginal,
    currentActiveShields,
    nextActiveShields,
}: BuildUseItemPatchArgs): UseItemPatch {
    const patch: UseItemPatch = {
        championVitals: {
            ...currentChampionVitals,
            [championId]: nextVitals,
        },
    };

    if (slotKey) {
        const nextEquipment = { ...equipment };
        if (shouldConsumeOriginal) {
            delete nextEquipment[slotKey];
        } else {
            nextEquipment[slotKey] = replacementItem ?? item;
        }
        patch.championEquipment = {
            ...currentChampionEquipment,
            [championId]: nextEquipment,
        };
    } else {
        patch.championInventories = {
            ...currentChampionInventories,
            [championId]: shouldConsumeOriginal
                ? inventory.filter((entry) => entry.id !== itemId)
                : inventory.map((entry, index) => (index === inventoryIndex ? (replacementItem ?? entry) : entry)),
        };
    }

    if (nextActiveShields !== currentActiveShields) {
        patch.activeShields = nextActiveShields;
    }

    return patch;
}

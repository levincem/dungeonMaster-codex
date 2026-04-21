import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';
import { I562_DROP_ORDER } from '../../data/items';

export type DeathDropState = {
    level: number;
    position: [number, number];
    party: Champion[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    deadChampions: Record<number, Champion>;
};

const ORIGINAL_POSSESSION_INDEX_TO_RUNTIME_SLOT: Partial<Record<number, EquipSlotKey>> = {
    0: 'leftHand',
    1: 'rightHand',
    2: 'head',
    3: 'torso',
    4: 'legs',
    5: 'feet',
    6: 'pocket2',
    7: 'quiver2',
    8: 'quiver3',
    9: 'quiver4',
    10: 'neck',
    11: 'pocket1',
    12: 'quiver1',
};

function getOrderedDroppedItems(
    inventory: FloorItem[],
    equipment: ChampionEquipment,
): FloorItem[] {
    const ordered: FloorItem[] = [];
    const seen = new Set<string>();

    for (const possessionIndex of I562_DROP_ORDER) {
        const item = possessionIndex >= 13 && possessionIndex <= 29
            ? inventory[possessionIndex - 13]
            : (() => {
                const slotKey = ORIGINAL_POSSESSION_INDEX_TO_RUNTIME_SLOT[possessionIndex];
                return slotKey ? equipment[slotKey] : undefined;
            })();

        if (!item || seen.has(item.id)) continue;
        ordered.push(item);
        seen.add(item.id);
    }

    // Keep any future runtime-only slot additions explicit instead of silently dropping them.
    for (const item of [...inventory.filter(Boolean), ...(Object.values(equipment).filter(Boolean) as FloorItem[])]) {
        if (seen.has(item.id)) continue;
        ordered.push(item);
        seen.add(item.id);
    }

    return ordered;
}

export function buildDeathDrop(
    state: DeathDropState,
    championId: number,
    nowMs: number,
): {
    floorItems: FloorItem[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    deadChampions: Record<number, Champion>;
    party: Champion[];
} {
    const [y, x] = state.position;
    const inventory = state.championInventories[championId] ?? [];
    const equipment = state.championEquipment[championId] ?? {};
    const droppedItems: FloorItem[] = getOrderedDroppedItems(inventory, equipment)
        .map((item) => ({ ...item, mapIndex: state.level, x, y, tilePos: 'North' as const }));

    const bonesItem: FloorItem = {
        id: `bones_${championId}_${nowMs}`,
        category: 'Misc',
        typeId: 5,
        rawName: 'Bones',
        mapIndex: state.level,
        x,
        y,
        tilePos: 'North',
        championId,
    };

    const champion = state.party.find((entry) => entry.id === championId);

    return {
        floorItems: [...state.floorItems, ...droppedItems, bonesItem],
        championInventories: { ...state.championInventories, [championId]: [] },
        championEquipment: { ...state.championEquipment, [championId]: {} },
        deadChampions: champion
            ? { ...state.deadChampions, [championId]: champion }
            : state.deadChampions,
        party: state.party.filter((entry) => entry.id !== championId),
    };
}

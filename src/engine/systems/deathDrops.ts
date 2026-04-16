import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';

export type DeathDropState = {
    level: number;
    position: [number, number];
    party: Champion[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    deadChampions: Record<number, Champion>;
};

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

    const droppedItems: FloorItem[] = [
        ...inventory,
        ...(Object.values(equipment).filter(Boolean) as FloorItem[]),
    ].map((item) => ({ ...item, mapIndex: state.level, x, y, tilePos: 'North' as const }));

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

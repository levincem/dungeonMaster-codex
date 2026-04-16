import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';
import type { ChampionVitals } from '../runtimeTypes';

type SpellItemCreationDeps = {
    buildIdSuffix?: () => string;
};

export type PlasmaSpellResult = {
    item: FloorItem;
    freeSlot: Extract<EquipSlotKey, 'rightHand' | 'leftHand'> | null;
};

export type PlasmaSpellPatch = {
    championVitals: Record<number, ChampionVitals>;
    championEquipment?: Record<number, ChampionEquipment>;
    floorItems?: FloorItem[];
};

function buildId(prefix: string, now: number, deps: SpellItemCreationDeps): string {
    return `${prefix}_${now}_${deps.buildIdSuffix?.() ?? Math.random().toString(36).slice(2)}`;
}

export function resolvePlasmaSpellResult(
    now: number,
    mapIndex: number,
    position: [number, number],
    equipment: ChampionEquipment | undefined,
    rawName: string,
    deps: SpellItemCreationDeps,
): PlasmaSpellResult {
    const [y, x] = position;
    const freeSlot = (['rightHand', 'leftHand'] as const).find((slot) => !equipment?.[slot]) ?? null;

    return {
        item: {
            id: buildId('misc_zokathra', now, deps),
            mapIndex,
            x,
            y,
            tilePos: 'North',
            category: 'Misc',
            typeId: 51,
            rawName,
        },
        freeSlot,
    };
}

type BuildPlasmaSpellPatchArgs = {
    championId: number;
    result: PlasmaSpellResult;
    currentChampionVitals: Record<number, ChampionVitals>;
    nextVitals: ChampionVitals;
    currentChampionEquipment: Record<number, ChampionEquipment>;
    currentEquipment: ChampionEquipment;
    currentFloorItems: FloorItem[];
    buildDroppedItem: (item: FloorItem) => FloorItem;
};

export function buildPlasmaSpellPatch({
    championId,
    result,
    currentChampionVitals,
    nextVitals,
    currentChampionEquipment,
    currentEquipment,
    currentFloorItems,
    buildDroppedItem,
}: BuildPlasmaSpellPatchArgs): PlasmaSpellPatch {
    const championVitals = {
        ...currentChampionVitals,
        [championId]: nextVitals,
    };

    if (result.freeSlot) {
        return {
            championVitals,
            championEquipment: {
                ...currentChampionEquipment,
                [championId]: { ...currentEquipment, [result.freeSlot]: result.item },
            },
        };
    }

    return {
        championVitals,
        floorItems: [
            ...currentFloorItems,
            buildDroppedItem(result.item),
        ],
    };
}

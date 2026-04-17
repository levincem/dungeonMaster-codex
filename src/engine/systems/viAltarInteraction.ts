import type { CardinalDir, ChampionEquipment, FloorItem } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';

type ActiveFloorDragLike = {
    itemId: string;
} | null;

type ViAltarInteractionState = {
    level: number;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    activeFloorDrag?: ActiveFloorDragLike;
};

type ViAltarInteractionDeps<TState, TPatch> = {
    isAltarWallFace: (level: number, x: number, y: number, face: CardinalDir) => boolean;
    buildViAltarResurrectionPatch: (
        state: TState,
        deadChampionId: number,
        consumedItemId: string,
        carriedBy: { championId: number; fromSlot: EquipSlotKey | 'inventory' } | null,
    ) => TPatch | null;
};

function isBonesItem(item: FloorItem | null | undefined): item is FloorItem & { championId: number } {
    return Boolean(
        item &&
        item.category === 'Misc' &&
        item.typeId === 5 &&
        item.championId !== undefined,
    );
}

export function buildUseChampionItemOnViAltarPatch<
    TState extends ViAltarInteractionState,
    TPatch,
>(
    state: TState,
    championId: number,
    itemId: string,
    fromSlot: EquipSlotKey | 'inventory',
    altarX: number,
    altarY: number,
    altarFace: CardinalDir,
    deps: ViAltarInteractionDeps<TState, TPatch>,
): TPatch | null {
    const item = fromSlot === 'inventory'
        ? state.championInventories[championId]?.find((entry) => entry.id === itemId)
        : state.championEquipment[championId]?.[fromSlot];
    if (!isBonesItem(item)) return null;
    if (!deps.isAltarWallFace(state.level, altarX, altarY, altarFace)) return null;
    return deps.buildViAltarResurrectionPatch(state, item.championId, item.id, {
        championId,
        fromSlot,
    });
}

export function buildUseFloorItemOnViAltarPatch<
    TState extends ViAltarInteractionState,
    TPatch extends Record<string, unknown>,
>(
    state: TState,
    itemId: string,
    altarX: number,
    altarY: number,
    altarFace: CardinalDir,
    deps: ViAltarInteractionDeps<TState, TPatch>,
): TPatch | null {
    const item = state.floorItems.find((entry) => entry.id === itemId);
    if (!isBonesItem(item)) return null;
    if (!deps.isAltarWallFace(state.level, altarX, altarY, altarFace)) return null;

    const patch = deps.buildViAltarResurrectionPatch(state, item.championId, item.id, null);
    if (!patch) return null;
    return {
        ...patch,
        ...(state.activeFloorDrag?.itemId === itemId ? { activeFloorDrag: null } : {}),
    };
}

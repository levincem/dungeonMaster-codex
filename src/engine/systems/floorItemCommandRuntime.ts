import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';

type PendingSensorChangeResult<TPatch> = {
    sensorChanges: TPatch;
    pendingSensorEvents: unknown[];
};

type PickupRuntimeState = {
    floorItems: FloorItem[];
    party: Champion[];
    championInventories: Record<number, FloorItem[]>;
    activeFloorDrag: { itemId: string; pointerX: number; pointerY: number } | null;
    lastCastResult: { success: boolean; message: string; ts: number } | null;
};

type PickupRuntimeDeps<TState extends PickupRuntimeState, TPatch extends object> = {
    transferFloorItemToChampionState: (
        state: TState,
        itemId: string,
        championId: number,
    ) => TPatch | null;
};

type DropRuntimeState = {
    level: number;
    position: [number, number];
    party: Champion[];
    floorItems: FloorItem[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    deadChampions: Record<number, Champion>;
    pendingSensorEvents: unknown[];
};

type DropRuntimeDeps<TState extends DropRuntimeState, TPatch> = {
    isAltarTile: (level: number, x: number, y: number) => boolean;
    buildViAltarResurrectionPatch: (
        state: TState,
        deadChampionId: number,
        itemId: string,
        championId: number,
    ) => TPatch | null;
    buildSensorStateSnapshot: (state: TState) => unknown;
    triggerFloorSensors: (
        level: number,
        x: number,
        y: number,
        sensorState: unknown,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
        floorItems: FloorItem[],
        pendingSensorEvents: unknown[],
    ) => PendingSensorChangeResult<TPatch>;
    applyImmediateTransportSquareEffects: (state: TState, basePatch: TPatch) => TPatch;
};

export function buildPickupItemToChampionRuntimePatch<
    TState extends PickupRuntimeState,
    TPatch extends object,
>(
    state: TState,
    itemId: string,
    championId: number,
    deps: PickupRuntimeDeps<TState, TPatch>,
): TPatch | null {
    return deps.transferFloorItemToChampionState(state, itemId, championId);
}

export function buildDropInventoryItemRuntimePatch<
    TState extends DropRuntimeState,
    TPatch extends Partial<TState>,
>(
    state: TState,
    championId: number,
    itemId: string,
    deps: DropRuntimeDeps<TState, TPatch>,
): TPatch | null {
    const inventory = state.championInventories[championId] ?? [];
    const item = inventory.find((entry) => entry.id === itemId);
    if (!item) return null;

    const [y, x] = state.position;

    if (item.category === 'Misc' && item.typeId === 5 && item.championId !== undefined) {
        const deadChampion = state.deadChampions[item.championId];
        if (deadChampion && state.party.length < 4 && deps.isAltarTile(state.level, x, y)) {
            return deps.buildViAltarResurrectionPatch(state, item.championId, itemId, championId);
        }
    }

    const dropped: FloorItem = { ...item, mapIndex: state.level, x, y, tilePos: 'North' };
    const nextFloorItems = [...state.floorItems, dropped];
    const sensorState = deps.buildSensorStateSnapshot(state);
    const sensorChanges = deps.triggerFloorSensors(
        state.level,
        x,
        y,
        sensorState,
        state.championInventories,
        state.championEquipment,
        nextFloorItems,
        state.pendingSensorEvents,
    );

    return deps.applyImmediateTransportSquareEffects(state, {
        championInventories: {
            ...state.championInventories,
            [championId]: inventory.filter((entry) => entry.id !== itemId),
        },
        floorItems: nextFloorItems,
        ...sensorChanges.sensorChanges,
        pendingSensorEvents: sensorChanges.pendingSensorEvents,
    } as TPatch);
}

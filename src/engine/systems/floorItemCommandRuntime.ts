import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';
import type { Projectile } from '../runtimeTypes';
import { canPartyReachFloorItem } from './floorItemState';

type PendingSensorChangeResult<TPatch> = {
    sensorChanges: TPatch;
    pendingSensorEvents: unknown[];
};

type PickupRuntimeState = {
    level: number;
    floorItems: FloorItem[];
    party: Champion[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    activeFloorDrag: { itemId: string; pointerX: number; pointerY: number } | null;
    lastCastResult: { success: boolean; message: string; ts: number } | null;
    pendingSensorEvents: unknown[];
};

type PickupRuntimeDeps<TState extends PickupRuntimeState, TPatch extends object> = {
    transferFloorItemToChampionState: (
        state: TState,
        itemId: string,
        championId: number,
    ) => TPatch | null;
    buildSensorStateSnapshot?: (state: TState) => unknown;
    triggerFloorSensors?: (
        level: number,
        x: number,
        y: number,
        sensorState: unknown,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
        floorItems: FloorItem[],
        pendingSensorEvents: unknown[],
        source: 'party' | 'item',
        mode: 'enter' | 'leave',
    ) => PendingSensorChangeResult<Partial<TState>>;
};

type DropRuntimeState = {
    level: number;
    position: [number, number];
    direction?: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    party: Champion[];
    floorItems: FloorItem[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    deadChampions: Record<number, Champion>;
    pendingSensorEvents: unknown[];
    activeFloorDrag?: { itemId: string; pointerX: number; pointerY: number } | null;
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
        source: 'party' | 'item',
        mode: 'enter' | 'leave',
    ) => PendingSensorChangeResult<TPatch>;
    applyImmediateTransportSquareEffects: (state: TState, basePatch: TPatch) => TPatch;
};

type MoveFloorItemRuntimeState = DropRuntimeState & {
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
};

type MoveFloorItemRuntimeDeps<TState extends MoveFloorItemRuntimeState, TPatch extends Partial<TState>> = {
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
        source: 'party' | 'item',
        mode: 'enter' | 'leave',
    ) => PendingSensorChangeResult<TPatch>;
    applyImmediateTransportSquareEffects?: (state: TState, basePatch: TPatch) => TPatch;
};

type ThrowFloorItemRuntimeState = MoveFloorItemRuntimeState & {
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    projectiles: Projectile[];
};

type ThrowFloorItemRuntimeDeps<
    TState extends ThrowFloorItemRuntimeState,
    TSensorPatch extends Partial<TState>,
    TXpPatch extends object,
> = {
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
        source: 'party' | 'item',
        mode: 'enter' | 'leave',
    ) => PendingSensorChangeResult<TSensorPatch>;
    buildProjectile: (state: TState, championId: number, champion: Champion, item: FloorItem) => Projectile;
    buildThrowXpPatch?: (state: TState, championId: number) => TXpPatch | null;
};

function clearActiveFloorDragForItem<TState extends { activeFloorDrag?: { itemId: string } | null }>(
    state: TState,
    itemId: string,
): Pick<TState, 'activeFloorDrag'> | {} {
    return state.activeFloorDrag?.itemId === itemId
        ? { activeFloorDrag: null }
        : {};
}

function buildDroppedFloorItem(item: FloorItem, level: number, x: number, y: number): FloorItem {
    return {
        ...item,
        mapIndex: level,
        x,
        y,
        tilePos: 'North',
        projectileDropped: undefined,
    };
}

export function removeChampionCarriedItemToTile<TState extends DropRuntimeState>(
    state: TState,
    championId: number,
    itemId: string,
    fromSlot: EquipSlotKey | 'inventory',
    x: number,
    y: number,
): Partial<TState> | null {
    if (fromSlot === 'inventory') {
        const inventory = state.championInventories[championId] ?? [];
        const item = inventory.find((entry) => entry.id === itemId);
        if (!item) return null;
        return {
            championInventories: {
                ...state.championInventories,
                [championId]: inventory.filter((entry) => entry.id !== itemId),
            },
            floorItems: [...state.floorItems, buildDroppedFloorItem(item, state.level, x, y)],
        } as Partial<TState>;
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
        floorItems: [...state.floorItems, buildDroppedFloorItem(item, state.level, x, y)],
    } as Partial<TState>;
}

export function buildPickupItemToChampionRuntimePatch<
    TState extends PickupRuntimeState,
    TPatch extends object,
>(
    state: TState,
    itemId: string,
    championId: number,
    deps: PickupRuntimeDeps<TState, TPatch>,
): TPatch | null {
    const item = state.floorItems.find((entry) => entry.id === itemId);
    const patch = deps.transferFloorItemToChampionState(state, itemId, championId);
    if (!patch || !item || !deps.buildSensorStateSnapshot || !deps.triggerFloorSensors) return patch;

    const nextFloorItems = 'floorItems' in patch && Array.isArray(patch.floorItems)
        ? patch.floorItems as FloorItem[]
        : state.floorItems.filter((entry) => entry.id !== itemId);
    const sensorState = deps.buildSensorStateSnapshot(state);
    const sensorChanges = deps.triggerFloorSensors(
        item.mapIndex,
        item.x,
        item.y,
        sensorState,
        state.championInventories,
        state.championEquipment,
        nextFloorItems,
        state.pendingSensorEvents,
        'item',
        'leave',
    );

    return {
        ...patch,
        ...sensorChanges.sensorChanges,
        pendingSensorEvents: sensorChanges.pendingSensorEvents,
    };
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
    return buildDropInventoryItemToTileRuntimePatch(state, championId, itemId, x, y, deps);
}

export function buildDropInventoryItemToTileRuntimePatch<
    TState extends DropRuntimeState,
    TPatch extends Partial<TState>,
>(
    state: TState,
    championId: number,
    itemId: string,
    targetX: number,
    targetY: number,
    deps: DropRuntimeDeps<TState, TPatch>,
): TPatch | null {
    const inventory = state.championInventories[championId] ?? [];
    const item = inventory.find((entry) => entry.id === itemId);
    if (!item) return null;

    if (item.category === 'Misc' && item.typeId === 5 && item.championId !== undefined) {
        const deadChampion = state.deadChampions[item.championId];
        if (deadChampion && state.party.length < 4 && deps.isAltarTile(state.level, targetX, targetY)) {
            return deps.buildViAltarResurrectionPatch(state, item.championId, itemId, championId);
        }
    }

    const dropped = buildDroppedFloorItem(item, state.level, targetX, targetY);
    const nextFloorItems = [...state.floorItems, dropped];
    const sensorState = deps.buildSensorStateSnapshot(state);
    const sensorChanges = deps.triggerFloorSensors(
        state.level,
        targetX,
        targetY,
        sensorState,
        state.championInventories,
        state.championEquipment,
        nextFloorItems,
        state.pendingSensorEvents,
        'item',
        'enter',
    );

    const basePatch = {
        championInventories: {
            ...state.championInventories,
            [championId]: inventory.filter((entry) => entry.id !== itemId),
        },
        floorItems: nextFloorItems,
        ...sensorChanges.sensorChanges,
        pendingSensorEvents: sensorChanges.pendingSensorEvents,
    } as TPatch;

    const [partyY, partyX] = state.position;
    if (partyX === targetX && partyY === targetY) {
        return deps.applyImmediateTransportSquareEffects(state, basePatch);
    }
    return basePatch;
}

export function buildMoveFloorItemToTileRuntimePatch<
    TState extends MoveFloorItemRuntimeState,
    TPatch extends Partial<TState>,
>(
    state: TState,
    itemId: string,
    championId: number,
    targetX: number,
    targetY: number,
    deps: MoveFloorItemRuntimeDeps<TState, TPatch>,
): TPatch | null {
    const item = state.floorItems.find((entry) => entry.id === itemId);
    const champion = state.party.find((entry) => entry.id === championId);
    if (!item || !champion || !canPartyReachFloorItem(state, item)) return null;

    if (item.mapIndex === state.level && item.x === targetX && item.y === targetY && item.tilePos === 'North') {
        return {
            ...clearActiveFloorDragForItem(state, itemId),
        } as TPatch;
    }

    const withoutSourceItem = state.floorItems.filter((entry) => entry.id !== itemId);
    const leaveState = deps.buildSensorStateSnapshot(state);
    const leave = deps.triggerFloorSensors(
        item.mapIndex,
        item.x,
        item.y,
        leaveState,
        state.championInventories,
        state.championEquipment,
        withoutSourceItem,
        state.pendingSensorEvents,
        'item',
        'leave',
    );

    const movedItem = buildDroppedFloorItem(item, state.level, targetX, targetY);
    const nextFloorItems = [...withoutSourceItem, movedItem];
    const stateAfterLeave = {
        ...state,
        ...leave.sensorChanges,
        floorItems: withoutSourceItem,
        pendingSensorEvents: leave.pendingSensorEvents,
    } as TState;
    const enterState = deps.buildSensorStateSnapshot(stateAfterLeave);
    const enter = deps.triggerFloorSensors(
        state.level,
        targetX,
        targetY,
        enterState,
        state.championInventories,
        state.championEquipment,
        nextFloorItems,
        leave.pendingSensorEvents,
        'item',
        'enter',
    );

    const basePatch = {
        ...leave.sensorChanges,
        ...enter.sensorChanges,
        floorItems: nextFloorItems,
        pendingSensorEvents: enter.pendingSensorEvents,
        ...clearActiveFloorDragForItem(state, itemId),
    } as TPatch;

    const [partyY, partyX] = state.position;
    if (deps.applyImmediateTransportSquareEffects && partyX === targetX && partyY === targetY) {
        return deps.applyImmediateTransportSquareEffects(state, basePatch);
    }
    return basePatch;
}

export function buildThrowFloorItemRuntimePatch<
    TState extends ThrowFloorItemRuntimeState,
    TSensorPatch extends Partial<TState>,
    TXpPatch extends object = {},
>(
    state: TState,
    itemId: string,
    championId: number,
    deps: ThrowFloorItemRuntimeDeps<TState, TSensorPatch, TXpPatch>,
): (TSensorPatch & TXpPatch) | null {
    const item = state.floorItems.find((entry) => entry.id === itemId);
    const champion = state.party.find((entry) => entry.id === championId);
    if (!item || !champion || !canPartyReachFloorItem(state, item)) return null;

    const withoutSourceItem = state.floorItems.filter((entry) => entry.id !== itemId);
    const leaveState = deps.buildSensorStateSnapshot(state);
    const leave = deps.triggerFloorSensors(
        item.mapIndex,
        item.x,
        item.y,
        leaveState,
        state.championInventories,
        state.championEquipment,
        withoutSourceItem,
        state.pendingSensorEvents,
        'item',
        'leave',
    );

    const projectile = deps.buildProjectile(state, championId, champion, item);
    return {
        ...leave.sensorChanges,
        floorItems: withoutSourceItem,
        projectiles: [...state.projectiles, projectile],
        pendingSensorEvents: leave.pendingSensorEvents,
        ...clearActiveFloorDragForItem(state, itemId),
        ...(deps.buildThrowXpPatch?.(state, championId) ?? {}),
    } as TSensorPatch & TXpPatch;
}

import type { Champion } from '../../types/champion';
import type { FloorItem, SensorObject, GameTile } from '../../types/game';
import { canChampionInventoryAcceptItem } from './inventoryState';

type FloorPickupState = {
    level: number;
    position: [number, number];
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    floorItems: FloorItem[];
    party: Champion[];
    championInventories: Record<number, FloorItem[]>;
    activeFloorDrag: { itemId: string; pointerX: number; pointerY: number } | null;
};

type FloorItemPickupTransferState<TResult> = FloorPickupState & {
    lastCastResult?: TResult | null;
};

export function hasHiddenFirestaffPickupRestriction(item: FloorItem, tile: GameTile | undefined): boolean {
    if (item.category !== 'Weapon' || item.typeId !== 45) return false;
    if (!tile || (tile.type !== 'Wall' && tile.type !== 'TrickWall')) return false;

    return tile.objects.some((object) =>
        object.category === 'Sensor' &&
        (
            (object as SensorObject).requiredObjectName === 'THE FIRESTAFF' ||
            (object as SensorObject).requiredObjectName === 'ZOKATHRA SPELL'
        ),
    );
}

function resolveFrontTilePosition(
    position: [number, number],
    direction: FloorPickupState['direction'],
): { x: number; y: number } {
    const [y, x] = position;
    if (direction === 'NORTH') return { x, y: y - 1 };
    if (direction === 'SOUTH') return { x, y: y + 1 };
    if (direction === 'EAST') return { x: x + 1, y };
    return { x: x - 1, y };
}

export function canPartyReachFloorItem(
    state: Pick<FloorPickupState, 'level' | 'position' | 'direction'>,
    item: FloorItem,
): boolean {
    if (item.mapIndex !== state.level) return false;

    const [partyY, partyX] = state.position;
    if (item.x === partyX && item.y === partyY) return true;

    const frontTile = resolveFrontTilePosition(state.position, state.direction);
    return item.x === frontTile.x && item.y === frontTile.y;
}

export function isFloorItemPickupBlockedByFullInventory(
    state: FloorPickupState,
    id: string,
    championId: number,
): boolean {
    const item = state.floorItems.find((entry) => entry.id === id);
    if (!item) return false;

    const champion = state.party.find((entry) => entry.id === championId);
    if (!champion) return false;
    if (!canPartyReachFloorItem(state, item)) return false;

    return !canChampionInventoryAcceptItem(state.championInventories[championId] ?? []);
}

export function buildFloorItemPickupPatch<TSensorPatch extends object>(
    state: FloorPickupState,
    item: FloorItem,
    championId: number,
    sensorPatch: TSensorPatch,
): {
    floorItems: FloorItem[];
    championInventories: Record<number, FloorItem[]>;
    activeFloorDrag: FloorPickupState['activeFloorDrag'];
} & TSensorPatch {
    const championInventory = state.championInventories[championId] ?? [];
    return {
        floorItems: state.floorItems.filter((entry) => entry.id !== item.id),
        championInventories: { ...state.championInventories, [championId]: [...championInventory, item] },
        activeFloorDrag: state.activeFloorDrag?.itemId === item.id ? null : state.activeFloorDrag,
        ...sensorPatch,
    };
}

type TransferFloorItemPickupDeps<TState extends FloorItemPickupTransferState<TResult>, TResult, TSensorPatch extends object> = {
    getTile: (mapIndex: number, y: number, x: number) => GameTile | undefined;
    buildPickupPatch: (
        state: TState,
        item: FloorItem,
        championId: number,
        sensorPatch: TSensorPatch,
    ) => {
        floorItems: FloorItem[];
        championInventories: Record<number, FloorItem[]>;
        activeFloorDrag: TState['activeFloorDrag'];
    } & TSensorPatch;
    clearAlcoveStateOnPickup: (item: FloorItem, state: TState) => TSensorPatch;
    buildHiddenFirestaffMessage: () => TResult;
};

export function transferFloorItemToChampionState<
    TResult,
    TSensorPatch extends object,
    TState extends FloorItemPickupTransferState<TResult>,
>(
    state: TState,
    id: string,
    championId: number,
    deps: TransferFloorItemPickupDeps<TState, TResult, TSensorPatch>,
): (ReturnType<typeof deps.buildPickupPatch> & { lastCastResult?: TResult | null }) | { lastCastResult: TResult } | null {
    const item = state.floorItems.find((entry) => entry.id === id);
    if (!item) return null;

    const champion = state.party.find((entry) => entry.id === championId);
    if (!champion) return null;
    if (!canPartyReachFloorItem(state, item)) return null;
    if (!canChampionInventoryAcceptItem(state.championInventories[championId] ?? [])) return null;

    const tile = deps.getTile(item.mapIndex, item.y, item.x);
    if (hasHiddenFirestaffPickupRestriction(item, tile)) {
        return {
            lastCastResult: deps.buildHiddenFirestaffMessage(),
        };
    }

    const alcoveState = deps.clearAlcoveStateOnPickup(item, state);
    return deps.buildPickupPatch(state, item, championId, alcoveState);
}

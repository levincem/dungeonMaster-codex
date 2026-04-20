import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem, GameTile } from '../../types/game';
import { transferFloorItemToChampionState as transferFloorItemToChampionStateSystem } from './floorItemState';

type FloorItemPickupStateLike<TMessage, TSensorPatch extends object> = {
    level: number;
    position: [number, number];
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    floorItems: FloorItem[];
    party: Champion[];
    championInventories: Record<number, FloorItem[]>;
    activeFloorDrag: { itemId: string; pointerX: number; pointerY: number } | null;
    lastCastResult?: TMessage | null;
} & TSensorPatch;

type FloorItemDropStateLike = {
    level: number;
    position: [number, number];
    party: Champion[];
    floorItems: FloorItem[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    deadChampions: Record<number, Champion>;
    pendingSensorEvents: unknown[];
};

export function createStoreFloorItemCommandDeps<
    TMessage,
    TSensorPatch extends object,
    TState extends FloorItemPickupStateLike<TMessage, TSensorPatch> & FloorItemDropStateLike,
    TSensorState,
    TPendingSensorEvent,
>(params: {
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
    buildHiddenFirestaffMessage: () => TMessage;
    isAltarTile: (level: number, x: number, y: number) => boolean;
    buildViAltarResurrectionPatch: (
        state: TState,
        deadChampionId: number,
        itemId: string,
        championId: number,
    ) => Partial<TState> | null;
    buildSensorStateSnapshot: (state: TState) => TSensorState;
    triggerFloorSensors: (
        level: number,
        x: number,
        y: number,
        sensorState: TSensorState,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
        floorItems: FloorItem[],
        pendingSensorEvents: TPendingSensorEvent[],
        source: 'party' | 'item',
        mode: 'enter' | 'leave',
    ) => {
        sensorChanges: TSensorPatch;
        pendingSensorEvents: TPendingSensorEvent[];
    };
    applyImmediateTransportSquareEffects: (
        state: TState,
        patch: Partial<TState>,
    ) => Partial<TState>;
}) {
    return {
        transferFloorItemToChampionState: (
            state: TState,
            itemId: string,
            championId: number,
        ) => transferFloorItemToChampionStateSystem(state, itemId, championId, {
            getTile: params.getTile,
            buildPickupPatch: params.buildPickupPatch,
            clearAlcoveStateOnPickup: params.clearAlcoveStateOnPickup,
            buildHiddenFirestaffMessage: params.buildHiddenFirestaffMessage,
        }),
        isAltarTile: params.isAltarTile,
        buildViAltarResurrectionPatch: params.buildViAltarResurrectionPatch,
        buildSensorStateSnapshot: params.buildSensorStateSnapshot,
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
        ) => params.triggerFloorSensors(
            level,
            x,
            y,
            sensorState as TSensorState,
            inventories,
            equipment,
            floorItems,
            pendingSensorEvents as TPendingSensorEvent[],
            source,
            mode,
        ),
        applyImmediateTransportSquareEffects: (
            state: TState,
            patch: Partial<TState>,
        ) => params.applyImmediateTransportSquareEffects(state, patch),
    };
}

type SelectedChampionPickupStateLike<TMessage, TSensorPatch extends object> =
    FloorItemPickupStateLike<TMessage, TSensorPatch> & {
        selectedChampionIndex: number;
    };

export function buildStoreSelectedChampionPickupPatch<
    TMessage,
    TSensorPatch extends object,
    TState extends SelectedChampionPickupStateLike<TMessage, TSensorPatch>,
>(
    state: TState,
    itemId: string,
    deps: {
        buildPickupPatch: (
            state: TState,
            itemId: string,
            championId: number,
        ) => (Partial<TState> & TSensorPatch) | null;
    },
) {
    const activeChampion = state.party[state.selectedChampionIndex];
    if (!activeChampion) return null;
    return deps.buildPickupPatch(state, itemId, activeChampion.id);
}

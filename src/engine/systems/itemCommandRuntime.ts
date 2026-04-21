import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';
import type { ChampionVitals, Direction } from '../runtimeTypes';
import { tryUseChampionItemOnFrontWall, tryUseFloorItemOnFrontWall } from './frontWallInteractions';
import { resolveFillWaterAction } from './fillWaterAction';
import { buildUseItemStatePatch } from './useItemState';

type UseItemRuntimeState<TActivePotionBoost, TActiveShield> = {
    party: Parameters<typeof buildUseItemStatePatch<TActivePotionBoost, TActiveShield>>[0]['party'];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    activePotionBoosts: TActivePotionBoost[];
    activeShields: TActiveShield[];
};

type FillWaterRuntimeState = {
    level: number;
    position: [number, number];
    direction: Direction;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
};

type DrinkFromFountainRuntimeState = {
    level: number;
    position: [number, number];
    direction: Direction;
    championVitals: Record<number, ChampionVitals>;
};

type FrontWallRuntimeState = {
    level: number;
    position: [number, number];
    direction: Direction;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    activeFloorDrag: { itemId: string } | null;
};

type FrontWallRuntimeResult<TPatch> = {
    matched: boolean;
    patch: TPatch | null;
    shouldPlayPlate: boolean;
};

export function buildUseItemRuntimePatch<TActivePotionBoost, TActiveShield, TPatch extends Record<string, unknown>>(
    state: UseItemRuntimeState<TActivePotionBoost, TActiveShield>,
    championId: number,
    itemId: string,
    fromSlot: EquipSlotKey | 'inventory',
    now: number,
    deps: Parameters<typeof buildUseItemStatePatch<TActivePotionBoost, TActiveShield>>[5],
): TPatch | null {
    return buildUseItemStatePatch(
        state,
        championId,
        itemId,
        fromSlot,
        now,
        deps,
    ) as TPatch | null;
}

export function buildFillWaterRuntimePatch<TPatch extends Record<string, unknown>>(
    state: FillWaterRuntimeState,
    championId: number,
    itemId: string,
    deps: {
        isFacingFountain: (state: FillWaterRuntimeState) => boolean;
        canFillWaterContainer: (item: FloorItem) => boolean;
        fillWaterContainer: (item: FloorItem) => FloorItem | null;
    },
): TPatch | null {
    if (!deps.isFacingFountain(state)) return null;
    return resolveFillWaterAction(
        {
            state,
            championId,
            itemId,
        },
        {
            canFillWaterContainer: deps.canFillWaterContainer,
            fillWaterContainer: deps.fillWaterContainer,
        },
    ) as TPatch | null;
}

export function buildDrinkFromFountainRuntimePatch<TPatch extends Record<string, unknown>>(
    state: DrinkFromFountainRuntimeState,
    championId: number,
    deps: {
        isFacingFountain: (state: DrinkFromFountainRuntimeState) => boolean;
        clampWater: (value: number) => number;
        waterGain: number;
    },
): TPatch | null {
    if (!deps.isFacingFountain(state)) return null;
    const vitals = state.championVitals[championId];
    if (!vitals) return null;

    return {
        championVitals: {
            ...state.championVitals,
            [championId]: {
                ...vitals,
                water: deps.clampWater(vitals.water + deps.waterGain),
            },
        },
    } as unknown as TPatch;
}

export function runChampionItemOnFrontWallRuntime<
    TState extends FrontWallRuntimeState,
    TSensorState,
    TPatch extends Record<string, unknown>,
>(
    state: TState,
    championId: number,
    itemId: string,
    fromSlot: EquipSlotKey | 'inventory',
    deps: Parameters<typeof tryUseChampionItemOnFrontWall<TState, TSensorState, TPatch>>[2],
): FrontWallRuntimeResult<TPatch> {
    return tryUseChampionItemOnFrontWall(
        state,
        { championId, itemId, fromSlot },
        deps,
    );
}

export function runFloorItemOnFrontWallRuntime<
    TState extends FrontWallRuntimeState,
    TSensorState,
    TPatch extends Record<string, unknown>,
>(
    state: TState,
    itemId: string,
    championId: number,
    deps: Parameters<typeof tryUseFloorItemOnFrontWall<TState, TSensorState, TPatch>>[3],
): FrontWallRuntimeResult<TPatch> {
    return tryUseFloorItemOnFrontWall(state, itemId, championId, deps);
}

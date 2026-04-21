import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { PotionDef } from '../../types/items';
import type { EquipSlotKey } from '../../types/items';
import type {
    ActivePotionBoost,
    ChampionVitals,
    PartyShield,
} from '../runtimeTypes';
import { resolveUseItemConsumption as resolveUseItemConsumptionSystem } from './useItemConsumption';
import { resolvePotionConsumption as resolvePotionConsumptionSystem } from './potionConsumption';
import {
    buildDrinkFromFountainRuntimePatch,
    buildFillWaterRuntimePatch,
    buildUseItemRuntimePatch,
} from './itemCommandRuntime';
import { buildResurrectChampionRuntimePatch } from './itemCarryCommandRuntime';

type UseItemStateLike = {
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    activePotionBoosts: ActivePotionBoost[];
    activeShields: PartyShield[];
};

type FillWaterStateLike = {
    level: number;
    position: [number, number];
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
};

type DrinkFromFountainStateLike = {
    level: number;
    position: [number, number];
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    championVitals: Record<number, ChampionVitals>;
};

type ResurrectStateLike = {
    level: number;
    position: [number, number];
    party: Champion[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    deadChampions: Record<number, Champion>;
};

type StoreUseItemConsumptionDeps = {
    isOriginalConsumableItem: (item: FloorItem) => boolean;
    isWaterContainer: (item: FloorItem) => boolean;
    consumeWaterContainer: (item: FloorItem) => { nextItem: FloorItem; waterGain: number; staminaGain: number } | null;
    clampFoodWater: (value: number, max: number) => number;
    getPotionDef: (typeId: number, rawName?: string) => PotionDef | undefined;
    getMiscNutrition: (typeId: number) => number | null;
    resolvePotionConsumption: (
        args: Parameters<typeof resolvePotionConsumptionSystem>[0],
    ) => ReturnType<typeof resolvePotionConsumptionSystem> | null;
    maxFood: number;
    maxWater: number;
};

export function resolveStoreUseItemSound(
    item: FloorItem,
    deps: Pick<
        StoreUseItemConsumptionDeps,
        'isOriginalConsumableItem' | 'isWaterContainer' | 'getPotionDef' | 'getMiscNutrition'
    >,
): 'swallowing' | null {
    if (deps.isWaterContainer(item)) return 'swallowing';
    if (!deps.isOriginalConsumableItem(item)) return null;

    if (item.category === 'Potion') {
        return deps.getPotionDef(item.typeId, item.rawName)?.drinkable
            ? 'swallowing'
            : null;
    }

    if (item.category === 'Misc') {
        return (deps.getMiscNutrition(item.typeId) ?? 0) > 0
            ? 'swallowing'
            : null;
    }

    return null;
}

export function createStoreUseItemRuntimeDeps(params: {
    locateChampionItem: (
        state: UseItemStateLike,
        championId: number,
        itemId: string,
        fromSlot: EquipSlotKey | 'inventory',
    ) => {
        inventory: FloorItem[];
        equipment: ChampionEquipment;
        inventoryIndex: number;
        slotKey?: EquipSlotKey;
        item: FloorItem;
    } | null;
    getEffectiveChampionStatsRuntime: (
        champion: Champion,
        equipment: ChampionEquipment,
        activePotionBoosts: ActivePotionBoost[],
        vitals: ChampionVitals,
    ) => { stamina: number; mana: number; health: number };
    normalizeChampionCurrentStats: (
        champion: Champion,
        currentStats: ChampionVitals['currentStats'],
    ) => ChampionVitals['currentStats'];
    consumptionDeps: StoreUseItemConsumptionDeps;
    buildUseItemPatch: (args: {
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
    }) => Record<string, unknown>;
}) {
    return {
        locateChampionItem: params.locateChampionItem,
        getEffectiveChampionStatsRuntime: params.getEffectiveChampionStatsRuntime,
        normalizeChampionCurrentStats: params.normalizeChampionCurrentStats,
        resolveUseItemSound: (item: FloorItem) =>
            resolveStoreUseItemSound(item, {
                isOriginalConsumableItem: params.consumptionDeps.isOriginalConsumableItem,
                isWaterContainer: params.consumptionDeps.isWaterContainer,
                getPotionDef: params.consumptionDeps.getPotionDef,
                getMiscNutrition: params.consumptionDeps.getMiscNutrition,
            }),
        resolveUseItemConsumption: (args: Parameters<typeof resolveUseItemConsumptionSystem>[0]) =>
            resolveUseItemConsumptionSystem(args, {
                isOriginalConsumableItem: params.consumptionDeps.isOriginalConsumableItem,
                isWaterContainer: params.consumptionDeps.isWaterContainer,
                consumeWaterContainer: params.consumptionDeps.consumeWaterContainer,
                clampFoodWater: params.consumptionDeps.clampFoodWater,
                getPotionDef: params.consumptionDeps.getPotionDef,
                getMiscNutrition: params.consumptionDeps.getMiscNutrition,
                resolvePotionConsumption: params.consumptionDeps.resolvePotionConsumption,
                maxFood: params.consumptionDeps.maxFood,
                maxWater: params.consumptionDeps.maxWater,
            }),
        buildUseItemPatch: params.buildUseItemPatch,
    };
}

export function createStoreFillWaterRuntimeDeps(params: {
    isFacingFountain: (state: FillWaterStateLike) => boolean;
    canFillWaterContainer: (item: FloorItem) => boolean;
    fillWaterContainer: (item: FloorItem) => FloorItem | null;
}) {
    return {
        isFacingFountain: params.isFacingFountain,
        canFillWaterContainer: params.canFillWaterContainer,
        fillWaterContainer: params.fillWaterContainer,
    };
}

export function createStoreDrinkFromFountainRuntimeDeps(params: {
    isFacingFountain: (state: DrinkFromFountainStateLike) => boolean;
    clampWater: (value: number) => number;
    waterGain: number;
}) {
    return {
        isFacingFountain: params.isFacingFountain,
        clampWater: params.clampWater,
        waterGain: params.waterGain,
    };
}

export function createStoreResurrectChampionRuntimeDeps<
    TState extends ResurrectStateLike,
    TPatch,
>(params: {
    maxPartySize: number;
    isAltarTile: (level: number, x: number, y: number) => boolean;
    buildViAltarResurrectionPatch: (
        state: TState,
        deadChampionId: number,
        bonesItemId: string,
        carriedBy: number | null,
    ) => TPatch | null;
}) {
    return {
        maxPartySize: params.maxPartySize,
        isAltarTile: params.isAltarTile,
        buildViAltarResurrectionPatch: params.buildViAltarResurrectionPatch,
    };
}

export function buildStoreUseItemPatch(
    state: UseItemStateLike,
    championId: number,
    itemId: string,
    fromSlot: EquipSlotKey | 'inventory',
    now: number,
    deps: ReturnType<typeof createStoreUseItemRuntimeDeps>,
) {
    return buildUseItemRuntimePatch(
        state,
        championId,
        itemId,
        fromSlot,
        now,
        deps,
    );
}

export function buildStoreFillWaterPatch<TState extends FillWaterStateLike>(
    state: TState,
    championId: number,
    itemId: string,
    deps: ReturnType<typeof createStoreFillWaterRuntimeDeps>,
) {
    return buildFillWaterRuntimePatch(
        state,
        championId,
        itemId,
        deps,
    );
}

export function buildStoreDrinkFromFountainPatch<TState extends DrinkFromFountainStateLike>(
    state: TState,
    championId: number,
    deps: ReturnType<typeof createStoreDrinkFromFountainRuntimeDeps>,
) {
    return buildDrinkFromFountainRuntimePatch(
        state,
        championId,
        deps,
    );
}

export function buildStoreResurrectChampionPatch<
    TState extends ResurrectStateLike,
    TPatch,
>(
    state: TState,
    bonesItemId: string,
    deps: ReturnType<typeof createStoreResurrectChampionRuntimeDeps<TState, TPatch>>,
) {
    return buildResurrectChampionRuntimePatch(
        state,
        bonesItemId,
        deps,
    );
}

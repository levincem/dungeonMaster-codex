import type { ChampionVitals, PartyShield } from '../runtimeTypes';
import type { FloorItem } from '../../types/game';
import type { PotionDef } from '../../types/items';
import {
    resolvePotionConsumption,
    type PotionConsumptionResult,
} from './potionConsumption';

type EffectiveConsumableCaps = {
    stamina: number;
    mana: number;
    health: number;
};

type UseItemConsumptionDeps = {
    isWaterContainer: (item: FloorItem) => boolean;
    consumeWaterContainer: (item: FloorItem) => { nextItem: FloorItem; waterGain: number; staminaGain: number } | null;
    clampFoodWater: (value: number, max: number) => number;
    getPotionDef: (typeId: number, rawName?: string) => PotionDef | undefined;
    getMiscNutrition: (typeId: number) => number | null;
    resolvePotionConsumption: (
        args: Parameters<typeof resolvePotionConsumption>[0],
    ) => PotionConsumptionResult | null;
    maxFood: number;
    maxWater: number;
};

type ResolveUseItemConsumptionArgs = {
    item: FloorItem;
    championId: number;
    vitals: ChampionVitals;
    effective: EffectiveConsumableCaps;
    normalizedStats: ChampionVitals['currentStats'];
    activeShields: PartyShield[];
    now: number;
};

export type UseItemConsumptionResult =
    | { kind: 'blocked' }
    | { kind: 'unhandled' }
    | {
        kind: 'handled';
        nextVitals: ChampionVitals;
        replacementItem: FloorItem | null;
        shouldConsumeOriginal: boolean;
        activeShields?: PartyShield[];
    };

export function resolveUseItemConsumption(
    {
        item,
        championId,
        vitals,
        effective,
        normalizedStats,
        activeShields,
        now,
    }: ResolveUseItemConsumptionArgs,
    deps: UseItemConsumptionDeps,
): UseItemConsumptionResult {
    const waterUse = deps.consumeWaterContainer(item);
    if (deps.isWaterContainer(item) && !waterUse) {
        return { kind: 'blocked' };
    }
    if (waterUse) {
        return {
            kind: 'handled',
            nextVitals: {
                ...vitals,
                water: deps.clampFoodWater(vitals.water + waterUse.waterGain, deps.maxWater),
                stamina: Math.min(effective.stamina, vitals.stamina + waterUse.staminaGain),
            },
            replacementItem: waterUse.nextItem,
            shouldConsumeOriginal: false,
        };
    }

    if (item.category === 'Potion') {
        const def = deps.getPotionDef(item.typeId, item.rawName);
        if (!def?.drinkable) {
            return { kind: 'blocked' };
        }

        const potionResult = deps.resolvePotionConsumption({
            effect: def.effect,
            item,
            championId,
            vitals,
            effective,
            normalizedStats,
            activeShields,
            now,
        });
        if (!potionResult) {
            return { kind: 'blocked' };
        }

        return {
            kind: 'handled',
            nextVitals: potionResult.nextVitals,
            replacementItem: potionResult.replacementItem,
            shouldConsumeOriginal: false,
            ...(potionResult.activeShields ? { activeShields: potionResult.activeShields } : {}),
        };
    }

    if (item.category === 'Misc') {
        const nutrition = deps.getMiscNutrition(item.typeId);
        if (nutrition) {
            return {
                kind: 'handled',
                nextVitals: {
                    ...vitals,
                    food: deps.clampFoodWater(vitals.food + nutrition, deps.maxFood),
                },
                replacementItem: null,
                shouldConsumeOriginal: true,
            };
        }
    }

    return { kind: 'unhandled' };
}

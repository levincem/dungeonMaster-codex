import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FloorItem } from '../src/types/game.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import { resolveUseItemConsumption } from '../src/engine/systems/useItemConsumption.js';

function createItem(overrides: Partial<FloorItem>): FloorItem {
    return {
        id: 'item_1',
        category: 'Misc',
        typeId: 0,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
        ...overrides,
    };
}

function createVitals(overrides: Partial<ChampionVitals> = {}): ChampionVitals {
    return {
        hp: 35,
        stamina: 40,
        mana: 20,
        food: 300,
        water: 300,
        currentStats: {
            luck: 10,
            strength: 10,
            dexterity: 10,
            wisdom: 10,
            vitality: 10,
            antiMagic: 0,
            antiFire: 0,
        },
        wounds: {
            rightHand: false,
            leftHand: false,
            head: false,
            torso: false,
            legs: false,
            feet: false,
        },
        poisonEntries: [],
        ...overrides,
    };
}

test('resolveUseItemConsumption handles water containers without consuming the item slot', () => {
    const nextItem = createItem({ id: 'waterskin_empty', category: 'Misc', typeId: 1 });
    const result = resolveUseItemConsumption(
        {
            item: createItem({ id: 'waterskin_full', category: 'Potion', typeId: 24 }),
            championId: 1,
            vitals: createVitals(),
            effective: { stamina: 70, mana: 50, health: 60 },
            normalizedStats: createVitals().currentStats,
            activeShields: [],
            now: 1000,
        },
        {
            isOriginalConsumableItem: () => true,
            isWaterContainer: () => true,
            consumeWaterContainer: () => ({ nextItem, waterGain: 800, staminaGain: 0 }),
            clampFoodWater: (value, max) => Math.min(max, value),
            getPotionDef: () => undefined,
            getMiscNutrition: () => null,
            resolvePotionConsumption: () => null,
            maxFood: 2500,
            maxWater: 2500,
        },
    );

    assert.deepEqual(result, {
        kind: 'handled',
        nextVitals: {
            ...createVitals(),
            water: 1100,
            stamina: 40,
        },
        replacementItem: nextItem,
        shouldConsumeOriginal: false,
    });
});

test('resolveUseItemConsumption delegates drinkable potions to the potion helper', () => {
    const replacementItem = createItem({ id: 'empty_flask', category: 'Potion', typeId: 20 });
    const potionVitals = createVitals({ hp: 50 });
    const result = resolveUseItemConsumption(
        {
            item: createItem({ category: 'Potion', typeId: 11, rawName: 'Mon Potion' }),
            championId: 2,
            vitals: createVitals(),
            effective: { stamina: 70, mana: 50, health: 60 },
            normalizedStats: createVitals().currentStats,
            activeShields: [],
            now: 1000,
        },
        {
            isOriginalConsumableItem: () => true,
            isWaterContainer: () => false,
            consumeWaterContainer: () => null,
            clampFoodWater: (value) => value,
            getPotionDef: () => ({ id: 11, name: 'Mon Potion', effect: 'stamina', drinkable: true }),
            getMiscNutrition: () => null,
            resolvePotionConsumption: () => ({
                nextVitals: potionVitals,
                replacementItem,
            }),
            maxFood: 2500,
            maxWater: 2500,
        },
    );

    assert.deepEqual(result, {
        kind: 'handled',
        nextVitals: potionVitals,
        replacementItem,
        shouldConsumeOriginal: false,
    });
});

test('resolveUseItemConsumption blocks unusable water containers and non-drinkable potions', () => {
    const blockedWater = resolveUseItemConsumption(
        {
            item: createItem({ category: 'Misc', typeId: 1 }),
            championId: 1,
            vitals: createVitals(),
            effective: { stamina: 70, mana: 50, health: 60 },
            normalizedStats: createVitals().currentStats,
            activeShields: [],
            now: 1000,
        },
        {
            isOriginalConsumableItem: () => true,
            isWaterContainer: () => true,
            consumeWaterContainer: () => null,
            clampFoodWater: (value) => value,
            getPotionDef: () => undefined,
            getMiscNutrition: () => null,
            resolvePotionConsumption: () => null,
            maxFood: 2500,
            maxWater: 2500,
        },
    );
    const blockedPotion = resolveUseItemConsumption(
        {
            item: createItem({ category: 'Potion', typeId: 18, rawName: 'Poison Bomb' }),
            championId: 1,
            vitals: createVitals(),
            effective: { stamina: 70, mana: 50, health: 60 },
            normalizedStats: createVitals().currentStats,
            activeShields: [],
            now: 1000,
        },
        {
            isOriginalConsumableItem: () => true,
            isWaterContainer: () => false,
            consumeWaterContainer: () => null,
            clampFoodWater: (value) => value,
            getPotionDef: () => ({ id: 18, name: 'Poison Bomb', effect: 'poisonCloud', throwable: true }),
            getMiscNutrition: () => null,
            resolvePotionConsumption: () => null,
            maxFood: 2500,
            maxWater: 2500,
        },
    );

    assert.deepEqual(blockedWater, { kind: 'blocked' });
    assert.deepEqual(blockedPotion, { kind: 'blocked' });
});

test('resolveUseItemConsumption handles edible misc items and leaves unrelated items unhandled', () => {
    const foodResult = resolveUseItemConsumption(
        {
            item: createItem({ category: 'Misc', typeId: 9 }),
            championId: 1,
            vitals: createVitals(),
            effective: { stamina: 70, mana: 50, health: 60 },
            normalizedStats: createVitals().currentStats,
            activeShields: [],
            now: 1000,
        },
        {
            isOriginalConsumableItem: () => true,
            isWaterContainer: () => false,
            consumeWaterContainer: () => null,
            clampFoodWater: (value, max) => Math.min(max, value),
            getPotionDef: () => undefined,
            getMiscNutrition: () => 450,
            resolvePotionConsumption: () => null,
            maxFood: 2500,
            maxWater: 2500,
        },
    );
    const compassResult = resolveUseItemConsumption(
        {
            item: createItem({ category: 'Misc', typeId: 0 }),
            championId: 1,
            vitals: createVitals(),
            effective: { stamina: 70, mana: 50, health: 60 },
            normalizedStats: createVitals().currentStats,
            activeShields: [],
            now: 1000,
        },
        {
            isOriginalConsumableItem: () => false,
            isWaterContainer: () => false,
            consumeWaterContainer: () => null,
            clampFoodWater: (value) => value,
            getPotionDef: () => undefined,
            getMiscNutrition: () => null,
            resolvePotionConsumption: () => null,
            maxFood: 2500,
            maxWater: 2500,
        },
    );

    const fakeConsumablePotionResult = resolveUseItemConsumption(
        {
            item: createItem({ category: 'Potion', typeId: 14, rawName: 'Vi Potion' }),
            championId: 1,
            vitals: createVitals(),
            effective: { stamina: 70, mana: 50, health: 60 },
            normalizedStats: createVitals().currentStats,
            activeShields: [],
            now: 1000,
        },
        {
            isOriginalConsumableItem: () => false,
            isWaterContainer: () => false,
            consumeWaterContainer: () => null,
            clampFoodWater: (value) => value,
            getPotionDef: () => ({ id: 14, name: 'Vi Potion', effect: 'health', drinkable: true }),
            getMiscNutrition: () => 450,
            resolvePotionConsumption: () => null,
            maxFood: 2500,
            maxWater: 2500,
        },
    );

    assert.deepEqual(foodResult, {
        kind: 'handled',
        nextVitals: {
            ...createVitals(),
            food: 750,
        },
        replacementItem: null,
        shouldConsumeOriginal: true,
    });
    assert.deepEqual(compassResult, { kind: 'unhandled' });
    assert.deepEqual(fakeConsumablePotionResult, { kind: 'unhandled' });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FloorItem } from '../src/types/game.js';
import { MISC_TYPES, POTION_TYPES, resolveItemName, getPotionDef } from '../src/data/items.js';
import { isOriginalConsumableItem } from '../src/data/originalItemRules.js';
import { resolveUseItemConsumption } from '../src/engine/systems/useItemConsumption.js';
import { resolvePotionConsumption } from '../src/engine/systems/potionConsumption.js';
import { canDrinkFromContainer, getWaterContainerState, isWaterContainer } from '../src/data/waterContainers.js';
import {
    MAX_FOOD,
    MAX_WATER,
    adjustOriginalStatisticCurrentValue,
    buildEmptyFlaskReplacement,
    clampFoodWater,
} from '../src/engine/systems/storeChampionRuntime.js';
import type { ChampionVitals, PartyShield } from '../src/engine/runtimeTypes.js';

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

function createItem(category: FloorItem['category'], typeId: number, overrides: Partial<FloorItem> = {}): FloorItem {
    return {
        id: `${category}-${typeId}`,
        category,
        typeId,
        rawName: resolveItemName(category, typeId),
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
        ...overrides,
    };
}

function createActiveShields(): PartyShield[] {
    return [];
}

test('buildEmptyFlaskReplacement keeps potion consumption aligned with the canonical empty flask runtime item', () => {
    const replacement = buildEmptyFlaskReplacement(createItem('Potion', 11), resolveItemName);
    assert.equal(replacement.category, 'Potion');
    assert.equal(replacement.typeId, 20);
    assert.equal(replacement.rawName, POTION_TYPES[20]?.name);
    assert.equal(replacement.waterCharges, 0);
    assert.equal(replacement.waterMaxCharges, 1);
});

test('runtime item consumption keeps all source-backed food misc items consumable with their packaged nutrition values', () => {
    for (const [typeIdText, def] of Object.entries(MISC_TYPES)) {
        const typeId = Number(typeIdText);
        if (!Number.isFinite(typeId) || !def?.food) continue;
        const nutrition = def.nutrition ?? 0;
        assert.ok(nutrition > 0, `food misc ${typeId} should keep a positive packaged nutrition value`);

        const baseVitals = createVitals();
        const result = resolveUseItemConsumption(
            {
                item: createItem('Misc', typeId),
                championId: 1,
                vitals: baseVitals,
                effective: { stamina: 70, mana: 50, health: 60 },
                normalizedStats: baseVitals.currentStats,
                activeShields: createActiveShields(),
                now: 1000,
        },
        {
            isOriginalConsumableItem,
            isWaterContainer: () => false,
            consumeWaterContainer: () => null,
            clampFoodWater,
            getPotionDef,
                getMiscNutrition: (candidateTypeId) => {
                    const candidate = MISC_TYPES[candidateTypeId];
                    return candidate?.food && candidate.nutrition ? candidate.nutrition : null;
                },
                resolvePotionConsumption: (args) => resolvePotionConsumption(args, {
                    adjustStatisticCurrentValue: adjustOriginalStatisticCurrentValue,
                    buildEmptyFlaskReplacement: (item) => buildEmptyFlaskReplacement(item, resolveItemName),
                    getPartyShieldKind: (shield) => shield.kind === 'fire' ? 'fire' : shield.kind === 'magic' ? 'magic' : 'physical',
                    quantizeDurationMs: (durationMs) => durationMs,
                    healChampionWounds: () => ({}),
                    timerTickMs: 1,
                }),
                maxFood: MAX_FOOD,
                maxWater: MAX_WATER,
            },
        );

        assert.equal(result.kind, 'handled', `food misc ${typeId} should remain consumable`);
        if (result.kind === 'handled') {
            assert.equal(result.shouldConsumeOriginal, true, `food misc ${typeId} should still consume the original item`);
            assert.equal(result.replacementItem, null, `food misc ${typeId} should not create a replacement item`);
            assert.equal(result.nextVitals.food, clampFoodWater(baseVitals.food + nutrition, MAX_FOOD), `food misc ${typeId} nutrition drifted through use-item runtime`);
        }
    }
});

test('runtime item consumption keeps drinkable and non-drinkable potion semantics aligned with packaged potion metadata', () => {
    for (const [typeIdText, def] of Object.entries(POTION_TYPES)) {
        const typeId = Number(typeIdText);
        if (!Number.isFinite(typeId) || !def) continue;

        const baseVitals = createVitals();
        const result = resolveUseItemConsumption(
            {
                item: createItem('Potion', typeId, { potionPower: 40 }),
                championId: 1,
                vitals: baseVitals,
                effective: { stamina: 70, mana: 50, health: 60 },
                normalizedStats: baseVitals.currentStats,
                activeShields: createActiveShields(),
                now: 1000,
        },
        {
            isOriginalConsumableItem,
            isWaterContainer: () => false,
            consumeWaterContainer: () => null,
            clampFoodWater,
            getPotionDef,
                getMiscNutrition: () => null,
                resolvePotionConsumption: (args) => resolvePotionConsumption(args, {
                    adjustStatisticCurrentValue: adjustOriginalStatisticCurrentValue,
                    buildEmptyFlaskReplacement: (item) => buildEmptyFlaskReplacement(item, resolveItemName),
                    getPartyShieldKind: (shield) => shield.kind === 'fire' ? 'fire' : shield.kind === 'magic' ? 'magic' : 'physical',
                    quantizeDurationMs: (durationMs) => durationMs,
                    healChampionWounds: () => ({}),
                    timerTickMs: 1,
                }),
                maxFood: MAX_FOOD,
                maxWater: MAX_WATER,
            },
        );

        const sourceConsumable = isOriginalConsumableItem(createItem('Potion', typeId));

        if (def.drinkable) {
            assert.equal(sourceConsumable, true, `drinkable potion ${typeId} should remain Consumable in the canonical item rules`);
            assert.equal(result.kind, 'handled', `potion ${typeId} should remain drinkable`);
            if (result.kind === 'handled') {
                assert.equal(result.shouldConsumeOriginal, false, `potion ${typeId} should still replace rather than consume in-place`);
                assert.equal(result.replacementItem?.typeId, 20, `potion ${typeId} should still become an empty flask after use`);
            }
        } else if (sourceConsumable) {
            assert.deepEqual(result, { kind: 'blocked' }, `consumable but non-drinkable potion ${typeId} should remain blocked for direct consumption`);
        } else {
            assert.deepEqual(result, { kind: 'unhandled' }, `non-consumable potion ${typeId} should stay outside the direct-consumption path`);
        }
    }
});

test('active runtime only treats canonical flask and waterskin ids as water containers', () => {
    assert.equal(isWaterContainer(createItem('Potion', 15, { waterCharges: 1 })), true);
    assert.equal(isWaterContainer(createItem('Potion', 20, { waterCharges: 0 })), true);
    assert.equal(isWaterContainer(createItem('Potion', 24, { waterCharges: 4 })), true);
    assert.equal(isWaterContainer(createItem('Misc', 1, { waterCharges: 0 })), true);

    assert.equal(isWaterContainer(createItem('Misc', 40, { waterCharges: 0 })), false);
    assert.equal(isWaterContainer(createItem('Misc', 41, { waterCharges: 1 })), false);
    assert.equal(isWaterContainer(createItem('Misc', 7, { waterCharges: 1 })), false);
    assert.equal(getWaterContainerState(createItem('Misc', 40, { waterCharges: 0 })), null);
    assert.equal(canDrinkFromContainer(createItem('Misc', 41, { waterCharges: 1 })), false);
});

test('runtime direct-consumption paths stay bounded by the canonical Consumable carry bit', () => {
    const baseVitals = createVitals();

    for (const [typeIdText, def] of Object.entries(MISC_TYPES)) {
        const typeId = Number(typeIdText);
        if (!Number.isFinite(typeId) || !def?.food) continue;
        assert.equal(
            isOriginalConsumableItem(createItem('Misc', typeId)),
            true,
            `food misc ${typeId} should remain marked Consumable in the canonical item rules`,
        );
    }

    for (const [typeIdText, def] of Object.entries(POTION_TYPES)) {
        const typeId = Number(typeIdText);
        if (!Number.isFinite(typeId) || !def?.drinkable) continue;
        assert.equal(
            isOriginalConsumableItem(createItem('Potion', typeId)),
            true,
            `drinkable potion ${typeId} should remain marked Consumable in the canonical item rules`,
        );
    }

    const nonConsumable = createItem('Misc', 8);
    assert.equal(isOriginalConsumableItem(nonConsumable), false);
    assert.deepEqual(
        resolveUseItemConsumption(
            {
                item: nonConsumable,
                championId: 1,
                vitals: baseVitals,
                effective: { stamina: 70, mana: 50, health: 60 },
                normalizedStats: baseVitals.currentStats,
                activeShields: createActiveShields(),
                now: 1000,
            },
            {
                isOriginalConsumableItem,
                isWaterContainer,
                consumeWaterContainer: () => null,
                clampFoodWater,
                getPotionDef,
                getMiscNutrition: () => 450,
                resolvePotionConsumption: (args) => resolvePotionConsumption(args, {
                    adjustStatisticCurrentValue: adjustOriginalStatisticCurrentValue,
                    buildEmptyFlaskReplacement: (item) => buildEmptyFlaskReplacement(item, resolveItemName),
                    getPartyShieldKind: (shield) => shield.kind === 'fire' ? 'fire' : shield.kind === 'magic' ? 'magic' : 'physical',
                    quantizeDurationMs: (durationMs) => durationMs,
                    healChampionWounds: () => ({}),
                    timerTickMs: 1,
                }),
                maxFood: MAX_FOOD,
                maxWater: MAX_WATER,
            },
        ),
        { kind: 'unhandled' },
        'non-consumable items should not become eatable through local nutrition heuristics alone',
    );
});

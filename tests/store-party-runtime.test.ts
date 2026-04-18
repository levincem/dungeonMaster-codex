import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyChampionTemporaryXP } from '../src/data/skillProgression.js';
import { createStorePartyRuntime } from '../src/engine/systems/storePartyRuntime.js';
import type { Champion } from '../src/types/champion.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champion ${id}`,
        title: 'The Brave',
        gender: 'M',
        class: 'Fighter',
        health: 100,
        stamina: 80,
        mana: 20,
        luck: 10,
        strength: 20,
        dexterity: 16,
        wisdom: 14,
        vitality: 15,
        antiMagic: 6,
        antiFire: 4,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: 'portrait.png',
    };
}

function createVitals(overrides: Partial<ChampionVitals> = {}): ChampionVitals {
    return {
        hp: 40,
        stamina: 20,
        mana: 10,
        food: 0,
        water: 0,
        currentStats: {
            luck: 10,
            strength: 10,
            dexterity: 10,
            wisdom: 10,
            vitality: 10,
            antiMagic: 10,
            antiFire: 10,
        },
        wounds: {
            head: false,
            torso: false,
            leftHand: false,
            rightHand: false,
            legs: false,
            feet: false,
        },
        poisonEntries: [],
        ...overrides,
    };
}

function createRuntime() {
    return createStorePartyRuntime<Record<string, unknown>>({
        sleepSurvivalIntervalTicks: 5,
        awakeSurvivalIntervalTicks: 10,
        originalTimerTickSeconds: 1,
        poisonTickIntervalSec: 5,
        foodDrainScale: 1,
        waterDrainScale: 1,
        maxFood: 2000,
        maxWater: 2000,
        sleepStatRelaxIntervalMask: 3,
        awakeStatRelaxIntervalMask: 7,
        normalizeChampionVitalsForChampion: (_champion, vitals) => vitals,
        getChampionRuntimeBonuses: () => ({}),
        getEffectiveChampionStatsWithBonuses: () => ({
            health: 50,
            stamina: 30,
            mana: 20,
            wisdom: 14,
            vitality: 15,
            luck: 10,
            strength: 10,
            dexterity: 10,
            antiMagic: 0,
            antiFire: 0,
        }),
        getChampionSkillLevelFromXP: () => 0,
        getEquipmentSkillLevelModifier: () => 0,
        normalizeChampionTemporaryXP: createEmptyChampionTemporaryXP,
        computeOriginalTimeCriteria: () => 255,
        applyChampionStaminaDeltaOriginal: (vitals, _maxStamina, delta) => ({
            ...vitals,
            stamina: vitals.stamina + delta,
        }),
        applyLimits: (_min, value, max) => Math.min(value, max),
        clampFoodWater: (value) => value,
        getChampionStatRelaxTargets: () => createVitals().currentStats,
        relaxChampionCurrentStatsTowardMaximum: (currentStats) => currentStats,
        buildCombatTickPatch: (_state, delta, now, damageEventLifetimeMs) => ({
            delta,
            now,
            damageEventLifetimeMs,
        }),
        damageEventLifetimeMs: 500,
        getTotalWeight: () => 10,
        getChampionMaxLoad: () => 20,
        buildChampionDamageEvent: (level, championId, amount) => ({
            id: `${level}-${championId}-${amount}`,
            level,
            target: 'champion',
            championId,
            amount,
            ts: 0,
        }),
        buildDeathDrop: (state) => ({
            party: state.party,
            floorItems: state.floorItems,
            championInventories: state.championInventories,
            championEquipment: state.championEquipment,
            deadChampions: state.deadChampions,
        }),
        randomInt: () => 0,
        rollOriginalPartyWideAttack: (rawAttack) => rawAttack,
        resolveChampionIncomingAttack: (_state, _champion, currentVitals) => ({
            damage: 0,
            nextVitals: currentVitals,
        }),
        getProjectileDamageClass: () => 'magic',
        getChampionAdjustedAttackFromResistance: (_champion, _equip, adjustedAttack) => adjustedAttack,
        getActiveShieldDefense: () => 0,
    });
}

test('store party runtime forwards combat tick lifetime into the delegated builder', () => {
    const runtime = createRuntime();

    assert.deepEqual(runtime.buildCombatTickPatch({}, 0.25, 1234), {
        delta: 0.25,
        now: 1234,
        damageEventLifetimeMs: 500,
    });
});

test('store party runtime reuses survival and rested helpers through the extracted facade', () => {
    const runtime = createRuntime();
    const champion = createChampion(1);

    const result = runtime.advanceSurvivalTime(
        {
            party: [champion],
            championVitals: { 1: createVitals() },
            championEquipment: {},
            championXP: {},
            championTemporaryXP: { 1: createEmptyChampionTemporaryXP() },
            elapsedGameTimeTicks: 10,
            lastSurvivalEffectGameTick: 0,
            freezeLifeRemainingTicks: 3,
            lastPartyMoveGameTick: 0,
            activePotionBoosts: [],
        },
        2,
    );

    assert.equal(result.elapsedGameTimeTicks, 12);
    assert.equal(result.freezeLifeRemainingTicks, 1);
    assert.equal(
        runtime.isPartyRested({
            party: [champion],
            championVitals: { 1: createVitals({ hp: 50, stamina: 30, mana: 20 }) },
            championEquipment: {},
            activePotionBoosts: [],
        }),
        true,
    );
});

test('store party runtime applies the original move-fatigue load factor', () => {
    const runtime = createRuntime();
    const champion = createChampion(1);

    const nextVitals = runtime.applyPartyMoveFatigue({
        party: [champion],
        championVitals: { 1: createVitals({ stamina: 20 }) },
        championEquipment: { 1: {} },
        championInventories: { 1: [] },
        activePotionBoosts: [],
    });

    assert.equal(nextVitals?.[1]?.stamina, 18);
});

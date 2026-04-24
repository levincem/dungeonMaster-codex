import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import { createEmptyChampionTemporaryXP } from '../src/data/skillProgression.js';
import { advanceSurvivalTimeState, isPartyRestedState } from '../src/engine/systems/survivalState.js';

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

const baseDeps = {
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
    normalizeChampionVitalsForChampion: (_champion: Champion, vitals: ChampionVitals) => vitals,
    getEffectiveChampionStatsRuntime: () => ({
        health: 50,
        stamina: 30,
        mana: 20,
        wisdom: 14,
        vitality: 15,
    }),
    getChampionSkillLevelFromXP: () => 0,
    getEquipmentSkillLevelModifier: () => 0,
    normalizeChampionTemporaryXP: createEmptyChampionTemporaryXP,
    computeOriginalTimeCriteria: () => 255,
    applyChampionStaminaDeltaOriginal: (vitals: ChampionVitals, _maxStamina: number, delta: number) => ({
        ...vitals,
        stamina: vitals.stamina + delta,
    }),
    applyLimits: (_min: number, value: number, max: number) => Math.min(value, max),
    clampFoodWater: (value: number) => value,
    getChampionStatRelaxTargets: () => createVitals().currentStats,
    relaxChampionCurrentStatsTowardMaximum: (currentStats: ChampionVitals['currentStats']) => currentStats,
};

test('advanceSurvivalTimeState decrements freeze life and advances elapsed time', () => {
    const champion = createChampion(1);
    const result = advanceSurvivalTimeState(
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
        baseDeps,
    );

    assert.equal(result.elapsedGameTimeTicks, 12);
    assert.equal(result.freezeLifeRemainingTicks, 1);
    assert.equal(result.advancedMs, 2000);
});

test('advanceSurvivalTimeState applies poison pulses and refreshes poison timers', () => {
    const champion = createChampion(1);
    const result = advanceSurvivalTimeState(
        {
            level: 3,
            party: [champion],
            championVitals: {
                1: createVitals({
                    hp: 20,
                    poisonEntries: [{ remaining: 128, nextTickIn: 1 }],
                }),
            },
            championEquipment: {},
            championXP: {},
            championTemporaryXP: { 1: createEmptyChampionTemporaryXP() },
            elapsedGameTimeTicks: 0,
            lastSurvivalEffectGameTick: 0,
            freezeLifeRemainingTicks: 0,
            lastPartyMoveGameTick: 0,
            activePotionBoosts: [],
        },
        1,
        baseDeps,
    );

    assert.equal(result.championVitals[1]?.hp, 18);
    assert.deepEqual(result.championVitals[1]?.poisonEntries, [{ remaining: 127, nextTickIn: 5 }]);
    assert.equal(result.damageEvents?.length, 1);
    assert.equal(result.damageEvents?.[0]?.championId, 1);
    assert.equal(result.damageEvents?.[0]?.amount, 2);
    assert.equal(result.damageEvents?.[0]?.kind, 'poison');
});

test('isPartyRestedState reports false until all living champions are topped up', () => {
    const champion = createChampion(1);
    assert.equal(isPartyRestedState(
        {
            party: [champion],
            championVitals: { 1: createVitals({ hp: 40, stamina: 20, mana: 10 }) },
            championEquipment: {},
            activePotionBoosts: [],
        },
        { getEffectiveChampionStatsRuntime: baseDeps.getEffectiveChampionStatsRuntime },
    ), false);

    assert.equal(isPartyRestedState(
        {
            party: [champion],
            championVitals: { 1: createVitals({ hp: 50, stamina: 30, mana: 20 }) },
            championEquipment: {},
            activePotionBoosts: [],
        },
        { getEffectiveChampionStatsRuntime: baseDeps.getEffectiveChampionStatsRuntime },
    ), true);
});

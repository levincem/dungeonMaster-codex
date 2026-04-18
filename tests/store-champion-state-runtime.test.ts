import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    applyChampionStaminaDeltaOriginal,
    chooseChampionWoundSlotsFromZones,
    computeOriginalTimeCriteria,
    createStoreChampionStateRuntime,
} from '../src/engine/systems/storeChampionStateRuntime.js';
import type { Champion } from '../src/types/champion.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import {
    createEmptyChampionTemporaryXP,
    createEmptyChampionXP,
} from '../src/data/skillProgression.js';

function createChampion(id = 1): Champion {
    return {
        id,
        name: `Champion ${id}`,
        title: 'The Tested',
        gender: 'M',
        class: 'Fighter',
        health: 100,
        stamina: 80,
        mana: 20,
        luck: 10,
        strength: 20,
        dexterity: 16,
        wisdom: 8,
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
        stamina: 30,
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
    return createStoreChampionStateRuntime<any, any>({
        poisonTickIntervalSec: 0.6,
        randomInt: () => 0,
        getMapDifficulty: () => 2,
        getEffectiveChampionStatsWithBonuses: () => ({ vitality: 0, wisdom: 0 }),
        computeChampionWoundDefense: () => 0,
        getChampionAdjustedAttackFromResistance: (_champion, _equip, attack) => attack,
        getActiveShieldDefense: () => 0,
        getChampionRuntimeBonuses: () => ({}),
    });
}

test('store champion state runtime maps coverage zones to wound slots and computes source-backed time criteria', () => {
    assert.deepEqual(chooseChampionWoundSlotsFromZones(undefined), ['torso']);
    assert.deepEqual(
        chooseChampionWoundSlotsFromZones(['hands', 'head', 'hands']),
        ['rightHand', 'leftHand', 'head'],
    );
    assert.equal(computeOriginalTimeCriteria(0x01c0), 112);
});

test('store champion state runtime applies stamina overflow to health and heals or poisons through extracted wrappers', () => {
    const runtime = createRuntime();
    const vitals = createVitals({
        hp: 10,
        stamina: 2,
        wounds: {
            head: true,
            torso: false,
            leftHand: false,
            rightHand: false,
            legs: false,
            feet: false,
        },
    });

    const exhausted = applyChampionStaminaDeltaOriginal(vitals, 30, -6);
    const healed = runtime.healChampionWoundsOriginal(vitals, 1);
    const poisoned = runtime.applyPoisonCharacterOriginal(createVitals({ hp: 20 }), 128);

    assert.equal(exhausted.stamina, 0);
    assert.equal(exhausted.hp, 8);
    assert.equal(healed.wounds.head, false);
    assert.equal(poisoned.hp, 18);
    assert.deepEqual(poisoned.poisonEntries, [{ remaining: 127, nextTickIn: 0.6 }]);
});

test('store champion state runtime delegates champion XP growth and level-up patch building', () => {
    const runtime = createRuntime();
    const champion = createChampion(7);
    const currentXP = createEmptyChampionXP();
    currentXP.swing = 490;
    currentXP.fighter = 490;

    const patch = runtime.buildChampionSkillExperiencePatchOriginal(
        {
            level: 3,
            party: [champion],
            championXP: { 7: currentXP },
            championTemporaryXP: { 7: createEmptyChampionTemporaryXP() },
            elapsedGameTimeTicks: 10,
            lastCreatureAttackGameTick: 10,
        },
        7,
        'swing',
        10,
    );

    assert.ok(patch);
    assert.equal(patch?.championXP[7]?.swing, 530);
    assert.equal(patch?.championXP[7]?.fighter, 530);
    assert.equal(patch?.party?.[0]?.strength, 21);
});

test('store champion state runtime resolves incoming attacks through the extracted wrapper', () => {
    const runtime = createRuntime();
    const champion = {
        ...createChampion(3),
        vitality: 0,
        wisdom: 0,
    };
    const currentVitals = createVitals({ hp: 5000 });

    const result = runtime.resolveChampionIncomingAttackRuntime(
        {
            championEquipment: { 3: {} },
            activePotionBoosts: [],
            activeShields: [],
        },
        champion,
        currentVitals,
        1200,
        'Blunt',
        ['head'],
        1000,
    );

    assert.ok(result.damage > 0);
    assert.equal(result.nextVitals.wounds.head, true);
    assert.equal(result.nextVitals.hp, currentVitals.hp - result.damage);
});

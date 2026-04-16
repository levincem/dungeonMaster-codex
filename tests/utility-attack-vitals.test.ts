import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import { applySpellHeal, applyUtilityHeal } from '../src/engine/systems/utilityAttackVitals.js';

function createVitals(hp: number): ChampionVitals {
    return {
        hp,
        stamina: 40,
        mana: 20,
        food: 500,
        water: 500,
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
    };
}

test('applyUtilityHeal restores hit points without exceeding the champion maximum', () => {
    const healed = applyUtilityHeal(createVitals(30), 50);
    const capped = applyUtilityHeal(createVitals(45), 50);

    assert.equal(healed?.hp, 50);
    assert.equal(capped?.hp, 50);
});

test('applyUtilityHeal returns null when there is no current vitals state', () => {
    assert.equal(applyUtilityHeal(undefined, 100), null);
});

test('applySpellHeal restores health using spell mana cost without exceeding the maximum', () => {
    const healed = applySpellHeal(createVitals(12), 60, 3);
    const capped = applySpellHeal(createVitals(58), 60, 2);

    assert.equal(healed?.hp, 42);
    assert.equal(capped?.hp, 60);
});

test('applySpellHeal returns null when there is no current vitals state', () => {
    assert.equal(applySpellHeal(undefined, 100, 4), null);
});

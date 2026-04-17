import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import {
    applyOriginalPoisonCharacter,
    healOriginalChampionWounds,
} from '../src/engine/systems/originalChampionConditionEffects.js';

function createVitals(): ChampionVitals {
    return {
        hp: 30,
        stamina: 20,
        mana: 10,
        food: 900,
        water: 900,
        currentStats: {
            luck: 10,
            strength: 12,
            dexterity: 14,
            wisdom: 8,
            vitality: 10,
            antiMagic: 4,
            antiFire: 2,
        },
        wounds: {
            rightHand: true,
            leftHand: false,
            head: false,
            torso: true,
            legs: false,
            feet: false,
        },
        poisonEntries: [],
    };
}

test('healOriginalChampionWounds clears randomly selected wounded slots', () => {
    const rolls = [1, 0];
    const healed = healOriginalChampionWounds(createVitals(), 2, () => rolls.shift() ?? 0);

    assert.equal(healed.wounds.torso, false);
    assert.equal(healed.wounds.rightHand, false);
});

test('applyOriginalPoisonCharacter applies immediate damage and queues the remaining poison', () => {
    const poisoned = applyOriginalPoisonCharacter(createVitals(), 130, 4);

    assert.equal(poisoned.hp, 28);
    assert.deepEqual(poisoned.poisonEntries, [{ remaining: 129, nextTickIn: 4 }]);
});

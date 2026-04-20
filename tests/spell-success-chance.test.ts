import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSpell } from '../src/data/runes.js';
import { getOriginalSpellSuccessChance, rollOriginalSpellCastSuccess } from '../src/engine/systems/storeCombatRuntime.js';
import type { Champion } from '../src/types/champion.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';

function createChampion(wisdom: number): Champion {
    return {
        id: 1,
        name: 'Syra',
        title: 'Child Of Nature',
        gender: 'F',
        class: 'Wizard',
        health: 53,
        stamina: 72,
        mana: 15,
        luck: 55,
        strength: 38,
        dexterity: 35,
        wisdom,
        vitality: 45,
        antiMagic: 42,
        antiFire: 40,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: 'syra.png',
    };
}

function createVitals(wisdom: number): ChampionVitals {
    return {
        hp: 30,
        stamina: 40,
        mana: 20,
        food: 1000,
        water: 1000,
        currentStats: {
            luck: 55,
            strength: 38,
            dexterity: 35,
            wisdom,
            vitality: 45,
            antiMagic: 42,
            antiFire: 40,
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

const torch = findSpell(['lo', 'ful']);

test('torch success chance matches the exact random roll space for a novice hidden fire skill', () => {
    assert.ok(torch, 'torch spell should exist');
    const wisdom = 42;
    const champion = createChampion(wisdom);
    const vitals = createVitals(wisdom);
    const threshold = Math.min(wisdom + 15, 115);
    const chance = getOriginalSpellSuccessChance(
        champion,
        {},
        [],
        vitals,
        torch,
        1,
        (_champion, _equip, _boosts, currentVitals) => ({ wisdom: currentVitals?.currentStats.wisdom ?? 0 }),
    );

    let successes = 0;
    for (let roll = 0; roll < 128; roll += 1) {
        const result = rollOriginalSpellCastSuccess(
            champion,
            {},
            [],
            vitals,
            torch,
            1,
            {
                randomInt: () => roll,
                getEffectiveChampionStatsRuntime: (_champion, _equip, _boosts, currentVitals) => ({
                    wisdom: currentVitals?.currentStats.wisdom ?? 0,
                }),
            },
        );
        if (result.success) successes += 1;
    }

    assert.equal(successes, threshold + 1);
    assert.equal(chance, (threshold + 1) / 128);
    assert.equal(Math.round(chance * 100), 45);
});

test('multi-level spell failures use the same probability formula as the repeated original rolls', () => {
    assert.ok(torch, 'torch spell should exist');
    const wisdom = 42;
    const champion = createChampion(wisdom);
    const vitals = createVitals(wisdom);
    const threshold = Math.min(wisdom + 15, 115);
    const chance = getOriginalSpellSuccessChance(
        champion,
        {},
        [],
        vitals,
        torch,
        0,
        (_champion, _equip, _boosts, currentVitals) => ({ wisdom: currentVitals?.currentStats.wisdom ?? 0 }),
    );

    let successes = 0;
    for (let first = 0; first < 128; first += 1) {
        for (let second = 0; second < 128; second += 1) {
            const rolls = [first, second];
            let index = 0;
            const result = rollOriginalSpellCastSuccess(
                champion,
                {},
                [],
                vitals,
                torch,
                0,
                {
                    randomInt: () => rolls[index++] ?? 0,
                    getEffectiveChampionStatsRuntime: (_champion, _equip, _boosts, currentVitals) => ({
                        wisdom: currentVitals?.currentStats.wisdom ?? 0,
                    }),
                },
            );
            if (result.success) successes += 1;
        }
    }

    assert.equal(successes, (threshold + 1) * (threshold + 1));
    assert.equal(chance, Math.pow((threshold + 1) / 128, 2));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ActivePotionBoost, ChampionVitals } from '../src/engine/runtimeTypes.js';
import {
    getChampionCurrentStatBonuses,
    getChampionPotionBonuses,
    getChampionRuntimeBonuses,
} from '../src/engine/systems/championRuntimeBonuses.js';

function createChampion(): Champion {
    return {
        id: 1,
        name: 'Tiggy',
        title: 'The Tester',
        gender: 'F',
        class: 'Wizard',
        health: 90,
        stamina: 70,
        mana: 55,
        luck: 10,
        strength: 12,
        dexterity: 13,
        wisdom: 14,
        vitality: 15,
        antiMagic: 5,
        antiFire: 6,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: 'tiggy.png',
    };
}

function createVitals(): ChampionVitals {
    return {
        hp: 70,
        stamina: 40,
        mana: 30,
        food: 100,
        water: 100,
        currentStats: {
            luck: 12,
            strength: 18,
            dexterity: 11,
            wisdom: 16,
            vitality: 15,
            antiMagic: 8,
            antiFire: 7,
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
    };
}

test('getChampionPotionBonuses ignores expired boosts', () => {
    const boosts: ActivePotionBoost[] = [
        { id: 'a', championId: 1, stat: 'strength', amount: 4, expiresAt: 200 },
        { id: 'b', championId: 1, stat: 'wisdom', amount: 2, expiresAt: 50 },
        { id: 'c', championId: 2, stat: 'vitality', amount: 9, expiresAt: 200 },
    ];

    const bonuses = getChampionPotionBonuses(boosts, 1, 100);

    assert.equal(bonuses.strength, 4);
    assert.equal(bonuses.wisdom, 0);
    assert.equal(bonuses.vitality, 0);
});

test('getChampionCurrentStatBonuses returns deltas from champion base stats', () => {
    const bonuses = getChampionCurrentStatBonuses(createChampion(), createVitals());

    assert.equal(bonuses.strength, 6);
    assert.equal(bonuses.dexterity, -2);
    assert.equal(bonuses.wisdom, 2);
    assert.equal(bonuses.antiMagic, 3);
});

test('getChampionRuntimeBonuses merges current stat and potion bonuses', () => {
    const bonuses = getChampionRuntimeBonuses(
        createChampion(),
        createVitals(),
        [{ id: 'boost', championId: 1, stat: 'strength', amount: 3, expiresAt: 200 }],
        100,
    );

    assert.equal(bonuses.strength, 9);
    assert.equal(bonuses.wisdom, 2);
});

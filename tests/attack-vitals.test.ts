import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment } from '../src/types/game.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import type { WeaponAttackOption } from '../src/data/weaponAttacks.js';
import { applyChampionAttackVitals } from '../src/engine/systems/attackVitals.js';

function createChampion(): Champion {
    return {
        id: 1,
        name: 'Tiggy',
        title: 'The Tester',
        gender: 'F',
        class: 'Wizard',
        health: 90,
        stamina: 60,
        mana: 120,
        luck: 30,
        strength: 25,
        dexterity: 35,
        wisdom: 55,
        vitality: 28,
        antiMagic: 12,
        antiFire: 8,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [1, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: 'portrait.png',
    };
}

function createVitals(stamina = 40): ChampionVitals {
    return {
        hp: 60,
        stamina,
        mana: 50,
        food: 800,
        water: 700,
        currentStats: {
            luck: 30,
            strength: 25,
            dexterity: 35,
            wisdom: 55,
            vitality: 28,
            antiMagic: 12,
            antiFire: 8,
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

function createAttackOption(staminaCost: number): WeaponAttackOption {
    return {
        attackType: 0,
        displayName: 'Hack',
        enumName: 'Hack',
        requiresCharges: false,
        masteryThreshold: 0,
        source: 'primary',
        attack: {
            index: 0,
            enumName: 'Hack',
            displayName: 'Hack',
            experienceForAttacking: 5,
            skillNumber: 0,
            defenseModifier: 0,
            staminaCost,
            strengthRequired: 10,
            baseDamage: 20,
            disableTime: 10,
        },
    };
}

test('applyChampionAttackVitals reduces stamina using the attack cost and random spread', () => {
    const result = applyChampionAttackVitals(
        createChampion(),
        {} as ChampionEquipment,
        [],
        createVitals(40),
        createAttackOption(6),
        {
            getEffectiveChampionStatsRuntime: () => ({ stamina: 60 }),
            randomInt: () => 1,
            clampVital: (value, maxValue) => Math.max(0, Math.min(maxValue, value)),
        },
    );

    assert.equal(result?.nextVitals.stamina, 33);
    assert.equal(result?.effective.stamina, 60);
});

test('applyChampionAttackVitals returns unchanged stamina when there is no attack option', () => {
    const result = applyChampionAttackVitals(
        createChampion(),
        {} as ChampionEquipment,
        [],
        createVitals(40),
        null,
        {
            getEffectiveChampionStatsRuntime: () => ({ stamina: 60 }),
            randomInt: () => 1,
            clampVital: (value, maxValue) => Math.max(0, Math.min(maxValue, value)),
        },
    );

    assert.equal(result?.nextVitals.stamina, 40);
});

test('applyChampionAttackVitals returns null when the champion vitals are missing', () => {
    const result = applyChampionAttackVitals(
        createChampion(),
        {} as ChampionEquipment,
        [],
        undefined,
        createAttackOption(6),
        {
            getEffectiveChampionStatsRuntime: () => ({ stamina: 60 }),
            randomInt: () => 1,
            clampVital: (value, maxValue) => Math.max(0, Math.min(maxValue, value)),
        },
    );

    assert.equal(result, null);
});

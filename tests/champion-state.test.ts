import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import {
    buildInitialChampionXP,
    isLegacyChampionXPForChampion,
    normalizeChampionVitalsForChampion,
} from '../src/engine/systems/championState.js';

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champion ${id}`,
        title: 'The Tester',
        gender: 'M',
        class: 'Fighter',
        health: 120,
        stamina: 90,
        mana: 30,
        luck: 40,
        strength: 45,
        dexterity: 35,
        wisdom: 25,
        vitality: 50,
        antiMagic: 10,
        antiFire: 11,
        skills: {
            fighter: [1, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#ffffff',
        equipment: [],
        portrait: 'portrait.png',
    };
}

function createVitals(): ChampionVitals {
    return {
        hp: 80,
        stamina: 60,
        mana: 20,
        food: 1500,
        water: 1400,
        currentStats: {} as ChampionVitals['currentStats'],
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

test('normalizeChampionVitalsForChampion restores missing current stats from champion defaults', () => {
    const champion = createChampion(1);
    const vitals = createVitals();

    assert.deepEqual(normalizeChampionVitalsForChampion(champion, vitals).currentStats, {
        luck: champion.luck,
        strength: champion.strength,
        dexterity: champion.dexterity,
        wisdom: champion.wisdom,
        vitality: champion.vitality,
        antiMagic: champion.antiMagic,
        antiFire: champion.antiFire,
    });
});

test('isLegacyChampionXPForChampion detects old basic-only initial XP and rejects hidden XP progress', () => {
    const champion = createChampion(2);
    const legacyXP = {
        fighter: 500,
        ninja: 0,
        priest: 0,
        wizard: 0,
        swing: 0,
        thrust: 0,
        club: 0,
        parry: 0,
        steal: 0,
        fight: 0,
        throw: 0,
        shoot: 0,
        identify: 0,
        heal: 0,
        influence: 0,
        defend: 0,
        fire: 0,
        air: 0,
        earth: 0,
        water: 0,
    };

    assert.equal(isLegacyChampionXPForChampion(champion, legacyXP), true);
    assert.equal(
        isLegacyChampionXPForChampion(champion, {
            ...buildInitialChampionXP(champion),
            swing: 25,
        }),
        false,
    );
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import {
    createEmptyChampionTemporaryXP,
    createEmptyChampionXP,
} from '../src/data/skillProgression.js';
import {
    applyOriginalChampionSkillExperience,
    buildOriginalLevelUpChampionUpdate,
} from '../src/engine/systems/originalChampionLeveling.js';

function createChampion(): Champion {
    return {
        id: 1,
        name: 'Halk',
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

test('applyOriginalChampionSkillExperience halves stale hidden combat XP, applies difficulty, then doubles recent hidden XP', () => {
    const result = applyOriginalChampionSkillExperience(
        createChampion(),
        createEmptyChampionXP(),
        createEmptyChampionTemporaryXP(),
        'throw',
        10,
        {
            mapDifficulty: 2,
            elapsedGameTimeTicks: 200,
            lastCreatureAttackGameTick: 190,
        },
        () => 0,
    );

    assert.ok(result);
    assert.equal(result?.adjustedExperience, 40);
    assert.equal(result?.championXP.throw, 40);
    assert.equal(result?.championXP.ninja, 40);
    assert.equal(result?.championTemporaryXP.throw, 5);
});

test('applyOriginalChampionSkillExperience levels up the parent basic skill and returns the upgraded champion', () => {
    const currentXP = createEmptyChampionXP();
    currentXP.swing = 490;
    currentXP.fighter = 490;

    const rolls = [1, 1, 1, 0, 1, 2];
    const result = applyOriginalChampionSkillExperience(
        createChampion(),
        currentXP,
        createEmptyChampionTemporaryXP(),
        'swing',
        10,
        {
            mapDifficulty: 1,
            elapsedGameTimeTicks: 10,
            lastCreatureAttackGameTick: 10,
        },
        () => rolls.shift() ?? 0,
    );

    assert.ok(result?.leveledChampion);
    assert.equal(result?.championXP.swing, 510);
    assert.equal(result?.championXP.fighter, 510);
    assert.equal(result?.leveledChampion?.strength, 22);
});

test('buildOriginalLevelUpChampionUpdate follows deterministic fighter growth rolls', () => {
    const champion = createChampion();
    const rolls = [1, 1, 1, 0, 1, 2];
    const leveled = buildOriginalLevelUpChampionUpdate(champion, 'fighter', 2, () => rolls.shift() ?? 0);

    assert.equal(leveled.strength, 22);
    assert.equal(leveled.dexterity, 17);
    assert.equal(leveled.vitality, 15);
    assert.equal(leveled.health, 107);
    assert.equal(leveled.stamina, 87);
    assert.equal(leveled.antiFire, 4);
}
);

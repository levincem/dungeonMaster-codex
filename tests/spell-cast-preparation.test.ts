import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SpellDef } from '../src/data/runes.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import { prepareSpellCast } from '../src/engine/systems/spellCastPreparation.js';

function createVitals(overrides: Partial<ChampionVitals> = {}): ChampionVitals {
    return {
        hp: 30,
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
        ...overrides,
    };
}

test('prepareSpellCast blocks on cooldown and mana before effect handling', () => {
    const spell = {
        runes: ['lo', 'ful'],
        name: 'Torch',
        effect: 'light',
        manaCost: 5,
        manaBase: 1,
        castSkill: 'wizard',
        description: 'Torch',
    } as SpellDef;

    const cooldownBlocked = prepareSpellCast(
        {
            championId: 1,
            spell,
            vitals: createVitals(),
            currentChampionCombat: { 1: { cooldown: 1, cooldownMax: 1, defenseModifier: 0 } },
            now: 1000,
        },
        {
            getSkillLevel: () => 4,
            rollCastCheck: () => ({ success: true, requiredSkillLevel: 2, missingSkillLevels: 0, successChance: 1 }),
            applySkillXp: () => null,
            originalTimerTicksToSeconds: (ticks) => ticks,
            createChampionCombatState: (cooldown, defenseModifier = 0) => ({ cooldown, cooldownMax: cooldown || 1, defenseModifier }),
            randomInt: () => 0,
        },
    );
    const manaBlocked = prepareSpellCast(
        {
            championId: 1,
            spell: { ...spell, manaCost: 50 },
            vitals: createVitals(),
            currentChampionCombat: {},
            now: 2000,
        },
        {
            getSkillLevel: () => 4,
            rollCastCheck: () => ({ success: true, requiredSkillLevel: 2, missingSkillLevels: 0, successChance: 1 }),
            applySkillXp: () => null,
            originalTimerTicksToSeconds: (ticks) => ticks,
            createChampionCombatState: (cooldown, defenseModifier = 0) => ({ cooldown, cooldownMax: cooldown || 1, defenseModifier }),
            randomInt: () => 0,
        },
    );

    assert.equal(cooldownBlocked.kind, 'blocked');
    assert.equal(manaBlocked.kind, 'blocked');
});

test('prepareSpellCast builds the ready cast payload with mana, cooldown and cast result', () => {
    type SpellXpPatch = {
        championXP: Record<number, { wizard?: number }>;
    };

    const spell = {
        runes: ['lo', 'ful'],
        name: 'Torch',
        effect: 'light',
        manaCost: 5,
        manaBase: 1,
        castSkill: 'wizard',
        description: 'Torch',
        sourceDisableTimeTicks: 4,
    } as SpellDef;

    const result = prepareSpellCast<SpellXpPatch>(
        {
            championId: 1,
            spell,
            vitals: createVitals(),
            currentChampionCombat: {},
            now: 3000,
        },
        {
            getSkillLevel: () => 3,
            rollCastCheck: () => ({ success: true, requiredSkillLevel: 2, missingSkillLevels: 0, successChance: 0.75 }),
            applySkillXp: () => ({ championXP: { 1: { wizard: 99 } } }),
            originalTimerTicksToSeconds: (ticks) => ticks / 2,
            createChampionCombatState: (cooldown, defenseModifier = 0) => ({ cooldown, cooldownMax: cooldown || 1, defenseModifier }),
            randomInt: () => 0,
        },
    );

    if (result.kind !== 'ready') {
        assert.fail('expected successful spell preparation');
    }
    assert.equal(result.nextVitals.mana, 15);
    assert.equal(result.basePatch.championCombat[1]?.cooldown, 2);
    assert.equal(result.basePatch.lastCastResult.success, true);
    assert.equal(result.basePatch.championXP[1]?.wizard, 99);
});

test('prepareSpellCast shifts original spell XP down on low-skill failure', () => {
    let awardedXp = -1;
    const spell = {
        runes: ['lo', 'ful'],
        name: 'Torch',
        effect: 'light',
        manaCost: 5,
        manaBase: 1,
        castSkill: 'wizard',
        description: 'Torch',
    } as SpellDef;

    const result = prepareSpellCast(
        {
            championId: 1,
            spell,
            vitals: createVitals(),
            currentChampionCombat: {},
            now: 4000,
        },
        {
            getSkillLevel: () => 1,
            rollCastCheck: () => ({ success: false, requiredSkillLevel: 3, missingSkillLevels: 2, successChance: 0.25 }),
            applySkillXp: (_skill, amount) => {
                awardedXp = amount;
                return null;
            },
            originalTimerTicksToSeconds: (ticks) => ticks,
            createChampionCombatState: (cooldown, defenseModifier = 0) => ({ cooldown, cooldownMax: cooldown || 1, defenseModifier }),
            randomInt: () => 0,
        },
    );

    assert.equal(result.kind, 'ready');
    assert.equal(awardedXp, 9);
});

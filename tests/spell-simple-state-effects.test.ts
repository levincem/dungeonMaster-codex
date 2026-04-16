import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import {
    buildSimpleStatusSpellPatch,
    buildSimpleTimedSpellPatch,
} from '../src/engine/systems/spellSimpleStateEffects.js';

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

function createSpell(effect: string, runes: string[], overrides: Record<string, unknown> = {}) {
    return {
        runes,
        name: 'Spell',
        effect,
        manaCost: 5,
        manaBase: 5,
        castSkill: 'priest',
        description: 'desc',
        ...overrides,
    } as never;
}

test('buildSimpleTimedSpellPatch wires shield-style buffs through the shared builders', () => {
    const patch = buildSimpleTimedSpellPatch({
        action: 'shield',
        championId: 1,
        now: 1000,
        spell: createSpell('shield', ['lo', 'ya', 'ir']),
        nextVitals: createVitals({ mana: 15 }),
        currentChampionVitals: { 1: createVitals() },
        currentSpellLights: [],
        currentActiveShields: [],
    });

    assert.equal(patch.championVitals[1]?.mana, 15);
    assert.equal(patch.activeShields?.length, 1);
});

test('buildSimpleStatusSpellPatch wires reveal hidden with its fallback timer key', () => {
    const patch = buildSimpleStatusSpellPatch({
        action: 'reveal_hidden',
        championId: 2,
        now: 2000,
        spell: createSpell('reveal_hidden', ['oh', 'ra']),
        nextVitals: createVitals({ mana: 14 }),
        currentChampionVitals: { 2: createVitals() },
        currentUntil: 1500,
        currentUntilKey: 'magicVisionUntil',
        quantizeDurationMs: (durationMs) => durationMs,
    });

    assert.equal(patch.championVitals[2]?.mana, 14);
    assert.equal(patch.magicVisionUntil, 2000 + (5 * 12_000));
});

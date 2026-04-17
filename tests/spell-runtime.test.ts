import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    getOriginalSpellProjectileLaunchProfile,
    rollOriginalSpellProjectileImpact,
} from '../src/data/spellRuntime.js';

function createSpell(effect: 'fireball' | 'poison_bolt' | 'open', runes: string[], manaCost = 8) {
    return {
        runes,
        name: effect,
        effect,
        manaCost,
        manaBase: manaCost,
        castSkill: 'wizard' as const,
        description: effect,
    };
}

test('getOriginalSpellProjectileLaunchProfile uses the original power rune and launch formula', () => {
    const profile = getOriginalSpellProjectileLaunchProfile(
        createSpell('fireball', ['pal', 'ful', 'ir'], 10),
        4,
        37,
    );

    assert.deepEqual(profile, {
        initialRange: 84,
        stepDecay: 6,
    });
});

test('rollOriginalSpellProjectileImpact keeps poison bolt source-backed semantics', () => {
    const impact = rollOriginalSpellProjectileImpact(
        createSpell('poison_bolt', ['um', 'des', 'ven'], 9),
        23,
        17,
        () => 0,
    );

    assert.deepEqual(impact, {
        damage: 1,
        poisonStrength: 23,
    });
});

test('rollOriginalSpellProjectileImpact returns deterministic fireball damage with deterministic rolls', () => {
    const impact = rollOriginalSpellProjectileImpact(
        createSpell('fireball', ['lo', 'ful', 'ir'], 8),
        32,
        64,
        () => 0,
    );

    assert.deepEqual(impact, {
        damage: 1,
        poisonStrength: 0,
    });
});

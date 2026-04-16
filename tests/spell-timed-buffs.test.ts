import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildSpellTimedBuffPatch,
    resolveSpellTimedBuff,
} from '../src/engine/systems/spellTimedBuffs.js';

function createSpell(
    effect: 'light' | 'darkness' | 'shield' | 'fire_shield',
    runes: string[],
) {
    return {
        runes,
        name: effect,
        effect,
        manaCost: 8,
        manaBase: 8,
        castSkill: 'priest' as const,
        description: effect,
    };
}

test('resolveSpellTimedBuff builds a light entry for positive and negative light spells', () => {
    const light = resolveSpellTimedBuff(
        'light',
        100,
        { buildIdSuffix: () => 'light' },
        createSpell('light', ['lo', 'oh', 'ir', 'ra']),
    );
    const darkness = resolveSpellTimedBuff(
        'darkness',
        100,
        { buildIdSuffix: () => 'dark' },
        createSpell('darkness', ['lo', 'des', 'ir', 'sar']),
    );

    assert.deepEqual(light, {
        spellLight: {
            id: 'light_100_light',
            lightContrib: 0.25,
            expiresAt: 2400100,
        },
    });
    assert.deepEqual(darkness, {
        spellLight: {
            id: 'darkness_100_dark',
            lightContrib: -2 / 12,
            expiresAt: 23620,
        },
    });
});

test('resolveSpellTimedBuff returns null when a light spell has no duration', () => {
    const light = resolveSpellTimedBuff(
        'light',
        100,
        { buildIdSuffix: () => 'noop' },
        createSpell('light', ['lo']),
    );

    assert.equal(light, null);
});

test('resolveSpellTimedBuff builds physical and fire shields from shield profiles', () => {
    const shield = resolveSpellTimedBuff(
        'shield',
        200,
        { buildIdSuffix: () => 'physical' },
        createSpell('shield', ['lo', 'ya', 'ir']),
    );
    const fireShield = resolveSpellTimedBuff(
        'fire_shield',
        200,
        { buildIdSuffix: () => 'fire' },
        createSpell('fire_shield', ['lo', 'ful', 'bro', 'neta']),
    );

    assert.deepEqual(shield, {
        shield: {
            id: 'shield_200_physical',
            expiresAt: 15560,
            defense: 8,
            kind: 'physical',
        },
    });
    assert.deepEqual(fireShield, {
        shield: {
            id: 'shield_200_fire',
            expiresAt: 39560,
            defense: 5,
            kind: 'fire',
        },
    });
});

test('resolveSpellTimedBuff returns null when a shield spell has no profile', () => {
    const shield = resolveSpellTimedBuff(
        'shield',
        100,
        { buildIdSuffix: () => 'noop' },
        createSpell('shield', ['lo']),
    );

    assert.equal(shield, null);
});

test('buildSpellTimedBuffPatch appends light entries and always updates vitals', () => {
    const patch = buildSpellTimedBuffPatch({
        championId: 2,
        nextVitals: { hp: 18 } as never,
        currentChampionVitals: { 2: { hp: 24 } } as never,
        currentSpellLights: [{ id: 'existing' }] as never,
        currentActiveShields: [],
        buff: { spellLight: { id: 'new-light' } } as never,
    });

    assert.deepEqual(patch, {
        championVitals: { 2: { hp: 18 } },
        spellLights: [{ id: 'existing' }, { id: 'new-light' }],
    });
});

test('buildSpellTimedBuffPatch appends shield entries and falls back to vitals only', () => {
    const shieldPatch = buildSpellTimedBuffPatch({
        championId: 2,
        nextVitals: { hp: 19 } as never,
        currentChampionVitals: { 2: { hp: 24 } } as never,
        currentSpellLights: [],
        currentActiveShields: [{ id: 'old-shield' }] as never,
        buff: { shield: { id: 'new-shield' } } as never,
    });
    const vitalsOnlyPatch = buildSpellTimedBuffPatch({
        championId: 2,
        nextVitals: { hp: 17 } as never,
        currentChampionVitals: { 2: { hp: 24 } } as never,
        currentSpellLights: [],
        currentActiveShields: [],
        buff: null,
    });

    assert.deepEqual(shieldPatch, {
        championVitals: { 2: { hp: 19 } },
        activeShields: [{ id: 'old-shield' }, { id: 'new-shield' }],
    });
    assert.deepEqual(vitalsOnlyPatch, {
        championVitals: { 2: { hp: 17 } },
    });
});

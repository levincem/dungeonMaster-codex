import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveUtilityBuffAction } from '../src/engine/systems/utilityAttackBuffs.js';

test('resolveUtilityBuffAction builds light and shield buffs with original-style durations', () => {
    const light = resolveUtilityBuffAction(
        'Light',
        100,
        0,
        0,
        {
            quantizeDurationMs: (durationMs) => durationMs + 5,
            buildIdSuffix: () => 'seed',
        },
    );
    const shield = resolveUtilityBuffAction(
        'Spellshield',
        100,
        0,
        0,
        {
            quantizeDurationMs: (durationMs) => durationMs + 5,
            buildIdSuffix: () => 'seed',
        },
    );

    assert.deepEqual(light.spellLight, {
        id: 'weapon_light_100_seed',
        lightContrib: 0.5,
        expiresAt: 600105,
    });
    assert.deepEqual(shield.shield, {
        id: 'weapon_spellshield_100_seed',
        expiresAt: 90105,
        defense: 22,
        kind: 'magic',
    });
});

test('resolveUtilityBuffAction handles Fireshield, Freeze Life and Window caps', () => {
    const fireshield = resolveUtilityBuffAction(
        'Fireshield',
        20,
        0,
        0,
        {
            quantizeDurationMs: (durationMs) => durationMs,
            buildIdSuffix: () => 'fire',
        },
    );
    const freezeLife = resolveUtilityBuffAction(
        'Freeze Life',
        20,
        180,
        0,
        {
            quantizeDurationMs: (durationMs) => durationMs,
        },
    );
    const window = resolveUtilityBuffAction(
        'Window',
        50,
        0,
        200000,
        {
            quantizeDurationMs: (durationMs) => durationMs,
        },
    );

    assert.deepEqual(fireshield.shield, {
        id: 'weapon_fireshield_20_fire',
        expiresAt: 90020,
        defense: 22,
        kind: 'fire',
    });
    assert.equal(freezeLife.freezeLifeRemainingTicks, 200);
    assert.equal(window.seeThroughWallsUntil, 200000);
});

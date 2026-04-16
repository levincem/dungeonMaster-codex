import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCastSpellStatePatch } from '../src/engine/systems/spellCastState.js';

test('buildCastSpellStatePatch reports unknown rune combinations', () => {
    const result = buildCastSpellStatePatch<{ effect: string }, Record<string, unknown>, { hp: number }>(['foo'], {
        findSpell: () => undefined,
        buildUnknownCombinationPatch: () => ({ message: 'unknown' }),
        prepareCast: () => ({ kind: 'blocked', patch: { blocked: true } }),
        buildFailedCastPatch: () => ({ failed: true }),
        buildNonProjectilePatch: () => null,
        buildProjectilePatch: () => null,
        mergeBasePatch: (basePatch, nextPatch) => ({ ...basePatch, ...nextPatch }),
    });

    assert.deepEqual(result, { patch: { message: 'unknown' }, shouldPlayDoorMotion: false });
});

test('buildCastSpellStatePatch returns the failed cast patch when the cast fizzles', () => {
    const result = buildCastSpellStatePatch<{ effect: string }, Record<string, unknown>, { hp: number }>(['oh'], {
        findSpell: () => ({ effect: 'light' }),
        buildUnknownCombinationPatch: () => ({ message: 'unknown' }),
        prepareCast: () => ({
            kind: 'ready',
            basePatch: { base: true },
            castSucceeded: false,
            nextVitals: { hp: 10 },
            skillLevel: 1,
        }),
        buildFailedCastPatch: (basePatch, nextVitals) => ({ ...basePatch, hp: nextVitals.hp }),
        buildNonProjectilePatch: () => null,
        buildProjectilePatch: () => null,
        mergeBasePatch: (basePatch, nextPatch) => ({ ...basePatch, ...nextPatch }),
    });

    assert.deepEqual(result, { patch: { base: true, hp: 10 }, shouldPlayDoorMotion: false });
});

test('buildCastSpellStatePatch merges projectile patches and preserves door-motion metadata', () => {
    const result = buildCastSpellStatePatch<{ effect: string }, Record<string, unknown>, { hp: number }>(['ful', 'ir'], {
        findSpell: () => ({ effect: 'fireball' }),
        buildUnknownCombinationPatch: () => ({ message: 'unknown' }),
        prepareCast: () => ({
            kind: 'ready',
            basePatch: { base: true },
            castSucceeded: true,
            nextVitals: { hp: 10 },
            skillLevel: 3,
        }),
        buildFailedCastPatch: (basePatch, nextVitals) => ({ ...basePatch, hp: nextVitals.hp }),
        buildNonProjectilePatch: () => null,
        buildProjectilePatch: () => ({
            patch: { projectile: true },
            shouldPlayDoorMotion: true,
            doorMotionSquare: { level: 1, x: 2, y: 3 },
        }),
        mergeBasePatch: (basePatch, nextPatch) => ({ ...basePatch, ...nextPatch }),
    });

    assert.deepEqual(result, {
        patch: { base: true, projectile: true },
        shouldPlayDoorMotion: true,
        doorMotionSquare: { level: 1, x: 2, y: 3 },
    });
});

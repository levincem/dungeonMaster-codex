import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildSpellStatusStatePatch,
    resolveSpellStatusEffect,
    resolveSpellStatusPatch,
} from '../src/engine/systems/spellStatusEffects.js';

function createSpell(
    effect: 'invisibility' | 'see_through_walls' | 'reveal_hidden' | 'footprints',
    runes: string[],
    manaCost = 8,
) {
    return {
        runes,
        name: effect,
        effect,
        manaCost,
        manaBase: manaCost,
        castSkill: 'priest' as const,
        description: effect,
    };
}

test('resolveSpellStatusEffect extends simple duration-based statuses without going backwards', () => {
    const invisibility = resolveSpellStatusEffect(
        'invisibility',
        100,
        500,
        300,
        { quantizeDurationMs: (durationMs) => durationMs },
    );
    const footprints = resolveSpellStatusEffect(
        'footprints',
        100,
        50,
        300,
        { quantizeDurationMs: (durationMs) => durationMs },
    );

    assert.equal(invisibility, 500);
    assert.equal(footprints, 400);
});

test('resolveSpellStatusEffect returns null for simple statuses when no duration is provided', () => {
    const seeThroughWalls = resolveSpellStatusEffect(
        'see_through_walls',
        100,
        0,
        null,
        { quantizeDurationMs: (durationMs) => durationMs },
    );

    assert.equal(seeThroughWalls, null);
});

test('resolveSpellStatusEffect computes reveal hidden duration from mana cost', () => {
    const revealHidden = resolveSpellStatusEffect(
        'reveal_hidden',
        200,
        1000,
        null,
        { quantizeDurationMs: (durationMs) => durationMs + 7 },
        3,
    );

    assert.equal(revealHidden, 36207);
});

test('resolveSpellStatusPatch maps simple spell effects to the expected state keys', () => {
    const invisibility = resolveSpellStatusPatch(
        'invisibility',
        100,
        500,
        createSpell('invisibility', ['lo', 'oh', 'ew', 'sar']),
        { quantizeDurationMs: (durationMs) => durationMs },
    );
    const seeThroughWalls = resolveSpellStatusPatch(
        'see_through_walls',
        100,
        0,
        createSpell('see_through_walls', ['lo', 'oh', 'ew', 'ra']),
        { quantizeDurationMs: (durationMs) => durationMs },
    );
    const footprints = resolveSpellStatusPatch(
        'footprints',
        100,
        0,
        createSpell('footprints', ['lo', 'ya', 'bro', 'ros']),
        { quantizeDurationMs: (durationMs) => durationMs },
    );

    assert.deepEqual(invisibility, { invisibleUntil: 15460 });
    assert.deepEqual(seeThroughWalls, { seeThroughWallsUntil: 3940 });
    assert.deepEqual(footprints, { footprintsUntil: 15460 });
});

test('resolveSpellStatusPatch keeps reveal hidden on the magic vision field', () => {
    const revealHidden = resolveSpellStatusPatch(
        'reveal_hidden',
        200,
        1000,
        createSpell('reveal_hidden', ['lo', 'oh', 'bro', 'ros'], 3),
        { quantizeDurationMs: (durationMs) => durationMs + 7 },
    );

    assert.deepEqual(revealHidden, { magicVisionUntil: 36207 });
});

test('resolveSpellStatusPatch returns null when a duration-based status has no valid spell duration', () => {
    const seeThroughWalls = resolveSpellStatusPatch(
        'see_through_walls',
        100,
        0,
        createSpell('see_through_walls', ['lo']),
        { quantizeDurationMs: (durationMs) => durationMs },
    );

    assert.equal(seeThroughWalls, null);
});

test('buildSpellStatusStatePatch merges champion vitals with a status patch when present', () => {
    const patch = buildSpellStatusStatePatch({
        championId: 5,
        nextVitals: { hp: 12 } as never,
        currentChampionVitals: { 5: { hp: 20 } } as never,
        statusPatch: { invisibleUntil: 900 },
    });

    assert.deepEqual(patch, {
        championVitals: { 5: { hp: 12 } },
        invisibleUntil: 900,
    });
});

test('buildSpellStatusStatePatch can preserve the previous timer when no new patch exists', () => {
    const patch = buildSpellStatusStatePatch({
        championId: 5,
        nextVitals: { hp: 10 } as never,
        currentChampionVitals: { 5: { hp: 20 } } as never,
        statusPatch: null,
        currentUntilKey: 'magicVisionUntil',
        currentUntilValue: 444,
    });

    assert.deepEqual(patch, {
        championVitals: { 5: { hp: 10 } },
        magicVisionUntil: 444,
    });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    getChampionStatHighlightSnapshot,
    recordChampionStatHighlights,
    resetChampionStatHighlightsForTests,
} from '../src/components/UI/championStatHighlights.js';

test('champion stat highlight snapshots stay referentially stable until the store changes', () => {
    resetChampionStatHighlightsForTests();

    const emptyA = getChampionStatHighlightSnapshot(1);
    const emptyB = getChampionStatHighlightSnapshot(1);
    assert.strictEqual(emptyA, emptyB);

    recordChampionStatHighlights(1, ['strength', 'wisdom'], 30_000, 1_000);

    const activeA = getChampionStatHighlightSnapshot(1);
    const activeB = getChampionStatHighlightSnapshot(1);
    assert.strictEqual(activeA, activeB);
    assert.notStrictEqual(activeA, emptyA);
    assert.deepEqual(activeA, { strength: true, wisdom: true });

    resetChampionStatHighlightsForTests();

    const emptyAfterResetA = getChampionStatHighlightSnapshot(1);
    const emptyAfterResetB = getChampionStatHighlightSnapshot(1);
    assert.strictEqual(emptyAfterResetA, emptyAfterResetB);
    assert.deepEqual(emptyAfterResetA, {});
});

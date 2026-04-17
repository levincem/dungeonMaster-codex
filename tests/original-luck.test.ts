import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOriginalLuckSuccessful } from '../src/engine/systems/originalLuck.js';

test('isOriginalLuckSuccessful matches the original 1-in-2 plus random(100) fast path', () => {
    const randoms = [1, 61];
    const result = isOriginalLuckSuccessful(0, 60, () => randoms.shift() ?? 0);

    assert.equal(result, true);
});

test('isOriginalLuckSuccessful falls back to random(currentLuck) when the fast path fails', () => {
    const randoms = [0, 11];
    const result = isOriginalLuckSuccessful(12, 10, () => randoms.shift() ?? 0);

    assert.equal(result, true);
});

test('isOriginalLuckSuccessful returns false when current luck is zero and the fast path fails', () => {
    const randoms = [0];
    const result = isOriginalLuckSuccessful(0, 10, () => randoms.shift() ?? 0);

    assert.equal(result, false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    getOriginalMonsterAttackDelaySeconds,
    getOriginalMonsterMoveDelaySeconds,
} from '../src/engine/systems/originalMonsterTiming.js';

test('getOriginalMonsterMoveDelaySeconds follows the original 4-roll spread and floor', () => {
    assert.equal(getOriginalMonsterMoveDelaySeconds(0, () => 0), 1 / 6);
    assert.equal(getOriginalMonsterMoveDelaySeconds(8, () => 3), 10 / 6);
});

test('getOriginalMonsterAttackDelaySeconds adds the extra long-delay spread for large attack ticks', () => {
    const rolls = [3, 7];
    assert.equal(
        getOriginalMonsterAttackDelaySeconds(16, () => rolls.shift() ?? 0),
        23 / 6,
    );
    assert.equal(getOriginalMonsterAttackDelaySeconds(8, () => 0), 7 / 6);
});

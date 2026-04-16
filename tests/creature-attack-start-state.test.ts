import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCreatureAttackStartState } from '../src/engine/systems/creatureAttackStartState.js';

test('resolveCreatureAttackStartState keeps the current timer when no attack is attempted', () => {
    const result = resolveCreatureAttackStartState({
        shouldAttemptAttack: false,
        confused: false,
        currentAttackTimer: 0.4,
        nextAttackDelaySeconds: 1.2,
        nowMs: 1000,
        attackWindowMs: 900,
        confusedSkipRoll: 1,
    });

    assert.deepEqual(result, {
        kind: 'idle',
        nextAttackTimer: 0.4,
    });
});

test('resolveCreatureAttackStartState blocks a confused creature while still consuming the attack timer', () => {
    const result = resolveCreatureAttackStartState({
        shouldAttemptAttack: true,
        confused: true,
        currentAttackTimer: 0,
        nextAttackDelaySeconds: 1.5,
        nowMs: 1000,
        attackWindowMs: 900,
        confusedSkipRoll: 0,
    });

    assert.deepEqual(result, {
        kind: 'blocked',
        nextAttackTimer: 1.5,
    });
});

test('resolveCreatureAttackStartState starts the attack window when the attempt goes through', () => {
    const result = resolveCreatureAttackStartState({
        shouldAttemptAttack: true,
        confused: false,
        currentAttackTimer: 0,
        nextAttackDelaySeconds: 1.25,
        nowMs: 1000,
        attackWindowMs: 900,
        confusedSkipRoll: 1,
    });

    assert.deepEqual(result, {
        kind: 'started',
        nextAttackTimer: 1.25,
        attackWindowExpiresAt: 1900,
    });
});

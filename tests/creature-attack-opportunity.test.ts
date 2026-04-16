import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCreatureAttackOpportunity } from '../src/engine/systems/creatureAttackOpportunity.js';

test('resolveCreatureAttackOpportunity opens an attack window after movement and allows ranged attacks in range', () => {
    const result = resolveCreatureAttackOpportunity(
        {
            attackReach: 4,
            distanceAfterMove: 3,
            canDetectParty: true,
            movedThisTick: true,
            frightened: false,
            atkTimer: 0,
            projectileEffectAvailable: true,
            adjacentAfterMove: false,
            isContactCell: false,
            attackWindowSeconds: 0.9,
        },
        { randomInt: () => 0 },
    );

    assert.equal(result.nextAttackTimer, 0.9);
    assert.equal(result.canUseRangedAttack, true);
    assert.equal(result.canUseMeleeAttack, false);
    assert.equal(result.shouldAttemptAttack, false);
    assert.equal(result.shouldLaunchProjectile, true);
});

test('resolveCreatureAttackOpportunity allows melee attacks from contact cells when stationary', () => {
    const result = resolveCreatureAttackOpportunity(
        {
            attackReach: 1,
            distanceAfterMove: 1,
            canDetectParty: true,
            movedThisTick: false,
            frightened: false,
            atkTimer: 0,
            projectileEffectAvailable: false,
            adjacentAfterMove: true,
            isContactCell: true,
            attackWindowSeconds: 0.9,
        },
        { randomInt: () => 0 },
    );

    assert.equal(result.canUseMeleeAttack, true);
    assert.equal(result.canUseRangedAttack, false);
    assert.equal(result.shouldAttemptAttack, true);
    assert.equal(result.shouldLaunchProjectile, false);
});

test('resolveCreatureAttackOpportunity suppresses attack attempts for frightened creatures', () => {
    const result = resolveCreatureAttackOpportunity(
        {
            attackReach: 3,
            distanceAfterMove: 2,
            canDetectParty: true,
            movedThisTick: false,
            frightened: true,
            atkTimer: 0,
            projectileEffectAvailable: true,
            adjacentAfterMove: false,
            isContactCell: false,
            attackWindowSeconds: 0.9,
        },
        { randomInt: () => 0 },
    );

    assert.equal(result.shouldAttemptAttack, false);
});

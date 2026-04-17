import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollOriginalProjectileImpactAttack } from '../src/engine/systems/originalProjectileImpact.js';

test('rollOriginalProjectileImpactAttack keeps poison bolt source-backed semantics', () => {
    const result = rollOriginalProjectileImpactAttack('poison_bolt', 23, 40, () => 0);

    assert.deepEqual(result, {
        damage: 1,
        attackType: 'Magic',
        poisonAttack: 23,
    });
});

test('rollOriginalProjectileImpactAttack keeps non-damaging utility effects at zero damage', () => {
    assert.deepEqual(
        rollOriginalProjectileImpactAttack('open', 12, 40, () => 0),
        { damage: 0, attackType: 'Normal', poisonAttack: 0 },
    );
    assert.deepEqual(
        rollOriginalProjectileImpactAttack('poison_cloud', 12, 40, () => 0),
        { damage: 0, attackType: 'Magic', poisonAttack: 0 },
    );
});

test('rollOriginalProjectileImpactAttack returns deterministic lightning damage with deterministic rolls', () => {
    const rolls = [3, 4, 2, 1];
    const result = rollOriginalProjectileImpactAttack('lightning', 40, 32, () => rolls.shift() ?? 0);

    assert.deepEqual(result, {
        damage: 5,
        attackType: 'Lightning',
        poisonAttack: 0,
    });
});

test('rollOriginalProjectileImpactAttack applies the dedicated slime branch', () => {
    const rolls = [5, 7, 3, 2];
    const result = rollOriginalProjectileImpactAttack('slime', 24, 24, () => rolls.shift() ?? 0);

    assert.deepEqual(result, {
        damage: 4,
        attackType: 'Blunt',
        poisonAttack: 15,
    });
});

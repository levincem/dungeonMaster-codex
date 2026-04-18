import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSpellProjectileCast } from '../src/engine/systems/spellProjectileCasting.js';

function createSpell(effect: 'fireball' | 'open' | 'disrupt_nonmaterial' | 'heal', runes: string[], manaCost = 8) {
    return {
        runes,
        name: effect,
        effect,
        manaCost,
        manaBase: manaCost,
        castSkill: 'wizard' as const,
        description: effect,
    };
}

test('buildSpellProjectileCast creates a fireball projectile from the party square and keeps the front square for immediate checks', () => {
    const result = buildSpellProjectileCast(
        createSpell('fireball', ['on', 'ful', 'ir'], 10),
        3,
        [5, 8],
        'EAST',
        100,
        4,
        37,
        {
            projectileAttack: 90,
            projectileStepMs: 140,
            buildIdSuffix: () => 'seed',
        },
    );

    assert.ok(result);
    assert.equal(result.startX, 8);
    assert.equal(result.startY, 5);
    assert.equal(result.frontX, 9);
    assert.equal(result.frontY, 5);
    assert.ok(Math.abs(result.visualScale - 1.12) < 1e-9);
    assert.deepEqual(result.projectileDamage, { min: 30, max: 50 });
    assert.ok(result.launchProfile);
    assert.equal(result.projectile.id, 'proj_100_seed');
    assert.equal(result.projectile.nextMoveAt, 240);
    assert.equal(result.projectile.remainingAttack, 90);
    assert.equal(result.projectile.effect, 'fireball');
    assert.deepEqual([result.projectile.x, result.projectile.y], [8, 5]);
});

test('buildSpellProjectileCast creates an open projectile with zero damage and no attack payload', () => {
    const result = buildSpellProjectileCast(
        createSpell('open', ['lo', 'zo']),
        1,
        [7, 4],
        'NORTH',
        50,
        2,
        12,
        {
            projectileAttack: 90,
            projectileStepMs: 100,
            buildIdSuffix: () => 'open',
        },
    );

    assert.ok(result);
    assert.deepEqual(result.projectileDamage, { min: 0, max: 0 });
    assert.equal(result.projectile.remainingAttack, 0);
    assert.equal(result.projectile.visualScale, 0.82);
    assert.deepEqual([result.startX, result.startY], [4, 7]);
    assert.deepEqual([result.frontX, result.frontY], [4, 6]);
});

test('buildSpellProjectileCast returns null for non-projectile-compatible spell effects', () => {
    const result = buildSpellProjectileCast(
        createSpell('heal', ['lo', 'vi']),
        1,
        [0, 0],
        'SOUTH',
        0,
        1,
        10,
        {
            projectileAttack: 90,
            projectileStepMs: 100,
            buildIdSuffix: () => 'none',
        },
    );

    assert.equal(result, null);
});

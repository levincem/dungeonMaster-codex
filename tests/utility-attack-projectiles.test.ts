import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUtilityAttackProjectile } from '../src/engine/systems/utilityAttackProjectiles.js';

test('buildUtilityAttackProjectile builds fixed combat projectiles with the expected front tile', () => {
    const lightning = buildUtilityAttackProjectile(
        'Lightning',
        2,
        [5, 5],
        'NORTH',
        100,
        {
            randomInt: () => 0,
            buildIdSuffix: () => 'seed',
        },
    );
    const fireball = buildUtilityAttackProjectile(
        'Fireball',
        2,
        [5, 5],
        'EAST',
        100,
        {
            randomInt: () => 0,
            buildIdSuffix: () => 'seed',
        },
    );
    const dispell = buildUtilityAttackProjectile(
        'Dispell',
        2,
        [5, 5],
        'WEST',
        100,
        {
            randomInt: () => 0,
            buildIdSuffix: () => 'seed',
        },
    );

    assert.equal(lightning.id, 'weapon_lightning_100_seed');
    assert.deepEqual([lightning.x, lightning.y], [5, 4]);
    assert.equal(lightning.effect, 'lightning');
    assert.deepEqual(lightning.damage, [20, 45]);

    assert.equal(fireball.id, 'weapon_fireball_100_seed');
    assert.deepEqual([fireball.x, fireball.y], [6, 5]);
    assert.equal(fireball.effect, 'fireball');
    assert.deepEqual(fireball.damage, [18, 42]);

    assert.equal(dispell.id, 'weapon_dispell_100_seed');
    assert.deepEqual([dispell.x, dispell.y], [4, 5]);
    assert.equal(dispell.effect, 'disrupt_nonmaterial');
    assert.deepEqual(dispell.damage, [14, 34]);
});

test('buildUtilityAttackProjectile selects invoke effects through injected randomness', () => {
    const invoke = buildUtilityAttackProjectile(
        'Invoke',
        3,
        [9, 2],
        'SOUTH',
        250,
        {
            randomInt: () => 2,
            buildIdSuffix: () => 'invoke',
        },
    );

    assert.equal(invoke.id, 'weapon_invoke_250_invoke');
    assert.deepEqual([invoke.x, invoke.y], [2, 10]);
    assert.equal(invoke.effect, 'disrupt_nonmaterial');
    assert.deepEqual(invoke.damage, [20, 50]);
    assert.equal(invoke.nextMoveAt, 250);
});

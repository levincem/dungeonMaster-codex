import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Projectile } from '../src/engine/runtimeTypes.js';
import { resolveProjectileContinuation } from '../src/engine/systems/projectileContinuation.js';

function createProjectile(overrides: Partial<Projectile> = {}): Projectile {
    return {
        id: 'proj-1',
        level: 0,
        x: 2,
        y: 2,
        direction: 'EAST',
        effect: 'fireball',
        damage: [4, 8],
        nextMoveAt: 1000,
        remainingRange: 6,
        remainingAttack: 10,
        visualScale: 1.2,
        ...overrides,
    };
}

test('resolveProjectileContinuation advances open projectiles until their remaining range is exhausted', () => {
    const result = resolveProjectileContinuation(
        createProjectile({ effect: 'open', remainingRange: 2, stepDecay: 1 }),
        { level: 0, x: 3, y: 2, direction: 'EAST' },
        1000,
        [],
        {
            projectileStepMs: 150,
            physicalProjectileStepMs: 90,
            buildDroppedItem: (item) => item,
        },
    );

    assert.equal(result.keepProjectile?.effect, 'open');
    assert.equal(result.keepProjectile?.remainingRange, 1);
    assert.equal(result.keepProjectile?.nextMoveAt, 1150);
});

test('resolveProjectileContinuation drops exhausted physical projectiles to the floor', () => {
    const rock = { id: 'rock', category: 'Misc', typeId: 1, mapIndex: 0, x: 2, y: 2, tilePos: 'North' } as const;
    const result = resolveProjectileContinuation(
        createProjectile({
            effect: 'physical',
            physicalItem: rock,
            remainingRange: 1,
            remainingAttack: 1,
            stepDecay: 1,
        }),
        { level: 0, x: 3, y: 2, direction: 'EAST' },
        1000,
        [],
        {
            projectileStepMs: 150,
            physicalProjectileStepMs: 90,
            buildDroppedItem: (item, level, x, y) => ({ ...item, mapIndex: level, x, y }),
        },
    );

    assert.equal(result.keepProjectile, undefined);
    assert.equal(result.floorItems.length, 1);
    assert.equal(result.floorItems[0]?.x, 3);
});

test('resolveProjectileContinuation advances magical projectiles while range and attack remain', () => {
    const result = resolveProjectileContinuation(
        createProjectile({ effect: 'lightning', remainingRange: 4, remainingAttack: 8, stepDecay: 2 }),
        { level: 1, x: 5, y: 6, direction: 'SOUTH' },
        1000,
        [],
        {
            projectileStepMs: 150,
            physicalProjectileStepMs: 90,
            buildDroppedItem: (item) => item,
        },
    );

    assert.equal(result.keepProjectile?.level, 1);
    assert.equal(result.keepProjectile?.x, 5);
    assert.equal(result.keepProjectile?.y, 6);
    assert.equal(result.keepProjectile?.remainingRange, 2);
    assert.equal(result.keepProjectile?.remainingAttack, 6);
});

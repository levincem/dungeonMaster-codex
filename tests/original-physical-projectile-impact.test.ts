import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FloorItem } from '../src/types/game.js';
import type { Projectile } from '../src/engine/runtimeTypes.js';
import {
    rollOriginalPhysicalProjectileBaseDamage,
    rollOriginalPhysicalProjectileCreatureDamage,
} from '../src/engine/systems/originalPhysicalProjectileImpact.js';

function createProjectile(overrides: Partial<Projectile> = {}): Projectile {
    return {
        id: 'proj-1',
        level: 0,
        x: 2,
        y: 2,
        direction: 'NORTH',
        effect: 'physical',
        damage: [4, 8],
        nextMoveAt: 1000,
        remainingRange: 24,
        remainingAttack: 40,
        physicalItem: {
            id: 'dagger-1',
            category: 'Weapon',
            typeId: 8,
            rawName: 'Dagger',
            mapIndex: 0,
            x: 2,
            y: 2,
            tilePos: 'North',
        } satisfies FloorItem,
        ...overrides,
    };
}

test('physical projectile base damage is source-backed and far below remainingAttack', () => {
    const damage = rollOriginalPhysicalProjectileBaseDamage(createProjectile(), () => 0);
    assert.equal(damage, 1);
});

test('physical projectile creature damage is scaled by creature defense instead of using raw remainingAttack', () => {
    const damage = rollOriginalPhysicalProjectileCreatureDamage(
        createProjectile(),
        10,
        () => 0,
    );

    assert.equal(damage, 2);
});

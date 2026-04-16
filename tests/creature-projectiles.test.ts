import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureDef } from '../src/data/creatures.js';
import type { CreatureInstance } from '../src/types/game.js';
import {
    buildCreatureProjectile,
    chooseOriginalCreatureProjectileEffect,
} from '../src/engine/systems/creatureProjectiles.js';
import { PROJECTILE_STEP_MS } from '../src/engine/time.js';

function createCreature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
    return {
        id: 'creature-1',
        typeId: 14,
        mapIndex: 2,
        x: 6,
        y: 7,
        currentHP: 25,
        alive: true,
        cell: 'center',
        ...overrides,
    };
}

function createCreatureDef(overrides: Partial<CreatureDef> = {}): CreatureDef {
    return {
        id: 14,
        name: 'Vexirk',
        sizeOnTile: 0,
        baseHP: 20,
        armor: 10,
        hitProb: 40,
        atkSpd: 20,
        moveSpd: 20,
        exp: 100,
        poison: false,
        originalAttackType: 'Magic',
        attackTypes: ['Magic'],
        drops: [],
        fixedDrops: [],
        rawAttack: 40,
        poisonAttack: 0,
        dexterity: 13,
        fireResistance: 0,
        poisonResistance: 0,
        nonMaterial: false,
        attackAnyChampion: false,
        attackFromAllSides: false,
        attackRange: 1,
        sightRange: 6,
        preferBackRow: false,
        levitates: false,
        absorbMissiles: false,
        seeInvisible: false,
        fearResistance: 5,
        archenemy: false,
        ...overrides,
    };
}

test('chooseOriginalCreatureProjectileEffect follows original creature-specific tables', () => {
    assert.equal(chooseOriginalCreatureProjectileEffect(1, () => 0), 'slime');
    assert.equal(chooseOriginalCreatureProjectileEffect(22, () => 0), 'fireball');
    assert.equal(chooseOriginalCreatureProjectileEffect(999, () => 0), null);

    let calls = 0;
    const lordChaosEffect = chooseOriginalCreatureProjectileEffect(23, (max) => {
        calls += 1;
        if (calls === 1) return 0;
        return max === 4 ? 2 : 0;
    });
    assert.equal(lordChaosEffect, 'poison_cloud');
});

test('buildCreatureProjectile computes direction, kinetic bounds and visual scale', () => {
    const projectile = buildCreatureProjectile(
        { position: [3, 10] },
        createCreature(),
        createCreatureDef(),
        'lightning',
        4,
        1000,
        {
            randomInt: () => 5,
            buildIdSuffix: () => 'seeded',
        },
    );

    assert.equal(projectile.id, 'creature_proj_creature-1_1000_seeded');
    assert.equal(projectile.direction, 'EAST');
    assert.deepEqual(projectile.damage, [1, 21]);
    assert.equal(projectile.remainingRange, 21);
    assert.equal(projectile.remainingAttack, 13);
    assert.equal(projectile.nextMoveAt, 1000 + PROJECTILE_STEP_MS);
    assert.equal(projectile.visualScale, 1.05);
});

test('buildCreatureProjectile clamps kinetic energy to the original cap', () => {
    const projectile = buildCreatureProjectile(
        { position: [0, 0] },
        createCreature({ x: 20, y: 20 }),
        createCreatureDef({ rawAttack: 400, dexterity: 0 }),
        'poison_cloud',
        undefined,
        50,
        {
            randomInt: (max) => max,
            buildIdSuffix: () => 'max',
        },
    );

    assert.deepEqual(projectile.damage, [1, 255]);
    assert.equal(projectile.remainingRange, 255);
    assert.equal(projectile.remainingAttack, 1);
    assert.equal(projectile.visualScale, 1.1);
});

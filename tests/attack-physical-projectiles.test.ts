import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { FloorItem } from '../src/types/game.js';
import { buildShotAttackProjectile, buildThrownAttackProjectile } from '../src/engine/systems/attackPhysicalProjectiles.js';

const champion: Champion = {
    id: 1,
    name: 'Halk',
    title: 'Fighter',
    gender: 'M',
    class: 'Fighter',
    health: 60,
    stamina: 55,
    mana: 10,
    luck: 20,
    strength: 50,
    dexterity: 35,
    wisdom: 20,
    vitality: 45,
    antiMagic: 10,
    antiFire: 10,
    skills: {
        fighter: [0, 0, 0, 0],
        ninja: [0, 0, 0, 0],
        priest: [0, 0, 0, 0],
        wizard: [0, 0, 0, 0],
    },
    color: 'red',
    equipment: [],
    portrait: 'portrait.png',
};

const thrownItem: FloorItem = {
    id: 'weapon-1',
    category: 'Potion',
    typeId: 4,
    rawName: 'Ful Bomb',
    mapIndex: 0,
    x: 0,
    y: 0,
    tilePos: 'North',
};

const ammoItem: FloorItem = {
    id: 'ammo-1',
    category: 'Misc',
    typeId: 1,
    rawName: 'Arrow',
    mapIndex: 0,
    x: 0,
    y: 0,
    tilePos: 'North',
};

test('buildThrownAttackProjectile builds a physical projectile with explosion metadata', () => {
    const projectile = buildThrownAttackProjectile(
        {
            champion,
            equip: {},
            currentStamina: 40,
            item: thrownItem,
            descriptor: { rawClass: 10, kineticEnergy: 3 },
            fighterMastery: 2,
            ninjaMastery: 4,
            runtimeBonuses: {
                mana: 0,
                strength: 0,
                dexterity: 0,
                wisdom: 0,
                vitality: 0,
                antiMagic: 0,
                antiFire: 0,
                luck: 0,
            },
            level: 0,
            position: [6, 7],
            direction: 'WEST',
            now: 1000,
        },
        {
            originalThrowingDistance: () => 6,
            getThrownPotionExplosionEffect: () => 'fireball',
            buildDroppedItem: (item, level, x, y) => ({ ...item, mapIndex: level, x, y, tilePos: 'North' }),
            randomInt: (maxExclusive) => (maxExclusive === 16 ? 5 : 7),
            buildIdSuffix: () => 'fixed',
        },
    );

    assert.equal(projectile.id, 'throw_1000_fixed');
    assert.equal(projectile.effect, 'physical');
    assert.equal(projectile.remainingRange, 22);
    assert.equal(projectile.remainingAttack, 40);
    assert.equal(projectile.explosionOnImpact, 'fireball');
    assert.equal(projectile.explosionAttack, 40);
    assert.equal(projectile.x, 7);
    assert.equal(projectile.y, 6);
});

test('buildShotAttackProjectile builds a ranged physical projectile from launcher and ammo descriptors', () => {
    const projectile = buildShotAttackProjectile(
        {
            launcher: { shootDamage: 8, kineticEnergy: 2 },
            ammoDescriptor: { kineticEnergy: 3 },
            ammoItem,
            mastery: 5,
            level: 1,
            position: [3, 4],
            direction: 'NORTH',
            now: 2000,
        },
        {
            buildDroppedItem: (item, level, x, y) => ({ ...item, mapIndex: level, x, y, tilePos: 'North' }),
            buildIdSuffix: () => 'arrow',
        },
    );

    assert.equal(projectile.id, 'shoot_2000_arrow');
    assert.deepEqual(projectile.damage, [14, 26]);
    assert.equal(projectile.remainingRange, 5);
    assert.equal(projectile.stepDecay, 10);
    assert.equal(projectile.x, 4);
    assert.equal(projectile.y, 3);
});

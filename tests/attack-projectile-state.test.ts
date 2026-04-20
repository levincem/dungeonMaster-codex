import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampionCombat, ChampionVitals, Projectile } from '../src/engine/runtimeTypes.js';
import type { ChampionEquipment } from '../src/types/game.js';
import { buildMissingAmmoAttackPatch, buildProjectileAttackSuccessPatch } from '../src/engine/systems/attackProjectileState.js';

function createCombat(): ChampionCombat {
    return {
        cooldown: 2,
        cooldownMax: 2,
        defenseModifier: 0,
    };
}

function createVitals(): ChampionVitals {
    return {
        hp: 60,
        stamina: 40,
        mana: 10,
        food: 900,
        water: 900,
        currentStats: {
            luck: 10,
            strength: 10,
            dexterity: 10,
            wisdom: 10,
            vitality: 10,
            antiMagic: 0,
            antiFire: 0,
        },
        wounds: {
            rightHand: false,
            leftHand: false,
            head: false,
            torso: false,
            legs: false,
            feet: false,
        },
        poisonEntries: [],
    };
}

function createProjectile(id: string): Projectile {
    return {
        id,
        level: 0,
        x: 4,
        y: 3,
        direction: 'NORTH',
        effect: 'physical',
        damage: [10, 20],
        nextMoveAt: 1,
    };
}

test('buildProjectileAttackSuccessPatch updates combat, equipment and projectile state together', () => {
    const patch = buildProjectileAttackSuccessPatch({
        championCombat: { 1: createCombat() },
        championId: 1,
        newCombat: { cooldown: 4, cooldownMax: 4, defenseModifier: 2 },
        championVitals: { 1: createVitals() },
        championEquipment: {
            1: { rightHand: { id: 'weapon', category: 'Weapon', typeId: 1, mapIndex: 0, x: 0, y: 0, tilePos: 'North' } },
        } as Record<number, ChampionEquipment>,
        nextEquip: {},
        attackXpPatch: { championXP: { 1: { fighter: 10 } } },
        projectiles: [createProjectile('existing')],
        projectile: createProjectile('new'),
        displayName: 'Shoot',
        buildAttackResultMessage: (message: string, success = false) => ({ success, message, ts: 1 }),
    });

    assert.equal(patch.championCombat[1]?.cooldown, 4);
    assert.deepEqual(patch.championEquipment[1], {});
    assert.equal(patch.projectiles.length, 2);
    assert.equal(patch.projectiles[1]?.id, 'new');
    assert.equal(patch.lastCastResult.message, 'Shoot');
    assert.equal(patch.lastCastResult.success, true);
});

test('buildMissingAmmoAttackPatch returns the expected failure message', () => {
    const patch = buildMissingAmmoAttackPatch((message: string, success = false) => ({ success, message, ts: 1 }));

    assert.equal(patch.lastCastResult.message, 'No compatible ammunition in the quiver.');
    assert.equal(patch.lastCastResult.success, false);
});

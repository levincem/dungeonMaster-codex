import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import type { ChampionCombat, ChampionVitals } from '../src/engine/runtimeTypes.js';
import type { WeaponAttackOption } from '../src/data/weaponAttacks.js';
import { buildPhysicalProjectileAttackPatch } from '../src/engine/systems/attackPhysicalState.js';

function createChampion(): Champion {
    return {
        id: 1,
        name: 'Halk',
        title: 'The Tester',
        gender: 'M',
        class: 'Fighter',
        health: 120,
        stamina: 90,
        mana: 10,
        luck: 20,
        strength: 50,
        dexterity: 25,
        wisdom: 12,
        vitality: 40,
        antiMagic: 4,
        antiFire: 6,
        skills: {
            fighter: [1, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: 'portrait.png',
    };
}

function createVitals(): ChampionVitals {
    return {
        hp: 100,
        stamina: 70,
        mana: 10,
        food: 900,
        water: 900,
        currentStats: {
            luck: 20,
            strength: 50,
            dexterity: 25,
            wisdom: 12,
            vitality: 40,
            antiMagic: 4,
            antiFire: 6,
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

function createCombat(): ChampionCombat {
    return {
        cooldown: 2,
        cooldownMax: 2,
        defenseModifier: 0,
    };
}

function createItem(overrides: Partial<FloorItem> = {}): FloorItem {
    return {
        id: 'item-1',
        category: 'Weapon',
        typeId: 10,
        rawName: 'ITEM',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
        ...overrides,
    };
}

function createAttack(enumName: string): WeaponAttackOption {
    return {
        attackType: 0,
        enumName,
        displayName: enumName,
        requiresCharges: false,
        masteryThreshold: 0,
        source: 'primary',
        attack: {
            index: 0,
            enumName,
            displayName: enumName,
            experienceForAttacking: 5,
            skillNumber: 0,
            defenseModifier: 0,
            staminaCost: 5,
            strengthRequired: 0,
            baseDamage: 20,
            disableTime: 10,
        },
    };
}

function createState() {
    return {
        championId: 1,
        level: 0,
        position: [5, 5] as [number, number],
        direction: 'NORTH' as const,
        now: 123,
        championCombat: { 1: createCombat() },
        championVitals: { 1: createVitals() },
        championEquipment: { 1: {} as ChampionEquipment },
        projectiles: [],
    };
}

const baseDeps = {
    isThrowAttack: (attack: WeaponAttackOption) => attack.enumName === 'Throw',
    isShootAttack: (attack: WeaponAttackOption) => attack.enumName === 'Shoot',
    getOriginalWeaponReference: () => ({
        weaponIndex: 0,
        objectInfoIndex: 0,
        displayName: 'Projectile',
        weightKg: 1,
        rawClass: 1,
        damage: 4,
        kineticEnergy: 4,
        shootDamage: 6,
        throwGraphic: 0,
    }),
    getFighterMastery: () => 2,
    getNinjaMastery: () => 3,
    getRuntimeBonuses: () => ({}),
    originalThrowingDistance: () => 6,
    getThrownPotionExplosionEffect: () => undefined,
    buildDroppedItem: (item: FloorItem, level: number, x: number, y: number) => ({
        ...item,
        mapIndex: level,
        mapX: x,
        mapY: y,
    }),
    randomInt: () => 1,
    findAmmo: () => null,
    buildAttackXpPatch: () => ({ championXP: { ok: true } }),
    buildAttackResultMessage: (message: string, success = false) => ({ success, message, ts: 1 }),
};

test('buildPhysicalProjectileAttackPatch resolves throw attacks into a success patch', () => {
    const rightHand = createItem({ id: 'weapon' });
    const patch = buildPhysicalProjectileAttackPatch(
        createAttack('Throw'),
        createState(),
        createChampion(),
        { rightHand },
        rightHand,
        'rightHand',
        60,
        createCombat(),
        baseDeps,
    );

    assert.ok(patch && 'projectiles' in patch && 'championEquipment' in patch);
    const successPatch = patch as {
        championEquipment: Record<number, ChampionEquipment>;
        projectiles: unknown[];
        lastCastResult: { success: boolean; message: string };
    };

    assert.equal(successPatch.championEquipment[1]?.rightHand, undefined);
    assert.equal(successPatch.projectiles.length, 1);
    assert.equal(successPatch.lastCastResult.message, 'Throw');
    assert.equal(successPatch.lastCastResult.success, true);
});

test('buildPhysicalProjectileAttackPatch reports missing ammo for shoot attacks', () => {
    const patch = buildPhysicalProjectileAttackPatch(
        createAttack('Shoot'),
        createState(),
        createChampion(),
        {},
        undefined,
        null,
        60,
        createCombat(),
        baseDeps,
    );

    assert.ok(patch && 'lastCastResult' in patch);
    assert.equal(patch.lastCastResult.message, 'No compatible ammunition in the quiver.');
    assert.equal(patch.lastCastResult.success, false);
});

test('buildPhysicalProjectileAttackPatch consumes the ammo slot on shoot success', () => {
    const ammo = createItem({ id: 'ammo' });
    const patch = buildPhysicalProjectileAttackPatch(
        createAttack('Shoot'),
        createState(),
        createChampion(),
        { quiver1: ammo } as ChampionEquipment,
        createItem({ id: 'bow' }),
        'rightHand',
        60,
        createCombat(),
        {
            ...baseDeps,
            findAmmo: () => ({ slot: 'quiver1', item: ammo }),
        },
    );

    assert.ok(patch && 'projectiles' in patch && 'championEquipment' in patch);
    const successPatch = patch as {
        championEquipment: Record<number, ChampionEquipment>;
        projectiles: unknown[];
    };

    assert.equal(successPatch.championEquipment[1]?.quiver1, undefined);
    assert.equal(successPatch.projectiles.length, 1);
});

test('buildPhysicalProjectileAttackPatch throws a quiver weapon without requiring it in hand', () => {
    const dagger = createItem({ id: 'dagger', rawName: 'Dagger' });
    const patch = buildPhysicalProjectileAttackPatch(
        createAttack('Throw'),
        createState(),
        createChampion(),
        { quiver1: dagger } as ChampionEquipment,
        dagger,
        'quiver1',
        60,
        createCombat(),
        baseDeps,
    );

    assert.ok(patch && 'projectiles' in patch && 'championEquipment' in patch);
    const successPatch = patch as {
        championEquipment: Record<number, ChampionEquipment>;
        projectiles: unknown[];
        lastCastResult: { success: boolean; message: string };
    };

    assert.equal(successPatch.championEquipment[1]?.quiver1, undefined);
    assert.equal(successPatch.projectiles.length, 1);
    assert.equal(successPatch.lastCastResult.message, 'Throw');
    assert.equal(successPatch.lastCastResult.success, true);
});

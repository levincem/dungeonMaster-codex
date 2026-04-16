import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WeaponAttackOption } from '../src/data/weaponAttacks.js';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../src/types/game.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import { determineMeleeDamage } from '../src/engine/systems/meleeDamage.js';

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

function createCreature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
    return {
        id: 'target',
        typeId: 5,
        mapIndex: 0,
        x: 1,
        y: 0,
        currentHP: 40,
        alive: true,
        cell: 'frontLeft',
        ...overrides,
    };
}

function createAttack(enumName: string, baseDamage = 32): WeaponAttackOption {
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
            baseDamage,
            disableTime: 10,
        },
    };
}

function createItem(rawName = 'Sword'): FloorItem {
    return {
        id: 'weapon',
        category: 'Weapon',
        typeId: 10,
        rawName,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

const baseDeps = {
    getEffectiveChampionStats: () => ({ strength: 40, luck: 30 }),
    getWeaponDescriptor: () => ({
        weaponIndex: 0,
        objectInfoIndex: 0,
        displayName: 'Weapon',
        weightKg: 1,
        rawClass: 1,
        damage: 10,
        kineticEnergy: 8,
        shootDamage: 0,
        throwGraphic: 0,
    }),
    getWeaponName: (item: FloorItem | undefined) => item?.rawName ?? '',
    isLikelyNonMaterial: () => false,
    computeQuickness: () => 60,
    getRuntimeBonuses: () => ({}),
    randomInt: () => 0,
    isCharacterLucky: () => false,
    originalThrowingDistance: () => 12,
    getFighterMastery: () => 4,
    getNinjaMastery: () => 2,
    getAttackMastery: () => 0,
    getTargetDefense: () => ({ hitProb: 10, armor: 4 }),
};

test('determineMeleeDamage returns zero against non-material creatures without disrupt or vorpal', () => {
    const damage = determineMeleeDamage(
        {
            champion: createChampion(),
            equip: { rightHand: createItem('Ordinary Sword') } as ChampionEquipment,
            inventory: [],
            currentVitals: createVitals(),
            currentStamina: 60,
            attackOption: createAttack('Hack'),
            target: createCreature(),
            levelDifficulty: 0,
        },
        {
            ...baseDeps,
            isLikelyNonMaterial: () => true,
        },
    );

    assert.equal(damage, 0);
});

test('determineMeleeDamage returns zero when the hit check fails and luck does not save it', () => {
    const damage = determineMeleeDamage(
        {
            champion: createChampion(),
            equip: { rightHand: createItem() } as ChampionEquipment,
            inventory: [],
            currentVitals: createVitals(),
            currentStamina: 60,
            attackOption: createAttack('Hack'),
            target: createCreature(),
            levelDifficulty: 20,
        },
        {
            ...baseDeps,
            computeQuickness: () => 5,
            randomInt: (maxExclusive: number) => maxExclusive - 1,
        },
    );

    assert.equal(damage, 0);
});

test('determineMeleeDamage produces positive damage on a successful standard hit', () => {
    const damage = determineMeleeDamage(
        {
            champion: createChampion(),
            equip: { rightHand: createItem('Ordinary Sword') } as ChampionEquipment,
            inventory: [],
            currentVitals: createVitals(),
            currentStamina: 60,
            attackOption: createAttack('Hack', 48),
            target: createCreature(),
            levelDifficulty: 0,
        },
        baseDeps,
    );

    assert.equal(damage, 2);
    assert.ok(damage > 0);
});

test('determineMeleeDamage halves vorpal damage against material targets', () => {
    const baseDamage = determineMeleeDamage(
        {
            champion: createChampion(),
            equip: { rightHand: createItem('Ordinary Sword') } as ChampionEquipment,
            inventory: [],
            currentVitals: createVitals(),
            currentStamina: 60,
            attackOption: createAttack('Hack', 48),
            target: createCreature(),
            levelDifficulty: 0,
        },
        baseDeps,
    );

    const vorpalDamage = determineMeleeDamage(
        {
            champion: createChampion(),
            equip: { rightHand: createItem('Vorpal Blade') } as ChampionEquipment,
            inventory: [],
            currentVitals: createVitals(),
            currentStamina: 60,
            attackOption: createAttack('Hack', 48),
            target: createCreature(),
            levelDifficulty: 0,
        },
        baseDeps,
    );

    assert.equal(vorpalDamage, Math.floor(baseDamage / 2));
});

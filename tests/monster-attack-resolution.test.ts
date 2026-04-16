import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureDef, OriginalAttackType } from '../src/data/creatures.js';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import type { ActivePotionBoost, ChampionVitals } from '../src/engine/runtimeTypes.js';
import { resolveMonsterAttackAgainstChampion } from '../src/engine/systems/monsterAttackResolution.js';

function createChampion(): Champion {
    return {
        id: 1,
        name: 'Tiggy',
        title: 'The Target',
        gender: 'F',
        class: 'Wizard',
        health: 90,
        stamina: 70,
        mana: 40,
        luck: 12,
        strength: 18,
        dexterity: 24,
        wisdom: 28,
        vitality: 22,
        antiMagic: 10,
        antiFire: 8,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [1, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: 'portrait.png',
    };
}

function createVitals(): ChampionVitals {
    return {
        hp: 30,
        stamina: 30,
        mana: 20,
        food: 900,
        water: 900,
        currentStats: {
            luck: 12,
            strength: 18,
            dexterity: 24,
            wisdom: 28,
            vitality: 22,
            antiMagic: 10,
            antiFire: 8,
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

function createCreatureDef(overrides: Partial<CreatureDef> = {}): CreatureDef {
    return {
        id: 99,
        name: 'Mock Beast',
        sizeOnTile: 0,
        baseHP: 40,
        armor: 10,
        hitProb: 20,
        atkSpd: 8,
        moveSpd: 8,
        exp: 10,
        poison: false,
        originalAttackType: 'Blunt',
        attackTypes: [],
        drops: [],
        fixedDrops: [],
        rawAttack: 32,
        poisonAttack: 0,
        dexterity: 10,
        fireResistance: 0,
        poisonResistance: 0,
        nonMaterial: false,
        attackAnyChampion: false,
        attackFromAllSides: false,
        attackRange: 1,
        sightRange: 8,
        preferBackRow: false,
        levitates: false,
        absorbMissiles: false,
        seeInvisible: false,
        fearResistance: 0,
        archenemy: false,
        ...overrides,
    };
}

function createItem(id: string): FloorItem {
    return {
        id,
        category: 'Weapon',
        typeId: 1,
        rawName: id,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

const activePotionBoosts: ActivePotionBoost[] = [];
const targetChampion = createChampion();
const targetEquipment: ChampionEquipment = {};
const targetInventory = [createItem('stick')];

test('resolveMonsterAttackAgainstChampion returns zero when the target dodges the hit', () => {
    const resolution = resolveMonsterAttackAgainstChampion(
        {
            targetChampion,
            targetVitals: createVitals(),
            targetEquipment,
            targetInventory,
            activePotionBoosts,
            attackerDef: createCreatureDef(),
            attackMode: 'melee',
            levelDifficulty: 0,
            nowMs: 1000,
        },
        {
            randomInt: ((rolls: number[]) => () => rolls.shift() ?? 0)([0, 0, 1]),
            computeQuickness: () => 99,
            getRuntimeBonuses: () => ({}),
            getEffectiveChampionStats: () => ({ luck: 12, stamina: 30, vitality: 22 }),
            isCharacterLucky: () => false,
            chooseChampionWoundSlots: () => ['torso'],
            resolveIncomingAttack: () => {
                throw new Error('resolveIncomingAttack should not run when the hit is dodged');
            },
            clampVital: (value, max) => Math.max(0, Math.min(max, value)),
            adjustByAttribute: (value) => value,
            applyPoison: (vitals) => vitals,
        },
    );

    assert.equal(resolution.damage, 0);
    assert.equal(resolution.nextVitals.hp, 30);
});

test('resolveMonsterAttackAgainstChampion applies stamina drain and poison after a successful hit', () => {
    let poisonStrength = 0;
    const baseNextVitals = {
        ...createVitals(),
        hp: 24,
        stamina: 30,
    };

    const resolution = resolveMonsterAttackAgainstChampion(
        {
            targetChampion,
            targetVitals: createVitals(),
            targetEquipment,
            targetInventory,
            activePotionBoosts,
            attackerDef: createCreatureDef({
                attackTypes: ['StaminaDrain'],
                poisonAttack: 7,
            }),
            attackMode: 'melee',
            levelDifficulty: 0,
            nowMs: 1000,
        },
        {
            randomInt: ((rolls: number[]) => () => rolls.shift() ?? 0)([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
            computeQuickness: () => -1,
            getRuntimeBonuses: () => ({}),
            getEffectiveChampionStats: () => ({ luck: 12, stamina: 40, vitality: 20 }),
            isCharacterLucky: () => false,
            chooseChampionWoundSlots: () => ['torso'],
            resolveIncomingAttack: () => ({
                damage: 6,
                nextVitals: baseNextVitals,
            }),
            clampVital: (value, max) => Math.max(0, Math.min(max, value)),
            adjustByAttribute: (value) => {
                poisonStrength = value;
                return value;
            },
            applyPoison: (vitals, strength) => ({
                ...vitals,
                hp: vitals.hp - 1,
                poisonEntries: [...vitals.poisonEntries, { remaining: strength, nextTickIn: 4 }],
            }),
        },
    );

    assert.equal(resolution.damage, 6);
    assert.equal(resolution.nextVitals.stamina, 27);
    assert.equal(poisonStrength, 7);
    assert.equal(resolution.nextVitals.hp, 23);
    assert.equal(resolution.nextVitals.poisonEntries.length, 1);
});

test('resolveMonsterAttackAgainstChampion resolves ranged magical attacks without hit zones', () => {
    let capturedAttackType: OriginalAttackType | null = null;

    const resolution = resolveMonsterAttackAgainstChampion(
        {
            targetChampion,
            targetVitals: createVitals(),
            targetEquipment,
            targetInventory,
            activePotionBoosts,
            attackerDef: createCreatureDef({
                originalAttackType: 'Blunt',
                attackTypes: ['Magic'],
                attackRange: 4,
            }),
            attackMode: 'ranged',
            levelDifficulty: 0,
            nowMs: 1000,
        },
        {
            randomInt: () => 0,
            computeQuickness: () => -1,
            getRuntimeBonuses: () => ({}),
            getEffectiveChampionStats: () => ({ luck: 12, stamina: 30, vitality: 22 }),
            isCharacterLucky: () => false,
            chooseChampionWoundSlots: (hitZones) => {
                assert.equal(hitZones, undefined);
                return ['torso'];
            },
            resolveIncomingAttack: (_champion, currentVitals, _rawAttack, attackType) => {
                capturedAttackType = attackType;
                return {
                    damage: 4,
                    nextVitals: {
                        ...currentVitals,
                        hp: currentVitals.hp - 4,
                    },
                };
            },
            clampVital: (value, max) => Math.max(0, Math.min(max, value)),
            adjustByAttribute: (value) => value,
            applyPoison: (vitals) => vitals,
        },
    );

    assert.equal(capturedAttackType, 'Magic');
    assert.equal(resolution.damageClass, 'magic');
    assert.equal(resolution.hitZones, undefined);
    assert.equal(resolution.nextVitals.hp, 26);
});

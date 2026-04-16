import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureDef } from '../src/data/creatures.js';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../src/types/game.js';
import type { ChampionVitals, Projectile } from '../src/engine/runtimeTypes.js';
import { resolveCreatureAttackState } from '../src/engine/systems/creatureAttackState.js';

function createChampion(): Champion {
    return {
        id: 1,
        name: 'Halk',
        title: 'The Tested',
        gender: 'M',
        class: 'Fighter',
        health: 80,
        stamina: 70,
        mana: 10,
        luck: 15,
        strength: 25,
        dexterity: 20,
        wisdom: 8,
        vitality: 18,
        antiMagic: 6,
        antiFire: 4,
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
        hp: 35,
        stamina: 30,
        mana: 5,
        food: 900,
        water: 900,
        currentStats: {
            luck: 15,
            strength: 25,
            dexterity: 20,
            wisdom: 8,
            vitality: 18,
            antiMagic: 6,
            antiFire: 4,
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
        id: 'creature-1',
        typeId: 19,
        mapIndex: 0,
        x: 5,
        y: 6,
        currentHP: 40,
        cell: 'frontLeft',
        alive: true,
        carriedItems: [],
        ...overrides,
    };
}

function createDef(overrides: Partial<CreatureDef> = {}): CreatureDef {
    return {
        id: 19,
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
        category: 'Misc',
        typeId: 1,
        rawName: id,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

test('resolveCreatureAttackState returns a projectile when ranged attack launch is chosen', () => {
    const targetChampion = createChampion();
    const targetVitals = createVitals();
    const projectile: Projectile = {
        id: 'proj-1',
        level: 0,
        x: 5,
        y: 6,
        direction: 'WEST',
        effect: 'fireball',
        launchedBy: 'creature',
        sourceCreatureId: 'creature-1',
        targetChampionId: targetChampion.id,
        damage: [1, 20],
        nextMoveAt: 1000,
        remainingRange: 20,
        remainingAttack: 10,
        stepDecay: 8,
        visualScale: 1,
    };

    const result = resolveCreatureAttackState(
        {
            state: {
                position: [6, 6],
                activePotionBoosts: [],
            },
            creature: createCreature(),
            attackerDef: createDef({ attackRange: 4 }),
            creatureProjectileEffect: 'fireball',
            shouldLaunchProjectile: true,
            adjacentAfterMove: false,
            targetChampion,
            targetVitals,
            targetInventory: [],
            targetEquipment: {},
            levelDifficulty: 4,
            nowMs: 1000,
        },
        {
            randomInt: () => 0,
            buildProjectile: () => projectile,
            getEffectiveChampionStats: () => ({ dexterity: 20, luck: 15 }),
            tryStealChampionItem: () => ({
                stolenItem: null,
                nextInventory: [],
                nextEquipment: {},
                shouldFlee: false,
            }),
            isCharacterLucky: () => false,
            resolveMonsterAttackAgainstChampion: () => ({
                damage: 0,
                hitZones: undefined,
                damageClass: 'physical',
                nextVitals: targetVitals,
            }),
        },
    );

    assert.deepEqual(result, { kind: 'projectile', projectile });
});

test('resolveCreatureAttackState returns a steal result when a steal attack succeeds', () => {
    const targetChampion = createChampion();
    const targetVitals = createVitals();
    const stolenItem = createItem('compass');
    const nextEquipment: ChampionEquipment = { torso: undefined };

    const result = resolveCreatureAttackState(
        {
            state: {
                position: [6, 6],
                activePotionBoosts: [],
            },
            creature: createCreature({ typeId: 5 }),
            attackerDef: createDef({ attackTypes: ['Steal'] }),
            creatureProjectileEffect: null,
            shouldLaunchProjectile: false,
            adjacentAfterMove: true,
            targetChampion,
            targetVitals,
            targetInventory: [createItem('apple')],
            targetEquipment: { torso: createItem('mail') },
            levelDifficulty: 4,
            nowMs: 1000,
        },
        {
            randomInt: () => 0,
            buildProjectile: () => {
                throw new Error('buildProjectile should not run for steal attacks');
            },
            getEffectiveChampionStats: () => ({ dexterity: 20, luck: 15 }),
            tryStealChampionItem: () => ({
                stolenItem,
                nextInventory: [],
                nextEquipment,
                shouldFlee: true,
            }),
            isCharacterLucky: () => false,
            resolveMonsterAttackAgainstChampion: () => ({
                damage: 0,
                hitZones: undefined,
                damageClass: 'physical',
                nextVitals: targetVitals,
            }),
        },
    );

    assert.deepEqual(result, {
        kind: 'steal',
        targetChampionId: targetChampion.id,
        stolenItem,
        nextInventory: [],
        nextEquipment,
        shouldFlee: true,
    });
});

test('resolveCreatureAttackState returns damage when a normal attack lands', () => {
    const targetChampion = createChampion();
    const targetVitals = createVitals();
    const nextVitals = {
        ...targetVitals,
        hp: 29,
    };

    const result = resolveCreatureAttackState(
        {
            state: {
                position: [6, 6],
                activePotionBoosts: [],
            },
            creature: createCreature(),
            attackerDef: createDef(),
            creatureProjectileEffect: null,
            shouldLaunchProjectile: false,
            adjacentAfterMove: true,
            targetChampion,
            targetVitals,
            targetInventory: [],
            targetEquipment: {},
            levelDifficulty: 4,
            nowMs: 1000,
        },
        {
            randomInt: () => 0,
            buildProjectile: () => {
                throw new Error('buildProjectile should not run for melee damage');
            },
            getEffectiveChampionStats: () => ({ dexterity: 20, luck: 15 }),
            tryStealChampionItem: () => ({
                stolenItem: null,
                nextInventory: [],
                nextEquipment: {},
                shouldFlee: false,
            }),
            isCharacterLucky: () => false,
            resolveMonsterAttackAgainstChampion: () => ({
                damage: 6,
                hitZones: ['torso'],
                damageClass: 'physical',
                nextVitals,
            }),
        },
    );

    assert.deepEqual(result, {
        kind: 'damage',
        targetChampionId: targetChampion.id,
        damage: 6,
        nextVitals,
    });
});

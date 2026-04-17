import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureDef } from '../src/data/creatures.js';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, CreatureInstance } from '../src/types/game.js';
import type { ChampionVitals, DamageEvent, Projectile } from '../src/engine/runtimeTypes.js';
import type { MonsterAttackResolution } from '../src/engine/systems/monsterAttackResolution.js';
import { resolveMonsterAttackTurn } from '../src/engine/systems/monsterAttackTurn.js';

function createCreature(id: string, overrides: Partial<CreatureInstance> = {}): CreatureInstance {
    return {
        id,
        typeId: 1,
        mapIndex: 0,
        x: 5,
        y: 4,
        currentHP: 10,
        alive: true,
        cell: 'backLeft',
        carriedItems: [],
        ...overrides,
    };
}

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champ ${id}`,
        title: 'The Target',
        gender: 'M',
        class: 'Fighter',
        health: 100,
        stamina: 100,
        mana: 10,
        luck: 10,
        strength: 10,
        dexterity: 10,
        wisdom: 10,
        vitality: 10,
        antiMagic: 10,
        antiFire: 10,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: 'portrait.png',
    };
}

function createVitals(hp: number): ChampionVitals {
    return {
        hp,
        stamina: 50,
        mana: 10,
        food: 900,
        water: 900,
        currentStats: {
            luck: 10,
            strength: 10,
            dexterity: 10,
            wisdom: 10,
            vitality: 10,
            antiMagic: 10,
            antiFire: 10,
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
        id: 1,
        name: 'Test Creature',
        sizeOnTile: 0,
        baseHP: 10,
        armor: 0,
        hitProb: 100,
        atkSpd: 10,
        moveSpd: 10,
        exp: 0,
        poison: false,
        originalAttackType: 'Impact',
        attackTypes: ['Physical'],
        drops: [],
        fixedDrops: [],
        rawAttack: 8,
        poisonAttack: 0,
        dexterity: 10,
        fireResistance: 0,
        poisonResistance: 0,
        nonMaterial: false,
        archenemy: false,
        attackAnyChampion: false,
        attackFromAllSides: false,
        attackRange: 1,
        sightRange: 4,
        preferBackRow: false,
        levitates: false,
        absorbMissiles: false,
        seeInvisible: false,
        fearResistance: 0,
        ...overrides,
    };
}

const baseDeps = {
    randomInt: () => 1,
    chooseCreatureProjectileEffect: () => null,
    getCreatureSizeOnTile: () => 0,
    isCreatureCellOccupiedOnTile: () => false,
    nextMonsterMoveDelaySeconds: () => 0.6,
    nextMonsterAttackDelaySeconds: () => 0.8,
    buildProjectile: () => ({}) as Projectile,
    getEffectiveChampionStats: () => ({ dexterity: 10, luck: 10 }),
    tryStealChampionItem: () => ({
        stolenItem: null,
        nextInventory: [],
        nextEquipment: {} as ChampionEquipment,
        nextVitals: createVitals(20),
        shouldFlee: false,
    }),
    resolveMonsterAttackAgainstChampion: (): MonsterAttackResolution => ({
        damage: 4,
        damageClass: 'physical',
        nextVitals: createVitals(16),
    }),
    buildChampionDamageEvent: (_level: number, championId: number, amount: number): DamageEvent => ({
        id: `dmg-${championId}`,
        level: 0,
        target: 'champion',
        championId,
        amount,
        ts: 0,
    }),
    attackWindowMs: 1200,
};

test('resolveMonsterAttackTurn returns contact advance before opening an attack', () => {
    const creature = createCreature('rear', { cell: 'backRight' });

    const result = resolveMonsterAttackTurn(
        {
            creature,
            attackerDef: createCreatureDef(),
            creatures: [creature],
            stateCreatures: [creature],
            projectiles: [],
            stateProjectiles: [],
            championInventories: {},
            championEquipment: {},
            baseChampionEquipment: {},
            championVitals: { 1: createVitals(20) },
            damageEvents: [],
            party: [createChampion(1)],
            activePotionBoosts: [],
            partyPosition: [5, 5],
            movedPosition: { x: 5, y: 4 },
            movedThisTick: false,
            canDetectParty: true,
            frightened: false,
            confused: false,
            attackReach: 1,
            currentAttackTimer: 0,
            nowMs: 1000,
            level: 0,
            levelDifficulty: 2,
            partySleeping: false,
        },
        baseDeps,
    );

    assert.equal(result.kind, 'contactAdvance');
    assert.equal(result.targetCell, 'frontRight');
    assert.equal(result.nextMoveTimer, 0.3);
});

test('resolveMonsterAttackTurn returns damage outcome and attack window for a valid target', () => {
    const creature = createCreature('front', { cell: 'frontLeft' });

    const result = resolveMonsterAttackTurn(
        {
            creature,
            attackerDef: createCreatureDef(),
            creatures: [creature],
            stateCreatures: [creature],
            projectiles: [],
            stateProjectiles: [],
            championInventories: { 1: [] },
            championEquipment: { 1: {} },
            baseChampionEquipment: {},
            championVitals: { 1: createVitals(20) },
            damageEvents: [],
            party: [createChampion(1)],
            activePotionBoosts: [],
            partyPosition: [5, 5],
            movedPosition: { x: 5, y: 4 },
            movedThisTick: false,
            canDetectParty: true,
            frightened: false,
            confused: false,
            attackReach: 1,
            currentAttackTimer: 0,
            nowMs: 1000,
            level: 0,
            levelDifficulty: 2,
            partySleeping: false,
        },
        baseDeps,
    );

    assert.equal(result.kind, 'damage');
    assert.equal(result.nextAttackTimer, 0.8);
    assert.equal(result.attackWindowExpiresAt, 2200);
    assert.equal(result.damageEvents?.[0]?.amount, 4);
    assert.equal(result.championVitals?.[1]?.hp, 16);
});

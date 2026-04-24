import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyChampionTemporaryXP, createEmptyChampionXP } from '../src/data/skillProgression.js';
import type { CreatureDef } from '../src/data/creatures.js';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, CreatureInstance } from '../src/types/game.js';
import type { DamageEvent, Projectile } from '../src/engine/runtimeTypes.js';
import type { MonsterAttackResolution } from '../src/engine/systems/monsterAttackResolution.js';
import { resolveMonsterSingleTurn } from '../src/engine/systems/monsterSingleTurn.js';

function createCreature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
    return {
        id: 'creature-1',
        typeId: 1,
        mapIndex: 0,
        x: 5,
        y: 4,
        currentHP: 12,
        alive: true,
        cell: 'frontLeft',
        carriedItems: [],
        ...overrides,
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
        moveSpd: 12,
        exp: 0,
        experienceClass: 0,
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
        sightRange: 1,
        smellRange: 10,
        preferBackRow: false,
        levitates: false,
        absorbMissiles: false,
        seeInvisible: false,
        fearResistance: 0,
        ...overrides,
    };
}

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champion ${id}`,
        title: 'Tester',
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
        portrait: '',
    };
}

function createVitals() {
    return {
        hp: 10,
        stamina: 10,
        mana: 0,
        food: 1000,
        water: 1000,
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

const emptyProjectile = (): Projectile => ({
    id: 'projectile-1',
    level: 0,
    x: 0,
    y: 0,
    direction: 'NORTH',
    effect: 'poison_bolt',
    launchedBy: 'creature',
    damage: [1, 1],
    nextMoveAt: 0,
});

test('resolveMonsterSingleTurn lets smell-driven pursuit move without playing a sight-based move sound', () => {
    const creature = createCreature();
    const championEquipment: Record<number, ChampionEquipment> = {};
    const damageEvents: DamageEvent[] = [];

    const result = resolveMonsterSingleTurn(
        {
            creature,
            creatureIndex: 0,
            creatureDef: createCreatureDef(),
            deltaSeconds: 0.1,
            nowMs: 1000,
            level: 0,
            levelDifficulty: 1,
            partyPosition: [4, 7],
            partyDirection: 'NORTH',
            party: [],
            championXP: {},
            championTemporaryXP: {},
            activePotionBoosts: [],
            invisibleUntil: 0,
            openTeleporters: new Set(),
            currentTimers: { mt: 0, at: 999 },
            lastSeen: undefined,
            confusedUntilMs: 0,
            fluxcageUntilMs: 0,
            frightenedUntilMs: 0,
            creatures: [creature],
            stateCreatures: [creature],
            projectiles: [],
            stateProjectiles: [],
            championInventories: {},
            championEquipment,
            baseChampionEquipment: championEquipment,
            championVitals: {},
            damageEvents,
            partySleeping: false,
            groupMovementPlans: new Map(),
            elapsedGameTimeTicks: 0,
            lastCreatureAttackGameTick: 0,
        },
        {
            randomFraction: () => 0,
            randomInt: () => 0,
            hasLineOfSight: () => true,
            nextMonsterMoveDelaySeconds: () => 0.6,
            nextMonsterAttackDelaySeconds: () => 1.2,
            monsterWalkable: () => true,
            canCreatureShareTile: () => true,
            canArchenemyDoubleMove: () => null,
            chooseCreatureProjectileEffect: () => null,
            getCreatureSizeOnTile: () => 0,
            isCreatureCellOccupiedOnTile: () => false,
            buildProjectile: emptyProjectile,
            getEffectiveChampionStats: () => ({ dexterity: 10, luck: 0 }),
            tryStealChampionItem: () => ({
                stolenItem: null,
                nextInventory: [],
                nextEquipment: {} as ChampionEquipment,
                nextVitals: createVitals(),
                shouldFlee: false,
            }),
            resolveMonsterAttackAgainstChampion: (): MonsterAttackResolution => ({
                damage: 0,
                damageClass: 'physical',
                nextVitals: createVitals(),
            }),
            buildChampionSkillExperiencePatch: () => ({
                championXP: { 1: createEmptyChampionXP() },
                championTemporaryXP: { 1: createEmptyChampionTemporaryXP() },
            }),
            buildChampionDamageEvent: (level, championId, amount) => ({
                id: `dmg-${championId}`,
                level,
                target: 'champion',
                championId,
                amount,
                ts: 0,
            }),
            attackWindowMs: 500,
            buildFrightenedUntilMs: (nowMs) => nowMs + 1000,
            getTile: () => undefined,
            getTeleporter: () => undefined,
            resolveCreatureTeleporterTransport: (_state, level, x, y, _direction, cell) => ({ level, x, y, cell }),
            normalizeCreatureCellsOnTile: (creatures) => creatures,
        },
    );

    assert.equal(result.notifyMove, true);
    assert.equal(result.movementSound, null);
});

test('resolveMonsterSingleTurn applies the original post-attack behavior delay to both timers', () => {
    const creature = createCreature();
    const championEquipment: Record<number, ChampionEquipment> = { 1: {} };

    const result = resolveMonsterSingleTurn(
        {
            creature,
            creatureIndex: 0,
            creatureDef: createCreatureDef({ nextBehaviorUpdateAfterAttackTicks: 4 }),
            deltaSeconds: 0.1,
            nowMs: 1000,
            level: 0,
            levelDifficulty: 1,
            partyPosition: [5, 5],
            partyDirection: 'NORTH',
            party: [createChampion(1)],
            championXP: { 1: createEmptyChampionXP() },
            championTemporaryXP: { 1: createEmptyChampionTemporaryXP() },
            activePotionBoosts: [],
            invisibleUntil: 0,
            openTeleporters: new Set(),
            currentTimers: { mt: 0, at: 0 },
            lastSeen: undefined,
            confusedUntilMs: 0,
            fluxcageUntilMs: 0,
            frightenedUntilMs: 0,
            creatures: [creature],
            stateCreatures: [creature],
            projectiles: [],
            stateProjectiles: [],
            championInventories: { 1: [] },
            championEquipment,
            baseChampionEquipment: championEquipment,
            championVitals: { 1: createVitals() },
            damageEvents: [],
            partySleeping: false,
            groupMovementPlans: new Map(),
            elapsedGameTimeTicks: 0,
            lastCreatureAttackGameTick: 0,
        },
        {
            randomFraction: () => 0,
            randomInt: () => 0,
            hasLineOfSight: () => true,
            nextMonsterMoveDelaySeconds: () => 0.2,
            nextMonsterAttackDelaySeconds: () => 0.4,
            nextMonsterBehaviorUpdateAfterAttackDelaySeconds: () => 0.75,
            monsterWalkable: () => true,
            canCreatureShareTile: () => true,
            canArchenemyDoubleMove: () => null,
            chooseCreatureProjectileEffect: () => null,
            getCreatureSizeOnTile: () => 0,
            isCreatureCellOccupiedOnTile: () => false,
            buildProjectile: emptyProjectile,
            getEffectiveChampionStats: () => ({ dexterity: 10, luck: 0 }),
            tryStealChampionItem: () => ({
                stolenItem: null,
                nextInventory: [],
                nextEquipment: {} as ChampionEquipment,
                nextVitals: createVitals(),
                shouldFlee: false,
            }),
            resolveMonsterAttackAgainstChampion: (): MonsterAttackResolution => ({
                damage: 3,
                damageClass: 'physical',
                nextVitals: {
                    ...createVitals(),
                    hp: 7,
                },
            }),
            buildChampionSkillExperiencePatch: () => null,
            buildChampionDamageEvent: (level, championId, amount) => ({
                id: `dmg-${championId}`,
                level,
                target: 'champion',
                championId,
                amount,
                ts: 0,
            }),
            attackWindowMs: 500,
            buildFrightenedUntilMs: (nowMs) => nowMs + 1000,
            getTile: () => undefined,
            getTeleporter: () => undefined,
            resolveCreatureTeleporterTransport: (_state, level, x, y, _direction, cell) => ({ level, x, y, cell }),
            normalizeCreatureCellsOnTile: (creatures) => creatures,
        },
    );

    assert.equal(result.attackTimer, 0.75);
    assert.equal(result.moveTimer, 0.75);
    assert.equal(result.notifyAttack, true);
    assert.equal(result.shouldPlayChampionWounded, true);
    assert.equal(result.championVitals[1]?.hp, 7);
});

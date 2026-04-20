import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import type {
    ActivePoisonCloud,
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    PartyShield,
    Projectile,
    SpellVisualEvent,
} from '../src/engine/runtimeTypes.js';
import { applyProjectilePartyHit } from '../src/engine/systems/tickProjectilePartyHit.js';

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champion ${id}`,
        title: 'The Test',
        gender: 'M',
        class: 'Fighter',
        health: 100,
        stamina: 100,
        mana: 30,
        luck: 10,
        strength: 10,
        dexterity: 10,
        wisdom: 10,
        vitality: 10,
        antiMagic: 0,
        antiFire: 0,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: 'test.png',
    };
}

function createVitals(overrides: Partial<ChampionVitals> = {}): ChampionVitals {
    return {
        hp: 50,
        stamina: 40,
        mana: 20,
        food: 500,
        water: 500,
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
        ...overrides,
    };
}

function createProjectile(overrides: Partial<Projectile> = {}): Projectile {
    return {
        id: 'proj-1',
        level: 0,
        x: 3,
        y: 3,
        direction: 'NORTH',
        effect: 'fireball',
        launchedBy: 'creature',
        targetChampionId: 1,
        damage: [4, 8],
        nextMoveAt: 1000,
        remainingRange: 6,
        remainingAttack: 10,
        visualScale: 1.2,
        ...overrides,
    };
}

function createState(overrides: Partial<{
    level: number;
    position: [number, number];
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    deadChampions: Record<number, Champion>;
    selectedChampionIndex: number;
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    activePoisonClouds: ActivePoisonCloud[];
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    championCombat: Record<number, ChampionCombat>;
    lastCreatureAttackGameTick: number;
}> = {}) {
    return {
        level: 0,
        position: [3, 3] as [number, number],
        party: [createChampion(1)],
        championVitals: { 1: createVitals() },
        championInventories: {} as Record<number, FloorItem[]>,
        championEquipment: {} as Record<number, ChampionEquipment>,
        floorItems: [] as FloorItem[],
        deadChampions: {} as Record<number, Champion>,
        selectedChampionIndex: 0,
        damageEvents: [] as DamageEvent[],
        spellVisualEvents: [] as SpellVisualEvent[],
        activePoisonClouds: [] as ActivePoisonCloud[],
        activeShields: [] as PartyShield[],
        activePotionBoosts: [] as ActivePotionBoost[],
        championCombat: {} as Record<number, ChampionCombat>,
        lastCreatureAttackGameTick: 0,
        ...overrides,
    };
}

test('applyProjectilePartyHit applies direct champion damage and emits a party impact visual', () => {
    const result = applyProjectilePartyHit(
        createProjectile({ effect: 'physical', explosionOnImpact: 'fireball', explosionAttack: 8 }),
        0,
        3,
        3,
        10,
        1000,
        createState(),
        {
            resolveProjectileImpact: () => ({ damage: 7, attackType: 'Blunt', poisonAttack: 0 }),
            resolveChampionIncomingAttack: (_state, _champion, currentVitals) => ({
                damage: 7,
                nextVitals: { ...currentVitals, hp: currentVitals.hp - 7 },
            }),
            buildChampionDamageEvent: (level, championId, amount) => ({
                id: 'damage-1',
                level,
                target: 'champion',
                championId,
                amount,
                ts: 1000,
            }),
            applyPoisonCharacter: (vitals) => vitals,
            randomInt: () => 0,
            buildDeathDrop: () => {
                throw new Error('death drop should not happen here');
            },
            applyPartySpellBacklashDamage: () => null,
            applyPartyWideIncomingAttack: () => null,
            rollExplosionBurstAttack: () => 0,
            buildActivePoisonCloud: () => {
                throw new Error('poison cloud should not be created');
            },
            buildDroppedItem: (item, level, x, y) => ({ ...item, mapIndex: level, x, y, tilePos: 'North' }),
            getThrownExplosionVisualScale: () => 1.5,
            gridSize: 2,
        },
    );

    assert.equal(result.championVitals[1]?.hp, 43);
    assert.equal(result.damageEvents.length, 1);
    assert.equal(result.spellVisualEvents.length, 1);
    assert.equal(result.spellVisualEvents[0]?.effect, 'fireball');
});

test('applyProjectilePartyHit applies party backlash for fireball and lightning impacts', () => {
    let backlashCalled = false;
    const result = applyProjectilePartyHit(
        createProjectile({ effect: 'fireball' }),
        0,
        3,
        3,
        10,
        1000,
        createState(),
        {
            resolveProjectileImpact: () => ({ damage: 0, attackType: 'Magic', poisonAttack: 0 }),
            resolveChampionIncomingAttack: () => {
                throw new Error('direct champion hit should not be resolved when damage is zero');
            },
            buildChampionDamageEvent: () => {
                throw new Error('no direct event expected');
            },
            applyPoisonCharacter: (vitals) => vitals,
            randomInt: () => 0,
            buildDeathDrop: () => {
                throw new Error('death drop should not happen here');
            },
            applyPartySpellBacklashDamage: (state, championVitals) => {
                backlashCalled = true;
                return {
                    championVitals: {
                        ...championVitals,
                        1: { ...championVitals[1]!, hp: 41 },
                    },
                    damageEvents: [
                        ...state.damageEvents,
                        {
                            id: 'splash-1',
                            level: 0,
                            target: 'champion',
                            championId: 1,
                            amount: 9,
                            ts: 1000,
                        },
                    ],
                };
            },
            applyPartyWideIncomingAttack: () => null,
            rollExplosionBurstAttack: () => 9,
            buildActivePoisonCloud: () => {
                throw new Error('poison cloud should not be created');
            },
            buildDroppedItem: (item, level, x, y) => ({ ...item, mapIndex: level, x, y, tilePos: 'North' }),
            getThrownExplosionVisualScale: () => 1,
            gridSize: 2,
        },
    );

    assert.equal(backlashCalled, true);
    assert.equal(result.championVitals[1]?.hp, 41);
    assert.equal(result.damageEvents.length, 1);
    assert.equal(result.spellVisualEvents[0]?.effect, 'fireball');
});

test('applyProjectilePartyHit turns poison cloud impacts into lingering active clouds', () => {
    let poisonSplashCalled = false;
    const result = applyProjectilePartyHit(
        createProjectile({ effect: 'poison_cloud', remainingRange: 5 }),
        0,
        3,
        3,
        12,
        1000,
        createState(),
        {
            resolveProjectileImpact: () => ({ damage: 0, attackType: 'Magic', poisonAttack: 0 }),
            resolveChampionIncomingAttack: () => {
                throw new Error('direct champion hit should not run');
            },
            buildChampionDamageEvent: () => {
                throw new Error('no direct event expected');
            },
            applyPoisonCharacter: (vitals) => vitals,
            randomInt: () => 0,
            buildDeathDrop: () => {
                throw new Error('death drop should not happen here');
            },
            applyPartySpellBacklashDamage: () => null,
            applyPartyWideIncomingAttack: (_state, championVitals) => {
                poisonSplashCalled = true;
                return { championVitals };
            },
            rollExplosionBurstAttack: () => 4,
            buildActivePoisonCloud: (level, x, y, attack, currentGameTick, visualScale) => ({
                id: 'cloud-1',
                level,
                x,
                y,
                remainingAttack: attack,
                nextPulseGameTick: currentGameTick,
                visualScale,
            }),
            buildDroppedItem: (item, level, x, y) => ({ ...item, mapIndex: level, x, y, tilePos: 'North' }),
            getThrownExplosionVisualScale: () => 1,
            gridSize: 2,
        },
    );

    assert.equal(poisonSplashCalled, true);
    assert.equal(result.activePoisonClouds.length, 1);
    assert.equal(result.activePoisonClouds[0]?.remainingAttack, 5);
    assert.equal(result.spellVisualEvents[0]?.effect, 'poison_cloud');
});

test('applyProjectilePartyHit preserves direct-hit nextVitals even when no damage event is emitted', () => {
    const result = applyProjectilePartyHit(
        createProjectile({ effect: 'lightning' }),
        0,
        3,
        3,
        10,
        1000,
        createState(),
        {
            resolveProjectileImpact: () => ({ damage: 5, attackType: 'Magic', poisonAttack: 0 }),
            resolveChampionIncomingAttack: (_state, _champion, currentVitals) => ({
                damage: 0,
                nextVitals: {
                    ...currentVitals,
                    currentStats: {
                        ...currentVitals.currentStats,
                        luck: currentVitals.currentStats.luck + 2,
                    },
                },
            }),
            buildChampionDamageEvent: () => {
                throw new Error('no direct event expected');
            },
            applyPoisonCharacter: (vitals) => vitals,
            randomInt: () => 0,
            buildDeathDrop: () => {
                throw new Error('death drop should not happen here');
            },
            applyPartySpellBacklashDamage: () => null,
            applyPartyWideIncomingAttack: () => null,
            rollExplosionBurstAttack: () => 0,
            buildActivePoisonCloud: () => {
                throw new Error('poison cloud should not be created');
            },
            buildDroppedItem: (item, level, x, y) => ({ ...item, mapIndex: level, x, y, tilePos: 'North' }),
            getThrownExplosionVisualScale: () => 1,
            gridSize: 2,
        },
    );

    assert.equal(result.championVitals[1]?.currentStats.luck, 12);
    assert.equal(result.damageEvents.length, 0);
});

test('applyProjectilePartyHit only drops a poisoned champion once when poison delivers the kill', () => {
    let deathDropCalls = 0;

    const result = applyProjectilePartyHit(
        createProjectile({ effect: 'poison_bolt' }),
        0,
        3,
        3,
        10,
        1000,
        createState({
            championVitals: {
                1: createVitals({ hp: 2 }),
            },
        }),
        {
            resolveProjectileImpact: () => ({ damage: 1, attackType: 'Magic', poisonAttack: 64 }),
            resolveChampionIncomingAttack: (_state, _champion, currentVitals) => ({
                damage: 1,
                nextVitals: { ...currentVitals, hp: currentVitals.hp - 1 },
            }),
            buildChampionDamageEvent: (level, championId, amount) => ({
                id: 'damage-1',
                level,
                target: 'champion',
                championId,
                amount,
                ts: 1000,
            }),
            applyPoisonCharacter: (vitals) => ({
                ...vitals,
                hp: 0,
                poisonEntries: [...vitals.poisonEntries, { remaining: 63, nextTickIn: 4 }],
            }),
            randomInt: () => 1,
            buildDeathDrop: (state, championId) => {
                deathDropCalls += 1;
                return {
                    party: state.party.filter((champion) => champion.id !== championId),
                    floorItems: state.floorItems,
                    championInventories: state.championInventories,
                    championEquipment: state.championEquipment,
                    deadChampions: { ...state.deadChampions, [championId]: createChampion(championId) },
                };
            },
            applyPartySpellBacklashDamage: () => null,
            applyPartyWideIncomingAttack: () => null,
            rollExplosionBurstAttack: () => 0,
            buildActivePoisonCloud: () => {
                throw new Error('poison cloud should not be created');
            },
            buildDroppedItem: (item, level, x, y) => ({ ...item, mapIndex: level, x, y, tilePos: 'North' }),
            getThrownExplosionVisualScale: () => 1,
            gridSize: 2,
        },
    );

    assert.equal(deathDropCalls, 1);
    assert.equal(result.party.length, 0);
    assert.equal(result.deadChampions[1]?.id, 1);
});

test('applyProjectilePartyHit drops physical projectiles on the party square after impact', () => {
    const dagger: FloorItem = {
        id: 'dagger-1',
        category: 'Weapon',
        typeId: 8,
        rawName: 'Dagger',
        mapIndex: 0,
        x: 1,
        y: 1,
        tilePos: 'North',
    };

    const result = applyProjectilePartyHit(
        createProjectile({
            effect: 'physical',
            physicalItem: dagger,
            remainingAttack: 6,
        }),
        0,
        3,
        3,
        10,
        1000,
        createState(),
        {
            resolveProjectileImpact: () => ({ damage: 4, attackType: 'Blunt', poisonAttack: 0 }),
            resolveChampionIncomingAttack: (_state, _champion, currentVitals) => ({
                damage: 4,
                nextVitals: { ...currentVitals, hp: currentVitals.hp - 4 },
            }),
            buildChampionDamageEvent: (level, championId, amount) => ({
                id: 'damage-physical',
                level,
                target: 'champion',
                championId,
                amount,
                ts: 1000,
            }),
            applyPoisonCharacter: (vitals) => vitals,
            randomInt: () => 0,
            buildDeathDrop: () => {
                throw new Error('death drop should not happen here');
            },
            applyPartySpellBacklashDamage: () => null,
            applyPartyWideIncomingAttack: () => null,
            rollExplosionBurstAttack: () => 0,
            buildActivePoisonCloud: () => {
                throw new Error('poison cloud should not be created');
            },
            buildDroppedItem: (item, level, x, y) => ({ ...item, mapIndex: level, x, y, tilePos: 'North' }),
            getThrownExplosionVisualScale: () => 1,
            gridSize: 2,
        },
    );

    assert.equal(result.championVitals[1]?.hp, 46);
    assert.deepEqual(result.floorItems, [{ ...dagger, mapIndex: 0, x: 3, y: 3, tilePos: 'South', projectileDropped: true }]);
});

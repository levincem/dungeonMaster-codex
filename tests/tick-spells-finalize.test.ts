import type { Champion } from '../src/types/champion.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type {
    ActiveFluxcage,
    ActivePoisonCloud,
    ActivePotionBoost,
    ChampionVitals,
    DamageEvent,
    FootprintEntry,
    PartyShield,
    Projectile,
    SpellLight,
    SpellVisualEvent,
} from '../src/engine/runtimeTypes.js';
import { buildTickSpellsPatch } from '../src/engine/systems/tickSpellsFinalize.js';

function createVitals(): ChampionVitals {
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
    };
}

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

function createState(overrides: Partial<{
    spellLights: SpellLight[];
    projectiles: Projectile[];
    creatures: never[];
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    floorItems: never[];
    openDoors: Set<string>;
    party: never[];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, never[]>;
    championEquipment: Record<number, object>;
    deadChampions: Record<number, Champion>;
    selectedChampionIndex: number;
    activePoisonClouds: ActivePoisonCloud[];
    activeFluxcages: ActiveFluxcage[];
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    footprintHistory: FootprintEntry[];
    lastCreatureAttackGameTick: number;
}> = {}) {
    return {
        spellLights: [] as SpellLight[],
        projectiles: [] as Projectile[],
        creatures: [],
        damageEvents: [] as DamageEvent[],
        spellVisualEvents: [] as SpellVisualEvent[],
        floorItems: [],
        openDoors: new Set<string>(),
        party: [],
        championVitals: { 1: createVitals() },
        championInventories: {},
        championEquipment: {},
        deadChampions: {} as Record<number, Champion>,
        selectedChampionIndex: 0,
        activePoisonClouds: [] as ActivePoisonCloud[],
        activeFluxcages: [] as ActiveFluxcage[],
        activeShields: [] as PartyShield[],
        activePotionBoosts: [] as ActivePotionBoost[],
        footprintHistory: [] as FootprintEntry[],
        lastCreatureAttackGameTick: 0,
        ...overrides,
    };
}

test('buildTickSpellsPatch returns null when nothing changed', () => {
    const state = createState();
    const result = buildTickSpellsPatch(
        state,
        {
            keepProjectiles: state.projectiles,
            creatures: state.creatures,
            damageEvents: state.damageEvents,
            spellVisualEvents: state.spellVisualEvents,
            floorItems: state.floorItems,
            openDoors: state.openDoors,
            party: state.party,
            championVitals: state.championVitals,
            championInventories: state.championInventories,
            championEquipment: state.championEquipment,
            deadChampions: state.deadChampions,
            selectedChampionIndex: state.selectedChampionIndex,
            activePoisonClouds: state.activePoisonClouds,
            lastCreatureAttackGameTick: state.lastCreatureAttackGameTick,
        },
        1000,
        {
            footprintLifetimeMs: 60000,
            damageEventLifetimeMs: 1500,
        },
    );

    assert.equal(result, null);
});

test('buildTickSpellsPatch filters expired timed spell state and includes changed runtime fields', () => {
    const state = createState({
        spellLights: [{ id: 'light-1', lightContrib: 1, expiresAt: 900 }],
        activeFluxcages: [{ id: 'flux-1', level: 0, x: 1, y: 1, expiresAt: 900 }],
        activeShields: [{ id: 'shield-1', defense: 5, expiresAt: 900 }],
        activePotionBoosts: [{ id: 'boost-1', championId: 1, stat: 'strength', amount: 5, expiresAt: 900 }],
        footprintHistory: [{ x: 1, y: 1, level: 0, ts: -70000 }],
        spellVisualEvents: [{ id: 'visual-1', level: 0, x: 1, y: 1, effect: 'fireball', ts: -2000, kind: 'wall' }],
        lastCreatureAttackGameTick: 1,
        deadChampions: { 1: createChampion(1) },
    });

    const nextProjectiles = [{ id: 'proj-1', level: 0, x: 1, y: 1, direction: 'NORTH', effect: 'fireball', damage: [1, 2], nextMoveAt: 1000 }] as Projectile[];
    const result = buildTickSpellsPatch(
        state,
        {
            keepProjectiles: nextProjectiles,
            creatures: state.creatures,
            damageEvents: state.damageEvents,
            spellVisualEvents: state.spellVisualEvents,
            floorItems: state.floorItems,
            openDoors: state.openDoors,
            party: state.party,
            championVitals: state.championVitals,
            championInventories: state.championInventories,
            championEquipment: state.championEquipment,
            deadChampions: state.deadChampions,
            selectedChampionIndex: state.selectedChampionIndex,
            activePoisonClouds: state.activePoisonClouds,
            lastCreatureAttackGameTick: 5,
        },
        1000,
        {
            footprintLifetimeMs: 60000,
            damageEventLifetimeMs: 1500,
        },
    );

    assert.ok(result);
    assert.deepEqual(result?.spellLights, []);
    assert.deepEqual(result?.activeFluxcages, []);
    assert.deepEqual(result?.activeShields, []);
    assert.deepEqual(result?.activePotionBoosts, []);
    assert.deepEqual(result?.footprintHistory, []);
    assert.deepEqual(result?.spellVisualEvents, []);
    assert.equal(result?.projectiles, nextProjectiles);
    assert.equal(result?.lastCreatureAttackGameTick, 5);
});

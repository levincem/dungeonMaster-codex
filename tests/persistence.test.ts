import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_VERSION } from '../src/appInfo.js';
import { DEFAULT_GAME_OPTIONS } from '../src/engine/options.js';
import { createEmptyChampionTemporaryXP, createEmptyChampionXP } from '../src/data/skillProgression.js';
import type { Champion } from '../src/types/champion.js';
import type { CreatureInstance, FloorItem } from '../src/types/game.js';
import type { ActivePoisonCloud, ChampionCombat, ChampionVitals, PartyShield, Projectile, SpellLight } from '../src/engine/runtimeTypes.js';
import {
    buildPersistedSaveData,
    computePersistedSaveIntegrity,
    hydratePersistedGameState,
    inspectPersistedSaveData,
    restoreExternalCreatureRuntimeFromSave,
    tryParsePersistedSaveData,
    type CreatureRuntimeMaps,
    type PersistableGameState,
} from '../src/engine/systems/persistence.js';

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champion ${id}`,
        title: 'The Tester',
        gender: 'M',
        class: 'Fighter',
        health: 120,
        stamina: 90,
        mana: 30,
        luck: 40,
        strength: 45,
        dexterity: 35,
        wisdom: 25,
        vitality: 50,
        antiMagic: 10,
        antiFire: 11,
        skills: {
            fighter: [1, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#ffffff',
        equipment: [],
        portrait: 'portrait.png',
    };
}

function createVitals(): ChampionVitals {
    return {
        hp: 80,
        stamina: 60,
        mana: 20,
        food: 1500,
        water: 1400,
        currentStats: {
            luck: 40,
            strength: 45,
            dexterity: 35,
            wisdom: 25,
            vitality: 50,
            antiMagic: 10,
            antiFire: 11,
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

function createFloorItem(): FloorItem {
    return {
        id: 'item-1',
        category: 'Weapon',
        typeId: 1,
        mapIndex: 0,
        x: 5,
        y: 6,
        tilePos: 'North',
    };
}

function createCreature(): CreatureInstance {
    return {
        id: 'creature-1',
        groupId: 'group-1',
        typeId: 1,
        mapIndex: 0,
        x: 2,
        y: 3,
        currentHP: 42,
        alive: true,
        cell: 'frontLeft',
    };
}

function createProjectile(nextMoveAt: number, physicalItem: FloorItem): Projectile {
    return {
        id: 'projectile-1',
        level: 0,
        x: 3,
        y: 4,
        direction: 'NORTH',
        effect: 'physical',
        damage: [4, 8],
        nextMoveAt,
        remainingRange: 6,
        remainingAttack: 5,
        stepDecay: 1,
        physicalItem,
    };
}

function createSpellLight(expiresAt: number): SpellLight {
    return {
        id: 'light-1',
        lightContrib: 0.5,
        expiresAt,
    };
}

function createShield(expiresAt: number): PartyShield {
    return {
        id: 'shield-1',
        defense: 14,
        kind: 'magic',
        expiresAt,
        championId: 1,
    };
}

function createPoisonCloud(): ActivePoisonCloud {
    return {
        id: 'cloud-1',
        level: 0,
        x: 8,
        y: 9,
        remainingAttack: 12,
        nextPulseGameTick: 777,
        visualScale: 1.1,
    };
}

function createRuntimeMaps(now: number): CreatureRuntimeMaps {
    return {
        creatureTimers: new Map([['creature-1', { mt: 9, at: 4 }]]),
        creatureAttackWindows: new Map([['creature-1', now + 1500]]),
        creatureConfusedUntil: new Map([['creature-1', now + 2500]]),
        creatureFluxcageUntil: new Map([['creature-1', now + 3500]]),
        creatureFrightenedUntil: new Map([['creature-1', now + 4500]]),
        creatureLastSeenPartyPos: new Map([['creature-1', { x: 12, y: 13, expiresAt: now + 5500 }]]),
    };
}

function createState(now: number): PersistableGameState {
    const champion = createChampion(1);
    const floorItem = createFloorItem();
    const spellLight = createSpellLight(now + 4000);
    const shield = createShield(now + 3000);
    const projectile = createProjectile(now + 2000, floorItem);
    const championCombat: Record<number, ChampionCombat> = {
        1: {
            cooldown: 1.2,
            cooldownMax: 2.4,
            defenseModifier: 3,
        },
    };

    return {
        gameOptions: DEFAULT_GAME_OPTIONS,
        level: 0,
        position: [1, 2],
        direction: 'NORTH',
        party: [champion],
        gateOpen: false,
        hydratedLevels: new Set([0, 1]),
        openDoors: new Set(['0,1,2']),
        brokenDoors: new Set(['0,1,2']),
        openPits: new Set(['0,4,5']),
        openTeleporters: new Set(['0,6,7']),
        openWalls: new Set(['0,8,9']),
        activeSensors: new Set(['sensor-a']),
        firedSensors: new Set(['sensor-b']),
        sensorRuntimeData: { 'sensor-a': 3 },
        sensorRotationOffsets: { 'sensor-a': 1 },
        visibleTexts: new Set(['text-a']),
        pendingSensorEvents: [{ id: 'pending-sensor' }],
        pendingGeneratorSpawns: [{ id: 'pending-generator' }],
        creatures: [createCreature()],
        floorItems: [floorItem],
        championInventories: { 1: [floorItem] },
        championEquipment: { 1: { rightHand: floorItem } },
        championVitals: { 1: createVitals() },
        championManaRegenBlockedUntilTick: { 1: 99 },
        elapsedGameTimeTicks: 1234,
        regenTickRemainder: 12,
        lastSurvivalEffectGameTick: 1200,
        freezeLifeRemainingTicks: 88,
        lastPartyMoveGameTick: 1222,
        movementCooldown: 0.4,
        championXP: { 1: createEmptyChampionXP() },
        championTemporaryXP: { 1: createEmptyChampionTemporaryXP() },
        championCombat,
        crushingDoors: { '0,1,2': { phase: 'closing', timer: 0.5 } },
        torchBurnStart: { 'torch-1': now - 600 },
        spellLights: [spellLight],
        projectiles: [projectile],
        activePoisonClouds: [createPoisonCloud()],
        activeShields: [shield],
        activePotionBoosts: [{
            id: 'boost-1',
            championId: 1,
            stat: 'strength',
            amount: 4,
            expiresAt: now + 5000,
        }],
        invisibleUntil: now + 1000,
        magicVisionUntil: now + 1100,
        seeThroughWallsUntil: now + 1200,
        footprintsUntil: now + 1300,
        footprintHistory: [{ x: 1, y: 2, level: 0, ts: now - 100 }],
        deadChampions: {},
        lastCreatureAttackGameTick: 1210,
    };
}

test('inspectPersistedSaveData classifies missing, corrupt, incompatible and compatible saves', () => {
    assert.deepEqual(inspectPersistedSaveData(null), { status: 'missing' });
    assert.deepEqual(inspectPersistedSaveData('not-json'), { status: 'corrupt' });

    const incompatible = inspectPersistedSaveData(JSON.stringify({
        version: 999,
        buildVersion: '0.0.0',
        position: [0, 0],
        party: [],
        creatures: [],
        floorItems: [],
    }));
    assert.equal(incompatible.status, 'incompatible');
    if (incompatible.status !== 'incompatible') {
        throw new Error('Expected an incompatible save inspection result.');
    }
    assert.equal(incompatible.foundVersion, 999);

    const compatibleRaw = JSON.stringify({
        version: 2,
        buildVersion: '0.5.0-alpha.1',
        savedAt: 1,
        level: 0,
        position: [0, 0],
        direction: 'NORTH',
        party: [],
        gateOpen: false,
        openDoors: [],
        brokenDoors: [],
        openPits: [],
        openTeleporters: [],
        openWalls: [],
        activeSensors: [],
        firedSensors: [],
        visibleTexts: [],
        pendingSensorEvents: [],
        creatures: [],
        floorItems: [],
        championInventories: {},
        championEquipment: {},
        championVitals: {},
        elapsedGameTimeTicks: 0,
        regenTickRemainder: 0,
        lastPartyMoveGameTick: 0,
        movementCooldown: 0,
        championXP: {},
        championCombat: {},
        crushingDoors: {},
        torchBurnElapsed: {},
        spellLights: [],
        projectiles: [],
        activeShields: [],
        activePotionBoosts: [],
        invisibleRemainingMs: 0,
        magicVisionRemainingMs: 0,
        seeThroughWallsRemainingMs: 0,
        footprintsRemainingMs: 0,
        footprintHistory: [],
        deadChampions: {},
        creatureTimers: {},
    });
    const compatible = inspectPersistedSaveData(compatibleRaw);
    assert.equal(compatible.status, 'compatible');
    assert.equal(tryParsePersistedSaveData(compatibleRaw)?.level, 0);
});

test('buildPersistedSaveData serializes runtime state in a stable shape', () => {
    const now = 10_000;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
        const state = createState(now);
        const runtime = createRuntimeMaps(now);
        const persisted = buildPersistedSaveData(state, runtime);
        const { integrity, ...persistedWithoutIntegrity } = persisted;

        assert.equal(persisted.version, 2);
        assert.equal(persisted.buildVersion, APP_VERSION);
        assert.equal(integrity, computePersistedSaveIntegrity(persistedWithoutIntegrity));
        assert.deepEqual(persisted.hydratedLevels, [0, 1]);
        assert.deepEqual(persisted.openDoors, ['0,1,2']);
        assert.deepEqual(persisted.brokenDoors, ['0,1,2']);
        assert.deepEqual(persisted.spellLights, [{ id: 'light-1', lightContrib: 0.5, remainingMs: 4000 }]);
        assert.equal(persisted.projectiles[0]?.nextMoveInMs, 2000);
        assert.equal(persisted.activeShields[0]?.remainingMs, 3000);
        assert.equal(persisted.activePotionBoosts[0]?.remainingMs, 5000);
        assert.equal(persisted.invisibleRemainingMs, 1000);
        assert.equal(persisted.torchBurnElapsed['torch-1'], 600);
        assert.equal(persisted.creatureTimers['creature-1']?.moveRemaining, 9);
        assert.equal(persisted.creatureTimers['creature-1']?.attackWindowRemainingMs, 1500);
        assert.equal(persisted.creatureTimers['creature-1']?.lastSeenPartyX, 12);
    } finally {
        Date.now = originalNow;
    }
});

test('inspectPersistedSaveData rejects saves with invalid integrity', () => {
    const raw = JSON.stringify({
        version: 2,
        buildVersion: '0.5.0-alpha.1',
        savedAt: 1,
        integrity: 'deadbeef',
        level: 0,
        position: [0, 0],
        direction: 'NORTH',
        party: [],
        gateOpen: false,
        openDoors: [],
        brokenDoors: [],
        openPits: [],
        openTeleporters: [],
        openWalls: [],
        activeSensors: [],
        firedSensors: [],
        visibleTexts: [],
        pendingSensorEvents: [],
        creatures: [],
        floorItems: [],
        championInventories: {},
        championEquipment: {},
        championVitals: {},
        elapsedGameTimeTicks: 0,
        regenTickRemainder: 0,
        lastPartyMoveGameTick: 0,
        movementCooldown: 0,
        championXP: {},
        championCombat: {},
        crushingDoors: {},
        torchBurnElapsed: {},
        spellLights: [],
        projectiles: [],
        activeShields: [],
        activePotionBoosts: [],
        invisibleRemainingMs: 0,
        magicVisionRemainingMs: 0,
        seeThroughWallsRemainingMs: 0,
        footprintsRemainingMs: 0,
        footprintHistory: [],
        deadChampions: {},
        creatureTimers: {},
    });

    assert.deepEqual(inspectPersistedSaveData(raw), { status: 'corrupt' });
});

test('restoreExternalCreatureRuntimeFromSave rebuilds creature runtime maps', () => {
    const now = 20_000;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
        const state = createState(now);
        const runtime = createRuntimeMaps(now);
        const persisted = buildPersistedSaveData(state, runtime);
        const restored: CreatureRuntimeMaps = {
            creatureTimers: new Map(),
            creatureAttackWindows: new Map(),
            creatureConfusedUntil: new Map(),
            creatureFluxcageUntil: new Map(),
            creatureFrightenedUntil: new Map(),
            creatureLastSeenPartyPos: new Map(),
        };

        restoreExternalCreatureRuntimeFromSave(persisted, restored);

        assert.deepEqual(restored.creatureTimers.get('creature-1'), { mt: 9, at: 4 });
        assert.equal(restored.creatureAttackWindows.get('creature-1'), now + 1500);
        assert.equal(restored.creatureConfusedUntil.get('creature-1'), now + 2500);
        assert.equal(restored.creatureFluxcageUntil.get('creature-1'), now + 3500);
        assert.equal(restored.creatureFrightenedUntil.get('creature-1'), now + 4500);
        assert.deepEqual(restored.creatureLastSeenPartyPos.get('creature-1'), {
            x: 12,
            y: 13,
            expiresAt: now + 5500,
        });
    } finally {
        Date.now = originalNow;
    }
});

test('persisted saves round-trip back into the same dungeon state', () => {
    const now = 30_000;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
        const state = createState(now);
        const runtime = createRuntimeMaps(now);
        const persisted = buildPersistedSaveData(state, runtime);
        const hydrated = hydratePersistedGameState(persisted, now);
        const restoredRuntime: CreatureRuntimeMaps = {
            creatureTimers: new Map(),
            creatureAttackWindows: new Map(),
            creatureConfusedUntil: new Map(),
            creatureFluxcageUntil: new Map(),
            creatureFrightenedUntil: new Map(),
            creatureLastSeenPartyPos: new Map(),
        };

        restoreExternalCreatureRuntimeFromSave(persisted, restoredRuntime);
        const roundTripped = buildPersistedSaveData(hydrated, restoredRuntime);

        assert.deepEqual([...hydrated.hydratedLevels], [0, 1]);
        assert.deepEqual(roundTripped, persisted);
    } finally {
        Date.now = originalNow;
    }
});

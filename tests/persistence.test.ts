import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_VERSION } from '../src/appInfo.js';
import { DEFAULT_GAME_OPTIONS } from '../src/engine/options.js';
import { createEmptyChampionTemporaryXP, createEmptyChampionXP } from '../src/data/skillProgression.js';
import type { Champion } from '../src/types/champion.js';
import type { CreatureInstance, FloorItem } from '../src/types/game.js';
import type { ActiveFluxcage, ActivePoisonCloud, ChampionCombat, ChampionVitals, PartyShield, Projectile, SpellLight } from '../src/engine/runtimeTypes.js';
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
import { createInitialGameStats } from '../src/engine/systems/gameStats.js';

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

function createFloorItem(overrides: Partial<FloorItem> = {}): FloorItem {
    return {
        id: 'item-1',
        category: 'Weapon',
        typeId: 1,
        mapIndex: 0,
        x: 5,
        y: 6,
        tilePos: 'North',
        ...overrides,
    };
}

function createCreature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
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
        ...overrides,
    };
}

function createDeadCreature(): CreatureInstance {
    return {
        id: 'creature-dead',
        groupId: 'group-dead',
        typeId: 2,
        mapIndex: 0,
        x: 7,
        y: 8,
        currentHP: 0,
        alive: false,
        cell: 'backRight',
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

function createFluxcage(expiresAt: number): ActiveFluxcage {
    return {
        id: 'flux-1',
        level: 0,
        x: 4,
        y: 5,
        expiresAt,
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
        minimapTiles: { '0,1,2': 'floor', '0,1,3': 'doorClosed' },
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
        gameStats: createInitialGameStats(now - 10000),
        championCombat,
        crushingDoors: { '0,1,2': { phase: 'closing', timer: 0.5 } },
        torchBurnStart: { 'torch-1': now - 600 },
        spellLights: [spellLight],
        projectiles: [projectile],
        activePoisonClouds: [createPoisonCloud()],
        activeFluxcages: [createFluxcage(now + 4500)],
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
        assert.deepEqual(persisted.minimapTiles, { '0,1,2': 'floor', '0,1,3': 'doorClosed' });
        assert.deepEqual(persisted.hydratedLevels, [0, 1]);
        assert.deepEqual(persisted.openDoors, ['0,1,2']);
        assert.deepEqual(persisted.brokenDoors, ['0,1,2']);
        assert.deepEqual(persisted.spellLights, [{ id: 'light-1', lightContrib: 0.5, remainingMs: 4000 }]);
        assert.deepEqual(persisted.activeFluxcages, [{ id: 'flux-1', level: 0, x: 4, y: 5, remainingMs: 4500 }]);
        assert.equal(persisted.projectiles[0]?.nextMoveInMs, 2000);
        assert.equal(persisted.activeShields[0]?.remainingMs, 3000);
        assert.equal(persisted.activePotionBoosts[0]?.remainingMs, 5000);
        assert.equal(persisted.invisibleRemainingMs, 1000);
        assert.equal(persisted.torchBurnElapsed['torch-1'], 600);
        assert.equal(persisted.creatureTimers['creature-1']?.moveRemaining, 9);
        assert.equal(persisted.creatureTimers['creature-1']?.attackWindowRemainingMs, 1500);
        assert.equal(persisted.creatureTimers['creature-1']?.lastSeenPartyX, 12);
        assert.equal(persisted.gameStats?.runId, state.gameStats.runId);
    } finally {
        Date.now = originalNow;
    }
});

test('hydratePersistedGameState reuses persisted open door state without requiring map preload', () => {
    const now = 10_000;
    const persisted = buildPersistedSaveData(createState(now), createRuntimeMaps(now));

    assert.doesNotThrow(() => hydratePersistedGameState(persisted, now));
});

test('buildPersistedSaveData compacts dead creatures and their timers out of saves', () => {
    const now = 11_000;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
        const state = createState(now);
        state.creatures = [...state.creatures, createDeadCreature()];
        const runtime = createRuntimeMaps(now);
        runtime.creatureTimers.set('creature-dead', { mt: 5, at: 6 });
        runtime.creatureAttackWindows.set('creature-dead', now + 700);

        const persisted = buildPersistedSaveData(state, runtime);

        assert.deepEqual(persisted.creatures.map((creature) => creature.id), ['creature-1']);
        assert.equal(persisted.creatureTimers['creature-dead'], undefined);
    } finally {
        Date.now = originalNow;
    }
});

test('buildPersistedSaveData normalizes living creature cells before serializing', () => {
    const now = 32_000;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
        const state = createState(now);
        state.creatures = [
            { ...createCreature(), id: 'creature-a', x: 4, y: 5, cell: 'frontLeft' },
            { ...createCreature(), id: 'creature-b', x: 4, y: 5, cell: 'backLeft' },
            { ...createCreature(), id: 'creature-c', x: 4, y: 5, cell: 'backRight' },
        ];

        const persisted = buildPersistedSaveData(state, createRuntimeMaps(now));

        assert.deepEqual(
            persisted.creatures.map((creature) => [creature.id, creature.cell]),
            [
                ['creature-a', 'frontLeft'],
                ['creature-b', 'frontRight'],
                ['creature-c', 'backLeft'],
            ],
        );
    } finally {
        Date.now = originalNow;
    }
});

test('buildPersistedSaveData removes duplicate floor item ids while preserving the progressed instance', () => {
    const now = 32_500;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
        const state = createState(now);
        state.floorItems = [
            createFloorItem({ id: '9_3_12_Misc_81', category: 'Misc', typeId: 10, mapIndex: 9, x: 3, y: 12 }),
            createFloorItem({ id: '9_3_12_Misc_81', category: 'Misc', typeId: 10, mapIndex: 9, x: 5, y: 12 }),
        ];

        const persisted = buildPersistedSaveData(state, createRuntimeMaps(now));

        assert.deepEqual(
            persisted.floorItems.map((item) => ({ id: item.id, mapIndex: item.mapIndex, x: item.x, y: item.y })),
            [{ id: '9_3_12_Misc_81', mapIndex: 9, x: 5, y: 12 }],
        );
    } finally {
        Date.now = originalNow;
    }
});

test('buildPersistedSaveData removes duplicate creature ids while preserving the progressed instance', () => {
    const now = 32_600;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
        const state = createState(now);
        state.creatures = [
            createCreature({ id: '9_13_24_100', mapIndex: 9, x: 13, y: 24, cell: 'center' }),
            createCreature({ id: '9_13_24_100', mapIndex: 9, x: 11, y: 25, cell: 'center' }),
        ];

        const persisted = buildPersistedSaveData(state, createRuntimeMaps(now));

        assert.deepEqual(
            persisted.creatures.map((creature) => ({
                id: creature.id,
                mapIndex: creature.mapIndex,
                x: creature.x,
                y: creature.y,
            })),
            [{ id: '9_13_24_100', mapIndex: 9, x: 11, y: 25 }],
        );
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

test('hydratePersistedGameState and runtime restore drop dead creatures from older saves', () => {
    const now = 21_000;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
        const state = createState(now);
        const runtime = createRuntimeMaps(now);
        const persisted = buildPersistedSaveData(state, runtime);
        persisted.creatures = [...persisted.creatures, createDeadCreature()];
        persisted.creatureTimers['creature-dead'] = {
            moveRemaining: 5,
            attackRemaining: 6,
            attackWindowRemainingMs: 700,
            confusedRemainingMs: 0,
            fluxcageRemainingMs: 0,
            frightenedRemainingMs: 0,
            lastSeenPartyX: 1,
            lastSeenPartyY: 2,
            lastSeenPartyRemainingMs: 900,
        };

        const hydrated = hydratePersistedGameState(persisted, now);
        assert.deepEqual(hydrated.creatures.map((creature) => creature.id), ['creature-1']);

        const restored: CreatureRuntimeMaps = {
            creatureTimers: new Map(),
            creatureAttackWindows: new Map(),
            creatureConfusedUntil: new Map(),
            creatureFluxcageUntil: new Map(),
            creatureFrightenedUntil: new Map(),
            creatureLastSeenPartyPos: new Map(),
        };

        restoreExternalCreatureRuntimeFromSave(persisted, restored);

        assert.equal(restored.creatureTimers.has('creature-dead'), false);
        assert.equal(restored.creatureAttackWindows.has('creature-dead'), false);
        assert.equal(restored.creatureLastSeenPartyPos.has('creature-dead'), false);
    } finally {
        Date.now = originalNow;
    }
});

test('hydratePersistedGameState creates a run id when loading a legacy save without one', () => {
    const now = 21_500;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
        const state = createState(now);
        const runtime = createRuntimeMaps(now);
        const persisted = buildPersistedSaveData(state, runtime);
        if (persisted.gameStats) {
            delete (persisted.gameStats as { runId?: string }).runId;
        }

        const hydrated = hydratePersistedGameState(persisted, now);

        assert.match(hydrated.gameStats.runId, /^[A-Za-z0-9_-]{8,96}$/);
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
        const expected = {
            ...persisted,
            openDoors: [...hydrated.openDoors],
            integrity: roundTripped.integrity,
        };

        assert.deepEqual([...hydrated.hydratedLevels], [0, 1]);
        assert.deepEqual(hydrated.minimapTiles, state.minimapTiles);
        assert.equal(hydrated.gameStats.runId, state.gameStats.runId);
        assert.deepEqual(roundTripped, expected);
    } finally {
        Date.now = originalNow;
    }
});

test('hydratePersistedGameState normalizes persisted creature cells for multi-creature tiles', () => {
    const now = 30_500;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
        const state = createState(now);
        const runtime = createRuntimeMaps(now);
        const persisted = buildPersistedSaveData(state, runtime);
        persisted.creatures = [
            { ...createCreature(), id: 'creature-a', x: 4, y: 5, cell: 'backLeft' },
            { ...createCreature(), id: 'creature-b', x: 4, y: 5, cell: 'backRight' },
        ];

        const hydrated = hydratePersistedGameState(persisted, now);

        assert.deepEqual(
            hydrated.creatures.map((creature) => [creature.id, creature.cell]),
            [
                ['creature-a', 'frontLeft'],
                ['creature-b', 'frontRight'],
            ],
        );
    } finally {
        Date.now = originalNow;
    }
});

test('hydratePersistedGameState removes duplicate floor item ids while preserving the progressed instance', () => {
    const now = 30_750;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
        const state = createState(now);
        const runtime = createRuntimeMaps(now);
        const persisted = buildPersistedSaveData(state, runtime);
        persisted.floorItems = [
            createFloorItem({ id: '9_3_12_Misc_81', category: 'Misc', typeId: 10, mapIndex: 9, x: 3, y: 12 }),
            createFloorItem({ id: '9_3_12_Misc_81', category: 'Misc', typeId: 10, mapIndex: 9, x: 5, y: 12 }),
        ];

        const hydrated = hydratePersistedGameState(persisted, now);

        assert.deepEqual(
            hydrated.floorItems.map((item) => ({ id: item.id, mapIndex: item.mapIndex, x: item.x, y: item.y })),
            [{ id: '9_3_12_Misc_81', mapIndex: 9, x: 5, y: 12 }],
        );
    } finally {
        Date.now = originalNow;
    }
});

test('hydratePersistedGameState removes duplicate creature ids while preserving the progressed instance', () => {
    const now = 30_800;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
        const state = createState(now);
        const runtime = createRuntimeMaps(now);
        const persisted = buildPersistedSaveData(state, runtime);
        persisted.creatures = [
            createCreature({ id: '9_13_24_100', mapIndex: 9, x: 13, y: 24, cell: 'center' }),
            createCreature({ id: '9_13_24_100', mapIndex: 9, x: 11, y: 25, cell: 'center' }),
        ];

        const hydrated = hydratePersistedGameState(persisted, now);

        assert.deepEqual(
            hydrated.creatures.map((creature) => ({
                id: creature.id,
                mapIndex: creature.mapIndex,
                x: creature.x,
                y: creature.y,
            })),
            [{ id: '9_13_24_100', mapIndex: 9, x: 11, y: 25 }],
        );
    } finally {
        Date.now = originalNow;
    }
});

test('hydratePersistedGameState repairs stale once-only direct sensor world state from saves', () => {
    const now = 31_000;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
        const state = createState(now);
        const runtime = createRuntimeMaps(now);
        const persisted = buildPersistedSaveData(state, runtime);

        persisted.openDoors = [];
        persisted.firedSensors = ['5_404'];

        const hydrated = hydratePersistedGameState(persisted, now);

        assert.equal(hydrated.firedSensors.has('5_404'), true);
        assert.equal(hydrated.openDoors.has('5,8,19'), true);
    } finally {
        Date.now = originalNow;
    }
});

test('hydratePersistedGameState normalizes persisted water containers in inventory and equipment', () => {
    const now = 40_000;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
        const state = createState(now);
        const runtime = createRuntimeMaps(now);
        const persisted = buildPersistedSaveData(state, runtime);

        persisted.floorItems = [
            {
                id: 'floor-waterskin',
                category: 'Misc',
                typeId: 1,
                rawName: 'Waterskin',
                waterCharges: 3,
                mapIndex: 0,
                x: 4,
                y: 4,
                tilePos: 'North',
            },
        ];
        persisted.championInventories = {
            1: [
                {
                    id: 'inventory-waterskin',
                    category: 'Misc',
                    typeId: 1,
                    rawName: 'Waterskin',
                    waterCharges: 2,
                    mapIndex: 0,
                    x: 1,
                    y: 1,
                    tilePos: 'North',
                },
            ],
        };
        persisted.championEquipment = {
            1: {
                rightHand: {
                    id: 'equipped-waterskin',
                    category: 'Misc',
                    typeId: 1,
                    rawName: 'Waterskin',
                    waterCharges: 1,
                    mapIndex: 0,
                    x: 1,
                    y: 1,
                    tilePos: 'North',
                },
            },
        };

        const hydrated = hydratePersistedGameState(persisted, now);

        assert.equal(hydrated.floorItems[0]?.category, 'Potion');
        assert.equal(hydrated.floorItems[0]?.typeId, 24);
        assert.equal(hydrated.floorItems[0]?.waterCharges, 3);

        assert.equal(hydrated.championInventories[1]?.[0]?.category, 'Potion');
        assert.equal(hydrated.championInventories[1]?.[0]?.typeId, 24);
        assert.equal(hydrated.championInventories[1]?.[0]?.waterCharges, 2);

        assert.equal(hydrated.championEquipment[1]?.rightHand?.category, 'Potion');
        assert.equal(hydrated.championEquipment[1]?.rightHand?.typeId, 24);
        assert.equal(hydrated.championEquipment[1]?.rightHand?.waterCharges, 1);
    } finally {
        Date.now = originalNow;
    }
});

test('hydratePersistedGameState no longer normalizes legacy misc placeholders into flask runtime items', () => {
    const now = 41_000;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
        const state = createState(now);
        const runtime = createRuntimeMaps(now);
        const persisted = buildPersistedSaveData(state, runtime);

        persisted.floorItems = [
            {
                id: 'hellion',
                category: 'Misc',
                typeId: 40,
                rawName: 'The Hellion',
                waterCharges: 0,
                mapIndex: 0,
                x: 4,
                y: 4,
                tilePos: 'North',
            },
            {
                id: 'pendant-feral',
                category: 'Misc',
                typeId: 41,
                rawName: 'Pendant Feral',
                waterCharges: 1,
                mapIndex: 0,
                x: 5,
                y: 5,
                tilePos: 'East',
            },
        ];
        persisted.championEquipment = {
            1: {
                rightHand: {
                    id: 'equipped-hellion',
                    category: 'Misc',
                    typeId: 40,
                    rawName: 'The Hellion',
                    waterCharges: 1,
                    mapIndex: 0,
                    x: 1,
                    y: 1,
                    tilePos: 'North',
                },
            },
        };

        const hydrated = hydratePersistedGameState(persisted, now);

        assert.equal(hydrated.floorItems[0]?.category, 'Misc');
        assert.equal(hydrated.floorItems[0]?.typeId, 40);
        assert.equal(hydrated.floorItems[0]?.waterCharges, 0);

        assert.equal(hydrated.floorItems[1]?.category, 'Misc');
        assert.equal(hydrated.floorItems[1]?.typeId, 41);
        assert.equal(hydrated.floorItems[1]?.waterCharges, 1);

        assert.equal(hydrated.championEquipment[1]?.rightHand?.category, 'Misc');
        assert.equal(hydrated.championEquipment[1]?.rightHand?.typeId, 40);
        assert.equal(hydrated.championEquipment[1]?.rightHand?.waterCharges, 1);
    } finally {
        Date.now = originalNow;
    }
});

test('hydratePersistedGameState strips disabled teleporter keys from saves', () => {
    const now = 50_000;
    const originalNow = Date.now;
    Date.now = () => now;

    try {
        const state = createState(now);
        state.openTeleporters = new Set(['0,6,7', '1,21,18']);
        const runtime = createRuntimeMaps(now);
        const persisted = buildPersistedSaveData(state, runtime);

        assert.deepEqual(persisted.openTeleporters, ['0,6,7']);

        persisted.openTeleporters = ['0,6,7', '1,21,18'];
        const hydrated = hydratePersistedGameState(persisted, now);

        assert.equal(hydrated.openTeleporters.has('0,6,7'), true);
        assert.equal(hydrated.openTeleporters.has('1,21,18'), false);
    } finally {
        Date.now = originalNow;
    }
});

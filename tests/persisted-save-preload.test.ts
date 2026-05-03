import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { PersistedSaveData } from '../src/engine/runtimeTypes.js';
import { collectPersistedGameplayPreloadLevels } from '../src/preload/persistedSavePreload.js';

function createPersistedSaveData(overrides: Partial<PersistedSaveData> = {}): PersistedSaveData {
    return {
        version: 1,
        savedAt: 0,
        level: 5,
        position: [10, 10],
        direction: 'NORTH',
        party: [],
        gateOpen: false,
        hydratedLevels: [5, 2, 4],
        openDoors: [],
        openPits: [],
        openTeleporters: [],
        openWalls: [],
        activeSensors: [],
        firedSensors: [],
        visibleTexts: [],
        pendingSensorEvents: [],
        pendingGeneratorSpawns: [],
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
        ...overrides,
    };
}

test('collectPersistedGameplayPreloadLevels includes hydrated and runtime-referenced levels from a save', () => {
    const save = createPersistedSaveData({
        creatures: [
            { id: 'c1', typeId: 1, mapIndex: 3, x: 1, y: 1, currentHP: 10, alive: true, cell: 'center', carriedItems: [] },
        ],
        floorItems: [
            { id: 'i1', category: 'Misc', typeId: 1, mapIndex: 6, x: 2, y: 2, tilePos: 'North' },
        ],
        projectiles: [
            { id: 'p1', effect: 'fireball', level: 7, x: 0, y: 0, direction: 'NORTH', damage: [1, 2], remainingAttack: 10, nextMoveInMs: 0 } as PersistedSaveData['projectiles'][number],
        ],
        spellVisualEvents: [
            { id: 'sv1', effect: 'fireball', level: 8, x: 0, y: 0, ts: 0, kind: 'wall' } as NonNullable<PersistedSaveData['spellVisualEvents']>[number],
        ],
        activePoisonClouds: [
            { id: 'pc1', level: 9, x: 0, y: 0, remainingAttack: 12, nextPulseGameTick: 0 } as NonNullable<PersistedSaveData['activePoisonClouds']>[number],
        ],
        footprintHistory: [
            { level: 10, x: 0, y: 0, ts: 0 },
        ],
        pendingSensorEvents: [
            { level: 11, sensorIndex: 22, remaining: 0 },
        ],
        pendingGeneratorSpawns: [
            { sensorLevel: 12, spawnLevel: 13, sensorIndex: 3, spawnX: 1, spawnY: 1, typeId: 2, hpMultiplier: 0, creatureCount: 1, groupId: 'g', remaining: 0 },
        ],
    });

    assert.deepEqual(
        collectPersistedGameplayPreloadLevels(save),
        [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    );
});

test('collectPersistedGameplayPreloadLevels ignores malformed level fields', () => {
    const save = createPersistedSaveData({
        hydratedLevels: [5],
        pendingSensorEvents: [
            { level: -1 },
            { level: 2.5 },
            { level: '3' },
            {},
        ],
        pendingGeneratorSpawns: [
            { sensorLevel: null, spawnLevel: undefined },
        ],
    });

    assert.deepEqual(collectPersistedGameplayPreloadLevels(save), [5]);
});

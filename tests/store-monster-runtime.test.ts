import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyChampionTemporaryXP, createEmptyChampionXP } from '../src/data/skillProgression.js';
import { createStoreMonsterTickRuntimeState } from '../src/engine/systems/storeMonsterRuntime.js';

test('createStoreMonsterTickRuntimeState forwards open trick walls to the monster runtime state', () => {
    const openWalls = new Set<string>(['2,23,7']);

    const runtimeState = createStoreMonsterTickRuntimeState({
        level: 2,
        position: [24, 7],
        direction: 'NORTH',
        party: [],
        championXP: { 1: createEmptyChampionXP() },
        championTemporaryXP: { 1: createEmptyChampionTemporaryXP() },
        creatures: [],
        championVitals: {},
        damageEvents: [],
        championInventories: {},
        championEquipment: {},
        projectiles: [],
        activePotionBoosts: [],
        invisibleUntil: 0,
        openDoors: new Set<string>(),
        openPits: new Set<string>(),
        openTeleporters: new Set<string>(),
        openWalls,
        sleeping: false,
        freezeLifeRemainingTicks: 0,
        lastCreatureAttackGameTick: 0,
        elapsedGameTimeTicks: 0,
        floorItems: [],
        deadChampions: {},
        selectedChampionIndex: 0,
        lastMonsterAttackDebug: null,
    });

    assert.equal(runtimeState.openWalls, openWalls);
});

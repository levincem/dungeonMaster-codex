import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyChampionTemporaryXP } from '../src/data/skillProgression.js';
import {
    buildStoreExplorationRegenPatch,
    buildStoreMovementTickPatch,
    buildStoreTickFramePatch,
} from '../src/engine/systems/storeFrameRuntime.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';

type TestState = {
    optionsModalOpen: boolean;
    gamePhase: 'title' | 'exploration' | 'mirror_open' | 'endgame' | 'alternate_ending' | 'victory' | 'game_over';
    party: Array<{ id: number }>;
    deadChampions: Record<number, unknown>;
    sleeping: boolean;
    paused: boolean;
    activeMirrorChampionId: number | null;
    activePartyMemberId: number | null;
    endgameSequence: { id: string } | null;
    alternateEndingSequence: { stage: string } | null;
    lastCastResult: { message: string } | null;
    damageEvents: Array<{ id: string }>;
    spellVisualEvents: Array<{ id: string }>;
    activeFloorDrag: { id: string } | null;
    pendingSensorEvents: string[];
    pendingGeneratorSpawns: string[];
    regenTickRemainder: number;
    movementCooldown: number;
    championVitals: Record<number, { hp: number }>;
    championTemporaryXP: Record<number, { value: number }>;
    elapsedGameTimeTicks: number;
    lastSurvivalEffectGameTick: number;
    freezeLifeRemainingTicks: number;
    marker?: string;
};

function createVitals(hp: number): ChampionVitals {
    return {
        hp,
        stamina: 50,
        mana: 10,
        food: 100,
        water: 100,
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
            head: false,
            torso: false,
            leftHand: false,
            rightHand: false,
            legs: false,
            feet: false,
        },
        poisonEntries: [],
    };
}

function createState(overrides: Partial<TestState> = {}): TestState {
    return {
        optionsModalOpen: false,
        gamePhase: 'exploration',
        party: [{ id: 1 }],
        deadChampions: {},
        sleeping: false,
        paused: false,
        activeMirrorChampionId: 1,
        activePartyMemberId: 1,
        endgameSequence: { id: 'end' },
        alternateEndingSequence: { stage: 'barrage' },
        lastCastResult: { message: 'hello' },
        damageEvents: [{ id: 'dmg' }],
        spellVisualEvents: [{ id: 'spell' }],
        activeFloorDrag: { id: 'drag' },
        pendingSensorEvents: [],
        pendingGeneratorSpawns: [],
        regenTickRemainder: 0,
        movementCooldown: 0,
        championVitals: {},
        championTemporaryXP: {},
        elapsedGameTimeTicks: 0,
        lastSurvivalEffectGameTick: 0,
        freezeLifeRemainingTicks: 0,
        ...overrides,
    };
}

test('buildStoreMovementTickPatch decrements finite cooldowns and normalizes invalid ones', () => {
    assert.deepEqual(
        buildStoreMovementTickPatch({ movementCooldown: 0.4 }, 0.15),
        { movementCooldown: 0.25 },
    );
    assert.deepEqual(
        buildStoreMovementTickPatch({ movementCooldown: Number.NaN }, 0.15),
        { movementCooldown: 0 },
    );
    assert.equal(buildStoreMovementTickPatch({ movementCooldown: 0 }, 0.15), null);
});

test('buildStoreExplorationRegenPatch delegates survival advancement through store deps', () => {
    const state = createState({ regenTickRemainder: 0.8 });
    let seenStepCount = 0;

    const patch = buildStoreExplorationRegenPatch(state, 0.25, {
        originalTimerTickSeconds: 1,
        advanceSurvivalTime: (_currentState, stepCount) => {
            seenStepCount = stepCount;
            return {
                championVitals: { 1: createVitals(42) },
                championTemporaryXP: { 1: createEmptyChampionTemporaryXP() },
                elapsedGameTimeTicks: 5,
                lastSurvivalEffectGameTick: 5,
                freezeLifeRemainingTicks: 0,
            };
        },
    });

    assert.equal(seenStepCount, 1);
    assert.deepEqual(patch, {
        championVitals: { 1: createVitals(42) },
        championTemporaryXP: { 1: createEmptyChampionTemporaryXP() },
        elapsedGameTimeTicks: 5,
        lastSurvivalEffectGameTick: 5,
        freezeLifeRemainingTicks: 0,
        regenTickRemainder: 0.050000000000000044,
    });
});

test('buildStoreTickFramePatch centralizes regen, movement, combat, and pending world wiring', () => {
    const state = createState({
        regenTickRemainder: 0.9,
        movementCooldown: 0.4,
        pendingSensorEvents: ['sensor-a'],
        pendingGeneratorSpawns: ['spawn-a'],
    });
    const sensorDeps = { kind: 'sensor-deps' as const };
    const generatorDeps = { kind: 'generator-deps' as const };
    let pendingDepsBuildCount = 0;

    const patch = buildStoreTickFramePatch(
        state,
        0.2,
        1000,
        {
            shouldEnterGameOver: () => false,
            applyEndgameFrame: () => null,
            applySleepFrame: () => null,
            originalTimerTickSeconds: 1,
            advanceSurvivalTime: (_currentState, stepCount) => ({
                championVitals: { 1: createVitals(40 + stepCount) },
                championTemporaryXP: { 1: createEmptyChampionTemporaryXP() },
                elapsedGameTimeTicks: stepCount,
                lastSurvivalEffectGameTick: stepCount,
                freezeLifeRemainingTicks: 0,
            }),
            applyCombatTick: () => ({ marker: 'combat' }),
            buildSensorStateSnapshot: () => ({ snapshot: true }),
            buildPendingWorldEventDeps: () => {
                pendingDepsBuildCount += 1;
                return sensorDeps;
            },
            processPendingSensorEvents: (_delta, pendingSensorEvents, _sensorState, deps) => {
                assert.equal(deps, sensorDeps);
                assert.deepEqual(pendingSensorEvents, ['sensor-a']);
                return {
                    sensorChanges: { marker: 'sensor' },
                    pendingSensorEvents: ['sensor-b'],
                };
            },
            processPendingGeneratorSpawns: (_delta, pendingGeneratorSpawns, _sensorState, deps) => {
                assert.equal(deps, generatorDeps);
                assert.deepEqual(pendingGeneratorSpawns, ['spawn-a']);
                return {
                    sensorChanges: { marker: 'generator' },
                    pendingGeneratorSpawns: ['spawn-b'],
                };
            },
            generatorRuntimeDeps: generatorDeps,
            applyImmediateTransportSquareEffects: (_currentState, basePatch, _now) => ({
                ...basePatch,
                marker: `${basePatch.marker}-transport`,
            }),
        },
    );

    assert.equal(pendingDepsBuildCount, 1);
    assert.deepEqual(patch, {
        championVitals: { 1: createVitals(41) },
        championTemporaryXP: { 1: createEmptyChampionTemporaryXP() },
        elapsedGameTimeTicks: 1,
        lastSurvivalEffectGameTick: 1,
        freezeLifeRemainingTicks: 0,
        regenTickRemainder: 0.10000000000000009,
        movementCooldown: 0.2,
        marker: 'generator-transport',
        pendingSensorEvents: ['sensor-b'],
        pendingGeneratorSpawns: ['spawn-b'],
    });
});

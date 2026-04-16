import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSleepFramePatch } from '../src/engine/systems/sleepFrameState.js';

type SleepTestState = {
    sleeping: boolean;
    pendingSensorEvents: string[];
    pendingGeneratorSpawns: string[];
    championVitals: Record<number, { hp: number }>;
    championTemporaryXP: Record<number, { wizard: number }>;
    spellLights?: unknown[];
    openDoors?: Set<string>;
    activeSensors?: Set<string>;
    damageEvents?: unknown[];
};

test('buildSleepFramePatch returns null when sleep is inactive', () => {
    const state: SleepTestState = {
        sleeping: false,
        pendingSensorEvents: [],
        pendingGeneratorSpawns: [],
        championVitals: {},
        championTemporaryXP: {},
    };
    const patch = buildSleepFramePatch(
        state,
        1000,
        {
            advanceSurvivalTime: () => {
                throw new Error('should not run');
            },
            ageTimedEffectsByMs: () => ({}),
            processPendingSensorEvents: () => ({ sensorChanges: {}, pendingSensorEvents: [] }),
            processPendingGeneratorSpawns: () => ({ sensorChanges: {}, pendingGeneratorSpawns: [] }),
            applyCombatTick: () => null,
            isPartyRested: () => true,
        },
    );

    assert.equal(patch, null);
});

test('buildSleepFramePatch merges survival, pending, generator and combat patches', () => {
    const state: SleepTestState = {
        sleeping: true,
        pendingSensorEvents: ['old'],
        pendingGeneratorSpawns: ['old-gen'],
        championVitals: { 1: { hp: 10 } },
        championTemporaryXP: { 1: { wizard: 1 } },
    };
    const patch = buildSleepFramePatch(
        state,
        1000,
        {
            advanceSurvivalTime: () => ({
                championVitals: { 1: { hp: 12 } },
                championTemporaryXP: { 1: { wizard: 0 } },
                elapsedGameTimeTicks: 5,
                lastSurvivalEffectGameTick: 4,
                freezeLifeRemainingTicks: 2,
                advancedMs: 1000,
            }),
            ageTimedEffectsByMs: () => ({ spellLights: [] }),
            processPendingSensorEvents: () => ({
                sensorChanges: { openDoors: new Set(['a']) },
                pendingSensorEvents: [],
            }),
            processPendingGeneratorSpawns: () => ({
                sensorChanges: { activeSensors: new Set(['b']) },
                pendingGeneratorSpawns: [],
            }),
            applyCombatTick: () => ({ damageEvents: [] }),
            isPartyRested: () => true,
        },
    );

    assert.ok(patch);
    assert.deepEqual(patch, {
        championVitals: { 1: { hp: 12 } },
        championTemporaryXP: { 1: { wizard: 0 } },
        elapsedGameTimeTicks: 5,
        lastSurvivalEffectGameTick: 4,
        freezeLifeRemainingTicks: 2,
        regenTickRemainder: 0,
        spellLights: [],
        damageEvents: [],
        openDoors: new Set(['a']),
        pendingSensorEvents: [],
        activeSensors: new Set(['b']),
        pendingGeneratorSpawns: [],
        sleeping: false,
    });
});

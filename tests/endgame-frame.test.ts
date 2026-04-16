import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEndgameFrameState, buildEndgameFramePatch } from '../src/engine/systems/endgameFrame.js';

test('buildEndgameFramePatch advances actions and messages before victory', () => {
    const buzzes: string[] = [];
    const result = buildEndgameFramePatch(
        {
            endgameSequence: {
                startedAt: 0,
                level: 0,
                x: 1,
                y: 2,
                lordChaosId: 'chaos',
                processedStepCount: 0,
                hideFluxcages: false,
                shownMessageCount: 0,
                messages: ['first'],
            },
            creatures: [{ id: 'chaos', mapIndex: 0, alive: true, typeId: 1, currentHP: 10, cell: 'front' }],
            spellVisualEvents: [],
            lastCastResult: null,
        },
        4200,
        {
            fuseUpdateMs: 100,
            messageIntervalMs: 100,
            finalDelayMs: 100,
            actions: [{
                step: 1,
                buzz: true,
                hideFluxcages: true,
                switchTypeId: 99,
                effects: [{ effect: 'fireball', scale: 1 }],
            }],
            playBuzz: () => { buzzes.push('buzz'); },
            buildSpellEvent: (effect, level, x, y, now, scale) => ({ effect, level, x, y, now, scale }),
            buildMessageResult: (message) => ({ message }),
        },
    );

    assert.equal(result.reachedVictory, false);
    assert.deepEqual(buzzes, ['buzz']);
    assert.ok(result.patch);
    assert.equal((result.patch as { endgameSequence: { hideFluxcages: boolean; shownMessageCount: number } }).endgameSequence.hideFluxcages, true);
    assert.equal((result.patch as { endgameSequence: { hideFluxcages: boolean; shownMessageCount: number } }).endgameSequence.shownMessageCount, 1);
});

test('buildEndgameFramePatch reports victory once the full sequence delay has elapsed', () => {
    const result = buildEndgameFramePatch(
        {
            endgameSequence: {
                startedAt: 0,
                level: 0,
                x: 1,
                y: 2,
                lordChaosId: 'chaos',
                processedStepCount: 0,
                hideFluxcages: false,
                shownMessageCount: 0,
                messages: ['first'],
            },
            creatures: [],
            spellVisualEvents: [],
            lastCastResult: null,
        },
        4300,
        {
            fuseUpdateMs: 100,
            messageIntervalMs: 100,
            finalDelayMs: 100,
            actions: [],
            playBuzz: () => {},
            buildSpellEvent: (effect, level, x, y, now, scale) => ({ effect, level, x, y, now, scale }),
            buildMessageResult: (message) => ({ message }),
        },
    );

    assert.equal(result.reachedVictory, true);
});

test('applyEndgameFrameState converts reached victory into a victory patch', () => {
    const patch = applyEndgameFrameState(
        {
            gamePhase: 'endgame',
            activeMirrorChampionId: 1,
            activePartyMemberId: 2,
            sleeping: true,
            endgameSequence: {
                startedAt: 0,
                level: 0,
                x: 1,
                y: 2,
                lordChaosId: 'chaos',
                processedStepCount: 0,
                hideFluxcages: false,
                shownMessageCount: 0,
                messages: ['first'],
            },
            creatures: [],
            spellVisualEvents: [],
            lastCastResult: null,
        },
        4300,
        {
            fuseUpdateMs: 100,
            messageIntervalMs: 100,
            finalDelayMs: 100,
            actions: [],
            playBuzz: () => {},
            buildSpellEvent: (effect, level, x, y, now, scale) => ({ effect, level, x, y, now, scale }),
            buildMessageResult: (message) => ({ message }),
        },
    );

    assert.equal(patch?.gamePhase, 'victory');
    assert.equal(patch?.sleeping, false);
    assert.equal(patch?.endgameSequence, null);
});

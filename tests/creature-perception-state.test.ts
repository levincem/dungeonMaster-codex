import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCreaturePerceptionState } from '../src/engine/systems/creaturePerceptionState.js';

test('resolveCreaturePerceptionState detects the party when visible and refreshes memory', () => {
    const result = resolveCreaturePerceptionState(
        {
            creaturePosition: [5, 5],
            partyPosition: [7, 5],
            nowMs: 1000,
            invisibleUntil: 0,
            sightRange: 8,
            seeInvisible: false,
            lastSeen: undefined,
        },
        {
            hasLineOfSight: () => true,
        },
    );

    assert.equal(result.distance, 2);
    assert.equal(result.adjacent, false);
    assert.equal(result.canDetectParty, true);
    assert.deepEqual(result.rememberedTarget, null);
    assert.deepEqual(result.nextRememberedTarget, {
        x: 7,
        y: 5,
        expiresAt: 7000,
    });
    assert.equal(result.shouldClearExpiredMemory, false);
});

test('resolveCreaturePerceptionState keeps remembered target when the party is hidden but memory is still valid', () => {
    const result = resolveCreaturePerceptionState(
        {
            creaturePosition: [5, 5],
            partyPosition: [7, 5],
            nowMs: 1000,
            invisibleUntil: 5000,
            sightRange: 8,
            seeInvisible: false,
            lastSeen: {
                x: 6,
                y: 5,
                expiresAt: 4000,
            },
        },
        {
            hasLineOfSight: () => true,
        },
    );

    assert.equal(result.canDetectParty, false);
    assert.deepEqual(result.rememberedTarget, {
        x: 6,
        y: 5,
        expiresAt: 4000,
    });
    assert.deepEqual(result.nextRememberedTarget, {
        x: 6,
        y: 5,
        expiresAt: 4000,
    });
    assert.equal(result.shouldClearExpiredMemory, false);
});

test('resolveCreaturePerceptionState clears expired memory when the party is no longer detectable', () => {
    const result = resolveCreaturePerceptionState(
        {
            creaturePosition: [5, 5],
            partyPosition: [7, 5],
            nowMs: 5000,
            invisibleUntil: 0,
            sightRange: 8,
            seeInvisible: false,
            lastSeen: {
                x: 6,
                y: 5,
                expiresAt: 4000,
            },
        },
        {
            hasLineOfSight: () => false,
        },
    );

    assert.equal(result.canDetectParty, false);
    assert.equal(result.rememberedTarget, null);
    assert.equal(result.nextRememberedTarget, null);
    assert.equal(result.shouldClearExpiredMemory, true);
});

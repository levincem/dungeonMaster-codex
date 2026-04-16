import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tickMovementCooldown, tickRegenState } from '../src/engine/systems/timeStateTicks.js';

test('tickRegenState only updates remainder until a full timer step is reached', () => {
    const partial = tickRegenState({
        delta: 0.2,
        regenTickRemainder: 0.1,
        originalTimerTickSeconds: 0.5,
        advanceSurvivalTime: () => {
            throw new Error('should not advance survival without a full step');
        },
    });

    assert.deepEqual(partial, { regenTickRemainder: 0.30000000000000004 });

    const unchanged = tickRegenState({
        delta: 0,
        regenTickRemainder: 0.1,
        originalTimerTickSeconds: 0.5,
        advanceSurvivalTime: () => {
            throw new Error('should not advance survival without a full step');
        },
    });

    assert.equal(unchanged, null);
});

test('tickRegenState advances survival once enough time accumulates', () => {
    const result = tickRegenState({
        delta: 1.2,
        regenTickRemainder: 0.1,
        originalTimerTickSeconds: 0.5,
        advanceSurvivalTime: (stepCount) => ({
            championVitals: {},
            championTemporaryXP: {},
            elapsedGameTimeTicks: stepCount,
            lastSurvivalEffectGameTick: 10,
            freezeLifeRemainingTicks: 3,
        }),
    });

    assert.ok(result);
    assert.equal(result?.elapsedGameTimeTicks, 2);
    assert.equal(result?.regenTickRemainder, 0.30000000000000004);
});

test('tickMovementCooldown normalizes invalid values and decrements active cooldowns', () => {
    assert.deepEqual(
        tickMovementCooldown({ movementCooldown: Number.NaN, delta: 0.2 }),
        { movementCooldown: 0 },
    );
    assert.deepEqual(
        tickMovementCooldown({ movementCooldown: 0.4, delta: 0.2 }),
        { movementCooldown: 0.2 },
    );
    assert.equal(
        tickMovementCooldown({ movementCooldown: 0, delta: 0.2 }),
        null,
    );
});

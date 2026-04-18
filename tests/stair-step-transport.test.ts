import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Direction } from '../src/engine/runtimeTypes.js';
import { resolveStairStepTransport } from '../src/engine/systems/stairStepTransport.js';

type TestState = {
    gateOpen: boolean;
    elapsedGameTimeTicks: number;
};

type TestPatch = Record<string, unknown>;

test('resolveStairStepTransport returns null when no stair link exists', () => {
    const result = resolveStairStepTransport<TestState, TestPatch>(
        { gateOpen: true, elapsedGameTimeTicks: 10 },
        undefined,
        null,
        { computeMovementCooldown: () => 0.5, buildLevelHydrationPatch: () => null },
    );

    assert.equal(result, null);
});

test('resolveStairStepTransport blocks gated stairs when the gate is closed', () => {
    const result = resolveStairStepTransport<TestState, TestPatch>(
        { gateOpen: false, elapsedGameTimeTicks: 10 },
        { toLevel: 1, toY: 4, toX: 5, dir: 'NORTH' as Direction, requireGate: true },
        null,
        { computeMovementCooldown: () => 0.5, buildLevelHydrationPatch: () => null },
    );

    assert.equal(result, null);
});

test('resolveStairStepTransport applies the stair destination, direction and cooldown', () => {
    const result = resolveStairStepTransport<TestState, TestPatch>(
        { gateOpen: true, elapsedGameTimeTicks: 42 },
        { toLevel: 3, toY: 10, toX: 12, dir: 'WEST' as Direction, requireGate: false },
        { championVitals: { 1: { hp: 25 } } },
        { computeMovementCooldown: () => 1.75, buildLevelHydrationPatch: () => null },
    );

    assert.ok(result);
    const patch = result?.patch as TestPatch;
    assert.equal(patch.level, 3);
    assert.deepEqual(patch.position, [10, 11]);
    assert.equal(patch.direction, 'WEST');
    assert.equal(patch.lastPartyMoveGameTick, 42);
    assert.equal(patch.movementCooldown, 1.75);
    assert.deepEqual(patch.championVitals, { 1: { hp: 25 } });
});

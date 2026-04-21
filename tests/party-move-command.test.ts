import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePartyMoveCommand, resolvePartyMoveTarget } from '../src/engine/systems/partyMoveCommand.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';

type TestState = ReturnType<typeof createState>;

function createState() {
    return {
        gamePhase: 'exploration',
        movementCooldown: 0,
        level: 1,
        position: [4, 5] as [number, number],
        direction: 'NORTH' as const,
        openDoors: new Set<string>(),
        openWalls: new Set<string>(),
        openPits: new Set<string>(),
        pendingSensorEvents: [] as unknown[],
        party: [{ id: 1 }],
        championVitals: { 1: { hp: 30 } as ChampionVitals },
    };
}

test('resolvePartyMoveTarget maps commands relative to the facing direction', () => {
    assert.deepEqual(resolvePartyMoveTarget([4, 5], 'NORTH', 'forward'), { y: 3, x: 5 });
    assert.deepEqual(resolvePartyMoveTarget([4, 5], 'NORTH', 'backward'), { y: 5, x: 5 });
    assert.deepEqual(resolvePartyMoveTarget([4, 5], 'NORTH', 'strafeLeft'), { y: 4, x: 4 });
    assert.deepEqual(resolvePartyMoveTarget([4, 5], 'EAST', 'strafeRight'), { y: 5, x: 5 });
});

test('resolvePartyMoveCommand keeps only the fatigue patch when forward hits a blocked wall with no side effects', () => {
    const movedVitals = { 1: { hp: 28 } as ChampionVitals };
    const state = createState();
    const result = resolvePartyMoveCommand(state, 'forward', 1234, {
        applyPartyMoveFatigue: () => movedVitals,
        isPartyStepBlockedByCreature: () => false,
        getTile: () => ({ type: 'Floor' }),
        isWalkable: () => false,
        buildSensorStateSnapshot: () => ({}),
        triggerWallPushSensors: () => ({ sensorChanges: {}, pendingSensorEvents: state.pendingSensorEvents }),
        applyFrontRowWallBumpDamage: () => null,
        applyImmediateTransportSquareEffects: () => {
            throw new Error('transport effects should not run');
        },
        resolvePartyStepTransport: () => {
            throw new Error('step transport should not run');
        },
    });

    assert.deepEqual(result.patch, { championVitals: movedVitals });
    assert.equal(result.shouldPlayWallBump, false);
    assert.equal(result.shouldPlayFallingAndDying, false);
});

test('resolvePartyMoveCommand merges wall push and bump effects for blocked forward movement', () => {
    const state = createState();
    state.pendingSensorEvents = [{ id: 'existing' }];
    const nextPending = [{ id: 'next' }];
    const result = resolvePartyMoveCommand(state, 'forward', 555, {
        applyPartyMoveFatigue: () => ({ 1: { hp: 27 } as ChampionVitals }),
        isPartyStepBlockedByCreature: () => false,
        getTile: () => ({ type: 'Wall' }),
        isWalkable: () => false,
        buildSensorStateSnapshot: () => ({ snapshot: true }),
        triggerWallPushSensors: () => ({
            sensorChanges: { openDoors: new Set(['1,4,5']) },
            pendingSensorEvents: nextPending,
        }),
        applyFrontRowWallBumpDamage: () => ({ damageEvents: ['bump'] }),
        applyImmediateTransportSquareEffects: (_state, patch) => ({ ...patch, routed: true }),
        resolvePartyStepTransport: () => {
            throw new Error('step transport should not run');
        },
    });

    assert.deepEqual(result.patch, {
        championVitals: { 1: { hp: 27 } },
        damageEvents: ['bump'],
        openDoors: new Set(['1,4,5']),
        pendingSensorEvents: nextPending,
        routed: true,
    });
    assert.equal(result.shouldPlayWallBump, true);
    assert.equal(result.shouldPlayFallingAndDying, false);
});

test('resolvePartyMoveCommand delegates non-forward movement to step transport and forwards the blocked message', () => {
    let capturedArgs: unknown[] = [];

    const result = resolvePartyMoveCommand<TestState>(createState(), 'backward', 999, {
        applyPartyMoveFatigue: () => null,
        isPartyStepBlockedByCreature: () => false,
        getTile: () => ({ type: 'Floor' }),
        isWalkable: () => true,
        buildSensorStateSnapshot: () => ({}),
        triggerWallPushSensors: () => ({ sensorChanges: {}, pendingSensorEvents: [] }),
        applyFrontRowWallBumpDamage: () => null,
        applyImmediateTransportSquareEffects: (_state, patch) => patch,
        resolvePartyStepTransport: (_state, y, x, movedVitals) => {
            capturedArgs = [y, x, movedVitals];
            return {
                patch: { position: [y, x] },
                blockedMessage: 'blocked',
                fellThroughPit: true,
            };
        },
    });

    assert.deepEqual(capturedArgs, [5, 5, null]);
    assert.deepEqual(result.patch, { position: [5, 5] });
    assert.equal(result.blockedMessage, 'blocked');
    assert.equal(result.shouldPlayWallBump, false);
    assert.equal(result.shouldPlayFallingAndDying, true);
});

test('resolvePartyMoveCommand stops before step transport when a creature blocks the target tile', () => {
    const movedVitals = { 1: { hp: 29 } as ChampionVitals };
    const result = resolvePartyMoveCommand(createState(), 'forward', 77, {
        applyPartyMoveFatigue: () => movedVitals,
        isPartyStepBlockedByCreature: () => true,
        getTile: () => ({ type: 'Floor' }),
        isWalkable: () => true,
        buildSensorStateSnapshot: () => ({}),
        triggerWallPushSensors: () => ({ sensorChanges: {}, pendingSensorEvents: [] }),
        applyFrontRowWallBumpDamage: () => null,
        applyImmediateTransportSquareEffects: () => {
            throw new Error('transport effects should not run');
        },
        resolvePartyStepTransport: () => {
            throw new Error('step transport should not run');
        },
    });

    assert.deepEqual(result.patch, { championVitals: movedVitals });
    assert.equal(result.shouldPlayWallBump, false);
    assert.equal(result.shouldPlayFallingAndDying, false);
});

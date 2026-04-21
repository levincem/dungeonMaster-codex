import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    applyStorePartyMoveSideEffects,
    runStoreMovementAction,
} from '../src/engine/systems/storePartyMoveRuntime.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';

type TestState = {
    gamePhase: 'exploration';
    movementCooldown: number;
    level: number;
    position: [number, number];
    direction: 'NORTH';
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
    pendingSensorEvents: unknown[];
    party: Array<{ id: number }>;
    championVitals: Record<number, ChampionVitals>;
};

function createState(): TestState {
    return {
        gamePhase: 'exploration',
        movementCooldown: 0,
        level: 1,
        position: [4, 5],
        direction: 'NORTH',
        openDoors: new Set<string>(),
        openWalls: new Set<string>(),
        openPits: new Set<string>(),
        pendingSensorEvents: [],
        party: [{ id: 1 }],
        championVitals: { 1: { hp: 30 } as ChampionVitals },
    };
}

test('applyStorePartyMoveSideEffects routes bump and pit-fall sounds separately while forwarding the blocked message', () => {
    let wallBumpCount = 0;
    let fallingAndDyingCount = 0;
    let blockedMessage: string | null = null;

    applyStorePartyMoveSideEffects(
        { shouldPlayWallBump: true, shouldPlayFallingAndDying: true, blockedMessage: 'Nope' },
        {
            playWallBump: () => {
                wallBumpCount += 1;
            },
            playFallingAndDying: () => {
                fallingAndDyingCount += 1;
            },
            showTransientMessage: (message) => {
                blockedMessage = message;
            },
        },
    );

    assert.equal(wallBumpCount, 1);
    assert.equal(fallingAndDyingCount, 1);
    assert.equal(blockedMessage, 'Nope');
});

test('runStoreMovementAction applies the move patch and plays the pit-fall sound for open-pit transport', () => {
    let currentState = createState();
    let blockedMessage: string | null = null;
    let wallBumpCount = 0;
    let fallingAndDyingCount = 0;

    runStoreMovementAction<TestState>({
        command: 'backward',
        now: 999,
        applyState: (updater) => {
            const nextState = updater(currentState);
            currentState = { ...currentState, ...nextState };
        },
        buildDeps: () => ({
            applyPartyMoveFatigue: () => null,
            isPartyStepBlockedByCreature: () => false,
            getTile: () => ({ type: 'Floor' }),
            isWalkable: () => true,
            buildSensorStateSnapshot: () => ({}),
            triggerWallPushSensors: () => ({ sensorChanges: {}, pendingSensorEvents: [] }),
            applyFrontRowWallBumpDamage: () => null,
            applyImmediateTransportSquareEffects: (_state, patch) => patch,
            resolvePartyStepTransport: (_state, y, x) => ({
                patch: { position: [y, x] as [number, number] },
                blockedMessage: 'blocked',
                fellThroughPit: true,
            }),
        }),
        playWallBump: () => {
            wallBumpCount += 1;
        },
        playFallingAndDying: () => {
            fallingAndDyingCount += 1;
        },
        showTransientMessage: (message) => {
            blockedMessage = message;
        },
    });

    assert.deepEqual(currentState.position, [5, 5]);
    assert.equal(wallBumpCount, 0);
    assert.equal(fallingAndDyingCount, 1);
    assert.equal(blockedMessage, 'blocked');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processTickFrame } from '../src/engine/systems/tickFrameState.js';

type TestState = {
    optionsModalOpen: boolean;
    gamePhase: 'title' | 'exploration' | 'mirror_open' | 'endgame' | 'alternate_ending' | 'victory' | 'game_over';
    party: Array<{ id: number }>;
    deadChampions: Record<number, unknown>;
    sleeping: boolean;
    paused: boolean;
    lastMonsterAttackDebug?: unknown | null;
    activeMirrorChampionId: number | null;
    activePartyMemberId: number | null;
    endgameSequence: { id: string } | null;
    alternateEndingSequence: { stage: string } | null;
    lastCastResult: { message: string } | null;
    damageEvents: Array<{ id: string }>;
    spellVisualEvents: Array<{ id: string }>;
    activeFluxcages?: Array<{ id: string }>;
    activeFloorDrag: { id: string } | null;
    pendingSensorEvents: string[];
    pendingGeneratorSpawns: string[];
    marker?: string;
};

function createState(overrides: Partial<TestState> = {}): TestState {
    return {
        optionsModalOpen: false,
        gamePhase: 'exploration',
        party: [{ id: 1 }],
        deadChampions: {},
        sleeping: false,
        paused: false,
        lastMonsterAttackDebug: null,
        activeMirrorChampionId: 1,
        activePartyMemberId: 1,
        endgameSequence: { id: 'end' },
        alternateEndingSequence: { stage: 'barrage' },
        lastCastResult: { message: 'hello' },
        damageEvents: [{ id: 'dmg' }],
        spellVisualEvents: [{ id: 'spell' }],
        activeFluxcages: [{ id: 'flux' }],
        activeFloorDrag: { id: 'drag' },
        pendingSensorEvents: [],
        pendingGeneratorSpawns: [],
        ...overrides,
    };
}

const inertDeps = {
    shouldEnterGameOver: () => false,
    applyEndgameFrame: () => null,
    applySleepFrame: () => null,
    applyRegenTick: () => null,
    applyMovementTick: () => null,
    applyCombatTick: () => null,
    buildSensorStateSnapshot: () => ({}),
    processPendingSensorEvents: (_delta: number, pendingSensorEvents: string[]) => ({
        sensorChanges: {},
        pendingSensorEvents,
    }),
    processPendingGeneratorSpawns: (_delta: number, pendingGeneratorSpawns: string[]) => ({
        sensorChanges: {},
        pendingGeneratorSpawns,
    }),
    applyImmediateTransportSquareEffects: (_state: TestState, patch: Partial<TestState>, _now: number) => patch,
};

test('processTickFrame returns the original state while options modal is open', () => {
    const state = createState({ optionsModalOpen: true });

    const result = processTickFrame(state, 0.1, 1000, inertDeps);

    assert.equal(result, state);
});

test('processTickFrame returns the game over patch immediately when the entry check triggers', () => {
    const state = createState();

    const result = processTickFrame(state, 0.1, 1000, {
        ...inertDeps,
        shouldEnterGameOver: () => true,
    }) as Partial<TestState> & { gamePhase: string };

    assert.equal(result.gamePhase, 'game_over');
    assert.equal(result.activeMirrorChampionId, null);
    assert.equal(result.activePartyMemberId, null);
    assert.equal(result.sleeping, false);
    assert.equal(result.paused, false);
    assert.equal(result.lastMonsterAttackDebug, null);
    assert.deepEqual(result.damageEvents, []);
    assert.deepEqual(result.spellVisualEvents, []);
    assert.deepEqual(result.activeFluxcages, []);
    assert.equal(result.activeFloorDrag, null);
    assert.equal(result.alternateEndingSequence, null);
});

test('processTickFrame delegates endgame and sleep phases before exploration logic', () => {
    const endgameState = createState({ gamePhase: 'endgame' });
    const sleepState = createState({ sleeping: true });

    const endgameResult = processTickFrame(endgameState, 0.1, 1000, {
        ...inertDeps,
        applyEndgameFrame: () => ({ marker: 'endgame' }),
    });
    const sleepResult = processTickFrame(sleepState, 0.1, 1000, {
        ...inertDeps,
        applySleepFrame: () => ({ marker: 'sleep' }),
    });

    assert.deepEqual(endgameResult, { marker: 'endgame' });
    assert.deepEqual(sleepResult, { marker: 'sleep' });
});

test('processTickFrame leaves alternate ending state untouched so the scripted sequence can own the timeline', () => {
    const alternateEndingState = createState({
        gamePhase: 'alternate_ending',
        pendingSensorEvents: ['legacy-sensor'],
        pendingGeneratorSpawns: ['legacy-spawn'],
    });

    const result = processTickFrame(alternateEndingState, 0.1, 1000, {
        ...inertDeps,
        applyRegenTick: () => ({ marker: 'regen' }),
        applyMovementTick: () => ({ marker: 'move' }),
        applyCombatTick: () => ({ marker: 'combat' }),
    });

    assert.equal(result, alternateEndingState);
});

test('processTickFrame composes exploration patches and runs the post-transport game over check', () => {
    const state = createState();

    const result = processTickFrame(state, 0.1, 1000, {
        ...inertDeps,
        applyRegenTick: () => ({ marker: 'regen' }),
        applyMovementTick: () => ({ pendingSensorEvents: ['sensor-a'] }),
        applyCombatTick: () => ({ pendingGeneratorSpawns: ['spawn-a'] }),
        processPendingSensorEvents: () => ({
            sensorChanges: { marker: 'pending' },
            pendingSensorEvents: ['sensor-b'],
        }),
        processPendingGeneratorSpawns: () => ({
            sensorChanges: { marker: 'generator' },
            pendingGeneratorSpawns: ['spawn-b'],
        }),
        applyImmediateTransportSquareEffects: (_currentState, patch, _now) => ({
            ...patch,
            party: [],
            deadChampions: { 1: { id: 1 } },
        }),
        shouldEnterGameOver: ({ partySize, deadChampionCount }) => partySize === 0 && deadChampionCount === 1,
    }) as Partial<TestState> & { gamePhase: string };

    assert.equal(result.gamePhase, 'game_over');
    assert.equal(result.marker, 'generator');
    assert.equal(result.activeMirrorChampionId, null);
    assert.deepEqual(result.damageEvents, []);
    assert.deepEqual(result.activeFluxcages, []);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import { resolvePartyStepTransport } from '../src/engine/systems/partyStepTransport.js';

type TestTile = { type: string };
type TestPatch = Record<string, unknown>;
type TestState = ReturnType<typeof createState>;

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champ ${id}`,
        title: 'Adventurer',
        gender: 'M',
        class: 'Fighter',
        health: 30,
        stamina: 40,
        mana: 5,
        luck: 10,
        strength: 10,
        dexterity: 10,
        wisdom: 10,
        vitality: 10,
        antiMagic: 0,
        antiFire: 0,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: '',
    };
}

function createState() {
    return {
        level: 1,
        position: [4, 5] as [number, number],
        openDoors: new Set<string>(),
        openWalls: new Set<string>(),
        openPits: new Set<string>(),
        party: [createChampion(1)],
    };
}

function createVitalsPatch(hp: number) {
    return { 1: { hp } as ChampionVitals };
}

test('resolvePartyStepTransport returns moved vitals patch when the target tile is missing', () => {
    const movedVitals = createVitalsPatch(28);

    const result = resolvePartyStepTransport<TestState, TestPatch, TestTile, { fromLevel: number; fromY: number; fromX: number }>(
        createState(),
        8,
        9,
        movedVitals,
        {
            getTile: () => undefined,
            isWalkable: () => true,
            resolveOpenPitEntryTransport: () => null,
            findStairLink: () => undefined,
            resolveStairStepTransport: () => null,
            resolveTeleporterStepTransport: () => null,
            resolveStandardStepTransport: () => ({ patch: { unreachable: true } }),
        },
    );

    assert.deepEqual(result.patch, { championVitals: movedVitals });
});

test('resolvePartyStepTransport keeps the moved vitals patch when an open pit has no valid landing', () => {
    const movedVitals = createVitalsPatch(25);

    const result = resolvePartyStepTransport<TestState, TestPatch, TestTile, { fromLevel: number; fromY: number; fromX: number }>(
        {
            ...createState(),
            openPits: new Set(['1,6,7']),
        },
        6,
        7,
        movedVitals,
        {
            getTile: () => ({ type: 'Pit' }),
            isWalkable: () => true,
            resolveOpenPitEntryTransport: () => null,
            findStairLink: () => undefined,
            resolveStairStepTransport: () => null,
            resolveTeleporterStepTransport: () => null,
            resolveStandardStepTransport: () => ({ patch: { unreachable: true } }),
        },
    );

    assert.deepEqual(result.patch, { championVitals: movedVitals });
});

test('resolvePartyStepTransport prefers stairs and stops when a stair link exists but does not resolve', () => {
    const movedVitals = createVitalsPatch(24);

    const result = resolvePartyStepTransport<TestState, TestPatch, TestTile, { fromLevel: number; fromY: number; fromX: number }>(
        createState(),
        2,
        3,
        movedVitals,
        {
            getTile: () => ({ type: 'Stairs' }),
            isWalkable: () => true,
            resolveOpenPitEntryTransport: () => null,
            findStairLink: () => ({ fromLevel: 1, fromY: 2, fromX: 3 }),
            resolveStairStepTransport: () => null,
            resolveTeleporterStepTransport: () => {
                throw new Error('teleporter should not run');
            },
            resolveStandardStepTransport: () => {
                throw new Error('standard step should not run');
            },
        },
    );

    assert.deepEqual(result.patch, { championVitals: movedVitals });
});

test('resolvePartyStepTransport falls back to the standard step resolution when no special transport applies', () => {
    let capturedArgs: unknown[] = [];

    const result = resolvePartyStepTransport<TestState, TestPatch, TestTile, { fromLevel: number; fromY: number; fromX: number }>(
        createState(),
        3,
        8,
        null,
        {
            getTile: () => ({ type: 'Floor' }),
            isWalkable: () => true,
            resolveOpenPitEntryTransport: () => null,
            findStairLink: () => undefined,
            resolveStairStepTransport: () => null,
            resolveTeleporterStepTransport: () => null,
            resolveStandardStepTransport: (_state, x, y, nx, ny, movedVitals) => {
                capturedArgs = [x, y, nx, ny, movedVitals];
                return { patch: { position: [ny, nx], used: 'standard' } };
            },
        },
    );

    assert.deepEqual(capturedArgs, [5, 4, 8, 3, null]);
    assert.deepEqual(result.patch, { position: [3, 8], used: 'standard' });
});

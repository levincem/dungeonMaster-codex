import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import type { ChampionVitals, FootprintEntry } from '../src/engine/runtimeTypes.js';
import { resolveStandardStepTransport } from '../src/engine/systems/standardStepTransport.js';

type TestPendingSensorEvent = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type TestSensorState = {
    openDoors: Set<string>;
    marker?: string;
};

type TestPatch = Record<string, unknown>;
type TestState = ReturnType<typeof createStateBase>;

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

function createState(overrides: Partial<ReturnType<typeof createStateBase>> = {}) {
    return {
        ...createStateBase(),
        ...overrides,
    };
}

function createStateBase() {
    return {
        level: 2,
        position: [4, 5] as [number, number],
        party: [createChampion(1)],
        championInventories: {} as Record<number, FloorItem[]>,
        championEquipment: {} as Record<number, ChampionEquipment>,
        floorItems: [] as FloorItem[],
        pendingSensorEvents: [{ level: 2, sensorIndex: 3, remaining: 1 }] as TestPendingSensorEvent[],
        footprintsUntil: 1000,
        footprintHistory: [] as FootprintEntry[],
        elapsedGameTimeTicks: 321,
    };
}

test('resolveStandardStepTransport applies sensor changes and footprints before immediate effects', () => {
    let capturedPatch: TestPatch | null = null;

    const result = resolveStandardStepTransport<TestState, TestSensorState, TestPendingSensorEvent, TestPatch>(
        createState(),
        5,
        4,
        6,
        7,
        { 1: { hp: 26 } as ChampionVitals },
        {
            buildSensorStateSnapshot: () => ({ openDoors: new Set<string>(), marker: 'snapshot' }),
            transitionFloorSensors: (_level, _fromX, _fromY, _toX, _toY, _partySize, ss) => {
                assert.deepEqual(ss, { openDoors: new Set<string>(), marker: 'snapshot' });
                return {
                    sensorChanges: { openDoors: new Set(['door-1']), marker: 'entered' },
                    pendingSensorEvents: [{ level: 2, sensorIndex: 4, remaining: 2 }],
                    blockedMessage: 'moved',
                };
            },
            applyImmediateTransportSquareEffects: (_state, basePatch) => {
                capturedPatch = basePatch;
                return basePatch;
            },
            computeMovementCooldown: () => 0.75,
            now: () => 500,
        },
    );

    assert.equal(result.blockedMessage, 'moved');
    const patch = capturedPatch as unknown as TestPatch;
    assert.deepEqual(patch.position, [7, 6]);
    assert.equal(patch.lastPartyMoveGameTick, 321);
    assert.equal(patch.movementCooldown, 0.75);
    assert.deepEqual(patch.pendingSensorEvents, [{ level: 2, sensorIndex: 4, remaining: 2 }]);
    assert.equal((patch.openDoors as Set<string>).has('door-1'), true);
    assert.equal(patch.marker, 'entered');
    assert.deepEqual(patch.footprintHistory, [{ x: 6, y: 7, level: 2, ts: 500 }]);
});

test('resolveStandardStepTransport skips footprints when the effect has expired', () => {
    let capturedPatch: TestPatch | null = null;

    resolveStandardStepTransport<ReturnType<typeof createStateBase>, TestSensorState, TestPendingSensorEvent, TestPatch>(
        createState({ footprintsUntil: 100, footprintHistory: [{ x: 1, y: 1, level: 1, ts: 10 }] }),
        5,
        4,
        6,
        7,
        null,
        {
            buildSensorStateSnapshot: () => ({ openDoors: new Set<string>() }),
            transitionFloorSensors: () => ({
                sensorChanges: {},
                pendingSensorEvents: [],
            }),
            applyImmediateTransportSquareEffects: (_state, basePatch) => {
                capturedPatch = basePatch;
                return basePatch;
            },
            computeMovementCooldown: () => 1,
            now: () => 500,
        },
    );

    const patch = capturedPatch as unknown as TestPatch;
    assert.equal('footprintHistory' in patch, false);
});

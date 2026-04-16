import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampionEquipment, FloorItem, GameTile } from '../src/types/game.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import { resolveClimbDownAction } from '../src/engine/systems/climbDownAction.js';

type TestPendingSensorEvent = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type TestSensorState = {
    openDoors: Set<string>;
    marker?: string;
};

type TestState = {
    level: number;
    position: [number, number];
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    pendingSensorEvents: TestPendingSensorEvent[];
    elapsedGameTimeTicks: number;
};

type TestPatch = Record<string, unknown>;

function createState(): TestState {
    return {
        level: 1,
        position: [4, 5],
        direction: 'NORTH',
        openDoors: new Set<string>(),
        openWalls: new Set<string>(),
        openPits: new Set<string>(['1,3,5']),
        championInventories: {},
        championEquipment: {},
        floorItems: [],
        pendingSensorEvents: [{ level: 1, sensorIndex: 2, remaining: 3 }],
        elapsedGameTimeTicks: 99,
    };
}

test('resolveClimbDownAction returns an error when there is no open pit ahead', () => {
    const result = resolveClimbDownAction<TestState, TestSensorState, TestPendingSensorEvent, TestPatch>(
        createState(),
        {},
        {
            getFrontPosition: () => ({ x: 5, y: 3 }),
            getTile: () => ({ x: 5, y: 3, type: 'Floor', objects: [] } as GameTile),
            resolvePitLanding: () => null,
            applyPartyLoadBasedFatigue: () => null,
            buildSensorStateSnapshot: () => ({ openDoors: new Set<string>() }),
            triggerFloorSensors: () => ({ sensorChanges: {}, pendingSensorEvents: [] }),
            computeMovementCooldown: () => 1,
        },
    );

    assert.equal(result.errorMessage, 'CLIMB DOWN requiert un puits ouvert devant le groupe.');
});

test('resolveClimbDownAction returns an error when the landing is invalid', () => {
    const result = resolveClimbDownAction<TestState, TestSensorState, TestPendingSensorEvent, TestPatch>(
        createState(),
        {},
        {
            getFrontPosition: () => ({ x: 5, y: 3 }),
            getTile: () => ({ x: 5, y: 3, type: 'Pit', open: true, objects: [] } as GameTile),
            resolvePitLanding: () => null,
            applyPartyLoadBasedFatigue: () => null,
            buildSensorStateSnapshot: () => ({ openDoors: new Set<string>() }),
            triggerFloorSensors: () => ({ sensorChanges: {}, pendingSensorEvents: [] }),
            computeMovementCooldown: () => 1,
        },
    );

    assert.equal(result.errorMessage, 'Impossible de descendre ici.');
});

test('resolveClimbDownAction returns the movement patch on success', () => {
    let enterState: TestSensorState | null = null;

    const result = resolveClimbDownAction<TestState, TestSensorState, TestPendingSensorEvent, TestPatch>(
        createState(),
        { lastCastResult: null },
        {
            getFrontPosition: () => ({ x: 5, y: 3 }),
            getTile: () => ({ x: 5, y: 3, type: 'Pit', open: true, objects: [] } as GameTile),
            resolvePitLanding: () => ({ level: 2, x: 7, y: 8 }),
            applyPartyLoadBasedFatigue: () => ({ 1: { hp: 24 } as ChampionVitals }),
            buildSensorStateSnapshot: () => ({ openDoors: new Set<string>(), marker: 'snapshot' }),
            triggerFloorSensors: (_level, _x, _y, ss, _inventories, _equipment, _floorItems, _pending, mode) => {
                if (mode === 'enter') {
                    enterState = ss;
                    return {
                        sensorChanges: { marker: 'enter' },
                        pendingSensorEvents: [{ level: 2, sensorIndex: 4, remaining: 1 }],
                    };
                }
                return {
                    sensorChanges: { openDoors: new Set(['leave-door']), marker: 'leave' },
                    pendingSensorEvents: [{ level: 1, sensorIndex: 3, remaining: 2 }],
                };
            },
            computeMovementCooldown: () => 1.5,
        },
    );

    assert.equal(result.errorMessage, undefined);
    assert.deepEqual(enterState, { openDoors: new Set(['leave-door']), marker: 'leave' });
    const patch = result.patch as TestPatch;
    assert.deepEqual(patch.position, [8, 7]);
    assert.equal(patch.level, 2);
    assert.equal(patch.lastPartyMoveGameTick, 99);
    assert.equal(patch.movementCooldown, 1.5);
    assert.deepEqual(patch.pendingSensorEvents, [{ level: 2, sensorIndex: 4, remaining: 1 }]);
    assert.equal((patch.openDoors as Set<string>).has('leave-door'), true);
    assert.equal(patch.marker, 'enter');
    assert.deepEqual(patch.championVitals, { 1: { hp: 24 } });
});

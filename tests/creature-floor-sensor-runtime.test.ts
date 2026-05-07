import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCreatureFloorSensorRuntimeEffects } from '../src/engine/systems/creatureFloorSensorRuntime.js';

type TestPendingSensorEvent = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type TestCreature = {
    id: string;
    mapIndex: number;
    x: number;
    y: number;
    alive: boolean;
};

type TestState = {
    level: number;
    position: [number, number];
    hydratedLevels: Set<number>;
    creatures: TestCreature[];
    floorItems: unknown[];
    championInventories: Record<number, unknown[]>;
    championEquipment: Record<number, unknown>;
    pendingSensorEvents: TestPendingSensorEvent[];
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
};

test('applyCreatureFloorSensorRuntimeEffects teleports a creature immediately when its enter sensor opens a teleporter', () => {
    const state: TestState = {
        level: 0,
        position: [9, 9],
        hydratedLevels: new Set<number>(),
        creatures: [{
            id: 'wizard-eye',
            mapIndex: 0,
            x: 0,
            y: 0,
            alive: true,
        }],
        floorItems: [],
        championInventories: {},
        championEquipment: {},
        pendingSensorEvents: [],
        openDoors: new Set<string>(),
        openWalls: new Set<string>(),
        openPits: new Set<string>(),
        openTeleporters: new Set<string>(),
    };

    const transitionsSeen: string[] = [];
    const teleporterCalls: Array<[number, number, number]> = [];

    const patch = applyCreatureFloorSensorRuntimeEffects(
        state,
        {
            creatures: [{
                id: 'wizard-eye',
                mapIndex: 0,
                x: 1,
                y: 1,
                alive: true,
            }],
        },
        {
            triggerCreatureFloorSensors: (runtimeState, level, x, y, mode) => {
                transitionsSeen.push(`${mode}:${level}:${x}:${y}`);
                if (mode === 'enter' && level === 0 && x === 1 && y === 1) {
                    return {
                        sensorChanges: {
                            openTeleporters: new Set<string>(['0,1,1']),
                        },
                        pendingSensorEvents: runtimeState.pendingSensorEvents,
                    };
                }
                return {
                    sensorChanges: {},
                    pendingSensorEvents: runtimeState.pendingSensorEvents,
                };
            },
            applyCreaturesStandingOnOpenPit: () => null,
            applyFloorItemsStandingOnOpenPit: () => null,
            applyCreaturesStandingOnOpenTeleporter: (runtimeState, level, x, y) => {
                teleporterCalls.push([level, x, y]);
                if (level !== 0 || x !== 1 || y !== 1) return null;
                return {
                    creatures: runtimeState.creatures.map((creature) =>
                        creature.id === 'wizard-eye'
                            ? { ...creature, x: 2, y: 1 }
                            : creature,
                    ),
                };
            },
        },
    );

    assert.ok(patch);
    assert.deepEqual(
        patch.creatures,
        [{
            id: 'wizard-eye',
            mapIndex: 0,
            x: 2,
            y: 1,
            alive: true,
        }],
    );
    assert.deepEqual(teleporterCalls, [[0, 1, 1]]);
    assert.deepEqual(transitionsSeen, [
        'leave:0:0:0',
        'enter:0:1:1',
        'leave:0:1:1',
        'enter:0:2:1',
    ]);
});

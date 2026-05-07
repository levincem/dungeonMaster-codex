import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampionEquipment, CreatureInstance, FloorItem, GameTile } from '../src/types/game.js';
import type { SpellVisualEvent } from '../src/engine/runtimeTypes.js';
import { applyOpenedTeleporterEffects } from '../src/engine/systems/openedTransportSquares.js';

type TestPendingSensorEvent = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type TeleporterState = {
    level: number;
    position: [number, number];
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    hydratedLevels: Set<number>;
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    spellVisualEvents: SpellVisualEvent[];
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    pendingSensorEvents: TestPendingSensorEvent[];
};

function createCreature(id: string, overrides: Partial<CreatureInstance> = {}): CreatureInstance {
    return {
        id,
        typeId: 1,
        mapIndex: 0,
        x: 1,
        y: 1,
        currentHP: 30,
        alive: true,
        cell: 'center',
        ...overrides,
    };
}

function createTeleporterTile(x: number, y: number, destMap: number, destX: number, destY: number): GameTile {
    return {
        x,
        y,
        type: 'Teleporter',
        objects: [{
            category: 'Teleporter',
            index: 1,
            tilePos: 'North',
            sound: false,
            scope: 'local',
            rotationType: 0,
            rotation: 'North',
            destMap,
            destX,
            destY,
        }],
    };
}

function createBaseState(overrides: Partial<TeleporterState> = {}): TeleporterState {
    return {
        level: 0,
        position: [0, 0],
        direction: 'NORTH',
        hydratedLevels: new Set<number>([0]),
        creatures: [],
        floorItems: [],
        spellVisualEvents: [],
        openDoors: new Set<string>(),
        openWalls: new Set<string>(),
        openPits: new Set<string>(),
        openTeleporters: new Set<string>(),
        championInventories: {},
        championEquipment: {},
        pendingSensorEvents: [],
        ...overrides,
    };
}

test('applyOpenedTeleporterEffects moves the party through a newly opened teleporter and applies telefrag', () => {
    const result = applyOpenedTeleporterEffects(
        createBaseState({
            position: [4, 5],
            openTeleporters: new Set<string>(['0,4,5']),
            creatures: [createCreature('c1')],
        }),
        ['0,4,5'],
        {
            getTile: (level, x, y) => level === 0 && x === 5 && y === 4 ? createTeleporterTile(x, y, 1, 7, 8) : undefined,
            getTeleporter: (tile) => tile.objects[0]?.category === 'Teleporter' ? tile.objects[0] : undefined,
            resolveProjectileTeleporterTransport: () => ({ level: 1, x: 7, y: 8, direction: 'EAST' }),
            applyPartyTelefragAtSquare: () => ({
                creatures: [createCreature('c1', { mapIndex: 1, x: 7, y: 8, alive: false, currentHP: 0 })],
                floorItems: [{ id: 'loot-1', category: 'Misc', typeId: 1, mapIndex: 1, x: 7, y: 8, tilePos: 'North' }],
                spellVisualEvents: [{ id: 'fx-1', level: 1, x: 7, y: 8, effect: 'fireball', ts: 0, kind: 'death' }],
            }),
            buildLevelHydrationPatch: () => null,
            applyCreaturesStandingOnOpenTeleporter: () => null,
            buildSensorStateSnapshot: (state) => state,
            triggerFloorSensors: () => ({ sensorChanges: {}, pendingSensorEvents: [] }),
        },
    );

    assert.equal(result.changed, true);
    assert.equal(result.level, 1);
    assert.deepEqual(result.position, [8, 7]);
    assert.equal(result.direction, 'EAST');
    assert.equal(result.floorItems.length, 1);
    assert.equal(result.spellVisualEvents.length, 1);
});

test('applyOpenedTeleporterEffects also applies creature teleports on opened squares', () => {
    const result = applyOpenedTeleporterEffects(
        createBaseState({
            openTeleporters: new Set<string>(['0,3,2']),
            creatures: [createCreature('c2', { mapIndex: 0, x: 2, y: 3 })],
        }),
        ['0,3,2'],
        {
            getTile: (level, x, y) => level === 0 && x === 2 && y === 3 ? createTeleporterTile(x, y, 0, 4, 5) : undefined,
            getTeleporter: (tile) => tile.objects[0]?.category === 'Teleporter' ? tile.objects[0] : undefined,
            resolveProjectileTeleporterTransport: () => ({ level: 0, x: 2, y: 3, direction: 'NORTH' }),
            applyPartyTelefragAtSquare: () => null,
            buildLevelHydrationPatch: () => null,
            applyCreaturesStandingOnOpenTeleporter: (state) => ({
                hydratedLevels: state.hydratedLevels,
                creatures: [createCreature('c2', { mapIndex: 0, x: 4, y: 5 })],
                floorItems: state.floorItems,
                openDoors: state.openDoors,
            }),
            buildSensorStateSnapshot: (state) => state,
            triggerFloorSensors: () => ({ sensorChanges: {}, pendingSensorEvents: [] }),
        },
    );

    assert.equal(result.changed, true);
    assert.deepEqual(
        result.creatures[0] && {
            mapIndex: result.creatures[0].mapIndex,
            x: result.creatures[0].x,
            y: result.creatures[0].y,
        },
        { mapIndex: 0, x: 4, y: 5 },
    );
});

test('applyOpenedTeleporterEffects schedules leave and enter floor sensors around the party transport', () => {
    const calls: Array<{ mode: 'enter' | 'leave'; level: number; x: number; y: number }> = [];

    const result = applyOpenedTeleporterEffects(
        createBaseState({
            level: 9,
            position: [14, 22],
            direction: 'SOUTH',
            openTeleporters: new Set<string>(['9,14,22']),
        }),
        ['9,14,22'],
        {
            getTile: (level, x, y) => level === 9 && x === 22 && y === 14 ? createTeleporterTile(x, y, 9, 22, 15) : undefined,
            getTeleporter: (tile) => tile.objects[0]?.category === 'Teleporter' ? tile.objects[0] : undefined,
            resolveProjectileTeleporterTransport: () => ({ level: 9, x: 22, y: 15, direction: 'SOUTH' }),
            applyPartyTelefragAtSquare: () => null,
            buildLevelHydrationPatch: () => null,
            applyCreaturesStandingOnOpenTeleporter: () => null,
            buildSensorStateSnapshot: (state) => state,
            triggerFloorSensors: (level, x, y, _ss, _inventories, _equipment, _floorItems, pendingSensorEvents, mode) => {
                calls.push({ mode, level, x, y });
                if (mode === 'leave') {
                    return {
                        sensorChanges: {},
                        pendingSensorEvents: [...pendingSensorEvents, { level, sensorIndex: 296, remaining: 0.2 }],
                    };
                }
                return {
                    sensorChanges: {
                        openDoors: new Set<string>(['9,33,16']),
                    },
                    pendingSensorEvents: [...pendingSensorEvents, { level, sensorIndex: 297, remaining: 0.2 }],
                };
            },
        },
    );

    assert.equal(result.changed, true);
    assert.deepEqual(result.position, [15, 22]);
    assert.equal(result.direction, 'SOUTH');
    assert.deepEqual(calls, [
        { mode: 'leave', level: 9, x: 22, y: 14 },
        { mode: 'enter', level: 9, x: 22, y: 15 },
    ]);
    assert.equal(result.openDoors.has('9,33,16'), true);
    assert.deepEqual(result.pendingSensorEvents, [
        { level: 9, sensorIndex: 296, remaining: 0.2 },
        { level: 9, sensorIndex: 297, remaining: 0.2 },
    ]);
});

test('applyOpenedTeleporterEffects does not chain a second teleporter in the same pass when arrival only queues a delayed event', () => {
    const result = applyOpenedTeleporterEffects(
        createBaseState({
            position: [10, 10],
            direction: 'EAST',
            openTeleporters: new Set<string>(['0,10,10']),
        }),
        ['0,10,10'],
        {
            getTile: (level, x, y) => {
                if (level !== 0) return undefined;
                if (x === 10 && y === 10) return createTeleporterTile(x, y, 0, 11, 10);
                if (x === 11 && y === 10) return createTeleporterTile(x, y, 0, 12, 10);
                return undefined;
            },
            getTeleporter: (tile) => tile.objects[0]?.category === 'Teleporter' ? tile.objects[0] : undefined,
            resolveProjectileTeleporterTransport: (transportState, level, x, y, direction) => {
                if (level === 0 && x === 10 && y === 10) return { level: 0, x: 11, y: 10, direction };
                if (level === 0 && x === 11 && y === 10 && transportState.openTeleporters.has('0,10,11')) {
                    return { level: 0, x: 12, y: 10, direction };
                }
                return { level, x, y, direction };
            },
            applyPartyTelefragAtSquare: () => null,
            buildLevelHydrationPatch: () => null,
            applyCreaturesStandingOnOpenTeleporter: () => null,
            buildSensorStateSnapshot: (state) => state,
            triggerFloorSensors: (level, x, y, _ss, _inventories, _equipment, _floorItems, pendingSensorEvents, mode) => {
                if (mode === 'enter' && level === 0 && x === 11 && y === 10) {
                    return {
                        sensorChanges: {},
                        pendingSensorEvents: [...pendingSensorEvents, { level: 0, sensorIndex: 999, remaining: 0.2 }],
                    };
                }
                return { sensorChanges: {}, pendingSensorEvents };
            },
        },
    );

    assert.equal(result.changed, true);
    assert.deepEqual(result.position, [10, 11]);
    assert.equal(result.direction, 'EAST');
    assert.equal(result.openTeleporters.has('0,10,11'), false);
    assert.deepEqual(result.pendingSensorEvents, [{ level: 0, sensorIndex: 999, remaining: 0.2 }]);
});

test('applyOpenedTeleporterEffects reuses hydrated levels after a party transport within the same pass', () => {
    const seenHydratedLevels: number[][] = [];

    applyOpenedTeleporterEffects(
        createBaseState({
            position: [3, 2],
            openTeleporters: new Set<string>(['0,3,2', '0,5,4']),
        }),
        ['0,3,2', '0,5,4'],
        {
            getTile: () => createTeleporterTile(0, 0, 1, 7, 8),
            getTeleporter: (tile) => tile.objects[0]?.category === 'Teleporter' ? tile.objects[0] : undefined,
            resolveProjectileTeleporterTransport: () => ({ level: 1, x: 7, y: 8, direction: 'EAST' }),
            applyPartyTelefragAtSquare: () => null,
            buildLevelHydrationPatch: (state) => ({
                hydratedLevels: new Set<number>([...state.hydratedLevels, 1]),
                creatures: state.creatures,
                floorItems: state.floorItems,
            }),
            applyCreaturesStandingOnOpenTeleporter: (state) => {
                seenHydratedLevels.push([...state.hydratedLevels]);
                return null;
            },
            buildSensorStateSnapshot: (state) => state,
            triggerFloorSensors: () => ({ sensorChanges: {}, pendingSensorEvents: [] }),
        },
    );

    assert.deepEqual(seenHydratedLevels, [[0, 1], [0, 1]]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStoreBootstrapRuntime } from '../src/engine/systems/storeBootstrapRuntime.js';
import type { GameOptions } from '../src/engine/runtimeTypes.js';
import type { CreatureInstance, FloorItem } from '../src/types/game.js';

const TEST_OPTIONS: GameOptions = {
    keybindings: {
        moveForward: ['w'],
        moveBackward: ['s'],
        turnLeft: ['a'],
        turnRight: ['d'],
        strafeLeft: ['q'],
        strafeRight: ['e'],
    },
};

test('store bootstrap runtime builds a fresh exploration-ready dungeon state', () => {
    const creature: CreatureInstance = {
        id: 'creature-1',
        groupId: 'group-1',
        typeId: 7,
        mapIndex: 0,
        x: 0,
        y: 0,
        currentHP: 12,
        alive: true,
        cell: 'center',
        carriedItems: [],
    };
    const floorItem: FloorItem = {
        id: 'item-1',
        category: 'Weapon',
        typeId: 1,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
    const { buildFreshDungeonState } = createStoreBootstrapRuntime({
        hallStart: [3, 1],
        hallStartDirection: 'SOUTH',
        buildDefaultOpenDoors: () => new Set<string>(['0,4,2']),
        buildDefaultOpenPits: () => new Set<string>(['1,2,3']),
        buildDefaultOpenTeleporters: () => new Set<string>(['4,5,6']),
        buildDefaultVisibleTexts: () => new Set<string>(['txt']),
        buildCreatureInstancesForLevel: () => [creature],
        buildFloorItemsForLevel: () => [floorItem],
    });

    const state = buildFreshDungeonState(TEST_OPTIONS, 'exploration');

    assert.equal(state.level, 0);
    assert.deepEqual(state.position, [3, 1]);
    assert.equal(state.direction, 'SOUTH');
    assert.equal(state.gamePhase, 'exploration');
    assert.deepEqual([...state.hydratedLevels], [0]);
    assert.deepEqual([...state.openDoors], ['0,4,2']);
    assert.deepEqual([...state.openPits], ['1,2,3']);
    assert.deepEqual([...state.openTeleporters], ['4,5,6']);
    assert.deepEqual([...state.visibleTexts], ['txt']);
    assert.deepEqual(state.creatures, [creature]);
    assert.deepEqual(state.floorItems, [floorItem]);
    assert.equal(state.party.length, 0);
    assert.equal(state.pendingSensorEvents.length, 0);
    assert.equal(state.pendingGeneratorSpawns.length, 0);
    assert.equal(state.sleeping, false);
    assert.equal(state.endgameSequence, null);
    assert.equal(state.activeFloorDrag, null);
    assert.equal(state.tutorialOverlayActive, false);
});

test('store bootstrap runtime keeps title boot lightweight until world hydration is needed', () => {
    let openPitsCalls = 0;
    let openDoorsCalls = 0;
    let openTeleportersCalls = 0;
    let visibleTextsCalls = 0;
    let creaturesCalls = 0;
    let floorItemsCalls = 0;

    const { buildFreshDungeonState } = createStoreBootstrapRuntime({
        hallStart: [3, 1],
        hallStartDirection: 'SOUTH',
        buildDefaultOpenDoors: () => {
            openDoorsCalls += 1;
            return new Set<string>(['0,4,2']);
        },
        buildDefaultOpenPits: () => {
            openPitsCalls += 1;
            return new Set<string>(['1,2,3']);
        },
        buildDefaultOpenTeleporters: () => {
            openTeleportersCalls += 1;
            return new Set<string>(['4,5,6']);
        },
        buildDefaultVisibleTexts: () => {
            visibleTextsCalls += 1;
            return new Set<string>(['txt']);
        },
        buildCreatureInstancesForLevel: () => {
            creaturesCalls += 1;
            return [];
        },
        buildFloorItemsForLevel: () => {
            floorItemsCalls += 1;
            return [];
        },
    });

    const state = buildFreshDungeonState(TEST_OPTIONS, 'title');

    assert.equal(state.gamePhase, 'title');
    assert.deepEqual([...state.hydratedLevels], []);
    assert.deepEqual([...state.openDoors], []);
    assert.deepEqual([...state.openPits], []);
    assert.deepEqual([...state.openTeleporters], []);
    assert.deepEqual([...state.visibleTexts], []);
    assert.deepEqual(state.creatures, []);
    assert.deepEqual(state.floorItems, []);
    assert.equal(state.tutorialOverlayActive, false);
    assert.equal(openPitsCalls, 0);
    assert.equal(openDoorsCalls, 0);
    assert.equal(openTeleportersCalls, 0);
    assert.equal(visibleTextsCalls, 0);
    assert.equal(creaturesCalls, 0);
    assert.equal(floorItemsCalls, 0);
});

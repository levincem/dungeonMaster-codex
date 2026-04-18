import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStoreBootstrapRuntime } from '../src/engine/systems/storeBootstrapRuntime.js';

test('store bootstrap runtime builds a fresh exploration-ready dungeon state', () => {
    const { buildFreshDungeonState } = createStoreBootstrapRuntime({
        hallStart: [3, 1],
        hallStartDirection: 'SOUTH',
        buildDefaultOpenPits: () => new Set<string>(['1,2,3']),
        buildDefaultOpenTeleporters: () => new Set<string>(['4,5,6']),
        buildDefaultVisibleTexts: () => new Set<string>(['txt']),
        buildCreatureInstancesForLevel: () => [{ id: 'creature-1' }] as any,
        buildFloorItemsForLevel: () => [{ id: 'item-1' }] as any,
    });

    const state = buildFreshDungeonState({ locale: 'fr' } as any, 'exploration');

    assert.equal(state.level, 0);
    assert.deepEqual(state.position, [3, 1]);
    assert.equal(state.direction, 'SOUTH');
    assert.equal(state.gamePhase, 'exploration');
    assert.deepEqual([...state.hydratedLevels], [0]);
    assert.deepEqual([...state.openPits], ['1,2,3']);
    assert.deepEqual([...state.openTeleporters], ['4,5,6']);
    assert.deepEqual([...state.visibleTexts], ['txt']);
    assert.deepEqual(state.creatures, [{ id: 'creature-1' }]);
    assert.deepEqual(state.floorItems, [{ id: 'item-1' }]);
    assert.equal(state.party.length, 0);
    assert.equal(state.pendingSensorEvents.length, 0);
    assert.equal(state.pendingGeneratorSpawns.length, 0);
    assert.equal(state.sleeping, false);
    assert.equal(state.endgameSequence, null);
    assert.equal(state.activeFloorDrag, null);
});

test('store bootstrap runtime keeps title boot lightweight until world hydration is needed', () => {
    let openPitsCalls = 0;
    let openTeleportersCalls = 0;
    let visibleTextsCalls = 0;
    let creaturesCalls = 0;
    let floorItemsCalls = 0;

    const { buildFreshDungeonState } = createStoreBootstrapRuntime({
        hallStart: [3, 1],
        hallStartDirection: 'SOUTH',
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
            return [{ id: 'creature-1' }] as any;
        },
        buildFloorItemsForLevel: () => {
            floorItemsCalls += 1;
            return [{ id: 'item-1' }] as any;
        },
    });

    const state = buildFreshDungeonState({ locale: 'fr' } as any, 'title');

    assert.equal(state.gamePhase, 'title');
    assert.deepEqual([...state.hydratedLevels], []);
    assert.deepEqual([...state.openPits], []);
    assert.deepEqual([...state.openTeleporters], []);
    assert.deepEqual([...state.visibleTexts], []);
    assert.deepEqual(state.creatures, []);
    assert.deepEqual(state.floorItems, []);
    assert.equal(openPitsCalls, 0);
    assert.equal(openTeleportersCalls, 0);
    assert.equal(visibleTextsCalls, 0);
    assert.equal(creaturesCalls, 0);
    assert.equal(floorItemsCalls, 0);
});

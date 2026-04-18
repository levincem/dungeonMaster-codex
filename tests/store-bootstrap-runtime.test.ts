import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStoreBootstrapRuntime } from '../src/engine/systems/storeBootstrapRuntime.js';

test('store bootstrap runtime builds a fresh exploration-ready dungeon state', () => {
    const { buildFreshDungeonState } = createStoreBootstrapRuntime({
        hallStart: [3, 1],
        hallStartDirection: 'SOUTH',
        buildOpenPits: () => new Set<string>(['1,2,3']),
        buildOpenTeleporters: () => new Set<string>(['4,5,6']),
        buildVisibleTexts: () => new Set<string>(['txt']),
        buildCreatureInstances: () => [{ id: 'creature-1' }] as any,
        buildFloorItems: () => [{ id: 'item-1' }] as any,
    });

    const state = buildFreshDungeonState({ locale: 'fr' } as any, 'exploration');

    assert.equal(state.level, 0);
    assert.deepEqual(state.position, [3, 1]);
    assert.equal(state.direction, 'SOUTH');
    assert.equal(state.gamePhase, 'exploration');
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

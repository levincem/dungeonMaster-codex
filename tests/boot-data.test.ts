import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDungeonDataSync } from '../src/data/dungeonData.js';
import { getGameDbRawSync } from '../src/data/gameDbData.js';
import { getOriginalWallOverlayDataSync } from '../src/data/originalWallOverlayData.js';

test('dungeon data access fails before preload completes', () => {
    assert.throws(
        () => getDungeonDataSync<unknown>(),
        /Dungeon data accessed before preload completed\./,
    );
});

test('game_db access fails before preload completes', () => {
    assert.throws(
        () => getGameDbRawSync(),
        /game_db data accessed before preload completed\./,
    );
});

test('wall overlay access fails before preload completes', () => {
    assert.throws(
        () => getOriginalWallOverlayDataSync<unknown>(),
        /Original wall overlay data accessed before preload completed\./,
    );
});

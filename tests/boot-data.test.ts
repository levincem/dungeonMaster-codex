import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDungeonDataSync } from '../src/data/dungeonData.js';
import {
    getGameDbCreaturesRawSync,
    getGameDbItemsRawSync,
    resetGameDbDataForTests,
    getGameDbWeaponAttacksRawSync,
} from '../src/data/gameDbData.js';
import { getOriginalWallOverlayMapDataSync } from '../src/data/originalWallOverlayData.js';

test('dungeon data access fails before preload completes', () => {
    assert.throws(
        () => getDungeonDataSync<unknown>(),
        /Dungeon data accessed before preload completed\./,
    );
});

test('game_db slice access fails before preload completes', () => {
    resetGameDbDataForTests();
    assert.throws(
        () => getGameDbItemsRawSync(),
        /game_db items data accessed before preload completed\./,
    );
    assert.throws(
        () => getGameDbWeaponAttacksRawSync(),
        /game_db weapon attacks data accessed before preload completed\./,
    );
    assert.throws(
        () => getGameDbCreaturesRawSync(),
        /game_db creatures data accessed before preload completed\./,
    );
});

test('wall overlay access fails before preload completes', () => {
    assert.throws(
        () => getOriginalWallOverlayMapDataSync<unknown>(0),
        /Original wall overlay data for map 0 accessed before preload completed\./,
    );
});

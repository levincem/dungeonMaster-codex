import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { collectDungeonSceneBlackFlamePits } from '../src/components/Dungeon/dungeonSceneDerivedState.js';
import type { GameMap } from '../src/types/game.js';

type RawTile = {
    x: number;
    y: number;
    type: string;
    objects: Array<Record<string, unknown>>;
};

type RawMap = {
    index: number;
    width: number;
    height: number;
    tiles: RawTile[];
};

function readRuntimeMap(index: number): GameMap {
    const raw = JSON.parse(
        readFileSync(`${process.cwd()}\\src\\assets\\runtime\\dungeon\\maps\\level-${index}.json`, 'utf8'),
    ) as RawMap;
    const tiles: GameMap['tiles'] = Array.from(
        { length: raw.height },
        (_, y) => Array.from({ length: raw.width }, (__, x) => ({
            x,
            y,
            type: 'Wall',
            objects: [],
        }) as GameMap['tiles'][number][number]),
    );
    for (const tile of raw.tiles) {
        tiles[tile.y][tile.x] = tile as unknown as GameMap['tiles'][number][number];
    }
    return {
        ...raw,
        name: `Level ${index}`,
        level: index,
        difficulty: 0,
        tiles,
    } as GameMap;
}

test('level 12 exposes the source-backed Black Flame pit floor markers at every Black Flame generator tile', () => {
    const pits = collectDungeonSceneBlackFlamePits({ map: readRuntimeMap(12) })
        .map(({ tileX, tileY }) => ({ x: tileX, y: tileY }))
        .sort((a, b) => (a.y - b.y) || (a.x - b.x));

    assert.deepEqual(pits, [
        { x: 7, y: 1 },
        { x: 19, y: 4 },
        { x: 12, y: 10 },
        { x: 13, y: 10 },
        { x: 14, y: 10 },
        { x: 19, y: 10 },
        { x: 18, y: 11 },
        { x: 12, y: 12 },
        { x: 13, y: 12 },
        { x: 20, y: 9 },
        { x: 2, y: 18 },
    ].sort((a, b) => (a.y - b.y) || (a.x - b.x)));
});

test('other maps do not accidentally expose Black Flame pit markers', () => {
    assert.deepEqual(collectDungeonSceneBlackFlamePits({ map: readRuntimeMap(11) }), []);
    assert.deepEqual(collectDungeonSceneBlackFlamePits({ map: readRuntimeMap(13) }), []);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { GameMap } from '../src/types/game.js';

type RawTile = {
    x: number;
    y: number;
    type: string;
    objects: Array<Record<string, unknown>>;
};

type RawMap = {
    width: number;
    height: number;
    tiles: RawTile[];
};

function readRuntimeMap(level: number): GameMap {
    const raw = JSON.parse(
        readFileSync(`${process.cwd()}\\src\\assets\\runtime\\dungeon\\maps\\level-${level}.json`, 'utf8'),
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
        index: level,
        name: `Level ${level}`,
        level,
        difficulty: 0,
        tiles,
    } as GameMap;
}

function collectDoorTypes(level: number): Array<{ x: number; y: number; doorType: number | null }> {
    const map = readRuntimeMap(level);
    const out: Array<{ x: number; y: number; doorType: number | null }> = [];
    for (const row of map.tiles) {
        for (const tile of row) {
            if (tile.type !== 'Door') continue;
            const door = tile.objects.find((object) => object.category === 'Door') as { doorType?: number } | undefined;
            out.push({
                x: tile.x,
                y: tile.y,
                doorType: typeof door?.doorType === 'number' ? door.doorType : null,
            });
        }
    }
    return out;
}

test('the final dungeon levels keep the source-backed iron doors only at the four known endgame coordinates', () => {
    assert.deepEqual(collectDoorTypes(12), [
        { x: 17, y: 0, doorType: 2 },
        { x: 19, y: 2, doorType: 2 },
    ]);

    assert.deepEqual(collectDoorTypes(13), [
        { x: 22, y: 5, doorType: 2 },
        { x: 24, y: 8, doorType: 2 },
    ]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getGameMap } from '../src/data/mapLoader.js';
import { getDungeonBootstrapSync, preloadDungeonData } from '../src/data/dungeonData.js';
import { normalizeScrollText } from '../src/data/textNormalization.js';

type SourceDungeon = {
    startPosition: {
        map: number;
        x: number;
        y: number;
        direction: string;
    };
    champions: unknown[];
    maps: SourceMap[];
};

type SourceMap = Record<string, unknown> & {
    index: number;
    tiles: SourceTile[];
};

type SourceTile = Record<string, unknown> & {
    x: number;
    y: number;
    objects?: SourceObject[];
};

type SourceObject = Record<string, unknown> & {
    category: string;
    index: number;
};

const SOURCE_DUNGEON_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\output\\dungeon.json`;

function readSourceDungeon(): SourceDungeon {
    return JSON.parse(readFileSync(SOURCE_DUNGEON_PATH, 'utf8')) as SourceDungeon;
}

function normalizeSourceObject(object: SourceObject): SourceObject {
    if (object.category !== 'Text') return object;
    return {
        ...object,
        text: normalizeScrollText(typeof object.text === 'string' ? object.text : undefined),
    };
}

function normalizeSourceMap(map: SourceMap): SourceMap {
    return {
        ...map,
        tiles: [...map.tiles]
            .sort((left, right) => left.y - right.y || left.x - right.x)
            .map((tile) => ({
                ...tile,
                objects: (tile.objects ?? []).map(normalizeSourceObject),
            })),
    };
}

function isRuntimeHelperText(mapIndex: number, tile: Record<string, unknown>, object: Record<string, unknown>): boolean {
    return mapIndex === 0
        && tile.x === 9
        && tile.y === 3
        && object.category === 'Text'
        && object.index === 1000003;
}

function normalizeLoadedMap(mapIndex: number): SourceMap {
    const map = getGameMap(mapIndex) as unknown as Record<string, unknown> & {
        tiles: Array<Array<Record<string, unknown> & { objects?: Array<Record<string, unknown>> }>>;
    };
    const normalizedTiles = map.tiles
        .flat()
        .sort((left, right) => Number(left.y) - Number(right.y) || Number(left.x) - Number(right.x))
        .map((tile) => ({
            ...(tile as unknown as SourceTile),
            objects: (tile.objects ?? [])
                .filter((object) => !isRuntimeHelperText(mapIndex, tile, object))
                .map((object) => (
                    object.category !== 'Text'
                        ? object as unknown as SourceObject
                        : {
                            ...(object as unknown as SourceObject),
                            text: normalizeScrollText(typeof object.text === 'string' ? object.text : undefined),
                        }
                )),
        }));

    return {
        ...(map as unknown as SourceMap),
        tiles: normalizedTiles,
    };
}

test('runtime bootstrap preserves the extracted dungeon start position and champion records', async () => {
    await preloadDungeonData();

    const sourceDungeon = readSourceDungeon();
    const bootstrap = getDungeonBootstrapSync<{
        startPosition: SourceDungeon['startPosition'];
        champions: unknown[];
    }>();

    assert.deepEqual(bootstrap.startPosition, sourceDungeon.startPosition);
    assert.deepEqual(bootstrap.champions, sourceDungeon.champions);
});

test('getGameMap preserves every extracted dungeon map, tile, and object field', async () => {
    await preloadDungeonData();

    const sourceDungeon = readSourceDungeon();

    for (const sourceMap of sourceDungeon.maps) {
        const expected = normalizeSourceMap(sourceMap);
        const actual = normalizeLoadedMap(sourceMap.index);
        assert.deepEqual(actual, expected, `map ${sourceMap.index} diverged from extracted dungeon data`);
    }
});

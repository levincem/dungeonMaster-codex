import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SensorObject, TileType } from '../src/types/game.js';
import { getDungeonDataSync, preloadDungeonData } from '../src/data/dungeonData.js';

test('floor type 3 sensors never expose named object requirements across runtime maps', async () => {
    await preloadDungeonData();

    const dungeon = getDungeonDataSync<{
        maps: Array<{
            index: number;
            tiles: Array<{
                type: TileType;
                objects?: SensorObject[];
            }>;
        }>;
    }>();

    const invalidSensors: Array<{
        level: number;
        tileType: TileType;
        sensorIndex: number;
        requiredObjectName: string;
    }> = [];

    for (const map of dungeon.maps) {
        for (const tile of map.tiles ?? []) {
            if (tile.type === 'Wall' || tile.type === 'TrickWall') continue;

            for (const object of tile.objects ?? []) {
                if (object.category !== 'Sensor' || object.type !== 3 || !object.requiredObjectName) continue;
                invalidSensors.push({
                    level: map.index,
                    tileType: tile.type,
                    sensorIndex: object.index,
                    requiredObjectName: object.requiredObjectName,
                });
            }
        }
    }

    assert.deepEqual(invalidSensors, []);
});

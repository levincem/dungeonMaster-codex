import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    getAllOriginalGeneratorConfigs,
    getOriginalGeneratorConfig,
} from '../src/data/originalGenerators.js';

type SensorObject = {
    category: string;
    index: number;
    type: number;
    data: number;
    delay?: number;
    multipleValue?: number;
    raw?: {
        fields?: {
            delayBits?: number;
            multipleBits?: number;
        };
    };
};

type SourceTile = {
    x: number;
    y: number;
    type: string;
    objects?: SensorObject[];
};

type SourceMap = {
    index: number;
    tiles: SourceTile[];
};

type SourceDungeon = {
    maps: SourceMap[];
};

function readSourceDungeon(): SourceDungeon {
    return JSON.parse(
        readFileSync(`${process.cwd()}\\assets\\OriginalDataExtraction\\output\\dungeon.json`, 'utf8'),
    ) as SourceDungeon;
}

test('original generator configs match only floor type-6 generator sensors from the extracted dungeon data', () => {
    const dungeon = readSourceDungeon();
    const expected = new Map<string, ReturnType<typeof getOriginalGeneratorConfig>>();

    for (const map of dungeon.maps) {
        for (const tile of map.tiles) {
            if (tile.type !== 'Floor') continue;
            for (const object of tile.objects ?? []) {
                if (object.category !== 'Sensor' || object.type !== 6) continue;
                const countValue = (object.raw?.fields?.delayBits ?? object.delay ?? 0) & 0xF;
                const multiple = object.raw?.fields?.multipleBits ?? object.multipleValue ?? 0;
                expected.set(`${map.index}_${object.index}`, {
                    typeId: object.data,
                    countRaw: countValue & 0x7,
                    randomized: Boolean(countValue & 0x8),
                    hpMultiplier: multiple & 0xF,
                    ticks: multiple >> 4,
                    spawnX: tile.x,
                    spawnY: tile.y,
                });
            }
        }
    }

    assert.equal(expected.size, 50, 'the extracted dungeon should expose exactly 50 floor group generators');
    assert.equal(Object.keys(getAllOriginalGeneratorConfigs()).length, expected.size);

    for (const [key, config] of expected) {
        const [level, sensorIndex] = key.split('_').map(Number);
        assert.deepEqual(
            getOriginalGeneratorConfig(level, sensorIndex),
            config,
            `generator config drifted for ${key}`,
        );
    }

    assert.equal(getOriginalGeneratorConfig(5, 135), null, 'wall countdown 5_135 must not be treated as a group generator');
    assert.equal(getOriginalGeneratorConfig(5, 616), null, 'wall countdown 5_616 must not be treated as a group generator');
    assert.equal(getOriginalGeneratorConfig(11, 421), null, 'wall countdown 11_421 must not be treated as a group generator');
});

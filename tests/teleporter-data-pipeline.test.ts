import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getGameMap } from '../src/data/mapLoader.js';
import { getOriginalTeleporterRuntime } from '../src/data/originalTeleporters.js';
import type { CardinalDir, TeleporterObject } from '../src/types/game.js';

type SourceDungeon = {
    maps?: Array<{
        index: number;
        tiles?: Array<{
            x: number;
            y: number;
            objects?: Array<{
                category?: string;
                index?: number;
                scope?: string;
                rotationType?: number;
                rotation?: CardinalDir;
                destMap?: number;
                destX?: number;
                destY?: number;
            }>;
        }>;
    }>;
};

type SourceTeleporterRecord = {
    mapIndex: number;
    x: number;
    y: number;
    index: number;
    scope: string;
    rotationType: number;
    rotation: CardinalDir;
    destMap: number;
    destX: number;
    destY: number;
};

const SOURCE_DUNGEON_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\output\\dungeon.json`;

function readSourceTeleporters(): SourceTeleporterRecord[] {
    const dungeon = JSON.parse(readFileSync(SOURCE_DUNGEON_PATH, 'utf8')) as SourceDungeon;
    const teleporters: SourceTeleporterRecord[] = [];

    for (const map of dungeon.maps ?? []) {
        for (const tile of map.tiles ?? []) {
            for (const object of tile.objects ?? []) {
                if (object.category !== 'Teleporter') continue;
                if (
                    typeof object.index !== 'number'
                    || typeof object.scope !== 'string'
                    || typeof object.rotationType !== 'number'
                    || typeof object.rotation !== 'string'
                    || typeof object.destMap !== 'number'
                    || typeof object.destX !== 'number'
                    || typeof object.destY !== 'number'
                ) {
                    continue;
                }
                teleporters.push({
                    mapIndex: map.index,
                    x: tile.x,
                    y: tile.y,
                    index: object.index,
                    scope: object.scope,
                    rotationType: object.rotationType,
                    rotation: object.rotation,
                    destMap: object.destMap,
                    destX: object.destX,
                    destY: object.destY,
                });
            }
        }
    }

    return teleporters;
}

function describeRecord(record: SourceTeleporterRecord): string {
    return `map=${record.mapIndex} x=${record.x} y=${record.y} index=${record.index}`;
}

test('original teleporter runtime references preserve all source teleporter transport fields', () => {
    const mismatches: string[] = [];

    for (const record of readSourceTeleporters()) {
        const runtime = getOriginalTeleporterRuntime(record.mapIndex, record.x, record.y, record.index);
        if (!runtime) {
            mismatches.push(`${describeRecord(record)} missing from original_teleporters_runtime`);
            continue;
        }

        if (runtime.scope !== record.scope) {
            mismatches.push(`${describeRecord(record)} scope ${runtime.scope} !== ${record.scope}`);
        }
        if (runtime.rotationType !== record.rotationType) {
            mismatches.push(`${describeRecord(record)} rotationType ${runtime.rotationType} !== ${record.rotationType}`);
        }
        if (runtime.rotation !== record.rotation) {
            mismatches.push(`${describeRecord(record)} rotation ${runtime.rotation} !== ${record.rotation}`);
        }
        if (runtime.destMap !== record.destMap || runtime.destX !== record.destX || runtime.destY !== record.destY) {
            mismatches.push(
                `${describeRecord(record)} destination ${runtime.destMap},${runtime.destX},${runtime.destY} !== ${record.destMap},${record.destX},${record.destY}`,
            );
        }
    }

    assert.deepEqual(mismatches, []);
});

test('getGameMap preserves critical teleporter runtime fields for every source teleporter', () => {
    const mismatches: string[] = [];

    for (const record of readSourceTeleporters()) {
        const map = getGameMap(record.mapIndex);
        const tile = map.tiles[record.y]?.[record.x];
        if (tile?.type !== 'Teleporter') {
            mismatches.push(`${describeRecord(record)} missing teleporter tile in getGameMap`);
            continue;
        }

        const teleporter = tile.objects.find(
            (entry): entry is TeleporterObject => entry.category === 'Teleporter' && entry.index === record.index,
        );
        if (!teleporter) {
            mismatches.push(`${describeRecord(record)} missing teleporter object in getGameMap`);
            continue;
        }

        if (teleporter.scope !== record.scope) {
            mismatches.push(`${describeRecord(record)} loaded scope ${teleporter.scope} !== ${record.scope}`);
        }
        if (teleporter.rotationType !== record.rotationType) {
            mismatches.push(`${describeRecord(record)} loaded rotationType ${teleporter.rotationType} !== ${record.rotationType}`);
        }
        if (teleporter.rotation !== record.rotation) {
            mismatches.push(`${describeRecord(record)} loaded rotation ${teleporter.rotation} !== ${record.rotation}`);
        }
        if (teleporter.destMap !== record.destMap || teleporter.destX !== record.destX || teleporter.destY !== record.destY) {
            mismatches.push(
                `${describeRecord(record)} loaded destination ${teleporter.destMap},${teleporter.destX},${teleporter.destY} !== ${record.destMap},${record.destX},${record.destY}`,
            );
        }
    }

    assert.deepEqual(mismatches, []);
});

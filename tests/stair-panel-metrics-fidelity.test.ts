import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GRID_SIZE, WALL_HEIGHT } from '../src/engine/constants.js';
import { miscPath } from '../src/data/assetPaths.js';
import {
    ORIGINAL_FRONT_WALL_REFERENCE_HEIGHT,
    ORIGINAL_FRONT_WALL_REFERENCE_WIDTH,
    ORIGINAL_STAIRS_DOWN_FRONT2_HEIGHT,
    ORIGINAL_STAIRS_DOWN_FRONT2_WIDTH,
    ORIGINAL_STAIRS_UP_FRONT2_HEIGHT,
    ORIGINAL_STAIRS_UP_FRONT2_WIDTH,
    getOriginalStairsDownFrontHeightRatio,
    getOriginalStairsDownFrontWidthRatio,
    getOriginalStairsUpFrontHeightRatio,
    getOriginalStairsUpFrontWidthRatio,
} from '../src/data/originalStairPanelMetrics.js';
import { getWallDecalPresetForImage } from '../src/data/wallDecalPresets.js';

type GraphicsDbEntry = {
    description?: string | null;
    width?: number | null;
    height?: number | null;
};

function findEntriesWithDescription(value: unknown, out: GraphicsDbEntry[] = []): GraphicsDbEntry[] {
    if (Array.isArray(value)) {
        for (const item of value) findEntriesWithDescription(item, out);
        return out;
    }
    if (!value || typeof value !== 'object') return out;

    const entry = value as GraphicsDbEntry;
    if (typeof entry.description === 'string') {
        out.push(entry);
    }

    for (const nested of Object.values(value as Record<string, unknown>)) {
        findEntriesWithDescription(nested, out);
    }
    return out;
}

function requireEntry(entries: GraphicsDbEntry[], description: string): GraphicsDbEntry {
    const entry = entries.find((candidate) => candidate.description === description);
    assert.ok(entry, `graphics_db should contain ${description}`);
    return entry;
}

test('stair front panel metrics stay aligned with extracted graphics_db dimensions', () => {
    const graphicsDb = JSON.parse(
        readFileSync(`${process.cwd()}\\public\\graphics_db.json`, 'utf8'),
    ) as Record<string, unknown>;
    const entries = findEntriesWithDescription(graphicsDb);

    const wallFront = requireEntry(entries, 'Dungeon Graphics - Wall (Front 1)');
    assert.equal(wallFront.width, ORIGINAL_FRONT_WALL_REFERENCE_WIDTH, 'front wall reference width drifted');
    assert.equal(wallFront.height, ORIGINAL_FRONT_WALL_REFERENCE_HEIGHT, 'front wall reference height drifted');

    const stairsUp = requireEntry(entries, 'Dungeon Graphics - Stairs Up (Front 2)');
    assert.equal(stairsUp.width, ORIGINAL_STAIRS_UP_FRONT2_WIDTH, 'stairs up front-2 width drifted');
    assert.equal(stairsUp.height, ORIGINAL_STAIRS_UP_FRONT2_HEIGHT, 'stairs up front-2 height drifted');

    const stairsDown = requireEntry(entries, 'Dungeon Graphics - Stairs Down (Front 2)');
    assert.equal(stairsDown.width, ORIGINAL_STAIRS_DOWN_FRONT2_WIDTH, 'stairs down front-2 width drifted');
    assert.equal(stairsDown.height, ORIGINAL_STAIRS_DOWN_FRONT2_HEIGHT, 'stairs down front-2 height drifted');
});

test('wall decal stair presets use source-backed front-view stair proportions instead of the generic full-wall fallback', () => {
    const stairsUpPreset = getWallDecalPresetForImage(miscPath('stairs_up.png'));
    assert.ok(stairsUpPreset, 'stairs up decal preset should exist');
    assert.equal(
        stairsUpPreset.width,
        GRID_SIZE * getOriginalStairsUpFrontWidthRatio(),
        'stairs up decal width should follow the extracted front-view ratio',
    );
    assert.equal(
        stairsUpPreset.height,
        WALL_HEIGHT * getOriginalStairsUpFrontHeightRatio(),
        'stairs up decal height should follow the extracted front-view ratio',
    );

    const stairsDownPreset = getWallDecalPresetForImage(miscPath('stairs_down.png'));
    assert.ok(stairsDownPreset, 'stairs down decal preset should exist');
    assert.equal(
        stairsDownPreset.width,
        GRID_SIZE * getOriginalStairsDownFrontWidthRatio(),
        'stairs down decal width should follow the extracted front-view ratio',
    );
    assert.equal(
        stairsDownPreset.height,
        WALL_HEIGHT * getOriginalStairsDownFrontHeightRatio(),
        'stairs down decal height should follow the extracted front-view ratio',
    );
});

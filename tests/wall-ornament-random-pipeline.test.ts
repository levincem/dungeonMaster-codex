import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type RandomPoolEntry = {
    index: number;
    name: string;
    classification: string;
};

type RandomCapableFace = {
    mapIndex: number;
    x: number;
    y: number;
    face: string;
    randomPool?: RandomPoolEntry[];
    overlayName?: string | null;
    resolvedRandomIndex?: number;
};

type OverlayPositionsData = {
    randomCapableFaces?: RandomCapableFace[];
    effectivePlacements?: RandomCapableFace[];
};

function readJson<T>(relativePath: string): T {
    return JSON.parse(readFileSync(`${process.cwd()}\\${relativePath}`, 'utf8')) as T;
}

function findLevelOneWishFountainFace(data: OverlayPositionsData): RandomCapableFace | undefined {
    return (data.randomCapableFaces ?? []).find((face) =>
        face.mapIndex === 1 &&
        face.x === 4 &&
        face.y === 6 &&
        face.face === 'West',
    );
}

function findLevelOneResolvedRandomFountainFace(data: OverlayPositionsData): RandomCapableFace | undefined {
    return (data.effectivePlacements ?? []).find((face) =>
        face.mapIndex === 1 &&
        face.x === 4 &&
        face.y === 7 &&
        face.face === 'East',
    );
}

test('runtime wall overlay snapshot preserves random-capable wall ornament faces from the full extracted export', () => {
    const fullExport = readJson<OverlayPositionsData>('public\\original_wall_overlay_positions.json');
    const runtimeSnapshot = readJson<OverlayPositionsData>('src\\assets\\runtime\\support\\original_wall_overlay_positions.json');

    const expectedFace = findLevelOneWishFountainFace(fullExport);
    assert.ok(expectedFace, 'expected the extracted export to include Level 1 (4,6) West as a random-capable wall ornament face');

    const runtimeFace = findLevelOneWishFountainFace(runtimeSnapshot);
    assert.deepEqual(
        runtimeFace,
        expectedFace,
        'runtime snapshot should preserve the full random-capable wall face entry instead of dropping it',
    );

    assert.ok(
        runtimeFace?.randomPool?.some((entry) => entry.name === 'Fountain'),
        'the preserved random-capable face should keep Fountain in its original random pool',
    );
});

test('per-map runtime wall overlay support keeps random-capable entries and effective placements', () => {
    const runtimeMap = readJson<OverlayPositionsData>('src\\assets\\runtime\\support\\wall_overlays\\map-01.json');

    const randomFace = findLevelOneWishFountainFace(runtimeMap);
    assert.ok(randomFace, 'Level 1 wall overlay support map should keep the random-capable fountain candidate face');
    assert.ok(
        randomFace.randomPool?.some((entry) => entry.name === 'Fountain'),
        'per-map runtime support should preserve the original random ornament pool for the face',
    );

    const effectiveFace = (runtimeMap.effectivePlacements ?? []).find((face) =>
        face.mapIndex === 1 &&
        face.x === 4 &&
        face.y === 6 &&
        face.face === 'West',
    );
    assert.ok(effectiveFace, 'per-map runtime support should keep effective placements for random-capable faces too');
});

test('runtime wall overlay effective placements resolve deterministic random ornaments with the original engine formula', () => {
    const runtimeMap = readJson<OverlayPositionsData>('src\\assets\\runtime\\support\\wall_overlays\\map-01.json');

    const missingFace = (runtimeMap.effectivePlacements ?? []).find((face) =>
        face.mapIndex === 1 &&
        face.x === 4 &&
        face.y === 6 &&
        face.face === 'West',
    );
    assert.ok(missingFace, 'expected Level 1 (4,6) West to be preserved as an effective random-capable face');
    assert.equal(
        missingFace?.overlayName ?? null,
        null,
        'Level 1 (4,6) West should stay empty when the original engine random ornament formula resolves no wall ornament there',
    );

    const resolvedFountainFace = findLevelOneResolvedRandomFountainFace(runtimeMap);
    assert.ok(resolvedFountainFace, 'expected Level 1 (4,7) East to remain present in effective placements');
    assert.equal(
        resolvedFountainFace?.overlayName,
        'Fountain',
        'Level 1 (4,7) East should resolve to Fountain through the original engine random ornament formula',
    );
    assert.equal(
        resolvedFountainFace?.resolvedRandomIndex,
        2,
        'resolved fountain face should keep the original engine random pool index used for the pick',
    );
});

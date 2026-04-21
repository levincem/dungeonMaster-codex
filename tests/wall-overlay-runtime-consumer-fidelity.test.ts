import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDungeonSceneWallDecals } from '../src/components/Dungeon/dungeonSceneDerivedState.js';
import { preloadDungeonData } from '../src/data/dungeonData.js';
import { getGameMap } from '../src/data/mapLoader.js';
import { preloadOriginalWallOverlayMapData } from '../src/data/originalWallOverlayData.js';
import { getOriginalWallOverlayVisual, getOriginalWallOverlaysForMap } from '../src/data/originalWallOverlays.js';
import type { GameMap } from '../src/types/game.js';

type OverlaySupportData = {
    fixedFaces?: Array<{
        variants?: Array<{
            overlayName: string;
        }>;
    }>;
    effectivePlacements?: Array<{
        overlayName: string | null;
    }>;
};

function createOpenRoomMap(): GameMap {
    return {
        index: 0,
        name: 'Test Map',
        level: 0,
        width: 3,
        height: 3,
        difficulty: 0,
        tiles: [
            [
                { x: 0, y: 0, type: 'Floor', objects: [] },
                { x: 1, y: 0, type: 'Floor', objects: [] },
                { x: 2, y: 0, type: 'Floor', objects: [] },
            ],
            [
                { x: 0, y: 1, type: 'Floor', objects: [] },
                { x: 1, y: 1, type: 'Wall', objects: [] },
                { x: 2, y: 1, type: 'Floor', objects: [] },
            ],
            [
                { x: 0, y: 2, type: 'Floor', objects: [] },
                { x: 1, y: 2, type: 'Floor', objects: [] },
                { x: 2, y: 2, type: 'Floor', objects: [] },
            ],
        ],
    };
}

test('all extracted fixed wall overlay names are explicitly mapped instead of falling back to generic runtime labels', () => {
    const supportData = JSON.parse(
        readFileSync(`${process.cwd()}\\src\\assets\\runtime\\support\\original_wall_overlay_positions.json`, 'utf8'),
    ) as OverlaySupportData;

    const omitted = new Set([
        'Champion Mirror',
        'Unreadable Wall Inscription',
    ]);

    const overlayNames = new Set(
        [
            ...(supportData.fixedFaces ?? [])
                .flatMap((face) => face.variants ?? [])
                .map((variant) => variant.overlayName),
            ...(supportData.effectivePlacements ?? [])
                .map((placement) => placement.overlayName)
                .filter((overlayName): overlayName is string => typeof overlayName === 'string' && overlayName.length > 0),
        ],
    );

    for (const overlayName of overlayNames) {
        if (omitted.has(overlayName)) continue;
        assert.ok(
            getOriginalWallOverlayVisual(overlayName),
            `overlay ${overlayName} is present in extracted support data but has no explicit runtime visual mapping`,
        );
    }
});

test('buildDungeonSceneWallDecals preserves overlay dimensions and interactive sensor links from source-backed overlay renders', () => {
    const map = createOpenRoomMap();
    const overlay = {
        tileX: 1,
        tileY: 1,
        face: 'South' as const,
        image: '/game/images/misc/wall_foutain_overlay.png',
        accent: '#78a8d8',
        width: 0.8,
        height: 1.06,
        interactiveSensorIndices: [77, 91],
    };

    const decals = buildDungeonSceneWallDecals({
        level: map.index,
        map,
        openDoors: new Set(),
        openWalls: new Set(),
        partyPosition: [2, 1],
        originalWallOverlays: [overlay],
    });

    assert.equal(decals.length, 1, 'the visible overlay should reach the wall decal consumer');
    assert.deepEqual(decals[0], overlay, 'wall decal consumer should preserve source-backed overlay render data verbatim');
});

test('buildDungeonSceneWallDecals drops overlays hidden behind opened self-revealing wall cavities', () => {
    const map = createOpenRoomMap();
    const overlay = {
        tileX: 1,
        tileY: 1,
        face: 'South' as const,
        image: '/game/images/misc/wall_foutain_overlay.png',
        width: 0.8,
        height: 1.06,
    };

    const decals = buildDungeonSceneWallDecals({
        level: map.index,
        map,
        openDoors: new Set(),
        openWalls: new Set(['0,1,1']),
        partyPosition: [2, 1],
        originalWallOverlays: [overlay],
        isSelfRevealingWallTile: (level, tileX, tileY) => level === 0 && tileX === 1 && tileY === 1,
    });

    assert.equal(decals.length, 0, 'opened self-revealing walls should hide their associated overlay decals');
});

test('buildDungeonSceneWallDecals no longer injects stair visuals as wall decals', () => {
    const map: GameMap = {
        index: 0,
        name: 'Stair Map',
        level: 0,
        width: 3,
        height: 3,
        difficulty: 0,
        tiles: [
            [
                { x: 0, y: 0, type: 'Wall', objects: [] },
                { x: 1, y: 0, type: 'Floor', objects: [] },
                { x: 2, y: 0, type: 'Wall', objects: [] },
            ],
            [
                { x: 0, y: 1, type: 'Wall', objects: [] },
                { x: 1, y: 1, type: 'Stairs', objects: [] },
                { x: 2, y: 1, type: 'Wall', objects: [] },
            ],
            [
                { x: 0, y: 2, type: 'Wall', objects: [] },
                { x: 1, y: 2, type: 'Wall', objects: [] },
                { x: 2, y: 2, type: 'Wall', objects: [] },
            ],
        ],
    };

    const decals = buildDungeonSceneWallDecals({
        level: map.index,
        map,
        openDoors: new Set(),
        openWalls: new Set(),
        partyPosition: [0, 1],
        originalWallOverlays: [],
    });

    assert.deepEqual(decals, [], 'stair visuals should now be rendered by dedicated cell geometry, not wall decals');
});

test('stateful fixed wall faces own their render slot and do not also emit duplicate effective placements', async () => {
    await preloadDungeonData();
    await preloadOriginalWallOverlayMapData(1);

    const map = getGameMap(1);
    const activeSensors = new Set<string>(['1_0']);
    const overlays = getOriginalWallOverlaysForMap(map, activeSensors);
    const leverFaceOverlays = overlays.filter((overlay) =>
        overlay.tileX === 6 &&
        overlay.tileY === 8 &&
        overlay.face === 'North',
    );

    assert.equal(
        leverFaceOverlays.length,
        1,
        'a stateful lever face should emit exactly one overlay even when effective placements also include the face',
    );
    assert.equal(
        leverFaceOverlays[0]?.image,
        getOriginalWallOverlayVisual('Lever Down')?.image,
        'the rendered lever state should follow the fixed-face stateful resolution, not an extra duplicate placement',
    );
});

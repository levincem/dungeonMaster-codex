import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildDungeonSceneWallButtons,
    collectDungeonScenePits,
    collectDungeonScenePressurePlates,
    collectDungeonSceneTeleporters,
    collectDungeonSceneTrickWalls,
    resolveAltarDropTargets,
    resolveFrontWallInteractionKind,
} from '../src/components/Dungeon/dungeonSceneDerivedState.js';
import type { CardinalDir, GameMap, GameTile, SensorObject } from '../src/types/game.js';

function createTile(x: number, y: number, type: GameTile['type'], objects: GameTile['objects'] = []): GameTile {
    return { x, y, type, objects };
}

function createMap(width: number, height: number, fill: GameTile['type'] = 'Floor'): GameMap {
    return {
        index: 0,
        name: 'test',
        level: 0,
        width,
        height,
        difficulty: 0,
        tiles: Array.from({ length: height }, (_, y) =>
            Array.from({ length: width }, (_, x) => createTile(x, y, fill))),
    };
}

function createSensor(index: number, tilePos: CardinalDir, isLocal: boolean): SensorObject {
    return {
        category: 'Sensor',
        index,
        tilePos,
        type: 1,
        data: 0,
        graphic: 0,
        isLocal,
        delay: 0,
        sound: false,
        revert: false,
        action: 'Set',
        onceOnly: false,
        targetY: 0,
        targetX: 0,
        targetDir: 'North',
    };
}

test('buildDungeonSceneWallButtons keeps the non-local sensor and ignores faces already covered by overlays', () => {
    const map = createMap(4, 3);
    map.tiles[1][2] = createTile(2, 1, 'Wall', [
        createSensor(3, 'West', true),
        createSensor(7, 'West', false),
    ]);

    const visibleButtons = buildDungeonSceneWallButtons({
        level: 0,
        map,
        openDoors: new Set(),
        openWalls: new Set(),
        partyPosition: [1, 1],
        originalWallOverlays: [],
    });

    assert.deepEqual(visibleButtons, [{ tileX: 2, tileY: 1, face: 'West', sensorIndex: 7 }]);

    const hiddenByOverlay = buildDungeonSceneWallButtons({
        level: 0,
        map,
        openDoors: new Set(),
        openWalls: new Set(),
        partyPosition: [1, 1],
        originalWallOverlays: [{ tileX: 2, tileY: 1, face: 'West' }],
    });

    assert.deepEqual(hiddenByOverlay, []);
});

test('buildDungeonSceneWallButtons ignores floor pressure sensors that should stay floor-only', () => {
    const map = createMap(4, 3);
    map.tiles[1][2] = createTile(2, 1, 'Floor', [
        createSensor(8, 'North', false),
    ]);

    const visibleButtons = buildDungeonSceneWallButtons({
        level: 0,
        map,
        openDoors: new Set(),
        openWalls: new Set(),
        partyPosition: [2, 2],
        originalWallOverlays: [],
    });

    assert.deepEqual(visibleButtons, []);
});

test('resolveAltarDropTargets keeps only visible altar faces that match the injected altar rule', () => {
    const map = createMap(4, 3);
    map.tiles[1][2] = createTile(2, 1, 'Wall');

    const targets = resolveAltarDropTargets({
        level: 0,
        map,
        position: [1, 1],
        direction: 'EAST',
        openDoors: new Set(),
        openWalls: new Set(),
        isAltarWallFace: (level, tileX, tileY, face) =>
            level === 0 && tileX === 2 && tileY === 1 && face === 'West',
        mapTileLookup: (_level, tileX, tileY) => map.tiles[tileY]?.[tileX],
    });

    assert.deepEqual(targets, [{ placement: 'front', wallX: 2, wallY: 1, face: 'West' }]);
});

test('resolveFrontWallInteractionKind treats a front fountain overlay as an interaction target even without a mechanism sensor', () => {
    const map = createMap(4, 3);
    map.tiles[1][2] = createTile(2, 1, 'Wall');

    const interaction = resolveFrontWallInteractionKind({
        level: 0,
        map,
        position: [1, 1],
        direction: 'EAST',
        openWalls: new Set(),
        hasEffectiveOriginalWallOverlayAt: (_level, tileX, tileY, face, overlayName) =>
            tileX === 2 && tileY === 1 && face === 'West' && overlayName === 'Fountain',
        getMechanismsAtFace: () => [],
    });

    assert.equal(interaction, 'fountain');
});

test('collectDungeonScene helpers keep only actionable plates, closed trick walls, and pits', () => {
    const map = createMap(4, 3);
    map.tiles[0][0] = createTile(0, 0, 'Pit');
    map.tiles[0][1] = createTile(1, 0, 'TrickWall');
    map.tiles[1][1] = createTile(1, 1, 'Floor');
    map.tiles[1][2] = createTile(2, 1, 'Door');
    map.tiles[2][0] = createTile(0, 2, 'Floor');

    const pressurePlates = collectDungeonScenePressurePlates({
        level: 0,
        map,
        mechanisms: [
            { support: 'Floor', trigger: 'floor-pressure', sensorType: 3, kind: 'Capteur de passage (party)', x: 1, y: 1 } as never,
            { support: 'Floor', trigger: 'floor-pressure', sensorType: 3, kind: 'Capteur de passage (party)', x: 1, y: 1 } as never,
            { support: 'Floor', trigger: 'object-pressure', sensorType: 4, kind: 'Dalle de pression (objet specifique)', x: 2, y: 1 } as never,
            { support: 'Floor', trigger: 'floor-pressure', sensorType: 5, kind: 'Dalle d escalier', x: 3, y: 1 } as never,
            { support: 'Floor', trigger: 'floor-pressure', sensorType: 1, kind: 'Dalle de pression (tout)', x: 0, y: 2 } as never,
            { support: 'Wall', trigger: 'floor-pressure', sensorType: 3, kind: 'Capteur de passage (party)', x: 0, y: 0 } as never,
        ],
    });

    assert.deepEqual(pressurePlates, [{ tileX: 0, tileY: 2, face: undefined }]);
    assert.deepEqual(collectDungeonSceneTrickWalls({ level: 0, map, openWalls: new Set() }), [{ tileX: 1, tileY: 0 }]);
    assert.deepEqual(
        collectDungeonSceneTrickWalls({ level: 0, map, openWalls: new Set(['0,0,1']) }),
        [],
    );
    assert.deepEqual(collectDungeonScenePits({ map }), [{ tileX: 0, tileY: 0 }]);
});

test('collectDungeonSceneTeleporters keeps active teleporters, including runtime-opened hidden ones', () => {
    const map = createMap(3, 2);
    map.tiles[0][1] = { ...createTile(1, 0, 'Teleporter'), open: true, visible: false };
    map.tiles[1][1] = { ...createTile(1, 1, 'Teleporter'), open: false, visible: false };

    assert.deepEqual(
        collectDungeonSceneTeleporters({
            level: 0,
            map,
            openTeleporters: new Set(['0,0,1', '0,1,1']),
        }),
        [
            { tileX: 1, tileY: 0 },
            { tileX: 1, tileY: 1 },
        ],
    );
});

test('collectDungeonSceneTeleporters hides raw-open teleporters when runtime state has turned them off', () => {
    const map = createMap(2, 1);
    map.tiles[0][1] = { ...createTile(1, 0, 'Teleporter'), open: true, visible: true };

    assert.deepEqual(
        collectDungeonSceneTeleporters({
            level: 0,
            map,
            openTeleporters: new Set(),
        }),
        [],
    );
});

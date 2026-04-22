import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInstancedTileLayout } from '../src/components/Dungeon/instancedTileLayout.js';
import type { GameMap, GameTile } from '../src/types/game.js';
import { GRID_SIZE } from '../src/engine/constants.js';

function createTile(x: number, y: number, type: GameTile['type']): GameTile {
    return { x, y, type, objects: [] };
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

test('buildInstancedTileLayout keeps a floor plane under trick walls so opened passages do not reveal a void', () => {
    const map = createMap(2, 2);
    map.tiles[1][1] = createTile(1, 1, 'TrickWall');

    const layout = buildInstancedTileLayout(map, new Set(), {
        isMirrorWall: () => false,
        getSelfRevealingWallFace: () => null,
        isSelfRevealingWallTile: () => false,
    });

    assert.ok(
        layout.floorPositions.some(([wx, wz]) => wx === GRID_SIZE && wz === GRID_SIZE),
        'trick wall tiles should keep an underlying floor plane',
    );
    assert.ok(
        layout.wallEntries.some(([wx, wz, key]) => wx === GRID_SIZE && wz === GRID_SIZE && key === '0,1,1'),
        'trick wall tiles should still keep their hideable wall volume entry',
    );
});

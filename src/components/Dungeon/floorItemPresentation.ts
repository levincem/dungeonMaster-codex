import { GRID_SIZE } from '../../engine/constants';
import type { Direction } from '../../engine/runtimeTypes';
import type { FloorItem } from '../../types/game';

const FLOOR_Y = -GRID_SIZE / 2;

export const FLOOR_ITEM_SIZE = GRID_SIZE * 0.38;

const FLOOR_ITEM_BASE_Y = FLOOR_Y + FLOOR_ITEM_SIZE * 0.22;
const OCCUPIED_TILE_VIEWER_BIAS = GRID_SIZE * 0.14;
const OCCUPIED_TILE_ITEM_LIFT = GRID_SIZE * 0.1;
const OCCUPIED_TILE_ITEM_SCALE = 1.08;

const TILEPOS_OFFSET: Record<string, [number, number]> = {
    North: [0, -0.30],
    South: [0, 0.30],
    East: [0.30, 0],
    West: [-0.30, 0],
};

const PROJECTILE_TILEPOS_OFFSET: Record<string, [number, number]> = {
    North: [0, -0.43],
    South: [0, 0.43],
    East: [0.43, 0],
    West: [-0.43, 0],
};

function resolveViewerBias(direction: Direction): [number, number] {
    switch (direction) {
        case 'NORTH':
            return [0, OCCUPIED_TILE_VIEWER_BIAS];
        case 'SOUTH':
            return [0, -OCCUPIED_TILE_VIEWER_BIAS];
        case 'EAST':
            return [-OCCUPIED_TILE_VIEWER_BIAS, 0];
        case 'WEST':
            return [OCCUPIED_TILE_VIEWER_BIAS, 0];
    }
}

export function resolveFloorItemPresentation(
    item: FloorItem,
    direction: Direction,
    occupiedByCreature: boolean,
): {
    position: [number, number, number];
    scale: number;
} {
    const offsetMap = item.projectileDropped ? PROJECTILE_TILEPOS_OFFSET : TILEPOS_OFFSET;
    const [offsetX, offsetZ] = offsetMap[item.tilePos] ?? [0, 0];
    const [viewerBiasX, viewerBiasZ] = occupiedByCreature ? resolveViewerBias(direction) : [0, 0];

    return {
        position: [
            item.x * GRID_SIZE + offsetX + viewerBiasX,
            FLOOR_ITEM_BASE_Y + (item.projectileDropped ? GRID_SIZE * 0.03 : 0) + (occupiedByCreature ? OCCUPIED_TILE_ITEM_LIFT : 0),
            item.y * GRID_SIZE + offsetZ + viewerBiasZ,
        ],
        scale: occupiedByCreature ? OCCUPIED_TILE_ITEM_SCALE : 1,
    };
}

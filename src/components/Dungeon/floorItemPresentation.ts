import { GRID_SIZE } from '../../engine/constants';
import type { Direction } from '../../engine/runtimeTypes';
import type { FloorItem, GameTile } from '../../types/game';

const FLOOR_Y = -GRID_SIZE / 2;

export const FLOOR_ITEM_SIZE = GRID_SIZE * 0.38;

const FLOOR_ITEM_BASE_Y = FLOOR_Y + FLOOR_ITEM_SIZE * 0.22;
const OCCUPIED_TILE_VIEWER_BIAS = GRID_SIZE * 0.14;
const OCCUPIED_TILE_ITEM_LIFT = GRID_SIZE * 0.1;
const OCCUPIED_TILE_ITEM_SCALE = 1.08;
const PARTY_TILE_VIEWER_EDGE = GRID_SIZE * 0.42;
const PARTY_TILE_LATERAL_SPREAD = GRID_SIZE * 0.18;
const PARTY_TILE_DEPTH_TO_LATERAL_RATIO = 0.45;
const PARTY_TILE_ITEM_LIFT = GRID_SIZE * 0.16;
const PARTY_TILE_ITEM_SCALE = 1.16;
const PARTY_TILE_CAMERA_FORWARD = GRID_SIZE * 0.86;
const PARTY_TILE_CAMERA_VERTICAL = -GRID_SIZE * 0.5;
const PARTY_TILE_CAMERA_LATERAL_LIMIT = GRID_SIZE * 0.26;
const PARTY_TILE_CAMERA_DEPTH_TO_FORWARD = 0.08;
const PARTY_TILE_CAMERA_DEPTH_TO_VERTICAL = 0.1;
const PARTY_TILE_STACK_LATERAL_STEP = GRID_SIZE * 0.12;
const PARTY_TILE_STACK_VERTICAL_STEP = GRID_SIZE * 0.018;
const PARTY_TILE_STACK_FORWARD_STEP = GRID_SIZE * 0.022;

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

function resolveViewerBasis(direction: Direction): {
    forward: [number, number];
    right: [number, number];
} {
    switch (direction) {
        case 'NORTH':
            return { forward: [0, -1], right: [1, 0] };
        case 'SOUTH':
            return { forward: [0, 1], right: [-1, 0] };
        case 'EAST':
            return { forward: [1, 0], right: [0, 1] };
        case 'WEST':
            return { forward: [-1, 0], right: [0, -1] };
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function resolvePartyTileOffset(
    direction: Direction,
    offsetX: number,
    offsetZ: number,
): [number, number] {
    const [viewerBiasX, viewerBiasZ] = resolveViewerBias(direction);
    const viewerScale = PARTY_TILE_VIEWER_EDGE / OCCUPIED_TILE_VIEWER_BIAS;
    const viewerUnitX = viewerBiasX / OCCUPIED_TILE_VIEWER_BIAS;
    const viewerUnitZ = viewerBiasZ / OCCUPIED_TILE_VIEWER_BIAS;
    const sideUnitX = -viewerUnitZ;
    const sideUnitZ = viewerUnitX;
    const originalLateral = (offsetX * sideUnitX) + (offsetZ * sideUnitZ);
    const originalDepth = (offsetX * viewerUnitX) + (offsetZ * viewerUnitZ);
    const lateral = clamp(
        originalLateral + originalDepth * PARTY_TILE_DEPTH_TO_LATERAL_RATIO,
        -PARTY_TILE_LATERAL_SPREAD,
        PARTY_TILE_LATERAL_SPREAD,
    );

    return [
        viewerBiasX * viewerScale + sideUnitX * lateral,
        viewerBiasZ * viewerScale + sideUnitZ * lateral,
    ];
}

export function resolvePartyTileCameraAnchor(
    item: FloorItem,
    direction: Direction,
    stackIndex = 0,
    stackCount = 1,
): {
    forward: number;
    vertical: number;
    lateral: number;
    scale: number;
} {
    const offsetMap = item.projectileDropped ? PROJECTILE_TILEPOS_OFFSET : TILEPOS_OFFSET;
    const [offsetX, offsetZ] = offsetMap[item.tilePos] ?? [0, 0];
    const basis = resolveViewerBasis(direction);
    const depth = (offsetX * basis.forward[0]) + (offsetZ * basis.forward[1]);
    const centeredStackIndex = stackCount <= 1 ? 0 : stackIndex - ((stackCount - 1) / 2);
    const lateral = clamp(
        (offsetX * basis.right[0]) + (offsetZ * basis.right[1]),
        -PARTY_TILE_CAMERA_LATERAL_LIMIT,
        PARTY_TILE_CAMERA_LATERAL_LIMIT,
    ) + centeredStackIndex * PARTY_TILE_STACK_LATERAL_STEP;
    const vertical =
        PARTY_TILE_CAMERA_VERTICAL +
        (depth * PARTY_TILE_CAMERA_DEPTH_TO_VERTICAL) +
        stackIndex * PARTY_TILE_STACK_VERTICAL_STEP;
    const forward =
        PARTY_TILE_CAMERA_FORWARD +
        clamp(-depth * PARTY_TILE_CAMERA_DEPTH_TO_FORWARD, -0.05, 0.05) +
        stackIndex * PARTY_TILE_STACK_FORWARD_STEP;

    return {
        forward,
        vertical,
        lateral: clamp(lateral, -PARTY_TILE_CAMERA_LATERAL_LIMIT, PARTY_TILE_CAMERA_LATERAL_LIMIT),
        scale: 0.84 + Math.min(stackIndex, 3) * 0.012,
    };
}

export function resolveFloorItemPresentation(
    item: FloorItem,
    direction: Direction,
    occupiedByCreature: boolean,
    occupiedByParty = false,
): {
    position: [number, number, number];
    scale: number;
} {
    const offsetMap = item.projectileDropped ? PROJECTILE_TILEPOS_OFFSET : TILEPOS_OFFSET;
    const [offsetX, offsetZ] = offsetMap[item.tilePos] ?? [0, 0];
    const occupiedTileLift = occupiedByParty
        ? PARTY_TILE_ITEM_LIFT
        : occupiedByCreature
            ? OCCUPIED_TILE_ITEM_LIFT
            : 0;
    const occupiedTileScale = occupiedByParty
        ? PARTY_TILE_ITEM_SCALE
        : occupiedByCreature
            ? OCCUPIED_TILE_ITEM_SCALE
            : 1;
    const [viewerBiasX, viewerBiasZ] = occupiedByParty
        ? resolvePartyTileOffset(direction, offsetX, offsetZ)
        : occupiedByCreature
            ? resolveViewerBias(direction)
            : [0, 0];
    const finalOffsetX = occupiedByParty ? viewerBiasX : offsetX + viewerBiasX;
    const finalOffsetZ = occupiedByParty ? viewerBiasZ : offsetZ + viewerBiasZ;

    return {
        position: [
            item.x * GRID_SIZE + finalOffsetX,
            FLOOR_ITEM_BASE_Y + (item.projectileDropped ? GRID_SIZE * 0.03 : 0) + occupiedTileLift,
            item.y * GRID_SIZE + finalOffsetZ,
        ],
        scale: occupiedTileScale,
    };
}

export function isFloorItemWallMountedTile(
    level: number,
    tile: GameTile | undefined,
    openWalls: Set<string>,
): boolean {
    if (!tile) return false;
    if (tile.type === 'Wall') return true;
    if (tile.type !== 'TrickWall') return false;
    return !openWalls.has(`${level},${tile.y},${tile.x}`);
}

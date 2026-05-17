import { doorBlocksVision } from '../../data/doors';
import type { DoorObject, GameMap, GameTile } from '../../types/game';
import { isTrickWallPassable } from './trickWallState';

export type MinimapDiscoveryDirection = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';

export type MinimapSeenTileKind =
    | 'floor'
    | 'doorClosed'
    | 'doorOpen'
    | 'pit'
    | 'teleporter'
    | 'stairs'
    | 'stairsUp'
    | 'stairsDown'
    | 'water';

export const MINIMAP_DISCOVERY_RADIUS_TILES = 7;
const MINIMAP_DISCOVERY_HALF_FOV_DEGREES = 65;
const MINIMAP_DISCOVERY_FORWARD_DOT = Math.cos((MINIMAP_DISCOVERY_HALF_FOV_DEGREES * Math.PI) / 180);

const DIRECTION_VECTORS: Record<MinimapDiscoveryDirection, { x: number; y: number }> = {
    NORTH: { x: 0, y: -1 },
    EAST: { x: 1, y: 0 },
    SOUTH: { x: 0, y: 1 },
    WEST: { x: -1, y: 0 },
};

type GridPoint = {
    x: number;
    y: number;
};

type MinimapTileStateArgs = {
    tile: GameTile;
    level: number;
    openDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    isSelfRevealingWallTile?: (level: number, tileX: number, tileY: number) => boolean;
};

type VisibleMinimapTileMemoryArgs = {
    map: GameMap;
    level: number;
    position: [number, number];
    direction: MinimapDiscoveryDirection;
    openDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    isSelfRevealingWallTile?: (level: number, tileX: number, tileY: number) => boolean;
    radiusTiles?: number;
};

export function buildMinimapTileKey(level: number, y: number, x: number): string {
    return `${level},${y},${x}`;
}

export function parseMinimapTileKey(key: string): { level: number; y: number; x: number } | null {
    const match = /^(\d+),(\d+),(\d+)$/.exec(key);
    if (!match) return null;

    const [, levelRaw, yRaw, xRaw] = match;
    const level = Number(levelRaw);
    const y = Number(yRaw);
    const x = Number(xRaw);
    return [level, y, x].every(Number.isFinite) ? { level, y, x } : null;
}

function getDoorType(tile: GameTile): number | undefined {
    return tile.objects.find((object): object is DoorObject => object.category === 'Door')?.doorType;
}

function isOpenSelfRevealingWall(
    tile: GameTile,
    level: number,
    openWalls: Set<string>,
    isSelfRevealingWallTile?: (level: number, tileX: number, tileY: number) => boolean,
): boolean {
    if (tile.type !== 'Wall') return false;
    if (!isSelfRevealingWallTile?.(level, tile.x, tile.y)) return false;
    return openWalls.has(buildMinimapTileKey(level, tile.y, tile.x));
}

function tileBlocksVision(
    tile: GameTile | undefined,
    level: number,
    openDoors: Set<string>,
    openWalls: Set<string>,
    isSelfRevealingWallTile?: (level: number, tileX: number, tileY: number) => boolean,
): boolean {
    if (!tile) return true;

    if (tile.type === 'Wall') {
        return !isOpenSelfRevealingWall(tile, level, openWalls, isSelfRevealingWallTile);
    }

    if (tile.type === 'TrickWall') {
        return !isTrickWallPassable(tile, level, tile.y, tile.x, openWalls);
    }

    if (tile.type === 'Door') {
        const doorKey = buildMinimapTileKey(level, tile.y, tile.x);
        if (openDoors.has(doorKey)) return false;
        return doorBlocksVision(getDoorType(tile));
    }

    return false;
}

function getSupercoverLineBetweenTileCenters(ax: number, ay: number, bx: number, by: number): GridPoint[] {
    const dx = bx - ax;
    const dy = by - ay;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) return [];

    const touched = new Map<string, GridPoint>();
    const addPoint = (x: number, y: number) => {
        if (x === ax && y === ay) return;
        if (x === bx && y === by) return;
        touched.set(`${x},${y}`, { x, y });
    };

    if (steps === 1 && Math.abs(dx) === 1 && Math.abs(dy) === 1) {
        addPoint(ax, by);
        addPoint(bx, ay);
        return [...touched.values()];
    }

    let previousX = ax;
    let previousY = ay;
    for (let index = 1; index < steps; index += 1) {
        const currentX = Math.round(ax + ((dx * index) / steps));
        const currentY = Math.round(ay + ((dy * index) / steps));
        addPoint(currentX, currentY);

        if (currentX !== previousX && currentY !== previousY) {
            addPoint(previousX, currentY);
            addPoint(currentX, previousY);
        }

        previousX = currentX;
        previousY = currentY;
    }

    return [...touched.values()];
}

function hasTileLineOfSight(
    map: GameMap,
    level: number,
    openDoors: Set<string>,
    openWalls: Set<string>,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    isSelfRevealingWallTile?: (level: number, tileX: number, tileY: number) => boolean,
): boolean {
    for (const point of getSupercoverLineBetweenTileCenters(fromX, fromY, toX, toY)) {
        if (tileBlocksVision(map.tiles[point.y]?.[point.x], level, openDoors, openWalls, isSelfRevealingWallTile)) {
            return false;
        }
    }

    return true;
}

function isWithinViewCone(
    direction: MinimapDiscoveryDirection,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
): boolean {
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (dx === 0 && dy === 0) return true;

    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance <= 0) return false;

    const forward = DIRECTION_VECTORS[direction];
    const dot = ((dx / distance) * forward.x) + ((dy / distance) * forward.y);
    return dot >= MINIMAP_DISCOVERY_FORWARD_DOT;
}

export function resolveMinimapSeenTileKind(args: MinimapTileStateArgs): MinimapSeenTileKind | null {
    const { tile, level, openDoors, openPits, openTeleporters, openWalls, isSelfRevealingWallTile } = args;
    const tileKey = buildMinimapTileKey(level, tile.y, tile.x);

    switch (tile.type) {
        case 'Floor':
            return 'floor';
        case 'Water':
            return 'water';
        case 'Door':
            return openDoors.has(tileKey) ? 'doorOpen' : 'doorClosed';
        case 'Pit':
            return openPits.has(tileKey) ? 'pit' : 'floor';
        case 'Teleporter':
            return openTeleporters.has(tileKey) && tile.visible !== false ? 'teleporter' : 'floor';
        case 'Stairs':
            return 'stairs';
        case 'StairsUp':
            return 'stairsUp';
        case 'StairsDown':
            return 'stairsDown';
        case 'TrickWall':
            return isTrickWallPassable(tile, level, tile.y, tile.x, openWalls) ? 'floor' : null;
        case 'Wall':
            return isOpenSelfRevealingWall(tile, level, openWalls, isSelfRevealingWallTile) ? 'floor' : null;
        default:
            return null;
    }
}

export function computeVisibleMinimapTileMemory(
    args: VisibleMinimapTileMemoryArgs,
): Record<string, MinimapSeenTileKind> {
    const {
        map,
        level,
        position,
        direction,
        openDoors,
        openPits,
        openTeleporters,
        openWalls,
        isSelfRevealingWallTile,
        radiusTiles = MINIMAP_DISCOVERY_RADIUS_TILES,
    } = args;
    const partyX = position[1];
    const partyY = position[0];
    const updates: Record<string, MinimapSeenTileKind> = {};

    for (const row of map.tiles) {
        for (const tile of row) {
            const kind = resolveMinimapSeenTileKind({
                tile,
                level,
                openDoors,
                openPits,
                openTeleporters,
                openWalls,
                isSelfRevealingWallTile,
            });
            if (!kind) continue;

            const distance = Math.hypot(tile.x - partyX, tile.y - partyY);
            if (distance > radiusTiles) continue;
            if (!isWithinViewCone(direction, partyX, partyY, tile.x, tile.y)) continue;
            if (!hasTileLineOfSight(
                map,
                level,
                openDoors,
                openWalls,
                partyX,
                partyY,
                tile.x,
                tile.y,
                isSelfRevealingWallTile,
            )) {
                continue;
            }

            updates[buildMinimapTileKey(level, tile.y, tile.x)] = kind;
        }
    }

    return updates;
}

export function mergeMinimapTileMemory(
    current: Record<string, MinimapSeenTileKind>,
    updates: Record<string, MinimapSeenTileKind>,
): Record<string, MinimapSeenTileKind> | null {
    let next: Record<string, MinimapSeenTileKind> | null = null;

    for (const [key, kind] of Object.entries(updates)) {
        if (current[key] === kind) continue;
        next ??= { ...current };
        next[key] = kind;
    }

    return next;
}

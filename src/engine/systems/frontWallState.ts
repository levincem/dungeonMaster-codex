import type { CardinalDir, GameTile } from '../../types/game';
import type { Direction } from '../runtimeTypes';

export type FrontWallTarget = {
    wallX: number;
    wallY: number;
    face: CardinalDir;
};

const FRONT_WALL_FACE_BY_DIRECTION: Record<Direction, CardinalDir> = {
    NORTH: 'South',
    SOUTH: 'North',
    EAST: 'West',
    WEST: 'East',
};

const LEFT_WALL_FACE_BY_DIRECTION: Record<Direction, CardinalDir> = {
    NORTH: 'East',
    SOUTH: 'West',
    EAST: 'South',
    WEST: 'North',
};

const RIGHT_WALL_FACE_BY_DIRECTION: Record<Direction, CardinalDir> = {
    NORTH: 'West',
    SOUTH: 'East',
    EAST: 'North',
    WEST: 'South',
};

export function resolveFrontWallTarget(
    position: [number, number],
    direction: Direction,
): FrontWallTarget {
    const [y, x] = position;
    return {
        wallY: direction === 'NORTH' ? y - 1 : direction === 'SOUTH' ? y + 1 : y,
        wallX: direction === 'EAST' ? x + 1 : direction === 'WEST' ? x - 1 : x,
        face: FRONT_WALL_FACE_BY_DIRECTION[direction],
    };
}

export function resolveLeftWallTarget(
    position: [number, number],
    direction: Direction,
): FrontWallTarget {
    const [y, x] = position;
    return {
        wallY: direction === 'EAST' ? y - 1 : direction === 'WEST' ? y + 1 : y,
        wallX: direction === 'NORTH' ? x - 1 : direction === 'SOUTH' ? x + 1 : x,
        face: LEFT_WALL_FACE_BY_DIRECTION[direction],
    };
}

export function resolveRightWallTarget(
    position: [number, number],
    direction: Direction,
): FrontWallTarget {
    const [y, x] = position;
    return {
        wallY: direction === 'EAST' ? y + 1 : direction === 'WEST' ? y - 1 : y,
        wallX: direction === 'NORTH' ? x + 1 : direction === 'SOUTH' ? x - 1 : x,
        face: RIGHT_WALL_FACE_BY_DIRECTION[direction],
    };
}

type FacingFountainDeps = {
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    hasOriginalWallOverlayAt: (
        level: number,
        x: number,
        y: number,
        face: CardinalDir,
        overlayName: string,
    ) => boolean;
};

export function isFacingFountain(
    level: number,
    position: [number, number],
    direction: Direction,
    deps: FacingFountainDeps,
): boolean {
    const { wallX, wallY, face } = resolveFrontWallTarget(position, direction);
    const tile = deps.getTile(level, wallX, wallY);
    return Boolean(
        tile &&
        (tile.type === 'Wall' || tile.type === 'TrickWall') &&
        deps.hasOriginalWallOverlayAt(level, wallX, wallY, face, 'Fountain'),
    );
}

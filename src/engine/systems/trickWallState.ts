import type { GameTile } from '../../types/game';

type TrickWallLike = Pick<GameTile, 'type' | 'open'> & {
    imaginary?: boolean;
};

export function isTrickWallPassable(
    tile: TrickWallLike,
    level: number,
    y: number,
    x: number,
    openWalls: Set<string>,
): boolean {
    if (tile.type !== 'TrickWall') return false;
    return tile.open === true || tile.imaginary === true || openWalls.has(`${level},${y},${x}`);
}

export function isTrickWallBlocking(
    tile: TrickWallLike,
    level: number,
    y: number,
    x: number,
    openWalls: Set<string>,
): boolean {
    return tile.type === 'TrickWall' && !isTrickWallPassable(tile, level, y, x, openWalls);
}

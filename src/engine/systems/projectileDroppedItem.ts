import type { CardinalDir, FloorItem } from '../../types/game';
import type { Direction } from '../runtimeTypes';

export function getProjectileDropTilePos(direction: Direction): CardinalDir {
    if (direction === 'NORTH') return 'South';
    if (direction === 'SOUTH') return 'North';
    if (direction === 'EAST') return 'West';
    return 'East';
}

export function buildProjectileDroppedItem(
    item: FloorItem,
    level: number,
    x: number,
    y: number,
    direction: Direction,
    buildDroppedItem: (item: FloorItem, level: number, x: number, y: number) => FloorItem,
): FloorItem {
    return {
        ...buildDroppedItem(item, level, x, y),
        tilePos: getProjectileDropTilePos(direction),
        projectileDropped: true,
    };
}

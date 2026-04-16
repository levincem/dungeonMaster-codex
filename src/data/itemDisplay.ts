import type { Direction } from '../engine/runtimeTypes';
import type { FloorItem } from '../types/game';

const DIRECTION_LABELS: Record<Direction, string> = {
    NORTH: 'North',
    EAST: 'East',
    SOUTH: 'South',
    WEST: 'West',
};

export function getDisplayedItemName(
    baseName: string,
    item: Pick<FloorItem, 'category' | 'typeId' | 'rawName'>,
    direction?: Direction,
): string {
    if (item.category !== 'Misc' || item.typeId !== 0 || !direction) return baseName;
    return `${baseName} (${DIRECTION_LABELS[direction]})`;
}

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
    item: Pick<FloorItem, 'category' | 'typeId' | 'rawName' | 'waterCharges' | 'waterMaxCharges'>,
    direction?: Direction,
): string {
    if ((item.category === 'Potion' && item.typeId === 24) || (item.category === 'Misc' && item.typeId === 1)) {
        return (item.waterCharges ?? (item.category === 'Potion' ? 4 : 0)) > 0 ? 'Waterskin' : 'Empty Waterskin';
    }
    if (
        (item.category === 'Potion' && (item.typeId === 15 || item.typeId === 20))
        || (item.category === 'Misc' && (item.typeId === 40 || item.typeId === 41))
    ) {
        return (item.waterCharges ?? (item.typeId === 15 || item.typeId === 41 ? 1 : 0)) > 0 ? 'Water Flask' : 'Empty Flask';
    }
    if (item.category !== 'Misc' || item.typeId !== 0 || !direction) return baseName;
    return `${baseName} (${DIRECTION_LABELS[direction]})`;
}

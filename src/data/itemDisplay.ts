import type { Direction } from '../engine/runtimeTypes';
import type { FloorItem } from '../types/game';
import { isChargeDepleted } from './itemChargeState';

const DIRECTION_LABELS: Record<Direction, string> = {
    NORTH: 'North',
    EAST: 'East',
    SOUTH: 'South',
    WEST: 'West',
};

export function getDisplayedItemName(
    baseName: string,
    item: Pick<FloorItem, 'category' | 'typeId' | 'rawName' | 'waterCharges' | 'waterMaxCharges' | 'actionCharges' | 'actionMaxCharges'>,
    direction?: Direction,
): string {
    if ((item.category === 'Potion' && item.typeId === 24) || (item.category === 'Misc' && item.typeId === 1)) {
        return (item.waterCharges ?? (item.category === 'Potion' ? 4 : 0)) > 0 ? 'Waterskin' : 'Empty Waterskin';
    }
    if (
        (item.category === 'Potion' && (item.typeId === 15 || item.typeId === 20))
    ) {
        return (item.waterCharges ?? (item.typeId === 15 ? 1 : 0)) > 0 ? 'Water Flask' : 'Empty Flask';
    }
    if (item.category === 'Misc' && item.typeId === 0 && direction) {
        return `${baseName} (${DIRECTION_LABELS[direction]})`;
    }
    if (isChargeDepleted(item as FloorItem)) {
        return `${baseName} (empty)`;
    }
    return baseName;
}

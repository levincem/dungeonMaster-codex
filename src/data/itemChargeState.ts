import type { FloorItem } from '../types/game';
import { getWeaponAttackOptions } from './weaponAttacks';

export const MAGIC_BOX_BLUE_TYPE_ID = 42;
export const MAGIC_BOX_GREEN_TYPE_ID = 43;

export function isMagicBoxItem(
    item: Pick<FloorItem, 'category' | 'typeId'> | null | undefined,
): boolean {
    return item?.category === 'Misc'
        && (item.typeId === MAGIC_BOX_BLUE_TYPE_ID || item.typeId === MAGIC_BOX_GREEN_TYPE_ID);
}

export function hasChargeLimitedAction(item: FloorItem | null | undefined): boolean {
    if (!item || isMagicBoxItem(item)) return false;
    return getWeaponAttackOptions(item).some((option) => option.requiresCharges);
}

export function isChargeDepleted(item: FloorItem | null | undefined): boolean {
    return hasChargeLimitedAction(item)
        && typeof item?.actionCharges === 'number'
        && item.actionCharges <= 0;
}

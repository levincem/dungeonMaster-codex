import originalItemRulesRuntime from '../assets/runtime/reference/original_item_rules_runtime.json';
import { getSourceItemAllowedSlotsMask } from './items';
import type { FloorItem } from '../types/game';
import type { EquipSlotKey } from '../types/items';

type OriginalItemRulesRuntime = {
    carryLocationBits: Record<string, string>;
    carryLocationToRuntimeSlots: Record<string, EquipSlotKey[]>;
    rules: {
        nonZeroCarryMaskImpliesHandsAndBackpack: boolean;
        zeroCarryMaskMeansNotCarryableExceptCursorStyleSpecialCases: boolean;
        pouchItemsCanPassThroughSomeDoors: boolean;
        keysRemainBlockedByDoorPassRuleException: boolean;
    };
};

const ORIGINAL_ITEM_RULES = originalItemRulesRuntime as OriginalItemRulesRuntime;

export const ORIGINAL_CARRY_LOCATION_BITS = ORIGINAL_ITEM_RULES.carryLocationBits;
export const ORIGINAL_CARRY_LOCATION_TO_RUNTIME_SLOTS = ORIGINAL_ITEM_RULES.carryLocationToRuntimeSlots;
export const ORIGINAL_ITEM_RULE_FLAGS = ORIGINAL_ITEM_RULES.rules;

type OriginalCarryLocationName =
    | 'Consumable'
    | 'Head'
    | 'Neck'
    | 'Torso'
    | 'Legs'
    | 'Feet'
    | 'Quiver1'
    | 'Quiver2'
    | 'Pouch'
    | 'Hands'
    | 'Chest';

const ORIGINAL_CARRY_LOCATION_NAME_TO_BIT = Object.fromEntries(
    Object.entries(ORIGINAL_CARRY_LOCATION_BITS).map(([bitText, name]) => [name, Number(bitText)]),
) as Record<OriginalCarryLocationName, number>;

function pushUniqueSlots(target: EquipSlotKey[], ...entries: EquipSlotKey[]): void {
    for (const entry of entries) {
        if (!target.includes(entry)) target.push(entry);
    }
}

export function getOriginalCarryLocationBit(name: OriginalCarryLocationName): number {
    return ORIGINAL_CARRY_LOCATION_NAME_TO_BIT[name];
}

export function hasOriginalCarryLocation(allowedSlotsMask: number | undefined, name: OriginalCarryLocationName): boolean {
    if (allowedSlotsMask == null) return false;
    return (allowedSlotsMask & (1 << getOriginalCarryLocationBit(name))) !== 0;
}

export function getOriginalCarryRuntimeSlots(allowedSlotsMask: number | undefined): EquipSlotKey[] {
    if (allowedSlotsMask == null || allowedSlotsMask === 0) return [];

    const slots: EquipSlotKey[] = [];
    for (const [locationName, runtimeSlots] of Object.entries(ORIGINAL_CARRY_LOCATION_TO_RUNTIME_SLOTS)) {
        if (!hasOriginalCarryLocation(allowedSlotsMask, locationName as OriginalCarryLocationName)) continue;
        pushUniqueSlots(slots, ...runtimeSlots);
    }

    if (ORIGINAL_ITEM_RULE_FLAGS.nonZeroCarryMaskImpliesHandsAndBackpack) {
        pushUniqueSlots(slots, 'rightHand', 'leftHand');
    }

    return slots;
}

export function getOriginalItemAllowedSlotsMask(item: FloorItem | undefined): number | undefined {
    if (!item) return undefined;
    return getSourceItemAllowedSlotsMask(item.category, item.typeId, item.rawName);
}

export function isOriginalConsumableItem(item: FloorItem | undefined): boolean {
    return hasOriginalCarryLocation(getOriginalItemAllowedSlotsMask(item), 'Consumable');
}

export function isOriginalPouchCarriableItem(item: FloorItem | undefined): boolean {
    return hasOriginalCarryLocation(getOriginalItemAllowedSlotsMask(item), 'Pouch');
}

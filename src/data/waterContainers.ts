import type { FloorItem } from '../types/game';
import { normalizeLookupName, resolveItemName } from './items';

export type WaterContainerKind = 'waterskin' | 'flask';

export type WaterContainerState = {
    kind: WaterContainerKind;
    charges: number;
    maxCharges: number;
    fullCategory: FloorItem['category'];
    fullTypeId: number;
    emptyCategory: FloorItem['category'];
    emptyTypeId: number;
};

function createWaterContainerState(
    kind: WaterContainerKind,
    charges: number,
    maxCharges: number,
    fullCategory: FloorItem['category'],
    fullTypeId: number,
    emptyCategory: FloorItem['category'],
    emptyTypeId: number,
): WaterContainerState {
    return { kind, charges, maxCharges, fullCategory, fullTypeId, emptyCategory, emptyTypeId };
}

export function getWaterContainerState(item: FloorItem): WaterContainerState | null {
    const normalizedName = normalizeLookupName(item.rawName);
    if (item.category === 'Potion' && item.typeId === 15) {
        return createWaterContainerState('flask', item.waterCharges ?? 1, 1, 'Potion', 15, 'Potion', 20);
    }
    if (item.category === 'Potion' && item.typeId === 20) {
        return createWaterContainerState('flask', item.waterCharges ?? 0, 1, 'Potion', 15, 'Potion', 20);
    }
    if (item.category === 'Potion' && item.typeId === 24) {
        return createWaterContainerState('waterskin', item.waterCharges ?? 4, 4, 'Misc', 1, 'Misc', 1);
    }
    if (item.category === 'Misc' && item.typeId === 1) {
        const defaultCharges = normalizedName === 'empty waterskin' ? 0 : 4;
        return createWaterContainerState('waterskin', item.waterCharges ?? defaultCharges, 4, 'Misc', 1, 'Misc', 1);
    }
    if (item.category === 'Misc' && (item.typeId === 7 || item.typeId === 41)) {
        return createWaterContainerState('flask', item.waterCharges ?? 1, 1, 'Misc', 41, 'Misc', 40);
    }
    if (item.category === 'Misc' && item.typeId === 40) {
        return createWaterContainerState('flask', item.waterCharges ?? 0, 1, 'Misc', 41, 'Misc', 40);
    }
    return null;
}

export function isWaterContainer(item: FloorItem): boolean {
    return getWaterContainerState(item) !== null;
}

export function canDrinkFromContainer(item: FloorItem): boolean {
    const state = getWaterContainerState(item);
    return !!state && state.charges > 0;
}

export function canFillWaterContainer(item: FloorItem): boolean {
    const state = getWaterContainerState(item);
    return !!state && state.charges < state.maxCharges;
}

export function normaliseWaterContainer(item: FloorItem): FloorItem {
    const state = getWaterContainerState(item);
    if (!state) return item;

    const charges = Math.max(0, Math.min(state.maxCharges, item.waterCharges ?? state.charges));
    const isFull = charges > 0;
    const category = isFull ? state.fullCategory : state.emptyCategory;
    const typeId = isFull ? state.fullTypeId : state.emptyTypeId;
    const rawName = state.kind === 'waterskin'
        ? (isFull ? 'Waterskin' : 'Empty Waterskin')
        : resolveItemName(category, typeId, item.rawName);
    return {
        ...item,
        category,
        typeId,
        rawName,
        waterCharges: charges,
        waterMaxCharges: state.maxCharges,
    };
}

export function consumeWaterContainer(item: FloorItem): { nextItem: FloorItem; waterGain: number; staminaGain: number } | null {
    const state = getWaterContainerState(item);
    if (!state || state.charges <= 0) return null;

    const nextCharges = state.charges - 1;
    const nextItem = normaliseWaterContainer({
        ...item,
        waterCharges: nextCharges,
        waterMaxCharges: state.maxCharges,
    });

    return {
        nextItem,
        waterGain: state.kind === 'flask' ? 1600 : 800,
        staminaGain: 0,
    };
}

export function fillWaterContainer(item: FloorItem): FloorItem | null {
    const state = getWaterContainerState(item);
    if (!state) return null;
    return normaliseWaterContainer({
        ...item,
        waterCharges: state.maxCharges,
        waterMaxCharges: state.maxCharges,
    });
}

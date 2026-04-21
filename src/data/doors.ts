import payload from '../assets/runtime/reference/original_doors_runtime.json';
import type { FloorItem } from '../types/game';
import { miscPath, texturesPath } from './assetPaths';
import { getSourceItemAllowedSlotsMask, MISC_TYPES, WEAPON_TYPES } from './items';

export interface OriginalDoorDefinition {
    id: number;
    name: string;
    animated: boolean;
    thrownItemsCanPassThrough: boolean;
    creaturesCanSeeThrough: boolean;
    resistance: number;
}

interface OriginalDoorsPayload {
    doors: OriginalDoorDefinition[];
}

const POUCH_ALLOWED_SLOTS_MASK = 1 << 8;

export const ORIGINAL_DOOR_DEFS = (payload as OriginalDoorsPayload).doors.reduce<Record<number, OriginalDoorDefinition>>((acc, door) => {
    acc[door.id] = door;
    return acc;
}, {});

export function getDoorDefinition(doorType: number | undefined): OriginalDoorDefinition | undefined {
    if (doorType === undefined) return undefined;
    return ORIGINAL_DOOR_DEFS[doorType];
}

export function doorBlocksVision(doorType: number | undefined): boolean {
    return !getDoorDefinition(doorType)?.creaturesCanSeeThrough;
}

export function doorBlocksThrownItems(doorType: number | undefined): boolean {
    return !getDoorDefinition(doorType)?.thrownItemsCanPassThrough;
}

function isKeyLikeItem(item: FloorItem): boolean {
    if (item.category === 'Misc') return MISC_TYPES[item.typeId]?.key === true;
    if (item.category === 'Weapon') return WEAPON_TYPES[item.typeId]?.type === 'Key';
    return false;
}

export function doorBlocksThrownPhysicalItem(
    doorType: number | undefined,
    item: FloorItem | undefined,
): boolean {
    if (doorBlocksThrownItems(doorType)) return true;
    if (!item) return false;
    if (isKeyLikeItem(item)) return true;

    const allowedSlotsMask = getSourceItemAllowedSlotsMask(item.category, item.typeId);
    return (((allowedSlotsMask ?? 0) & POUCH_ALLOWED_SLOTS_MASK) === 0);
}

export function getDoorTexturePath(doorType: number | undefined): string {
    switch (doorType) {
        case 0:
            return miscPath('grille_metal.png');
        case 2:
            return texturesPath('doorIron.png');
        case 3:
            return texturesPath('doorRaOriginal.bmp');
        default:
            return texturesPath('doorWood.png');
    }
}

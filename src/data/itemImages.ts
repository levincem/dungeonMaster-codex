/**
 * Maps (category, typeId) to an image path under /public/items/.
 * For items with variants the default/unequipped/empty state is returned.
 */

import type { FloorItem } from '../types/game';
import { normalizeLookupName, resolveItemName } from './items';
import {
    getOriginalTorchStateIndex,
    ORIGINAL_TORCH_LIFETIME_MS,
} from './originalUiSupport';
import { getWaterContainerState } from './waterContainers';
import { itemsPath } from './assetPaths';
import { AVAILABLE_ITEM_IMAGE_FILENAMES } from './itemImageCatalog';
import {
    CATEGORY_IMAGE_FALLBACK,
    ITEM_IMAGE_NAME_ALIASES,
    LEGACY_ARMOR_TYPE_IMAGE_MAP,
    LEGACY_CONTAINER_TYPE_IMAGE_MAP,
    LEGACY_MISC_TYPE_IMAGE_MAP,
    LEGACY_POTION_TYPE_IMAGE_MAP,
    LEGACY_WEAPON_TYPE_IMAGE_MAP,
} from './itemImageCompatibility';

const ITEM_BASE = itemsPath('');

export function isTorchItem(item: FloorItem | undefined): boolean {
    if (!item) return false;
    const normalizedName = normalizeLookupName(item.rawName);
    return normalizedName === 'torch' || (item.category === 'Weapon' && item.typeId === 2);
}

const AVAILABLE_ITEM_IMAGES = new Set<string>(AVAILABLE_ITEM_IMAGE_FILENAMES);

function slugifyItemName(name: string): string {
    return name
        .replace(/[()]/g, ' ')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');
}

function getDerivedFilename(rawName?: string): string | undefined {
    const normalizedName = normalizeLookupName(rawName);
    if (!normalizedName) return undefined;

    const aliasFilename = ITEM_IMAGE_NAME_ALIASES[normalizedName];
    if (aliasFilename) return aliasFilename;

    const directFilename = `${slugifyItemName(normalizedName)}.png`;
    if (AVAILABLE_ITEM_IMAGES.has(directFilename)) return directFilename;

    return undefined;
}

function getNameOverrideImage(rawName?: string): string | undefined {
    const filename = getDerivedFilename(rawName);
    return filename ? ITEM_BASE + filename : undefined;
}

// Weapon variant images (charged / worn states).
export const WEAPON_VARIANTS: Record<number, { empty: string; full: string }> = {
     2: { empty: 'torch_unlit.png',          full: 'torch_lit.png'           },
     3: { empty: 'flamitt_empty.png',        full: 'flamitt_full.png'        },
     4: { empty: 'staff_of_claws_empty.png', full: 'staff_of_claws_full.png' },
     5: { empty: 'bolt_blade_empty.png',     full: 'bolt_blade_full.png'     },
     6: { empty: 'fury_empty.png',           full: 'fury_full.png'           },
};

/** Torch images by state index (0=burnt, 1=used_2, 2=used_1, 3=lit). */
export const TORCH_STATE_IMAGES = [
    'torch_unlit.png',
    'torch_used_2.png',
    'torch_used_1.png',
    'torch_lit.png',
];

/**
 * Return the correct torch image for a given item id and the torchBurnStart map.
 * Falls back to torch_lit if the torch has not been lit yet.
 */
export function getTorchImage(itemId: string, torchBurnStart: Record<string, number>, now = Date.now()): string {
    const litAt = torchBurnStart[itemId];
    if (litAt === undefined) return ITEM_BASE + 'torch_lit.png';
    const elapsed = now - litAt;
    const idx = elapsed >= ORIGINAL_TORCH_LIFETIME_MS
        ? 0
        : getOriginalTorchStateIndex(elapsed);
    return ITEM_BASE + TORCH_STATE_IMAGES[idx];
}

export function getInventoryItemImage(item: FloorItem): string {
    if (isTorchItem(item)) return ITEM_BASE + 'torch_unlit.png';
    return getFloorItemImage(item);
}

export function getEquippedItemImage(item: FloorItem, torchBurnStart: Record<string, number>, now = Date.now()): string {
    if (isTorchItem(item)) return getTorchImage(item.id, torchBurnStart, now);
    return getFloorItemImage(item);
}

export function getItemImage(category: string, typeId: number, rawName?: string): string {
    const resolvedName = resolveItemName(category as FloorItem['category'] | 'Scroll' | 'Container', typeId, rawName);
    const nameOverride = getNameOverrideImage(resolvedName);
    if (nameOverride) return nameOverride;

    let filename: string | undefined;
    switch (category) {
        case 'Weapon':
        case 'Armor':
        case 'Misc':
            // Legacy typeId image maps are now last-resort only.
            filename = undefined;
            break;
        case 'Potion':
            filename = LEGACY_POTION_TYPE_IMAGE_MAP[typeId];
            break;
        case 'Container':
            filename = LEGACY_CONTAINER_TYPE_IMAGE_MAP[typeId];
            break;
    }

    if (!filename) {
        switch (category) {
            case 'Weapon':
                filename = LEGACY_WEAPON_TYPE_IMAGE_MAP[typeId];
                break;
            case 'Armor':
                filename = LEGACY_ARMOR_TYPE_IMAGE_MAP[typeId];
                break;
            case 'Misc':
                filename = LEGACY_MISC_TYPE_IMAGE_MAP[typeId];
                break;
        }
    }

    return ITEM_BASE + (filename ?? CATEGORY_IMAGE_FALLBACK[category] ?? 'compass.png');
}

export function getFloorItemImage(item: FloorItem): string {
    const waterState = getWaterContainerState(item);
    if (waterState) {
        if (waterState.kind === 'waterskin') {
            return ITEM_BASE + (waterState.charges > 0 ? 'water_waterskin_full.png' : 'waterskin_empty.png');
        }
        return ITEM_BASE + (waterState.charges > 0 ? 'water_flask.png' : 'empty_flask.png');
    }
    return getItemImage(item.category, item.typeId, item.rawName);
}

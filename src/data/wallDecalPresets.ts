import { GRID_SIZE, WALL_HEIGHT } from '../engine/constants';
import { itemsPath, miscPath } from './assetPaths';
import {
    getOriginalStairsDownFrontHeightRatio,
    getOriginalStairsDownFrontWidthRatio,
    getOriginalStairsUpFrontHeightRatio,
    getOriginalStairsUpFrontWidthRatio,
} from './originalStairPanelMetrics';

export type WallDecalPreset = {
    width: number;
    height: number;
    y: number;
    hasBacking: boolean;
    hasGlow: boolean;
    plateColor: string;
    faceInset?: number;
    contentDepth?: number;
    scatterXOptions?: number[];
    scatterYOptions?: number[];
};

const LOCK_IMAGES = [
    miscPath('serrure.png'),
    miscPath('wall_lock_iron.png'),
    miscPath('wall_lock_double_iron.png'),
    miscPath('wall_lock_square.png'),
    miscPath('wall_lock_winged.png'),
    miscPath('wall_lock_onyx.png'),
    miscPath('wall_lock_stone.png'),
    miscPath('wall_lock_cross.png'),
    miscPath('wall_lock_topaz.png'),
    miscPath('wall_lock_skeleton.png'),
    miscPath('wall_lock_gold.png'),
    miscPath('wall_lock_tourquoise.png'),
    miscPath('wall_lock_emerald.png'),
    miscPath('wall_lock_ruby.png'),
    miscPath('wall_lock_ra.png'),
    miscPath('wall_lock_master.png'),
];
const LEVER_UP_IMAGE = miscPath('levier_haut.png');
const LEVER_DOWN_IMAGE = miscPath('levier_bas.png');
const ALTAR_IMAGE = miscPath('autel.png');
const TORCH_IMAGE = itemsPath('torch_unlit.png');
const FOUNTAIN_IMAGE = miscPath('wall_foutain_overlay.png');
const HOOK_IMAGE = miscPath('wall_hook.png');
const WOOD_RING_IMAGE = miscPath('wall_wood_ring.png');
const FULL_TORCH_HOLDER_IMAGE = miscPath('wall_torch_holder_full.png');
const EMPTY_TORCH_HOLDER_IMAGE = miscPath('wall_torch_holder_empty.png');
const SLIME_IMAGE = miscPath('wall_slime.png');
const GRATE_IMAGE = miscPath('wall_grate.png');
const GHOULS_HEAD_IMAGE = miscPath('wall_ghouls_head.png');
const COIN_SLOT_IMAGE = miscPath('wall_coin_slot.png');
const GEM_HOLE_IMAGE = miscPath('wall_gem_hole.png');
const SMALL_SWITCH_IMAGE = miscPath('wall_switch_small.png');
const TINY_SWITCH_IMAGE = miscPath('wall_switch_tiny.png');
const EYE_SWITCH_IMAGE = miscPath('wall_switch_eye.png');
const STAIRS_UP_IMAGE = miscPath('stairs_up.png');
const STAIRS_DOWN_IMAGE = miscPath('stairs_down.png');

const BIG_SWITCH_IMAGES = [
    miscPath('wall_switch_big_in.png'),
    miscPath('wall_switch_big_out.png'),
    miscPath('wall_switch_blue_in.png'),
    miscPath('wall_switch_blue_out.png'),
    miscPath('wall_switch_green_in.png'),
    miscPath('wall_switch_green_out.png'),
    miscPath('wall_switch_red_in.png'),
    miscPath('wall_switch_red_out.png'),
    miscPath('wall_switch_crack_in.png'),
    miscPath('wall_switch_crack_out.png'),
];

const DECAL_PRESETS: Record<string, WallDecalPreset> = {
    [LEVER_UP_IMAGE]: {
        width: GRID_SIZE * 0.28,
        height: WALL_HEIGHT * 0.46,
        y: 0,
        hasBacking: false,
        hasGlow: false,
        plateColor: '#3a2b1d',
    },
    [LEVER_DOWN_IMAGE]: {
        width: GRID_SIZE * 0.28,
        height: WALL_HEIGHT * 0.46,
        y: 0,
        hasBacking: false,
        hasGlow: false,
        plateColor: '#3a2b1d',
    },
    [ALTAR_IMAGE]: {
        width: GRID_SIZE * 0.56,
        height: WALL_HEIGHT * 0.42,
        y: -WALL_HEIGHT * 0.03,
        hasBacking: false,
        hasGlow: false,
        plateColor: '#3a2b1d',
    },
    [TORCH_IMAGE]: {
        width: GRID_SIZE * 0.18,
        height: WALL_HEIGHT * 0.5,
        y: 0,
        hasBacking: false,
        hasGlow: true,
        plateColor: '#3a2b1d',
    },
    [FOUNTAIN_IMAGE]: {
        width: GRID_SIZE * 0.72,
        height: WALL_HEIGHT * 0.92,
        y: -WALL_HEIGHT * 0.02,
        hasBacking: false,
        hasGlow: false,
        plateColor: '#1b2b39',
    },
    [HOOK_IMAGE]: {
        width: GRID_SIZE * 0.15,
        height: WALL_HEIGHT * 0.15,
        y: 0,
        hasBacking: false,
        hasGlow: false,
        plateColor: '#3a2b1d',
    },
    [WOOD_RING_IMAGE]: {
        width: GRID_SIZE * 0.15,
        height: WALL_HEIGHT * 0.15,
        y: 0,
        hasBacking: false,
        hasGlow: false,
        plateColor: '#3a2b1d',
    },
    [FULL_TORCH_HOLDER_IMAGE]: {
        width: GRID_SIZE * 0.24,
        height: WALL_HEIGHT * 0.92,
        y: 0,
        hasBacking: false,
        hasGlow: false,
        plateColor: '#3a2b1d',
    },
    [EMPTY_TORCH_HOLDER_IMAGE]: {
        width: GRID_SIZE * 0.42,
        height: WALL_HEIGHT * 0.48,
        y: 0,
        hasBacking: false,
        hasGlow: false,
        plateColor: '#3a2b1d',
    },
    [SLIME_IMAGE]: {
        width: GRID_SIZE * 0.15,
        height: WALL_HEIGHT * 0.15,
        y: -WALL_HEIGHT * 0.16,
        hasBacking: false,
        hasGlow: false,
        plateColor: '#3a2b1d',
        scatterXOptions: [
            -GRID_SIZE * 0.22,
            -GRID_SIZE * 0.1,
            0,
            GRID_SIZE * 0.1,
            GRID_SIZE * 0.22,
        ],
        scatterYOptions: [
            -WALL_HEIGHT * 0.08,
            -WALL_HEIGHT * 0.04,
            0,
            WALL_HEIGHT * 0.04,
        ],
    },
    [GRATE_IMAGE]: {
        width: GRID_SIZE * 0.15,
        height: WALL_HEIGHT * 0.15,
        y: -WALL_HEIGHT * 0.16,
        hasBacking: false,
        hasGlow: false,
        plateColor: '#3a2b1d',
        scatterXOptions: [
            -GRID_SIZE * 0.22,
            -GRID_SIZE * 0.1,
            0,
            GRID_SIZE * 0.1,
            GRID_SIZE * 0.22,
        ],
        scatterYOptions: [
            -WALL_HEIGHT * 0.08,
            -WALL_HEIGHT * 0.04,
            0,
            WALL_HEIGHT * 0.04,
        ],
    },
    [GHOULS_HEAD_IMAGE]: {
        width: GRID_SIZE * 0.4,
        height: WALL_HEIGHT * 0.54,
        y: 0,
        hasBacking: false,
        hasGlow: false,
        plateColor: '#3a2b1d',
    },
    [SMALL_SWITCH_IMAGE]: {
        width: GRID_SIZE * 0.36,
        height: WALL_HEIGHT * 0.36,
        y: -WALL_HEIGHT * 0.01,
        hasBacking: false,
        hasGlow: false,
        plateColor: '#3a2b1d',
    },
    [TINY_SWITCH_IMAGE]: {
        width: GRID_SIZE * 0.28,
        height: WALL_HEIGHT * 0.28,
        y: -WALL_HEIGHT * 0.01,
        hasBacking: false,
        hasGlow: false,
        plateColor: '#3a2b1d',
    },
    [EYE_SWITCH_IMAGE]: {
        width: GRID_SIZE * 0.42,
        height: WALL_HEIGHT * 0.42,
        y: -WALL_HEIGHT * 0.01,
        hasBacking: false,
        hasGlow: false,
        plateColor: '#3a2b1d',
    },
    [STAIRS_UP_IMAGE]: {
        width: GRID_SIZE * getOriginalStairsUpFrontWidthRatio(),
        height: WALL_HEIGHT * getOriginalStairsUpFrontHeightRatio(),
        y: 0,
        hasBacking: false,
        hasGlow: false,
        plateColor: '#3a2b1d',
    },
    [STAIRS_DOWN_IMAGE]: {
        width: GRID_SIZE * getOriginalStairsDownFrontWidthRatio(),
        height: WALL_HEIGHT * getOriginalStairsDownFrontHeightRatio(),
        y: 0,
        hasBacking: false,
        hasGlow: false,
        plateColor: '#3a2b1d',
    },
};

for (const image of LOCK_IMAGES) {
    DECAL_PRESETS[image] = {
        width: GRID_SIZE * 0.2,
        height: WALL_HEIGHT * 0.2,
        y: -WALL_HEIGHT * 0.02,
        hasBacking: false,
        hasGlow: true,
        plateColor: '#3a2b1d',
    };
}

DECAL_PRESETS[COIN_SLOT_IMAGE] = {
    width: GRID_SIZE * 0.34,
    height: WALL_HEIGHT * 0.34,
    y: -WALL_HEIGHT * 0.02,
    hasBacking: false,
    hasGlow: true,
    plateColor: '#3a2b1d',
};

DECAL_PRESETS[GEM_HOLE_IMAGE] = {
    width: GRID_SIZE * 0.34,
    height: WALL_HEIGHT * 0.34,
    y: -WALL_HEIGHT * 0.02,
    hasBacking: false,
    hasGlow: false,
    plateColor: '#3a2b1d',
};

for (const image of BIG_SWITCH_IMAGES) {
    DECAL_PRESETS[image] = {
        width: GRID_SIZE * 0.44,
        height: WALL_HEIGHT * 0.44,
        y: -WALL_HEIGHT * 0.01,
        hasBacking: false,
        hasGlow: false,
        plateColor: '#3a2b1d',
    };
}

export function getWallDecalPresetForImage(image?: string): WallDecalPreset | undefined {
    return image ? DECAL_PRESETS[image] : undefined;
}

export function getWallOverlayImageRatios(image?: string): { width: number; height: number } | undefined {
    const preset = getWallDecalPresetForImage(image);
    if (!preset) return undefined;
    return {
        width: preset.width / GRID_SIZE,
        height: preset.height / WALL_HEIGHT,
    };
}

function hashWallDecalScatterKey(key: string): number {
    let hash = 2166136261;
    for (let index = 0; index < key.length; index += 1) {
        hash ^= key.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function resolveWallDecalScatterOffset(
    image: string | undefined,
    tileX: number,
    tileY: number,
    face: string,
): { x: number; y: number } {
    const preset = getWallDecalPresetForImage(image);
    if (!preset || (!preset.scatterXOptions?.length && !preset.scatterYOptions?.length)) {
        return { x: 0, y: 0 };
    }

    const hash = hashWallDecalScatterKey(`${image ?? 'none'}:${tileX}:${tileY}:${face}`);
    const xOptions = preset.scatterXOptions ?? [0];
    const yOptions = preset.scatterYOptions ?? [0];
    const x = xOptions[hash % xOptions.length] ?? 0;
    const y = yOptions[Math.floor(hash / xOptions.length) % yOptions.length] ?? 0;
    return { x, y };
}

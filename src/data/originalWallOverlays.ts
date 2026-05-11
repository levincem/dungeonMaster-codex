import type { CardinalDir, GameMap } from '../types/game';
import { miscPath, originalMiscPath } from './assetPaths';
import { getOriginalWallOverlayMapDataSync } from './originalWallOverlayData';
import { GRID_SIZE, WALL_HEIGHT } from '../engine/constants';
import { getWallOverlayImageRatios } from './wallDecalPresets';

type OverlayClassification = 'interactive' | 'stateful' | 'hazard' | 'decorative' | 'unclear';

type FixedVariant = {
    mapIndex: number;
    x: number;
    y: number;
    face: CardinalDir;
    source: 'fixed-sensor' | 'fixed-text';
    objectIndex: number;
    overlayName: string;
    overlayIndex: number | null;
    overlayClassification: OverlayClassification;
    sensorType?: number;
    isLocal?: boolean;
};

type FixedFace = {
    mapIndex: number;
    x: number;
    y: number;
    face: CardinalDir;
    stateful: boolean;
    primaryOverlayName: string;
    primaryOverlayIndex: number | null;
    primaryOverlayClassification: OverlayClassification;
    variants: FixedVariant[];
};

type OverlayPositionsData = {
    mapIndex?: number;
    fixedFaces: FixedFace[];
    effectivePlacements?: EffectivePlacement[];
};

type OverlayVisual = {
    image?: string;
    label?: string;
    accent: string;
    width?: number;
    height?: number;
};

type OverlayAssetSource = 'modern-remake' | 'original-fallback';

type OverlayAssetPolicy = {
    modernImage?: string;
    originalFallbackImage: string;
    note?: string;
};

export type WallOverlayAssetStatus = {
    name: string;
    image: string;
    source: OverlayAssetSource;
    modernImage?: string;
    originalFallbackImage: string;
    note?: string;
};

export type OriginalWallOverlayRender = {
    tileX: number;
    tileY: number;
    face: CardinalDir;
    image?: string;
    label?: string;
    accent?: string;
    width?: number;
    height?: number;
    interactiveSensorIndices?: number[];
};

type OverlayRuntimeState = {
    activeSensors: Set<string>;
    firedSensors?: Set<string>;
};

type OverlayMapIndex = {
    fixedFaces: FixedFace[];
    resolvedPlacements: EffectivePlacement[];
    overlayNameKeys: Set<string>;
};

type EffectivePlacement = {
    mapIndex: number;
    x: number;
    y: number;
    face: CardinalDir;
    effectiveSource?: 'random-capable' | 'fixed';
    overlayName: string | null;
    overlayIndex: number | null;
    overlayClassification: OverlayClassification | null;
};

const overlayMapIndexes = new Map<number, OverlayMapIndex>();

function ensureOverlayMapIndex(mapIndex: number): OverlayMapIndex {
    const cached = overlayMapIndexes.get(mapIndex);
    if (cached) return cached;

    const data = getOriginalWallOverlayMapDataSync<OverlayPositionsData>(mapIndex);
    const fixedFaces = data.fixedFaces ?? [];
    const resolvedPlacements = (data.effectivePlacements ?? []).filter(
        (placement): placement is EffectivePlacement =>
            typeof placement?.overlayName === 'string' && placement.overlayName.length > 0,
    );
    const overlayNameKeys = new Set<string>();

    for (const face of fixedFaces) {
        for (const variant of face.variants) {
            overlayNameKeys.add(`${face.mapIndex}:${face.x}:${face.y}:${face.face}:${variant.overlayName}`);
        }
    }

    for (const placement of resolvedPlacements) {
        overlayNameKeys.add(`${placement.mapIndex}:${placement.x}:${placement.y}:${placement.face}:${placement.overlayName}`);
    }

    const index = { fixedFaces, resolvedPlacements, overlayNameKeys };
    overlayMapIndexes.set(mapIndex, index);
    return index;
}

const OMITTED_OVERLAYS = new Set([
    'Champion Mirror',
    'Unreadable Wall Inscription',
]);

const ORIGINAL_OVERLAY_REMAKE_NOTE =
    'No dedicated modern remake yet; using the original BMP fallback to preserve the exact family-specific art.';

const WALL_OVERLAY_ASSET_POLICY_BY_NAME: Record<string, OverlayAssetPolicy> = {
    'Fountain': { modernImage: miscPath('wall_foutain_overlay.png'), originalFallbackImage: originalMiscPath('fountain.bmp') },
    'Vi Altar': { modernImage: miscPath('autel.png'), originalFallbackImage: originalMiscPath('vi_altar.bmp') },
    'Lever Up': { modernImage: miscPath('levier_haut.png'), originalFallbackImage: originalMiscPath('lever_up.bmp') },
    'Lever Down': { modernImage: miscPath('levier_bas.png'), originalFallbackImage: originalMiscPath('lever_down.bmp') },
    'Iron Lock': { modernImage: miscPath('wall_lock_iron.png'), originalFallbackImage: originalMiscPath('iron_lock.bmp') },
    'Double Iron Lock': { modernImage: miscPath('wall_lock_double_iron.png'), originalFallbackImage: originalMiscPath('double_iron_lock.bmp') },
    'Square Lock': { modernImage: miscPath('wall_lock_square.png'), originalFallbackImage: originalMiscPath('square_lock.bmp') },
    'Winged Lock': { modernImage: miscPath('wall_lock_winged.png'), originalFallbackImage: originalMiscPath('winged_lock.bmp') },
    'Onyx Lock': { modernImage: miscPath('wall_lock_onyx.png'), originalFallbackImage: originalMiscPath('onyx_lock.bmp') },
    'Stone Lock': { modernImage: miscPath('wall_lock_stone.png'), originalFallbackImage: originalMiscPath('stone_lock.bmp') },
    'Cross Lock': { modernImage: miscPath('wall_lock_cross.png'), originalFallbackImage: originalMiscPath('cross_lock.bmp') },
    'Topaz Lock': { modernImage: miscPath('wall_lock_topaz.png'), originalFallbackImage: originalMiscPath('topaz_lock.bmp') },
    'Skeleton Lock': { modernImage: miscPath('wall_lock_skeleton.png'), originalFallbackImage: originalMiscPath('skeleton_lock.bmp') },
    'Gold Lock': { modernImage: miscPath('wall_lock_gold.png'), originalFallbackImage: originalMiscPath('gold_lock.bmp') },
    'Tourquoise Lock': { modernImage: miscPath('wall_lock_tourquoise.png'), originalFallbackImage: originalMiscPath('tourquoise_lock.bmp') },
    'Emerald Lock': { modernImage: miscPath('wall_lock_emerald.png'), originalFallbackImage: originalMiscPath('emerald_lock.bmp') },
    'Ruby Lock': { modernImage: miscPath('wall_lock_ruby.png'), originalFallbackImage: originalMiscPath('ruby_lock.bmp') },
    'Ra Lock': { modernImage: miscPath('wall_lock_ra.png'), originalFallbackImage: originalMiscPath('ra_lock.bmp') },
    'Master Lock': { modernImage: miscPath('wall_lock_master.png'), originalFallbackImage: originalMiscPath('master_lock.bmp') },
    'Coin Slot': { modernImage: miscPath('wall_coin_slot.png'), originalFallbackImage: originalMiscPath('coin_slot.bmp') },
    'Gem Hole': { modernImage: miscPath('wall_gem_hole.png'), originalFallbackImage: originalMiscPath('gem_hole.bmp') },
    'Hook': { modernImage: miscPath('wall_hook.png'), originalFallbackImage: originalMiscPath('hook.bmp') },
    'Wood Ring': { modernImage: miscPath('wall_wood_ring.png'), originalFallbackImage: originalMiscPath('wood_ring.bmp') },
    'Full Torch Holder': { modernImage: miscPath('wall_torch_holder_full.png'), originalFallbackImage: originalMiscPath('full_torch_holder.bmp') },
    'Empty Torch Holder': { modernImage: miscPath('wall_torch_holder_empty.png'), originalFallbackImage: originalMiscPath('empty_torch_holder.bmp') },
    'Square Alcove': { modernImage: miscPath('wall_alcove_square.png'), originalFallbackImage: originalMiscPath('square_alcove.bmp') },
    'Arched Alcove': { modernImage: miscPath('wall_alcove_arched.png'), originalFallbackImage: originalMiscPath('arched_alcove.bmp') },
    'Small Switch': { modernImage: miscPath('wall_switch_small.png'), originalFallbackImage: originalMiscPath('small_switch.bmp') },
    'Tiny Switch': { modernImage: miscPath('wall_switch_tiny.png'), originalFallbackImage: originalMiscPath('tiny_switch.bmp') },
    'Big Switch In': { modernImage: miscPath('wall_switch_big_in.png'), originalFallbackImage: originalMiscPath('big_switch_in.bmp') },
    'Big Switch Out': { modernImage: miscPath('wall_switch_big_out.png'), originalFallbackImage: originalMiscPath('big_switch_out.bmp') },
    'Blue Switch In': { modernImage: miscPath('wall_switch_blue_in.png'), originalFallbackImage: originalMiscPath('blue_switch_in.bmp') },
    'Blue Switch Out': { modernImage: miscPath('wall_switch_blue_out.png'), originalFallbackImage: originalMiscPath('blue_switch_out.bmp') },
    'Green Switch In': { modernImage: miscPath('wall_switch_green_in.png'), originalFallbackImage: originalMiscPath('green_switch_in.bmp') },
    'Green Switch Out': { modernImage: miscPath('wall_switch_green_out.png'), originalFallbackImage: originalMiscPath('green_switch_out.bmp') },
    'Red Switch In': { modernImage: miscPath('wall_switch_red_in.png'), originalFallbackImage: originalMiscPath('red_switch_in.bmp') },
    'Red Switch Out': { modernImage: miscPath('wall_switch_red_out.png'), originalFallbackImage: originalMiscPath('red_switch_out.bmp') },
    'Crack Switch In': { modernImage: miscPath('wall_switch_crack_in.png'), originalFallbackImage: originalMiscPath('crack_switch_in.bmp') },
    'Crack Switch Out': { modernImage: miscPath('wall_switch_crack_out.png'), originalFallbackImage: originalMiscPath('crack_switch_out.bmp') },
    'Eye Switch': { modernImage: miscPath('wall_switch_eye.png'), originalFallbackImage: originalMiscPath('eye_switch.bmp') },
    'Fireball Holes': { modernImage: miscPath('wall_hazard_fireball_holes.png'), originalFallbackImage: originalMiscPath('fireball_holes.bmp') },
    'Dagger Holes': { modernImage: miscPath('wall_hazard_dagger_holes.png'), originalFallbackImage: originalMiscPath('dagger_holes.bmp') },
    'Poison Holes': { modernImage: miscPath('wall_hazard_poison_holes.png'), originalFallbackImage: originalMiscPath('poison_holes.bmp') },
    'Slime Outlet': { modernImage: miscPath('wall_hazard_slime_outlet.png'), originalFallbackImage: originalMiscPath('slime_outlet.bmp') },
    'Dent 1': { modernImage: miscPath('wall_dent_1.png'), originalFallbackImage: originalMiscPath('dent_1.bmp') },
    'Slime': { modernImage: miscPath('wall_slime.png'), originalFallbackImage: originalMiscPath('slime.bmp') },
    'Grate': { modernImage: miscPath('wall_grate.png'), originalFallbackImage: originalMiscPath('grate.bmp') },
    'Ghoul\'s Head': { modernImage: miscPath('wall_ghouls_head.png'), originalFallbackImage: originalMiscPath('ghouls_head.bmp') },
    'Scratches': { modernImage: miscPath('wall_scratches.png'), originalFallbackImage: originalMiscPath('scratches.bmp') },
    'Amalgam (Encased Gem)': { modernImage: miscPath('wall_amalgam_encased_gem.png'), originalFallbackImage: originalMiscPath('amalgam_encased_gem.bmp') },
    'Amalgam (Free Gem)': { modernImage: miscPath('wall_amalgam_free_gem.png'), originalFallbackImage: originalMiscPath('amalgam_free_gem.bmp') },
    'Amalgam (Without Gem)': { modernImage: miscPath('wall_amalgam_without_gem.png'), originalFallbackImage: originalMiscPath('amalgam_without_gem.bmp') },
    'Crack': { modernImage: miscPath('wall_crack.png'), originalFallbackImage: originalMiscPath('crack.bmp') },
    'Iron Ring': { modernImage: miscPath('wall_iron_ring.png'), originalFallbackImage: originalMiscPath('iron_ring.bmp') },
    'Manacles': { modernImage: miscPath('wall_manacles.png'), originalFallbackImage: originalMiscPath('manacles.bmp') },
    'Lord Order (Outside)': { modernImage: miscPath('wall_lord_order_outside_v2.png'), originalFallbackImage: originalMiscPath('lord_order_outside.bmp') },
};

function resolveOverlayAssetImage(policy: OverlayAssetPolicy): string {
    return policy.modernImage ?? policy.originalFallbackImage;
}

function resolveOverlayAssetSource(policy: OverlayAssetPolicy): OverlayAssetSource {
    return policy.modernImage ? 'modern-remake' : 'original-fallback';
}

const SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME: Record<string, string> = Object.fromEntries(
    Object.entries(WALL_OVERLAY_ASSET_POLICY_BY_NAME).map(([name, policy]) => [name, resolveOverlayAssetImage(policy)]),
);

export const WALL_OVERLAY_ASSET_STATUSES: WallOverlayAssetStatus[] = Object.entries(WALL_OVERLAY_ASSET_POLICY_BY_NAME)
    .map(([name, policy]) => ({
        name,
        image: resolveOverlayAssetImage(policy),
        source: resolveOverlayAssetSource(policy),
        modernImage: policy.modernImage,
        originalFallbackImage: policy.originalFallbackImage,
        note: policy.note,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

export const WALL_OVERLAY_REMAKE_NOTES = WALL_OVERLAY_ASSET_STATUSES
    .filter((status) => status.source === 'original-fallback')
    .map((status) => ({
        name: status.name,
        image: status.image,
        note: status.note ?? ORIGINAL_OVERLAY_REMAKE_NOTE,
    }));

const VISUALS_BY_NAME: Record<string, OverlayVisual> = {
    'Fountain': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Fountain'], accent: '#78a8d8', width: 0.8, height: 1.06 },
    'Vi Altar': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Vi Altar'], accent: '#d5b175', width: 1.0, height: 0.94 },
    'Lever Up': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Lever Up'], accent: '#cda467', width: 0.32, height: 0.84 },
    'Lever Down': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Lever Down'], accent: '#cda467', width: 0.32, height: 0.84 },
    'Iron Lock': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Iron Lock'], accent: '#b0a38b', width: 0.42, height: 0.42 },
    'Double Iron Lock': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Double Iron Lock'], accent: '#b0a38b', width: 0.42, height: 0.42 },
    'Square Lock': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Square Lock'], accent: '#b0a38b', width: 0.42, height: 0.42 },
    'Winged Lock': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Winged Lock'], accent: '#d3b669', width: 0.42, height: 0.42 },
    'Onyx Lock': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Onyx Lock'], accent: '#8e8c99', width: 0.42, height: 0.42 },
    'Stone Lock': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Stone Lock'], accent: '#a79a87', width: 0.42, height: 0.42 },
    'Cross Lock': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Cross Lock'], accent: '#c2b08d', width: 0.42, height: 0.42 },
    'Topaz Lock': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Topaz Lock'], accent: '#d7a84d', width: 0.42, height: 0.42 },
    'Skeleton Lock': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Skeleton Lock'], accent: '#d8d0b2', width: 0.42, height: 0.42 },
    'Gold Lock': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Gold Lock'], accent: '#d9b43f', width: 0.42, height: 0.42 },
    'Tourquoise Lock': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Tourquoise Lock'], accent: '#56b7be', width: 0.42, height: 0.42 },
    'Emerald Lock': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Emerald Lock'], accent: '#48a664', width: 0.42, height: 0.42 },
    'Ruby Lock': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Ruby Lock'], accent: '#c45454', width: 0.42, height: 0.42 },
    'Ra Lock': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Ra Lock'], accent: '#e1b862', width: 0.42, height: 0.42 },
    'Master Lock': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Master Lock'], accent: '#f1d18a', width: 0.42, height: 0.42 },
    'Coin Slot': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Coin Slot'], accent: '#ccb173', width: 0.34, height: 0.34 },
    'Gem Hole': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Gem Hole'], accent: '#5bbad6', width: 0.34, height: 0.34 },
    'Hook': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Hook'], accent: '#8f826f', width: 0.34, height: 0.48 },
    'Wood Ring': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Wood Ring'], accent: '#9b7a58', width: 0.38, height: 0.5 },
    'Full Torch Holder': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Full Torch Holder'], accent: '#d59a54', width: 0.24, height: 0.92 },
    'Empty Torch Holder': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Empty Torch Holder'], accent: '#7e6c5c', width: 0.42, height: 0.48 },
    'Square Alcove': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Square Alcove'], accent: '#8c7a66', width: 0.72, height: 0.74 },
    'Arched Alcove': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Arched Alcove'], accent: '#92785f', width: 0.74, height: 0.86 },
    'Small Switch': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Small Switch'], accent: '#bea06e', width: 0.42, height: 0.42 },
    'Tiny Switch': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Tiny Switch'], accent: '#bea06e', width: 0.32, height: 0.32 },
    'Big Switch In': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Big Switch In'], accent: '#c18a5c', width: 0.5, height: 0.5 },
    'Big Switch Out': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Big Switch Out'], accent: '#c18a5c', width: 0.5, height: 0.5 },
    'Blue Switch In': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Blue Switch In'], accent: '#64a9d9', width: 0.5, height: 0.5 },
    'Blue Switch Out': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Blue Switch Out'], accent: '#64a9d9', width: 0.5, height: 0.5 },
    'Green Switch In': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Green Switch In'], accent: '#63b06d', width: 0.5, height: 0.5 },
    'Green Switch Out': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Green Switch Out'], accent: '#63b06d', width: 0.5, height: 0.5 },
    'Red Switch In': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Red Switch In'], accent: '#c86161', width: 0.5, height: 0.5 },
    'Red Switch Out': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Red Switch Out'], accent: '#c86161', width: 0.5, height: 0.5 },
    'Crack Switch In': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Crack Switch In'], accent: '#9d7d68', width: 0.5, height: 0.5 },
    'Crack Switch Out': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Crack Switch Out'], accent: '#9d7d68', width: 0.5, height: 0.5 },
    'Eye Switch': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Eye Switch'], accent: '#b87e58', width: 0.48, height: 0.48 },
    'Fireball Holes': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Fireball Holes'], accent: '#bf5b4e', width: 0.68, height: 0.52 },
    'Dagger Holes': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Dagger Holes'], accent: '#9c9aa4', width: 0.68, height: 0.52 },
    'Poison Holes': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Poison Holes'], accent: '#65a96c', width: 0.68, height: 0.52 },
    'Slime Outlet': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Slime Outlet'], accent: '#6ea16a', width: 0.34, height: 0.26 },
    'Dent 1': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Dent 1'], accent: '#8a857d', width: 0.44, height: 0.54 },
    'Slime': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Slime'], accent: '#6c9964', width: 0.72, height: 0.86 },
    'Grate': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Grate'], accent: '#8c9098', width: 0.78, height: 0.92 },
    'Ghoul\'s Head': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Ghoul\'s Head'], accent: '#a89572', width: 0.62, height: 0.84 },
    'Scratches': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Scratches'], accent: '#8c8578', width: 0.58, height: 0.82 },
    'Amalgam (Encased Gem)': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Amalgam (Encased Gem)'], accent: '#d1bf81', width: 0.78, height: 0.9 },
    'Amalgam (Free Gem)': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Amalgam (Free Gem)'], accent: '#d1bf81', width: 0.78, height: 0.9 },
    'Amalgam (Without Gem)': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Amalgam (Without Gem)'], accent: '#d1bf81', width: 0.78, height: 0.9 },
    'Crack': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Crack'], accent: '#8e8f9b', width: 0.56, height: 0.8 },
    'Iron Ring': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Iron Ring'], accent: '#a0a0a6', width: 0.2, height: 0.2 },
    'Manacles': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Manacles'], accent: '#9c9aa4', width: 0.56, height: 0.66 },
    'Lord Order (Outside)': { image: SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME['Lord Order (Outside)'], accent: '#bf8b54', width: 0.78, height: 1.0 },
};

for (const visual of Object.values(VISUALS_BY_NAME)) {
    const sharedRatios = getWallOverlayImageRatios(visual.image);
    if (!sharedRatios) continue;
    visual.width = sharedRatios.width;
    visual.height = sharedRatios.height;
}

export function getOriginalWallOverlayVisual(name: string): OverlayVisual | undefined {
    return VISUALS_BY_NAME[name];
}

export function getOriginalWallOverlaySourceImage(name: string): string | undefined {
    return SOURCE_BACKED_WALL_OVERLAY_IMAGE_BY_NAME[name];
}

export function getOriginalWallOverlayAssetStatus(name: string): WallOverlayAssetStatus | undefined {
    return WALL_OVERLAY_ASSET_STATUSES.find((status) => status.name === name);
}

export const ALL_WALL_OVERLAY_IMAGE_PATHS = Array.from(
    new Set(
        Object.values(VISUALS_BY_NAME)
            .map((visual) => visual.image)
            .filter((image): image is string => Boolean(image)),
    ),
).sort();

const CORE_WALL_OVERLAY_NAMES = [
    'Fountain',
    'Vi Altar',
    'Lever Up',
    'Lever Down',
    'Iron Lock',
    'Double Iron Lock',
    'Square Lock',
    'Winged Lock',
    'Onyx Lock',
    'Stone Lock',
    'Cross Lock',
    'Topaz Lock',
    'Skeleton Lock',
    'Gold Lock',
    'Tourquoise Lock',
    'Emerald Lock',
    'Ruby Lock',
    'Ra Lock',
    'Master Lock',
    'Coin Slot',
    'Gem Hole',
    'Full Torch Holder',
    'Empty Torch Holder',
    'Square Alcove',
    'Arched Alcove',
    'Small Switch',
    'Tiny Switch',
    'Big Switch In',
    'Big Switch Out',
    'Blue Switch In',
    'Blue Switch Out',
    'Green Switch In',
    'Green Switch Out',
    'Red Switch In',
    'Red Switch Out',
    'Crack Switch In',
    'Crack Switch Out',
    'Eye Switch',
    'Fireball Holes',
    'Dagger Holes',
    'Poison Holes',
    'Slime Outlet',
    'Amalgam (Encased Gem)',
    'Amalgam (Free Gem)',
    'Amalgam (Without Gem)',
] as const;

function buildOverlayImagePathList(names: readonly string[]): string[] {
    return Array.from(
        new Set(
            names
                .map((name) => getOriginalWallOverlaySourceImage(name))
                .filter((image): image is string => Boolean(image)),
        ),
    ).sort();
}

export const CORE_WALL_OVERLAY_IMAGE_PATHS = buildOverlayImagePathList(CORE_WALL_OVERLAY_NAMES);

const CORE_WALL_OVERLAY_IMAGE_PATH_SET = new Set(CORE_WALL_OVERLAY_IMAGE_PATHS);

export const SECONDARY_WALL_OVERLAY_IMAGE_PATHS = ALL_WALL_OVERLAY_IMAGE_PATHS
    .filter((image) => !CORE_WALL_OVERLAY_IMAGE_PATH_SET.has(image));

function getPreferredStateVariants(face: FixedFace): FixedVariant[] {
    const sensorVariants = face.variants.filter(
        (variant) => variant.source === 'fixed-sensor' && variant.sensorType !== undefined,
    );
    const nonLocalVariants = sensorVariants.filter((variant) => variant.isLocal === false);
    return nonLocalVariants.length > 0 ? nonLocalVariants : sensorVariants;
}

function isFaceActive(level: number, face: FixedFace, activeSensors: Set<string>): boolean {
    return getPreferredStateVariants(face).some((variant) =>
        activeSensors.has(`${level}_${variant.objectIndex}`),
    );
}

function getInteractiveSensorIndices(face: FixedFace): number[] {
    const interactiveVariants = face.variants.filter((variant) =>
        variant.source === 'fixed-sensor' &&
        (variant.sensorType === 1
            || variant.sensorType === 2
            || variant.sensorType === 3
            || variant.sensorType === 4),
    );
    const preferred = interactiveVariants.filter((variant) => variant.isLocal === false);
    return (preferred.length > 0 ? preferred : interactiveVariants).map((variant) => variant.objectIndex);
}

function chooseOverlayName(
    level: number,
    face: FixedFace,
    runtimeState: OverlayRuntimeState,
): string {
    const names = new Set(face.variants.map(variant => variant.overlayName));
    const active = isFaceActive(level, face, runtimeState.activeSensors);
    const firedSensors = runtimeState.firedSensors ?? new Set<string>();

    if (names.has('Lever Up') && names.has('Lever Down')) {
        return active ? 'Lever Down' : 'Lever Up';
    }
    if (names.has('Big Switch In') && names.has('Big Switch Out')) {
        return active ? 'Big Switch In' : 'Big Switch Out';
    }
    if (names.has('Blue Switch In') && names.has('Blue Switch Out')) {
        return active ? 'Blue Switch In' : 'Blue Switch Out';
    }
    if (names.has('Green Switch In') && names.has('Green Switch Out')) {
        return active ? 'Green Switch In' : 'Green Switch Out';
    }
    if (names.has('Red Switch In') && names.has('Red Switch Out')) {
        return active ? 'Red Switch In' : 'Red Switch Out';
    }
    if (names.has('Crack Switch In') && names.has('Crack Switch Out')) {
        return active ? 'Crack Switch In' : 'Crack Switch Out';
    }
    if (names.has('Empty Torch Holder') && names.has('Full Torch Holder')) {
        return active ? 'Full Torch Holder' : 'Empty Torch Holder';
    }
    if (
        names.has('Amalgam (Encased Gem)') &&
        names.has('Amalgam (Free Gem)') &&
        names.has('Amalgam (Without Gem)')
    ) {
        const freeGemVariant = face.variants.find((variant) => variant.overlayName === 'Amalgam (Free Gem)');
        const withoutGemVariant = face.variants.find((variant) => variant.overlayName === 'Amalgam (Without Gem)');
        if (withoutGemVariant && firedSensors.has(`${level}_${withoutGemVariant.objectIndex}`)) {
            return 'Amalgam (Without Gem)';
        }
        if (freeGemVariant && firedSensors.has(`${level}_${freeGemVariant.objectIndex}`)) {
            return 'Amalgam (Free Gem)';
        }
        return 'Amalgam (Encased Gem)';
    }
    return face.primaryOverlayName;
}

function buildLabel(name: string): string {
    return name
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\bWall\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function getVisual(name: string, classification: OverlayClassification): OverlayVisual {
    const mapped = VISUALS_BY_NAME[name];
    if (mapped) return mapped;
    const accentByClassification: Record<OverlayClassification, string> = {
        interactive: '#c5a46a',
        stateful: '#d09058',
        hazard: '#bf5b4e',
        decorative: '#8e8f9b',
        unclear: '#7d8791',
    };
    return {
        label: buildLabel(name),
        accent: accentByClassification[classification],
        width: 0.54,
        height: 0.44,
    };
}

export function getOriginalWallOverlaysForMap(
    map: GameMap,
    activeSensors: Set<string>,
    firedSensors?: Set<string>,
): OriginalWallOverlayRender[] {
    const { fixedFaces, resolvedPlacements } = ensureOverlayMapIndex(map.index);
    const faces = fixedFaces;
    const renders: OriginalWallOverlayRender[] = [];
    const runtimeState: OverlayRuntimeState = { activeSensors, firedSensors };
    const renderedKeys = new Set<string>();
    const fixedFaceKeys = new Set<string>();

    for (const face of faces) {
        const overlayName = chooseOverlayName(map.index, face, runtimeState);
        if (OMITTED_OVERLAYS.has(overlayName)) continue;

        const variant = face.variants.find(entry => entry.overlayName === overlayName) ?? face.variants[0];
        if (!variant) continue;

        const visual = getVisual(overlayName, variant.overlayClassification);
        const faceKey = `${face.x}:${face.y}:${face.face}`;
        const renderKey = `${face.x}:${face.y}:${face.face}:${overlayName}`;
        fixedFaceKeys.add(faceKey);
        renderedKeys.add(renderKey);
        renders.push({
            tileX: face.x,
            tileY: face.y,
            face: face.face,
            image: visual.image,
            label: visual.label,
            accent: visual.accent,
            // Visual definitions store wall-relative ratios; convert them once here
            // so renderers can consistently work in world units.
            width: visual.width !== undefined ? visual.width * GRID_SIZE : undefined,
            height: visual.height !== undefined ? visual.height * WALL_HEIGHT : undefined,
            interactiveSensorIndices: getInteractiveSensorIndices(face),
        });
    }

    for (const placement of resolvedPlacements) {
        if (placement.overlayName === null || OMITTED_OVERLAYS.has(placement.overlayName)) continue;
        const faceKey = `${placement.x}:${placement.y}:${placement.face}`;
        if (fixedFaceKeys.has(faceKey)) continue;
        const renderKey = `${placement.x}:${placement.y}:${placement.face}:${placement.overlayName}`;
        if (renderedKeys.has(renderKey)) continue;
        const visual = getVisual(placement.overlayName, placement.overlayClassification ?? 'unclear');
        renders.push({
            tileX: placement.x,
            tileY: placement.y,
            face: placement.face,
            image: visual.image,
            label: visual.label,
            accent: visual.accent,
            width: visual.width !== undefined ? visual.width * GRID_SIZE : undefined,
            height: visual.height !== undefined ? visual.height * WALL_HEIGHT : undefined,
        });
    }

    return renders;
}

export function hasOriginalWallOverlayAt(
    mapIndex: number,
    x: number,
    y: number,
    face: CardinalDir,
    overlayName: string,
): boolean {
    const { overlayNameKeys } = ensureOverlayMapIndex(mapIndex);
    return overlayNameKeys.has(`${mapIndex}:${x}:${y}:${face}:${overlayName}`);
}

export function hasEffectiveOriginalWallOverlayAt(
    mapIndex: number,
    x: number,
    y: number,
    face: CardinalDir,
    overlayName: string,
): boolean {
    const { fixedFaces, resolvedPlacements } = ensureOverlayMapIndex(mapIndex);
    // Only the fixed disabled-ornament fountains are direct water sources.
    // Other fixed Fountain art, such as the wish fountain flow, must not
    // become drinkable just because they share the same wall overlay family.
    return resolvedPlacements.some((placement) =>
        placement.x === x
        && placement.y === y
        && placement.face === face
        && placement.overlayName === overlayName,
    ) || fixedFaces.some((fixedFace) =>
        overlayName === 'Fountain'
        && !fixedFace.stateful
        && fixedFace.x === x
        && fixedFace.y === y
        && fixedFace.face === face
        && fixedFace.primaryOverlayName === overlayName
        && fixedFace.variants.every((variant) => variant.sensorType === 0),
    );
}

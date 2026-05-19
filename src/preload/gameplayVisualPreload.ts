import { ALL_ITEM_IMAGE_PATHS } from '../data/itemImageCatalog';
import {
    AMALGAM_WALL_OVERLAY_IMAGE_PATHS,
    CORE_WALL_OVERLAY_IMAGE_PATHS,
    SECONDARY_WALL_OVERLAY_IMAGE_PATHS,
} from '../data/originalWallOverlays';
import { miscPath, runesPath, spritesPath, texturesPath } from '../data/assetPaths';

const RUNE_IDS = [
    'bro', 'dain', 'des', 'ee', 'ew', 'ful', 'gor',
    'ir', 'kath', 'ku', 'lo', 'mon', 'neta', 'oh', 'on',
    'pal', 'ra', 'ros', 'sar', 'um', 'ven', 'vi', 'ya', 'zo',
];

const CREATURE_IDS = Array.from({ length: 27 }, (_, i) => i);

const TITLE_IMAGE_ASSETS: string[] = [
    miscPath('Dm_logo.png'),
    miscPath('cadre_entree.png'),
    miscPath('porte_entree_droite.png'),
    miscPath('porte_entree_gauche.png'),
    miscPath('wall_switch_green_out.png'),
    miscPath('wall_switch_red_out.png'),
    texturesPath('wall.png'),
];

const GAMEPLAY_CORE_IMAGE_ASSETS: string[] = [
    ...RUNE_IDS.map(id => runesPath(`${id}.png`)),
    ...CREATURE_IDS.map(id => spritesPath(`creatures/creature_${id}.png`)),
    ...CORE_WALL_OVERLAY_IMAGE_PATHS,
    texturesPath('wall.png'),
    texturesPath('floor.png'),
    texturesPath('ceiling.png'),
    texturesPath('doorWood.png'),
    texturesPath('doorIron.png'),
];

const GAMEPLAY_SECONDARY_IMAGE_ASSETS: string[] = [
    ...ALL_ITEM_IMAGE_PATHS,
    ...SECONDARY_WALL_OVERLAY_IMAGE_PATHS,
];

const PRELOAD_BATCH_SIZE = 12;

const imagePromiseCache = new Map<string, Promise<void>>();
let titleVisualPromise: Promise<void> | null = null;
let gameplayCoreVisualPromise: Promise<void> | null = null;
let gameplaySecondaryVisualPromise: Promise<void> | null = null;
let gameplayVisualPromise: Promise<void> | null = null;
let amalgamWallOverlayVisualPromise: Promise<void> | null = null;

function preloadImage(src: string): Promise<void> {
    const cached = imagePromiseCache.get(src);
    if (cached) return cached;

    const promise = new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = img.onerror = () => resolve();
        img.src = src;
    });

    imagePromiseCache.set(src, promise);
    return promise;
}

function waitForNextTask(): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, 0);
    });
}

async function preloadImageList(sources: readonly string[]): Promise<void> {
    const uniqueSources = Array.from(new Set(sources));

    for (let index = 0; index < uniqueSources.length; index += PRELOAD_BATCH_SIZE) {
        const batch = uniqueSources.slice(index, index + PRELOAD_BATCH_SIZE);
        await Promise.all(batch.map(preloadImage));
        if (index + PRELOAD_BATCH_SIZE < uniqueSources.length) {
            await waitForNextTask();
        }
    }
}

export function preloadTitleVisualAssets(): Promise<void> {
    if (!titleVisualPromise) {
        titleVisualPromise = preloadImageList(TITLE_IMAGE_ASSETS);
    }
    return titleVisualPromise;
}

export function preloadGameplayCoreVisualAssets(): Promise<void> {
    if (!gameplayCoreVisualPromise) {
        gameplayCoreVisualPromise = preloadImageList(GAMEPLAY_CORE_IMAGE_ASSETS);
    }
    return gameplayCoreVisualPromise;
}

export function preloadGameplaySecondaryVisualAssets(): Promise<void> {
    if (!gameplaySecondaryVisualPromise) {
        gameplaySecondaryVisualPromise = preloadImageList(GAMEPLAY_SECONDARY_IMAGE_ASSETS);
    }
    return gameplaySecondaryVisualPromise;
}

export function preloadAmalgamWallOverlayVisualAssets(): Promise<void> {
    if (!amalgamWallOverlayVisualPromise) {
        amalgamWallOverlayVisualPromise = preloadImageList(AMALGAM_WALL_OVERLAY_IMAGE_PATHS);
    }
    return amalgamWallOverlayVisualPromise;
}

export function preloadGameplayVisualAssets(): Promise<void> {
    if (!gameplayVisualPromise) {
        gameplayVisualPromise = preloadGameplayCoreVisualAssets()
            .then(() => preloadGameplaySecondaryVisualAssets());
    }
    return gameplayVisualPromise;
}

import { ALL_ITEM_IMAGE_PATHS } from '../data/itemImageCatalog';
import { ALL_WALL_OVERLAY_IMAGE_PATHS } from '../data/originalWallOverlays';
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
];

const GAMEPLAY_IMAGE_ASSETS: string[] = [
    ...RUNE_IDS.map(id => runesPath(`${id}.png`)),
    ...CREATURE_IDS.map(id => spritesPath(`creatures/creature_${id}.png`)),
    ...ALL_ITEM_IMAGE_PATHS,
    ...ALL_WALL_OVERLAY_IMAGE_PATHS,
    miscPath('wall_switch_green_out.png'),
    miscPath('wall_switch_red_out.png'),
    texturesPath('wall.png'),
    texturesPath('floor.png'),
    texturesPath('ceiling.png'),
    texturesPath('door.png'),
];

const imagePromiseCache = new Map<string, Promise<void>>();
let titleVisualPromise: Promise<void> | null = null;
let gameplayVisualPromise: Promise<void> | null = null;

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

export function preloadTitleVisualAssets(): Promise<void> {
    if (!titleVisualPromise) {
        titleVisualPromise = Promise.all(TITLE_IMAGE_ASSETS.map(preloadImage)).then(() => {});
    }
    return titleVisualPromise;
}

export function preloadGameplayVisualAssets(): Promise<void> {
    if (!gameplayVisualPromise) {
        gameplayVisualPromise = Promise.all(GAMEPLAY_IMAGE_ASSETS.map(preloadImage)).then(() => {});
    }
    return gameplayVisualPromise;
}

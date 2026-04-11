let cachedOriginalWallOverlayData: unknown | null = null;
let originalWallOverlayDataPromise: Promise<unknown> | null = null;

export async function preloadOriginalWallOverlayData(): Promise<void> {
    if (cachedOriginalWallOverlayData) return;
    if (!originalWallOverlayDataPromise) {
        originalWallOverlayDataPromise = import('../assets/original_wall_overlay_positions.json?raw').then((module) => {
            cachedOriginalWallOverlayData = JSON.parse(module.default) as unknown;
            return cachedOriginalWallOverlayData;
        });
    }
    await originalWallOverlayDataPromise;
}

export function getOriginalWallOverlayDataSync<T>(): T {
    if (!cachedOriginalWallOverlayData) {
        throw new Error('Original wall overlay data accessed before preload completed.');
    }
    return cachedOriginalWallOverlayData as T;
}

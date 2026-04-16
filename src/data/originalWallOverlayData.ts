let cachedOriginalWallOverlayData: unknown | null = null;
let originalWallOverlayDataPromise: Promise<unknown> | null = null;

function unwrapImportedModule<T>(module: T | { default: T }): T {
    if (typeof module === 'object' && module !== null && 'default' in module) {
        return (module as { default: T }).default;
    }
    return module as T;
}

export async function preloadOriginalWallOverlayData(): Promise<void> {
    if (cachedOriginalWallOverlayData) return;
    if (!originalWallOverlayDataPromise) {
        originalWallOverlayDataPromise = import('../assets/original_wall_overlay_positions.json?raw').then((module) => {
            cachedOriginalWallOverlayData = JSON.parse(unwrapImportedModule(module)) as unknown;
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

const cachedWallOverlayMaps = new Map<number, unknown>();
const wallOverlayMapPromises = new Map<number, Promise<unknown>>();

const wallOverlayMapModules: Record<number, () => Promise<unknown>> = {
    0: () => import('../assets/runtime/support/wall_overlays/map-00.json'),
    1: () => import('../assets/runtime/support/wall_overlays/map-01.json'),
    2: () => import('../assets/runtime/support/wall_overlays/map-02.json'),
    3: () => import('../assets/runtime/support/wall_overlays/map-03.json'),
    4: () => import('../assets/runtime/support/wall_overlays/map-04.json'),
    5: () => import('../assets/runtime/support/wall_overlays/map-05.json'),
    6: () => import('../assets/runtime/support/wall_overlays/map-06.json'),
    7: () => import('../assets/runtime/support/wall_overlays/map-07.json'),
    8: () => import('../assets/runtime/support/wall_overlays/map-08.json'),
    9: () => import('../assets/runtime/support/wall_overlays/map-09.json'),
    10: () => import('../assets/runtime/support/wall_overlays/map-10.json'),
    11: () => import('../assets/runtime/support/wall_overlays/map-11.json'),
    12: () => import('../assets/runtime/support/wall_overlays/map-12.json'),
    13: () => import('../assets/runtime/support/wall_overlays/map-13.json'),
};

function unwrapImportedModule<T>(module: T | { default: T }): T {
    if (typeof module === 'object' && module !== null && 'default' in module) {
        return (module as { default: T }).default;
    }
    return module as T;
}

function getKnownWallOverlayMapIndices(): number[] {
    return Object.keys(wallOverlayMapModules)
        .map((value) => Number(value))
        .sort((a, b) => a - b);
}

export async function preloadOriginalWallOverlayMapData(mapIndex: number): Promise<void> {
    if (cachedWallOverlayMaps.has(mapIndex)) return;

    let mapPromise = wallOverlayMapPromises.get(mapIndex);
    if (!mapPromise) {
        const importer = wallOverlayMapModules[mapIndex];
        if (!importer) {
            throw new Error(`Original wall overlay map import is not registered for ${mapIndex}.`);
        }

        mapPromise = importer().then((module) => {
            const mapData = unwrapImportedModule(module as { default: unknown });
            cachedWallOverlayMaps.set(mapIndex, mapData);
            return mapData;
        });
        wallOverlayMapPromises.set(mapIndex, mapPromise);
    }

    await mapPromise;
}

export async function preloadOriginalWallOverlayMapSetData(mapIndices: Iterable<number>): Promise<void> {
    const known = new Set(getKnownWallOverlayMapIndices());
    const uniqueValid = Array.from(new Set(Array.from(mapIndices).filter((mapIndex) => known.has(mapIndex))));
    await Promise.all(uniqueValid.map((mapIndex) => preloadOriginalWallOverlayMapData(mapIndex)));
}

export async function preloadOriginalWallOverlayMapNeighborhoodData(mapIndex: number, radius = 1): Promise<void> {
    const targets = Array.from({ length: radius * 2 + 1 }, (_, offset) => mapIndex - radius + offset);
    await preloadOriginalWallOverlayMapSetData(targets);
}

export async function preloadOriginalWallOverlayData(): Promise<void> {
    await preloadOriginalWallOverlayMapSetData(getKnownWallOverlayMapIndices());
}

export function getOriginalWallOverlayMapDataSync<T>(mapIndex: number): T {
    if (!cachedWallOverlayMaps.has(mapIndex)) {
        throw new Error(`Original wall overlay data for map ${mapIndex} accessed before preload completed.`);
    }
    return cachedWallOverlayMaps.get(mapIndex) as T;
}

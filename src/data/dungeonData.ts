export interface RawDungeonMapBounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export interface RawDungeonMapOffset {
    x: number;
    y: number;
}

export interface RawDungeonMapSummary {
    index: number;
    name: string;
    level: number;
    width: number;
    height: number;
    difficulty: number;
    mapOffset?: RawDungeonMapOffset;
    localBounds?: RawDungeonMapBounds;
    globalBounds?: RawDungeonMapBounds;
    file: string;
}

export interface RawDungeonBootstrap {
    startPosition: {
        map: number;
        x: number;
        y: number;
        direction: string;
    };
    champions: unknown[];
    defaultOpenPits: string[];
    defaultOpenTeleporters: string[];
    defaultVisibleTexts: string[];
    maps: RawDungeonMapSummary[];
}

function getDungeonBootstrapInternal(): RawDungeonBootstrap {
    return getDungeonBootstrapSync<RawDungeonBootstrap>();
}

function getKnownDungeonMapIndices(): number[] {
    return getDungeonBootstrapInternal().maps.map((map) => map.index);
}

let cachedDungeonBootstrap: unknown | null = null;
let dungeonBootstrapPromise: Promise<unknown> | null = null;
const cachedDungeonMaps = new Map<number, unknown>();
const dungeonMapPromises = new Map<number, Promise<unknown>>();

const dungeonMapModules: Record<string, () => Promise<unknown>> = {
    'maps/level-00.json': () => import('../assets/runtime/dungeon/maps/level-00.json'),
    'maps/level-01.json': () => import('../assets/runtime/dungeon/maps/level-01.json'),
    'maps/level-02.json': () => import('../assets/runtime/dungeon/maps/level-02.json'),
    'maps/level-03.json': () => import('../assets/runtime/dungeon/maps/level-03.json'),
    'maps/level-04.json': () => import('../assets/runtime/dungeon/maps/level-04.json'),
    'maps/level-05.json': () => import('../assets/runtime/dungeon/maps/level-05.json'),
    'maps/level-06.json': () => import('../assets/runtime/dungeon/maps/level-06.json'),
    'maps/level-07.json': () => import('../assets/runtime/dungeon/maps/level-07.json'),
    'maps/level-08.json': () => import('../assets/runtime/dungeon/maps/level-08.json'),
    'maps/level-09.json': () => import('../assets/runtime/dungeon/maps/level-09.json'),
    'maps/level-10.json': () => import('../assets/runtime/dungeon/maps/level-10.json'),
    'maps/level-11.json': () => import('../assets/runtime/dungeon/maps/level-11.json'),
    'maps/level-12.json': () => import('../assets/runtime/dungeon/maps/level-12.json'),
    'maps/level-13.json': () => import('../assets/runtime/dungeon/maps/level-13.json'),
};

function unwrapImportedModule<T>(module: T | { default: T }): T {
    if (typeof module === 'object' && module !== null && 'default' in module) {
        return (module as { default: T }).default;
    }
    return module as T;
}

function getDungeonMapSummary(mapIndex: number): RawDungeonMapSummary {
    const bootstrap = getDungeonBootstrapInternal();
    const summary = bootstrap.maps.find((map) => map.index === mapIndex);
    if (!summary) {
        throw new Error(`Dungeon map metadata missing for index ${mapIndex}.`);
    }
    return summary;
}

export async function preloadDungeonBootstrapData(): Promise<void> {
    if (cachedDungeonBootstrap) return;
    if (!dungeonBootstrapPromise) {
        dungeonBootstrapPromise = import('../assets/runtime/dungeon/bootstrap.json').then((module) => {
            cachedDungeonBootstrap = unwrapImportedModule(module);
            return cachedDungeonBootstrap;
        });
    }
    await dungeonBootstrapPromise;
}

export async function preloadDungeonMapData(mapIndex: number): Promise<void> {
    if (cachedDungeonMaps.has(mapIndex)) return;

    await preloadDungeonBootstrapData();
    const summary = getDungeonMapSummary(mapIndex);

    let mapPromise = dungeonMapPromises.get(mapIndex);
    if (!mapPromise) {
        const importer = dungeonMapModules[summary.file];
        if (!importer) {
            throw new Error(`Dungeon map import is not registered for ${summary.file}.`);
        }

        mapPromise = importer().then((module) => {
            const mapData = unwrapImportedModule(module as { default: unknown });
            cachedDungeonMaps.set(mapIndex, mapData);
            return mapData;
        });
        dungeonMapPromises.set(mapIndex, mapPromise);
    }

    await mapPromise;
}

export async function preloadDungeonData(): Promise<void> {
    await preloadDungeonBootstrapData();
    const bootstrap = getDungeonBootstrapInternal();
    await Promise.all(bootstrap.maps.map((map) => preloadDungeonMapData(map.index)));
}

export async function preloadDungeonMapSetData(mapIndices: Iterable<number>): Promise<void> {
    await preloadDungeonBootstrapData();
    const known = new Set(getKnownDungeonMapIndices());
    const uniqueValid = Array.from(new Set(Array.from(mapIndices).filter((mapIndex) => known.has(mapIndex))));
    await Promise.all(uniqueValid.map((mapIndex) => preloadDungeonMapData(mapIndex)));
}

export async function preloadDungeonMapNeighborhoodData(mapIndex: number, radius = 1): Promise<void> {
    const targets = Array.from({ length: radius * 2 + 1 }, (_, offset) => mapIndex - radius + offset);
    await preloadDungeonMapSetData(targets);
}

export function getDungeonMapIndicesSync(): number[] {
    return [...getKnownDungeonMapIndices()];
}

export function isDungeonMapDataPreloaded(mapIndex: number): boolean {
    return cachedDungeonMaps.has(mapIndex);
}

export function getDungeonBootstrapSync<T>(): T {
    if (!cachedDungeonBootstrap) {
        throw new Error('Dungeon data accessed before preload completed.');
    }
    return cachedDungeonBootstrap as T;
}

export function getDungeonMapDataSync<T>(mapIndex: number): T {
    if (!cachedDungeonMaps.has(mapIndex)) {
        throw new Error(`Dungeon map ${mapIndex} accessed before preload completed.`);
    }
    return cachedDungeonMaps.get(mapIndex) as T;
}

export function getDungeonDataSync<T>(): T {
    const bootstrap = getDungeonBootstrapSync<RawDungeonBootstrap>();
    return {
        ...bootstrap,
        maps: bootstrap.maps.map((map) => getDungeonMapDataSync(map.index)),
    } as T;
}

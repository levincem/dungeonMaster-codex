let cachedDungeonData: unknown | null = null;
let dungeonDataPromise: Promise<unknown> | null = null;

// Runtime note:
// src/assets/data/dungeon.json is now a compact runtime snapshot derived from
// the full extraction output. The audit/full-fidelity dump still lives under
// assets/OriginalDataExtraction/output/dungeon.json.

export async function preloadDungeonData(): Promise<void> {
    if (cachedDungeonData) return;
    if (!dungeonDataPromise) {
        dungeonDataPromise = import('../assets/data/dungeon.json').then((module) => {
            cachedDungeonData = module.default;
            return cachedDungeonData;
        });
    }
    await dungeonDataPromise;
}

export function getDungeonDataSync<T>(): T {
    if (!cachedDungeonData) {
        throw new Error('Dungeon data accessed before preload completed.');
    }
    return cachedDungeonData as T;
}

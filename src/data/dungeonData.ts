let cachedDungeonData: unknown | null = null;
let dungeonDataPromise: Promise<unknown> | null = null;

function unwrapImportedModule<T>(module: T | { default: T }): T {
    if (typeof module === 'object' && module !== null && 'default' in module) {
        return (module as { default: T }).default;
    }
    return module as T;
}

// Runtime note:
// src/assets/data/dungeon.json is now a compact runtime snapshot derived from
// the full extraction output. The audit/full-fidelity dump still lives under
// assets/OriginalDataExtraction/output/dungeon.json.

export async function preloadDungeonData(): Promise<void> {
    if (cachedDungeonData) return;
    if (!dungeonDataPromise) {
        dungeonDataPromise = import('../assets/data/dungeon.json').then((module) => {
            cachedDungeonData = unwrapImportedModule(module);
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

let cachedGameDbData: string | null = null;
let gameDbDataPromise: Promise<string> | null = null;

function unwrapImportedModule<T>(module: T | { default: T }): T {
    if (typeof module === 'object' && module !== null && 'default' in module) {
        return (module as { default: T }).default;
    }
    return module as T;
}

export async function preloadGameDbData(): Promise<void> {
    if (cachedGameDbData !== null) return;
    if (!gameDbDataPromise) {
        gameDbDataPromise = import('../assets/data/game_db.json?raw').then((module) => {
            cachedGameDbData = unwrapImportedModule(module);
            return cachedGameDbData;
        });
    }
    await gameDbDataPromise;
}

export function getGameDbRawSync(): string {
    if (cachedGameDbData === null) {
        throw new Error('game_db data accessed before preload completed.');
    }
    return cachedGameDbData;
}

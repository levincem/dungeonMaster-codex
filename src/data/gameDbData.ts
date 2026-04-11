let cachedGameDbData: string | null = null;
let gameDbDataPromise: Promise<string> | null = null;

export async function preloadGameDbData(): Promise<void> {
    if (cachedGameDbData !== null) return;
    if (!gameDbDataPromise) {
        gameDbDataPromise = import('../assets/data/game_db.json?raw').then((module) => {
            cachedGameDbData = module.default;
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

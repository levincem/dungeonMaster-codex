let dungeonData: unknown | null = null;
let dungeonDataPromise: Promise<void> | null = null;

export function preloadDungeonData(): Promise<void> {
    if (dungeonData !== null) return Promise.resolve();
    if (dungeonDataPromise) return dungeonDataPromise;

    dungeonDataPromise = fetch('/dungeon.json', { cache: 'force-cache' })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load dungeon.json: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            dungeonData = data;
        });

    return dungeonDataPromise;
}

export function getDungeonDataSync<T>(): T {
    if (dungeonData === null) {
        throw new Error('Dungeon data has not been preloaded yet.');
    }
    return dungeonData as T;
}

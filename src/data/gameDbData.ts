type CachedRawSlice = {
    raw: string | null;
    promise: Promise<string> | null;
    importer: () => Promise<string | { default: string }>;
};

function unwrapImportedModule<T>(module: T | { default: T }): T {
    if (typeof module === 'object' && module !== null && 'default' in module) {
        return (module as { default: T }).default;
    }
    return module as T;
}

function createRawSliceLoader(
    importer: () => Promise<string | { default: string }>,
): CachedRawSlice {
    return {
        raw: null,
        promise: null,
        importer,
    };
}

async function preloadRawSlice(slice: CachedRawSlice): Promise<void> {
    if (slice.raw !== null) return;
    if (!slice.promise) {
        slice.promise = slice.importer().then((module) => {
            slice.raw = unwrapImportedModule(module);
            return slice.raw;
        });
    }
    await slice.promise;
}

function getRawSliceSync(slice: CachedRawSlice, label: string): string {
    if (slice.raw === null) {
        throw new Error(`${label} data accessed before preload completed.`);
    }
    return slice.raw;
}

const itemsSlice = createRawSliceLoader(() => import('../assets/runtime/db/game_db_items.json?raw'));
const weaponAttacksSlice = createRawSliceLoader(() => import('../assets/runtime/db/game_db_weapon_attacks.json?raw'));
const creaturesSlice = createRawSliceLoader(() => import('../assets/runtime/db/game_db_creatures.json?raw'));

export async function preloadGameDbCoreData(): Promise<void> {
    await preloadGameDbCreaturesData();
}

export async function preloadGameDbData(): Promise<void> {
    await Promise.all([
        preloadGameDbItemsData(),
        preloadGameDbWeaponAttacksData(),
        preloadGameDbCreaturesData(),
    ]);
}

export async function preloadGameDbItemsData(): Promise<void> {
    await preloadRawSlice(itemsSlice);
}

export async function preloadGameDbWeaponAttacksData(): Promise<void> {
    await preloadRawSlice(weaponAttacksSlice);
}

export async function preloadGameDbCreaturesData(): Promise<void> {
    await preloadRawSlice(creaturesSlice);
}

export function getGameDbItemsRawSync(): string {
    return getRawSliceSync(itemsSlice, 'game_db items');
}

export function getGameDbWeaponAttacksRawSync(): string {
    return getRawSliceSync(weaponAttacksSlice, 'game_db weapon attacks');
}

export function getGameDbCreaturesRawSync(): string {
    return getRawSliceSync(creaturesSlice, 'game_db creatures');
}

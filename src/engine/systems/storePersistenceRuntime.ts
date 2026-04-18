import type { PersistedSaveData } from '../runtimeTypes';
import {
    buildPersistedSaveData as buildPersistedSaveDataSystem,
    hydratePersistedGameState as hydratePersistedGameStateSystem,
    restoreExternalCreatureRuntimeFromSave as restoreExternalCreatureRuntimeFromSaveSystem,
    type CreatureRuntimeMaps,
    type PersistableGameState,
} from './persistence';
import {
    buildLoadedGameUiResetPatch,
    buildReturnToTitlePatch as buildReturnToTitlePatchSystem,
} from './uiStateTransitions';

type LoadedPersistedGameStateLike<
    TPendingSensorEvent,
    TPendingGeneratorSpawnEvent,
> = PersistableGameState & {
    pendingSensorEvents: TPendingSensorEvent[];
    pendingGeneratorSpawns: TPendingGeneratorSpawnEvent[];
};

export function buildStorePersistedSavePayload(
    state: PersistableGameState,
    runtime: CreatureRuntimeMaps,
): string {
    return JSON.stringify(buildPersistedSaveDataSystem(state, runtime));
}

export function saveStoreGame(
    state: PersistableGameState,
    runtime: CreatureRuntimeMaps,
    writePersistedSave: (payload: string) => boolean,
): boolean {
    return writePersistedSave(buildStorePersistedSavePayload(state, runtime));
}

export function buildStoreLoadedGamePatch<
    TPendingSensorEvent,
    TPendingGeneratorSpawnEvent,
>(
    data: PersistedSaveData | null,
    now: number,
    runtime: CreatureRuntimeMaps,
) {
    if (!data) return null;
    const hydrated = hydratePersistedGameStateSystem(data, now);
    restoreExternalCreatureRuntimeFromSaveSystem(data, runtime);
    return buildLoadedGameUiResetPatch<
        LoadedPersistedGameStateLike<TPendingSensorEvent, TPendingGeneratorSpawnEvent>
    >({
        ...hydrated,
        pendingSensorEvents: hydrated.pendingSensorEvents as TPendingSensorEvent[],
        pendingGeneratorSpawns: hydrated.pendingGeneratorSpawns as TPendingGeneratorSpawnEvent[],
    });
}

export function loadStoreGamePatch<
    TPendingSensorEvent,
    TPendingGeneratorSpawnEvent,
>(
    raw: string | null,
    now: number,
    runtime: CreatureRuntimeMaps,
    tryParsePersistedSaveData: (input: string | null) => PersistedSaveData | null,
) {
    return buildStoreLoadedGamePatch<TPendingSensorEvent, TPendingGeneratorSpawnEvent>(
        tryParsePersistedSaveData(raw),
        now,
        runtime,
    );
}

export function buildStoreReturnToTitlePatch() {
    return buildReturnToTitlePatchSystem();
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPersistedSave, SAVE_STORAGE_KEY } from '../src/engine/saveGame.js';
import { computePersistedSaveIntegrity } from '../src/engine/systems/persistence.js';
import { resetExternalCreatureRuntimeState } from '../src/engine/systems/storeCreatureRuntime.js';
import type { PersistedSaveData } from '../src/engine/runtimeTypes.js';

class MemoryStorage {
    private readonly store = new Map<string, string>();

    getItem(key: string): string | null {
        return this.store.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.store.set(key, value);
    }

    removeItem(key: string): void {
        this.store.delete(key);
    }
}

async function withMockWindow<T>(run: (storage: MemoryStorage) => Promise<T>): Promise<T> {
    const localStorage = new MemoryStorage();
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

    Object.defineProperty(globalThis, 'window', {
        value: { localStorage },
        configurable: true,
        writable: true,
    });

    try {
        return await run(localStorage);
    } finally {
        if (previousWindow) {
            Object.defineProperty(globalThis, 'window', previousWindow);
        } else {
            Reflect.deleteProperty(globalThis, 'window');
        }
    }
}

test('loadGame persists a migrated legacy run id so repeated loads keep the same hall-of-fame identity', async () => {
    await withMockWindow(async (storage) => {
        const { useStore } = await import('../src/engine/store.js');
        const initialState = useStore.getState();

        try {
            useStore.getState().enterDungeon();
            assert.equal(useStore.getState().saveGame(), true);

            const savedRaw = readPersistedSave();
            assert.ok(savedRaw);

            const legacySave = JSON.parse(savedRaw) as PersistedSaveData;
            if (legacySave.gameStats) {
                delete (legacySave.gameStats as { runId?: string }).runId;
            }
            delete legacySave.integrity;
            legacySave.integrity = computePersistedSaveIntegrity(legacySave);
            storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(legacySave));

            useStore.getState().returnToTitle();
            assert.equal(useStore.getState().loadGame(), true);

            const migratedRunId = useStore.getState().gameStats.runId;
            assert.match(migratedRunId, /^[A-Za-z0-9_-]{8,96}$/);

            const migratedRaw = readPersistedSave();
            assert.ok(migratedRaw);
            const migratedSave = JSON.parse(migratedRaw) as PersistedSaveData;
            assert.equal(migratedSave.gameStats?.runId, migratedRunId);

            useStore.getState().returnToTitle();
            assert.equal(useStore.getState().loadGame(), true);
            assert.equal(useStore.getState().gameStats.runId, migratedRunId);
        } finally {
            useStore.setState(initialState, true);
            resetExternalCreatureRuntimeState();
        }
    });
});

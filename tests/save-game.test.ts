import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    importPersistedSave,
    SAVE_BACKUP_STORAGE_KEY,
    SAVE_STORAGE_KEY,
    clearPersistedSave,
    getBestPersistedSaveSource,
    getPersistedSaveStatus,
    hasPersistedSave,
    readBestPersistedSave,
    readPersistedSave,
    writePersistedSave,
} from '../src/engine/saveGame.js';
import {
    computePersistedSaveIntegrity,
    inspectPersistedSaveData,
} from '../src/engine/systems/persistence.js';
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

function createValidSavePayload(savedAt: number, level: number): string {
    const baseData: Omit<PersistedSaveData, 'integrity'> = {
        version: 2,
        buildVersion: '0.5.0-alpha.1',
        savedAt,
        gameOptions: {
            keybindings: {
                moveForward: ['ArrowUp'],
                moveBackward: ['ArrowDown'],
                turnLeft: ['ArrowLeft'],
                turnRight: ['ArrowRight'],
                strafeLeft: ['q'],
                strafeRight: ['e'],
            },
        },
        level,
        position: [0, 0],
        direction: 'NORTH',
        party: [],
        gateOpen: false,
        openDoors: [],
        openPits: [],
        openTeleporters: [],
        openWalls: [],
        activeSensors: [],
        firedSensors: [],
        visibleTexts: [],
        pendingSensorEvents: [],
        creatures: [],
        floorItems: [],
        championInventories: {},
        championEquipment: {},
        championVitals: {},
        elapsedGameTimeTicks: 0,
        regenTickRemainder: 0,
        lastPartyMoveGameTick: 0,
        movementCooldown: 0,
        championXP: {},
        championCombat: {},
        crushingDoors: {},
        torchBurnElapsed: {},
        spellLights: [],
        projectiles: [],
        activeShields: [],
        activePotionBoosts: [],
        invisibleRemainingMs: 0,
        magicVisionRemainingMs: 0,
        seeThroughWallsRemainingMs: 0,
        footprintsRemainingMs: 0,
        footprintHistory: [],
        deadChampions: {},
        creatureTimers: {},
    };

    return JSON.stringify({
        ...baseData,
        integrity: computePersistedSaveIntegrity(baseData),
    });
}

function withMockWindow(fn: (storage: MemoryStorage) => void): void {
    const localStorage = new MemoryStorage();
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

    Object.defineProperty(globalThis, 'window', {
        value: { localStorage },
        configurable: true,
        writable: true,
    });

    try {
        fn(localStorage);
    } finally {
        if (previousWindow) {
            Object.defineProperty(globalThis, 'window', previousWindow);
        } else {
            Reflect.deleteProperty(globalThis, 'window');
        }
    }
}

test('writePersistedSave rotates the previous primary save into backup', () => {
    withMockWindow((storage) => {
        const first = createValidSavePayload(1, 1);
        const second = createValidSavePayload(2, 2);

        assert.equal(writePersistedSave(first), true);
        assert.equal(writePersistedSave(second), true);

        assert.equal(storage.getItem(SAVE_STORAGE_KEY), second);
        assert.equal(storage.getItem(SAVE_BACKUP_STORAGE_KEY), first);
        assert.equal(readPersistedSave(), second);
        assert.equal(readBestPersistedSave(), second);
        assert.equal(getBestPersistedSaveSource(), 'primary');
    });
});

test('status and best save fallback use the backup slot when primary is corrupt', () => {
    withMockWindow((storage) => {
        const backup = createValidSavePayload(3, 7);
        storage.setItem(SAVE_STORAGE_KEY, '{"broken":');
        storage.setItem(SAVE_BACKUP_STORAGE_KEY, backup);

        assert.deepEqual(inspectPersistedSaveData(storage.getItem(SAVE_STORAGE_KEY)), { status: 'corrupt' });
        assert.equal(hasPersistedSave(), true);
        assert.equal(getBestPersistedSaveSource(), 'backup');
        assert.deepEqual(getPersistedSaveStatus(), { kind: 'ready', source: 'backup' });
        assert.equal(readBestPersistedSave(), backup);
    });
});

test('clearPersistedSave removes both primary and backup slots', () => {
    withMockWindow((storage) => {
        storage.setItem(SAVE_STORAGE_KEY, createValidSavePayload(4, 1));
        storage.setItem(SAVE_BACKUP_STORAGE_KEY, createValidSavePayload(5, 2));

        clearPersistedSave();

        assert.equal(storage.getItem(SAVE_STORAGE_KEY), null);
        assert.equal(storage.getItem(SAVE_BACKUP_STORAGE_KEY), null);
        assert.equal(hasPersistedSave(), false);
        assert.deepEqual(getPersistedSaveStatus(), { kind: 'none' });
    });
});

test('importPersistedSave accepts compatible saves and rotates the previous primary to backup', () => {
    withMockWindow((storage) => {
        const previous = createValidSavePayload(6, 3);
        const imported = createValidSavePayload(7, 8);
        storage.setItem(SAVE_STORAGE_KEY, previous);

        assert.deepEqual(importPersistedSave(imported), { kind: 'success' });
        assert.equal(storage.getItem(SAVE_STORAGE_KEY), imported);
        assert.equal(storage.getItem(SAVE_BACKUP_STORAGE_KEY), previous);
    });
});

test('importPersistedSave rejects corrupt and incompatible saves', () => {
    withMockWindow(() => {
        assert.deepEqual(importPersistedSave('not-json'), { kind: 'corrupt' });

        const incompatible = JSON.stringify({
            version: 999,
            buildVersion: '9.9.9',
            position: [0, 0],
            party: [],
            creatures: [],
            floorItems: [],
        });

        const result = importPersistedSave(incompatible);
        assert.equal(result.kind, 'incompatible');
        if (result.kind === 'incompatible') {
            assert.equal(result.savedBuildVersion, '9.9.9');
            assert.equal(result.savedSchemaVersion, 999);
        }
    });
});

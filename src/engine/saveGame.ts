import { APP_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from '../appInfo';
import { inspectPersistedSaveData } from './systems/persistence';

export const SAVE_STORAGE_KEY = 'dungeon-master-save-v1';

export type PersistedSaveStatus =
    | { kind: 'none' }
    | { kind: 'ready' }
    | { kind: 'corrupt' }
    | {
        kind: 'incompatible';
        savedBuildVersion?: string;
        savedSchemaVersion?: number;
        currentBuildVersion: string;
        currentSchemaVersion: number;
    };

export function hasPersistedSave(): boolean {
    try {
        return typeof window !== 'undefined' && window.localStorage.getItem(SAVE_STORAGE_KEY) !== null;
    } catch {
        return false;
    }
}

export function readPersistedSave(): string | null {
    try {
        return typeof window !== 'undefined' ? window.localStorage.getItem(SAVE_STORAGE_KEY) : null;
    } catch {
        return null;
    }
}

export function writePersistedSave(payload: string): boolean {
    try {
        if (typeof window === 'undefined') return false;
        window.localStorage.setItem(SAVE_STORAGE_KEY, payload);
        return true;
    } catch {
        return false;
    }
}

export function clearPersistedSave(): void {
    try {
        if (typeof window === 'undefined') return;
        window.localStorage.removeItem(SAVE_STORAGE_KEY);
    } catch {
        // ignore storage failures
    }
}

export function getPersistedSaveStatus(): PersistedSaveStatus {
    const inspection = inspectPersistedSaveData(readPersistedSave());
    switch (inspection.status) {
        case 'missing':
            return { kind: 'none' };
        case 'compatible':
            return { kind: 'ready' };
        case 'corrupt':
            return { kind: 'corrupt' };
        case 'incompatible':
            return {
                kind: 'incompatible',
                savedBuildVersion: inspection.buildVersion,
                savedSchemaVersion: inspection.foundVersion,
                currentBuildVersion: APP_VERSION,
                currentSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
            };
    }
}

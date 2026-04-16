import { APP_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from '../appInfo';
import { inspectPersistedSaveData } from './systems/persistence';

export const SAVE_STORAGE_KEY = 'dungeon-master-save-v1';
export const SAVE_BACKUP_STORAGE_KEY = 'dungeon-master-save-v1-backup';

export type SaveSource = 'primary' | 'backup';

export type PersistedSaveStatus =
    | { kind: 'none' }
    | { kind: 'ready'; source: SaveSource }
    | { kind: 'corrupt' }
    | {
        kind: 'incompatible';
        savedBuildVersion?: string;
        savedSchemaVersion?: number;
        currentBuildVersion: string;
        currentSchemaVersion: number;
    };

function readPersistedSaveFromKey(storageKey: string): string | null {
    try {
        return typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
    } catch {
        return null;
    }
}

function writePersistedSaveToKey(storageKey: string, payload: string): void {
    window.localStorage.setItem(storageKey, payload);
}

function removePersistedSaveFromKey(storageKey: string): void {
    window.localStorage.removeItem(storageKey);
}

function inspectPersistedSaveSlots() {
    const primary = inspectPersistedSaveData(readPersistedSaveFromKey(SAVE_STORAGE_KEY));
    const backup = inspectPersistedSaveData(readPersistedSaveFromKey(SAVE_BACKUP_STORAGE_KEY));
    return { primary, backup };
}

export function hasPersistedSave(): boolean {
    try {
        if (typeof window === 'undefined') return false;
        const { primary, backup } = inspectPersistedSaveSlots();
        return primary.status === 'compatible' || backup.status === 'compatible';
    } catch {
        return false;
    }
}

export function readPersistedSave(): string | null {
    return readPersistedSaveFromKey(SAVE_STORAGE_KEY);
}

export function readBestPersistedSave(): string | null {
    try {
        if (typeof window === 'undefined') return null;
        const primary = readPersistedSaveFromKey(SAVE_STORAGE_KEY);
        if (inspectPersistedSaveData(primary).status === 'compatible') return primary;
        const backup = readPersistedSaveFromKey(SAVE_BACKUP_STORAGE_KEY);
        if (inspectPersistedSaveData(backup).status === 'compatible') return backup;
        return primary ?? backup;
    } catch {
        return null;
    }
}

export function writePersistedSave(payload: string): boolean {
    try {
        if (typeof window === 'undefined') return false;
        const existingPrimary = readPersistedSaveFromKey(SAVE_STORAGE_KEY);
        if (existingPrimary !== null && existingPrimary !== payload) {
            writePersistedSaveToKey(SAVE_BACKUP_STORAGE_KEY, existingPrimary);
        }
        writePersistedSaveToKey(SAVE_STORAGE_KEY, payload);
        return true;
    } catch {
        return false;
    }
}

export function clearPersistedSave(): void {
    try {
        if (typeof window === 'undefined') return;
        removePersistedSaveFromKey(SAVE_STORAGE_KEY);
        removePersistedSaveFromKey(SAVE_BACKUP_STORAGE_KEY);
    } catch {
        // ignore storage failures
    }
}

export function getBestPersistedSaveSource(): SaveSource | null {
    const { primary, backup } = inspectPersistedSaveSlots();
    if (primary.status === 'compatible') return 'primary';
    if (backup.status === 'compatible') return 'backup';
    return null;
}

export function getPersistedSaveStatus(): PersistedSaveStatus {
    const { primary, backup } = inspectPersistedSaveSlots();
    if (primary.status === 'compatible') {
        return { kind: 'ready', source: 'primary' };
    }
    if (backup.status === 'compatible') {
        return { kind: 'ready', source: 'backup' };
    }

    const incompatibleInspection = [primary, backup].find((inspection) => inspection.status === 'incompatible');
    if (incompatibleInspection?.status === 'incompatible') {
        return {
            kind: 'incompatible',
            savedBuildVersion: incompatibleInspection.buildVersion,
            savedSchemaVersion: incompatibleInspection.foundVersion,
            currentBuildVersion: APP_VERSION,
            currentSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
        };
    }

    if (primary.status === 'corrupt' || backup.status === 'corrupt') {
        return { kind: 'corrupt' };
    }

    return { kind: 'none' };
}

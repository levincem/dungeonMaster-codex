export const SAVE_STORAGE_KEY = 'dungeon-master-save-v1';

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

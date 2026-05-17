import { APP_VERSION } from '../appInfo';
import type { GameStats } from './systems/gameStats';
import { normalizeGameStats } from './systems/gameStats';
import {
    sanitizeHallOfFamePlayerName,
    type HallOfFameEntryProof,
} from './hallOfFameSecurity';

const HALL_OF_FAME_STORAGE_KEY = 'dungeon-master-hall-of-fame-v1';
const HALL_OF_FAME_LAST_NAME_KEY = 'dungeon-master-hall-of-fame-last-name-v1';
const HALL_OF_FAME_VERSION = 1;
const HALL_OF_FAME_MAX_ENTRIES = 200;
const HALL_OF_FAME_API_PATH = '/api/hall-of-fame';
const HALL_OF_FAME_API_TIMEOUT_MS = 5000;

export interface HallOfFameEntrySummary {
    playTimeSec: number;
    monstersKilled: number;
    spellsCast: number;
    damageDealt: number;
    damageTaken: number;
    manaSpent: number;
}

export interface HallOfFameEntry {
    id: string;
    name: string;
    completedAt: number;
    buildVersion: string;
    stats: GameStats;
    summary: HallOfFameEntrySummary;
}

export interface HallOfFameSubmissionEntry extends HallOfFameEntry {
    proof?: HallOfFameEntryProof;
}

interface HallOfFameFile {
    version: number;
    entries: HallOfFameEntry[];
}

type HallOfFameSource = 'api' | 'local';

function canUseStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function canUseHallOfFameApi(): boolean {
    return typeof window !== 'undefined' && typeof window.fetch === 'function';
}

function buildSummary(stats: GameStats, completedAt: number): HallOfFameEntrySummary {
    return {
        playTimeSec: Math.max(0, Math.floor((completedAt - stats.startedAt) / 1000)),
        monstersKilled: stats.combat.monstersKilled,
        spellsCast: stats.magic.spells.attempted,
        damageDealt: stats.combat.damageDealt.total,
        damageTaken: stats.combat.damageTaken.total,
        manaSpent: stats.magic.manaSpent,
    };
}

function normalizeEntry(entry: Partial<HallOfFameEntry> | null | undefined): HallOfFameEntry | null {
    if (!entry || typeof entry !== 'object') return null;
    if (typeof entry.id !== 'string' || typeof entry.name !== 'string' || typeof entry.completedAt !== 'number') {
        return null;
    }
    const stats = normalizeGameStats(entry.stats, entry.completedAt);
    return {
        id: entry.id,
        name: sanitizeHallOfFamePlayerName(entry.name),
        completedAt: entry.completedAt,
        buildVersion: typeof entry.buildVersion === 'string' ? entry.buildVersion : APP_VERSION,
        stats,
        summary: buildSummary(stats, entry.completedAt),
    };
}

function normalizeHallOfFameFile(value: unknown): HallOfFameFile | null {
    try {
        const parsed = value as Partial<HallOfFameFile>;
        if (parsed.version !== HALL_OF_FAME_VERSION || !Array.isArray(parsed.entries)) return null;
        const dedupedEntries = new Map<string, HallOfFameEntry>();
        const entries = parsed.entries
            .map((entry) => normalizeEntry(entry))
            .filter((entry): entry is HallOfFameEntry => entry !== null)
            .sort((left, right) => right.completedAt - left.completedAt)
            .filter((entry) => {
                if (dedupedEntries.has(entry.id)) return false;
                dedupedEntries.set(entry.id, entry);
                return true;
            })
            .slice(0, HALL_OF_FAME_MAX_ENTRIES);
        return { version: HALL_OF_FAME_VERSION, entries };
    } catch {
        return null;
    }
}

function readRawLocalHallOfFame(): HallOfFameFile | null {
    if (!canUseStorage()) return null;
    try {
        const raw = window.localStorage.getItem(HALL_OF_FAME_STORAGE_KEY);
        if (!raw) return null;
        return normalizeHallOfFameFile(JSON.parse(raw));
    } catch {
        return null;
    }
}

function writeLocalHallOfFame(entries: HallOfFameEntry[]): boolean {
    if (!canUseStorage()) return false;
    try {
        const payload = normalizeHallOfFameFile({
            version: HALL_OF_FAME_VERSION,
            entries,
        });
        if (!payload) return false;
        window.localStorage.setItem(HALL_OF_FAME_STORAGE_KEY, JSON.stringify(payload));
        return true;
    } catch {
        return false;
    }
}

export function readHallOfFameEntries(): HallOfFameEntry[] {
    return readRawLocalHallOfFame()?.entries ?? [];
}

export function readLastHallOfFameName(): string {
    if (!canUseStorage()) return '';
    try {
        return sanitizeHallOfFamePlayerName(window.localStorage.getItem(HALL_OF_FAME_LAST_NAME_KEY) ?? '', '');
    } catch {
        return '';
    }
}

function persistLastHallOfFameName(name: string): void {
    if (!canUseStorage()) return;
    try {
        window.localStorage.setItem(HALL_OF_FAME_LAST_NAME_KEY, name);
    } catch {
        // ignore storage issues for the convenience field
    }
}

export function buildHallOfFameEntry(name: string, stats: GameStats, completedAt = Date.now()): HallOfFameEntry {
    const normalizedStats = normalizeGameStats(stats, completedAt);
    const trimmedName = sanitizeHallOfFamePlayerName(name);
    return {
        id: normalizedStats.runId,
        name: trimmedName,
        completedAt,
        buildVersion: APP_VERSION,
        stats: normalizedStats,
        summary: buildSummary(normalizedStats, completedAt),
    };
}

function appendLocalHallOfFameEntry(entry: HallOfFameSubmissionEntry): { success: boolean; entries: HallOfFameEntry[] } {
    const entries = [entry, ...readHallOfFameEntries().filter((candidate) => candidate.id !== entry.id)];
    const success = writeLocalHallOfFame(entries);
    if (success) persistLastHallOfFameName(entry.name);
    return {
        success,
        entries: success ? readHallOfFameEntries() : entries,
    };
}

function createHallOfFameAbortSignal(timeoutMs: number): { signal?: AbortSignal; cancel: () => void } {
    if (typeof AbortController === 'undefined') {
        return { signal: undefined, cancel: () => {} };
    }
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    return {
        signal: controller.signal,
        cancel: () => globalThis.clearTimeout(timeoutId),
    };
}

async function requestHallOfFameApi(method: 'GET' | 'POST', body?: unknown): Promise<Response | null> {
    if (!canUseHallOfFameApi()) return null;
    const { signal, cancel } = createHallOfFameAbortSignal(HALL_OF_FAME_API_TIMEOUT_MS);
    try {
        return await window.fetch(HALL_OF_FAME_API_PATH, {
            method,
            cache: 'no-store',
            headers: {
                Accept: 'application/json',
                ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            signal,
        });
    } catch {
        return null;
    } finally {
        cancel();
    }
}

function mirrorApiEntriesToLocal(entries: HallOfFameEntry[]): void {
    writeLocalHallOfFame(entries);
}

async function readHallOfFameEntriesFromApi(): Promise<HallOfFameEntry[] | null> {
    const response = await requestHallOfFameApi('GET');
    if (!response?.ok) return null;
    try {
        const payload = normalizeHallOfFameFile(await response.json());
        if (!payload) return null;
        mirrorApiEntriesToLocal(payload.entries);
        return payload.entries;
    } catch {
        return null;
    }
}

function isHallOfFameApiUnavailable(response: Response | null): boolean {
    if (!response) return true;
    return response.status === 404 || response.status >= 500;
}

type HallOfFameSaveResult =
    | { kind: 'success'; entries: HallOfFameEntry[] }
    | { kind: 'unavailable' }
    | { kind: 'rejected'; entries: HallOfFameEntry[] };

async function appendHallOfFameEntryViaApi(entry: HallOfFameSubmissionEntry): Promise<HallOfFameSaveResult> {
    const response = await requestHallOfFameApi('POST', { entry });
    if (isHallOfFameApiUnavailable(response)) {
        return { kind: 'unavailable' };
    }
    if (!response?.ok) {
        return { kind: 'rejected', entries: readHallOfFameEntries() };
    }
    try {
        const payload = normalizeHallOfFameFile(await response.json());
        if (!payload) {
            return { kind: 'rejected', entries: readHallOfFameEntries() };
        }
        mirrorApiEntriesToLocal(payload.entries);
        persistLastHallOfFameName(entry.name);
        return { kind: 'success', entries: payload.entries };
    } catch {
        return { kind: 'rejected', entries: readHallOfFameEntries() };
    }
}

export async function loadHallOfFameEntries(): Promise<{ source: HallOfFameSource; entries: HallOfFameEntry[] }> {
    const apiEntries = await readHallOfFameEntriesFromApi();
    if (apiEntries) {
        return { source: 'api', entries: apiEntries };
    }
    return { source: 'local', entries: readHallOfFameEntries() };
}

export async function appendHallOfFameEntry(entry: HallOfFameSubmissionEntry): Promise<{ success: boolean; source: HallOfFameSource; entries: HallOfFameEntry[] }> {
    const apiResult = await appendHallOfFameEntryViaApi(entry);
    if (apiResult.kind === 'success') {
        return { success: true, source: 'api', entries: apiResult.entries };
    }
    if (apiResult.kind === 'rejected') {
        return { success: false, source: 'api', entries: apiResult.entries };
    }
    const localResult = appendLocalHallOfFameEntry(entry);
    return { success: localResult.success, source: 'local', entries: localResult.entries };
}

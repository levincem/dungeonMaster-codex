import { APP_VERSION } from '../appInfo';
import type { GameStats } from './systems/gameStats';
import { normalizeGameStats } from './systems/gameStats';

const HALL_OF_FAME_STORAGE_KEY = 'dungeon-master-hall-of-fame-v1';
const HALL_OF_FAME_LAST_NAME_KEY = 'dungeon-master-hall-of-fame-last-name-v1';
const HALL_OF_FAME_VERSION = 1;
const HALL_OF_FAME_MAX_ENTRIES = 200;

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

interface HallOfFameFile {
    version: number;
    entries: HallOfFameEntry[];
}

function canUseStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
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
        name: entry.name.trim().slice(0, 32) || 'Anonymous',
        completedAt: entry.completedAt,
        buildVersion: typeof entry.buildVersion === 'string' ? entry.buildVersion : APP_VERSION,
        stats,
        summary: buildSummary(stats, entry.completedAt),
    };
}

function readRawHallOfFame(): HallOfFameFile | null {
    if (!canUseStorage()) return null;
    try {
        const raw = window.localStorage.getItem(HALL_OF_FAME_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<HallOfFameFile>;
        if (parsed.version !== HALL_OF_FAME_VERSION || !Array.isArray(parsed.entries)) return null;
        const entries = parsed.entries
            .map((entry) => normalizeEntry(entry))
            .filter((entry): entry is HallOfFameEntry => entry !== null)
            .sort((left, right) => right.completedAt - left.completedAt)
            .slice(0, HALL_OF_FAME_MAX_ENTRIES);
        return { version: HALL_OF_FAME_VERSION, entries };
    } catch {
        return null;
    }
}

function writeRawHallOfFame(entries: HallOfFameEntry[]): boolean {
    if (!canUseStorage()) return false;
    try {
        const normalizedEntries = entries
            .map((entry) => normalizeEntry(entry))
            .filter((entry): entry is HallOfFameEntry => entry !== null)
            .sort((left, right) => right.completedAt - left.completedAt)
            .slice(0, HALL_OF_FAME_MAX_ENTRIES);
        const payload: HallOfFameFile = {
            version: HALL_OF_FAME_VERSION,
            entries: normalizedEntries,
        };
        window.localStorage.setItem(HALL_OF_FAME_STORAGE_KEY, JSON.stringify(payload));
        return true;
    } catch {
        return false;
    }
}

export function readHallOfFameEntries(): HallOfFameEntry[] {
    return readRawHallOfFame()?.entries ?? [];
}

export function readLastHallOfFameName(): string {
    if (!canUseStorage()) return '';
    try {
        return window.localStorage.getItem(HALL_OF_FAME_LAST_NAME_KEY) ?? '';
    } catch {
        return '';
    }
}

export function buildHallOfFameEntry(name: string, stats: GameStats, completedAt = Date.now()): HallOfFameEntry {
    const normalizedStats = normalizeGameStats(stats, completedAt);
    const trimmedName = name.trim().slice(0, 32) || 'Anonymous';
    return {
        id: `victory_${completedAt}_${Math.random().toString(36).slice(2, 10)}`,
        name: trimmedName,
        completedAt,
        buildVersion: APP_VERSION,
        stats: normalizedStats,
        summary: buildSummary(normalizedStats, completedAt),
    };
}

export function appendHallOfFameEntry(entry: HallOfFameEntry): { success: boolean; entries: HallOfFameEntry[] } {
    const entries = [entry, ...readHallOfFameEntries()];
    const success = writeRawHallOfFame(entries);
    if (success && canUseStorage()) {
        try {
            window.localStorage.setItem(HALL_OF_FAME_LAST_NAME_KEY, entry.name);
        } catch {
            // ignore storage issues for the convenience field
        }
    }
    return {
        success,
        entries: success ? readHallOfFameEntries() : entries,
    };
}

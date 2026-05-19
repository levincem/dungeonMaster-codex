import type { PersistedSaveData } from './runtimeTypes';

export const HALL_OF_FAME_PLAYER_NAME_MAX_LENGTH = 32;
export const HALL_OF_FAME_ANONYMOUS_NAME = 'Anonymous';
export const HALL_OF_FAME_SUBMISSION_PROOF_VERSION = 1;

const HALL_OF_FAME_ID_PATTERN = /^[A-Za-z0-9_-]{8,96}$/;
const HALL_OF_FAME_SAVE_INTEGRITY_PATTERN = /^[a-f0-9]{8}$/i;
const HALL_OF_FAME_NON_ALNUM_NAME_PATTERN = /[^A-Za-z0-9]+/g;
const HALL_OF_FAME_BUILD_VERSION_MAX_LENGTH = 32;
const HALL_OF_FAME_MAX_NAMED_COUNTERS = 128;
const HALL_OF_FAME_COUNTER_KEY_MAX_LENGTH = 64;

export interface HallOfFameProofSource {
    proofVersion: number;
    saveVersion: number;
    savedAt: number;
    saveIntegrity: string;
    saveBuildVersion: string;
    runId: string;
    startedAt: number;
}

export interface HallOfFameEntryProof extends HallOfFameProofSource {
    signature: string;
}

interface HallOfFameProofEntrySnapshot {
    id: string;
    name: string;
    completedAt: number;
    buildVersion: string;
    stats: {
        startedAt: number;
        [key: string]: unknown;
    };
    summary: {
        playTimeSec: number;
        monstersKilled: number;
        spellsCast: number;
        damageDealt: number;
        damageTaken: number;
        manaSpent: number;
    };
}

interface HallOfFameSpellCounterSnapshot {
    attempted: number;
    succeeded: number;
    failed: number;
}

function readFiniteInteger(value: unknown): number | null {
    if (!Number.isFinite(value)) return null;
    return Math.floor(value as number);
}

function normalizeBuildVersion(value: unknown): string {
    if (typeof value !== 'string') return 'unknown';
    const trimmed = value.trim().slice(0, HALL_OF_FAME_BUILD_VERSION_MAX_LENGTH);
    return trimmed || 'unknown';
}

function computeHallOfFameDigest(input: string): string {
    let primary = 0x811c9dc5;
    let secondary = 0x811c9dc5;
    const salted = `hof|${input}|v${HALL_OF_FAME_SUBMISSION_PROOF_VERSION}`;
    for (let index = 0; index < salted.length; index += 1) {
        const code = salted.charCodeAt(index);
        primary ^= code;
        primary = Math.imul(primary, 0x01000193);
        secondary ^= (code << (index % 8)) & 0xff;
        secondary = Math.imul(secondary, 0x01000193);
    }
    return `${(primary >>> 0).toString(16).padStart(8, '0')}${(secondary >>> 0).toString(16).padStart(8, '0')}`;
}

function canonicalizeHallOfFamePayload(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((entry) => canonicalizeHallOfFamePayload(entry));
    }
    if (!value || typeof value !== 'object') {
        return value;
    }
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
            .map(([key, nestedValue]) => [key, canonicalizeHallOfFamePayload(nestedValue)]),
    );
}

function normalizeHallOfFameCounterKey(value: string): string {
    return value.trim().slice(0, HALL_OF_FAME_COUNTER_KEY_MAX_LENGTH).replace(/\s+/g, ' ');
}

function normalizeHallOfFameCounterValue(value: unknown): number {
    const normalized = readFiniteInteger(value);
    return normalized === null || normalized < 0 ? 0 : normalized;
}

function normalizeHallOfFameSpellCounterValue(value: unknown): HallOfFameSpellCounterSnapshot {
    const object = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
    return {
        attempted: normalizeHallOfFameCounterValue(object.attempted),
        succeeded: normalizeHallOfFameCounterValue(object.succeeded),
        failed: normalizeHallOfFameCounterValue(object.failed),
    };
}

function normalizeHallOfFameNamedCounters<T>(
    counters: Record<string, T> | null | undefined,
    normalizeValue?: (value: T) => T,
): Record<string, T> {
    if (!counters || typeof counters !== 'object' || Array.isArray(counters)) return {};
    const next: Record<string, T> = {};
    for (const [key, value] of Object.entries(counters).slice(0, HALL_OF_FAME_MAX_NAMED_COUNTERS)) {
        const normalizedKey = normalizeHallOfFameCounterKey(key);
        if (!normalizedKey) continue;
        next[normalizedKey] = normalizeValue ? normalizeValue(value as T) : value as T;
    }
    return next;
}

function normalizeHallOfFameProofEntrySnapshot(entry: HallOfFameProofEntrySnapshot): HallOfFameProofEntrySnapshot {
    return {
        ...entry,
        name: sanitizeHallOfFamePlayerName(entry.name),
        buildVersion: normalizeBuildVersion(entry.buildVersion),
        stats: {
            ...entry.stats,
            combat: entry.stats.combat && typeof entry.stats.combat === 'object'
                ? {
                    ...entry.stats.combat,
                    byCreature: normalizeHallOfFameNamedCounters(
                        (entry.stats.combat as { byCreature?: Record<string, number> }).byCreature,
                        (value) => normalizeHallOfFameCounterValue(value) as number,
                    ),
                }
                : entry.stats.combat,
            magic: entry.stats.magic && typeof entry.stats.magic === 'object'
                ? {
                    ...entry.stats.magic,
                    bySpell: normalizeHallOfFameNamedCounters(
                        (entry.stats.magic as { bySpell?: Record<string, HallOfFameSpellCounterSnapshot> }).bySpell,
                        (value) => normalizeHallOfFameSpellCounterValue(value),
                    ),
                }
                : entry.stats.magic,
        },
    };
}

function buildHallOfFameProofSignaturePayload(
    entry: HallOfFameProofEntrySnapshot,
    source: HallOfFameProofSource,
): string {
    const normalizedEntry = normalizeHallOfFameProofEntrySnapshot(entry);
    return JSON.stringify(canonicalizeHallOfFamePayload({
        proofVersion: source.proofVersion,
        saveVersion: source.saveVersion,
        savedAt: source.savedAt,
        saveIntegrity: source.saveIntegrity,
        saveBuildVersion: source.saveBuildVersion,
        runId: source.runId,
        startedAt: source.startedAt,
        entry: {
            id: normalizedEntry.id,
            name: normalizedEntry.name,
            completedAt: normalizedEntry.completedAt,
            buildVersion: normalizedEntry.buildVersion,
            stats: normalizedEntry.stats,
            summary: normalizedEntry.summary,
        },
    }));
}

function normalizeHallOfFameProofSource(
    source: Partial<HallOfFameProofSource> | null | undefined,
): HallOfFameProofSource | null {
    const proofVersion = readFiniteInteger(source?.proofVersion);
    const saveVersion = readFiniteInteger(source?.saveVersion);
    const savedAt = readFiniteInteger(source?.savedAt);
    const startedAt = readFiniteInteger(source?.startedAt);
    const runId = typeof source?.runId === 'string' ? source.runId.trim() : '';
    const saveIntegrity = typeof source?.saveIntegrity === 'string'
        ? source.saveIntegrity.trim().toLowerCase()
        : '';
    const saveBuildVersion = normalizeBuildVersion(source?.saveBuildVersion);

    if (
        proofVersion !== HALL_OF_FAME_SUBMISSION_PROOF_VERSION ||
        saveVersion === null ||
        savedAt === null ||
        startedAt === null ||
        !HALL_OF_FAME_ID_PATTERN.test(runId) ||
        !HALL_OF_FAME_SAVE_INTEGRITY_PATTERN.test(saveIntegrity)
    ) {
        return null;
    }

    return {
        proofVersion,
        saveVersion,
        savedAt,
        saveIntegrity,
        saveBuildVersion,
        runId,
        startedAt,
    };
}

function extractHallOfFameProofSourceFromSaveData(
    data: Partial<PersistedSaveData> | null | undefined,
): HallOfFameProofSource | null {
    return normalizeHallOfFameProofSource({
        proofVersion: HALL_OF_FAME_SUBMISSION_PROOF_VERSION,
        saveVersion: data?.version,
        savedAt: data?.savedAt,
        saveIntegrity: data?.integrity,
        saveBuildVersion: data?.buildVersion,
        runId: data?.gameStats?.runId,
        startedAt: data?.gameStats?.startedAt,
    });
}

export function sanitizeHallOfFamePlayerNameInput(value: string): string {
    if (typeof value !== 'string') return '';
    return value.replace(HALL_OF_FAME_NON_ALNUM_NAME_PATTERN, '').slice(0, HALL_OF_FAME_PLAYER_NAME_MAX_LENGTH);
}

export function sanitizeHallOfFamePlayerName(value: string, fallback = HALL_OF_FAME_ANONYMOUS_NAME): string {
    const sanitized = sanitizeHallOfFamePlayerNameInput(value);
    return sanitized || fallback;
}

export function extractHallOfFameProofSourceFromSaveExport(raw: string): HallOfFameProofSource | null {
    if (typeof raw !== 'string' || raw.length === 0) return null;
    try {
        return extractHallOfFameProofSourceFromSaveData(JSON.parse(raw) as Partial<PersistedSaveData>);
    } catch {
        return null;
    }
}

export function buildHallOfFameEntryProof(
    entry: HallOfFameProofEntrySnapshot,
    source: HallOfFameProofSource | null | undefined,
): HallOfFameEntryProof | null {
    const normalizedSource = normalizeHallOfFameProofSource(source);
    if (!normalizedSource) return null;
    if (
        !HALL_OF_FAME_ID_PATTERN.test(entry.id) ||
        entry.id !== normalizedSource.runId ||
        entry.stats.startedAt !== normalizedSource.startedAt
    ) {
        return null;
    }

    return {
        ...normalizedSource,
        signature: computeHallOfFameDigest(buildHallOfFameProofSignaturePayload(entry, normalizedSource)),
    };
}

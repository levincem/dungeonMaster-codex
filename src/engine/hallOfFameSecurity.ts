import type { PersistedSaveData } from './runtimeTypes';

export const HALL_OF_FAME_PLAYER_NAME_MAX_LENGTH = 32;
export const HALL_OF_FAME_ANONYMOUS_NAME = 'Anonymous';
export const HALL_OF_FAME_SUBMISSION_PROOF_VERSION = 1;

const HALL_OF_FAME_ID_PATTERN = /^[A-Za-z0-9_-]{8,96}$/;
const HALL_OF_FAME_SAVE_INTEGRITY_PATTERN = /^[a-f0-9]{8}$/i;
const HALL_OF_FAME_NON_ALNUM_NAME_PATTERN = /[^A-Za-z0-9]+/g;
const HALL_OF_FAME_BUILD_VERSION_MAX_LENGTH = 32;

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

function buildHallOfFameProofSignaturePayload(
    entry: HallOfFameProofEntrySnapshot,
    source: HallOfFameProofSource,
): string {
    return JSON.stringify({
        proofVersion: source.proofVersion,
        saveVersion: source.saveVersion,
        savedAt: source.savedAt,
        saveIntegrity: source.saveIntegrity,
        saveBuildVersion: source.saveBuildVersion,
        runId: source.runId,
        startedAt: source.startedAt,
        entry: {
            id: entry.id,
            name: entry.name,
            completedAt: entry.completedAt,
            buildVersion: entry.buildVersion,
            stats: entry.stats,
            summary: entry.summary,
        },
    });
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

export const HALL_OF_FAME_PLAYER_NAME_MAX_LENGTH = 32;
export const HALL_OF_FAME_ANONYMOUS_NAME = 'Anonymous';
const HALL_OF_FAME_LEGACY_SUBMISSION_PROOF_VERSION = 1;
export const HALL_OF_FAME_SUBMISSION_PROOF_VERSION = 2;
const HALL_OF_FAME_SUPPORTED_PROOF_VERSIONS = new Set([
    HALL_OF_FAME_LEGACY_SUBMISSION_PROOF_VERSION,
    HALL_OF_FAME_SUBMISSION_PROOF_VERSION,
]);

const HALL_OF_FAME_ID_PATTERN = /^[A-Za-z0-9_-]{8,96}$/;
const HALL_OF_FAME_SAVE_INTEGRITY_PATTERN = /^[a-f0-9]{8}$/i;
const HALL_OF_FAME_NON_ALNUM_NAME_PATTERN = /[^A-Za-z0-9]+/g;
const HALL_OF_FAME_BUILD_VERSION_MAX_LENGTH = 32;
const HALL_OF_FAME_MAX_NAMED_COUNTERS = 128;
const HALL_OF_FAME_COUNTER_KEY_MAX_LENGTH = 64;

function readFiniteInteger(value) {
    if (!Number.isFinite(value)) return null;
    return Math.floor(value);
}

function normalizeBuildVersion(value) {
    if (typeof value !== 'string') return 'unknown';
    const trimmed = value.trim().slice(0, HALL_OF_FAME_BUILD_VERSION_MAX_LENGTH);
    return trimmed || 'unknown';
}

function computeHallOfFameDigest(input, proofVersion) {
    let primary = 0x811c9dc5;
    let secondary = 0x811c9dc5;
    const salted = `hof|${input}|v${proofVersion}`;
    for (let index = 0; index < salted.length; index += 1) {
        const code = salted.charCodeAt(index);
        primary ^= code;
        primary = Math.imul(primary, 0x01000193);
        secondary ^= (code << (index % 8)) & 0xff;
        secondary = Math.imul(secondary, 0x01000193);
    }
    return `${(primary >>> 0).toString(16).padStart(8, '0')}${(secondary >>> 0).toString(16).padStart(8, '0')}`;
}

function canonicalizeHallOfFamePayload(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => canonicalizeHallOfFamePayload(entry));
    }
    if (!value || typeof value !== 'object') {
        return value;
    }
    return Object.fromEntries(
        Object.entries(value)
            .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
            .map(([key, nestedValue]) => [key, canonicalizeHallOfFamePayload(nestedValue)]),
    );
}

function normalizeHallOfFameCounterKey(value) {
    return value.trim().slice(0, HALL_OF_FAME_COUNTER_KEY_MAX_LENGTH).replace(/\s+/g, ' ');
}

function normalizeHallOfFameCounterValue(value) {
    const normalized = readFiniteInteger(value);
    return normalized === null || normalized < 0 ? 0 : normalized;
}

function normalizeHallOfFameSpellCounterValue(value) {
    const object = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
        attempted: normalizeHallOfFameCounterValue(object.attempted),
        succeeded: normalizeHallOfFameCounterValue(object.succeeded),
        failed: normalizeHallOfFameCounterValue(object.failed),
    };
}

function normalizeHallOfFameNamedCounters(counters, normalizeValue) {
    if (!counters || typeof counters !== 'object' || Array.isArray(counters)) return {};
    const next = {};
    for (const [key, value] of Object.entries(counters).slice(0, HALL_OF_FAME_MAX_NAMED_COUNTERS)) {
        const normalizedKey = normalizeHallOfFameCounterKey(key);
        if (!normalizedKey) continue;
        next[normalizedKey] = typeof normalizeValue === 'function' ? normalizeValue(value) : value;
    }
    return next;
}

function normalizeHallOfFameProofEntrySnapshot(entry, { includeExtendedCounters = true } = {}) {
    return {
        ...entry,
        name: sanitizeHallOfFamePlayerName(entry.name),
        buildVersion: normalizeBuildVersion(entry.buildVersion),
        stats: {
            ...entry.stats,
            combat: entry.stats?.combat && typeof entry.stats.combat === 'object' && !Array.isArray(entry.stats.combat)
                ? {
                    ...entry.stats.combat,
                    ...(includeExtendedCounters
                        ? {
                            damageTakenByCreature: normalizeHallOfFameNamedCounters(
                                entry.stats.combat.damageTakenByCreature,
                                normalizeHallOfFameCounterValue,
                            ),
                        }
                        : {}),
                    byCreature: normalizeHallOfFameNamedCounters(
                        entry.stats.combat.byCreature,
                        normalizeHallOfFameCounterValue,
                    ),
                }
                : entry.stats?.combat,
            exploration: entry.stats?.exploration && typeof entry.stats.exploration === 'object' && !Array.isArray(entry.stats.exploration)
                ? {
                    ...entry.stats.exploration,
                    ...(includeExtendedCounters
                        ? {
                            timeByLevelMs: normalizeHallOfFameNamedCounters(
                                entry.stats.exploration.timeByLevelMs,
                                normalizeHallOfFameCounterValue,
                            ),
                        }
                        : {}),
                }
                : entry.stats?.exploration,
            magic: entry.stats?.magic && typeof entry.stats.magic === 'object' && !Array.isArray(entry.stats.magic)
                ? {
                    ...entry.stats.magic,
                    bySpell: normalizeHallOfFameNamedCounters(
                        entry.stats.magic.bySpell,
                        normalizeHallOfFameSpellCounterValue,
                    ),
                }
                : entry.stats?.magic,
        },
    };
}

function buildHallOfFameProofSignaturePayload(entry, source, { includeExtendedCounters = true } = {}) {
    const normalizedEntry = normalizeHallOfFameProofEntrySnapshot(entry, { includeExtendedCounters });
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

function normalizeProofSource(source) {
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
        proofVersion === null ||
        !HALL_OF_FAME_SUPPORTED_PROOF_VERSIONS.has(proofVersion) ||
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

export function sanitizeHallOfFamePlayerNameInput(value) {
    if (typeof value !== 'string') return '';
    return value.replace(HALL_OF_FAME_NON_ALNUM_NAME_PATTERN, '').slice(0, HALL_OF_FAME_PLAYER_NAME_MAX_LENGTH);
}

export function sanitizeHallOfFamePlayerName(value, fallback = HALL_OF_FAME_ANONYMOUS_NAME) {
    const sanitized = sanitizeHallOfFamePlayerNameInput(value);
    return sanitized || fallback;
}

export function verifyHallOfFameEntryProofDetailed(entry, rawProof) {
    const source = normalizeProofSource(rawProof);
    if (!source) {
        return { ok: false, reason: 'proof payload is missing or malformed' };
    }
    if (!HALL_OF_FAME_ID_PATTERN.test(entry.id)) {
        return { ok: false, reason: 'entry id is invalid for proof verification' };
    }
    if (entry.id !== source.runId) {
        return { ok: false, reason: 'proof runId does not match the hall of fame entry id' };
    }
    if (entry.stats?.startedAt !== source.startedAt) {
        return { ok: false, reason: 'proof startedAt does not match the hall of fame entry' };
    }
    if (entry.buildVersion !== source.saveBuildVersion) {
        return { ok: false, reason: 'proof buildVersion does not match the hall of fame entry' };
    }

    const signature = typeof rawProof?.signature === 'string' ? rawProof.signature.trim().toLowerCase() : '';
    if (!/^[a-f0-9]{16}$/.test(signature)) {
        return { ok: false, reason: 'proof signature is missing or malformed' };
    }

    const expectedSignatures = source.proofVersion === HALL_OF_FAME_LEGACY_SUBMISSION_PROOF_VERSION
        ? [
            computeHallOfFameDigest(
                buildHallOfFameProofSignaturePayload(entry, source, { includeExtendedCounters: false }),
                source.proofVersion,
            ),
            computeHallOfFameDigest(
                buildHallOfFameProofSignaturePayload(entry, source),
                source.proofVersion,
            ),
        ]
        : [
            computeHallOfFameDigest(
                buildHallOfFameProofSignaturePayload(entry, source),
                source.proofVersion,
            ),
        ];
    const uniqueExpectedSignatures = [...new Set(expectedSignatures)];
    if (!uniqueExpectedSignatures.includes(signature)) {
        return {
            ok: false,
            reason: 'proof signature mismatch',
            details: {
                expectedSignature: uniqueExpectedSignatures[0],
                expectedSignatures: uniqueExpectedSignatures,
                receivedSignature: signature,
                proofVersion: source.proofVersion,
                saveVersion: source.saveVersion,
                savedAt: source.savedAt,
                runId: source.runId,
                startedAt: source.startedAt,
                saveBuildVersion: source.saveBuildVersion,
            },
        };
    }

    return { ok: true, proof: { ...source, signature } };
}

export function verifyHallOfFameEntryProof(entry, rawProof) {
    const result = verifyHallOfFameEntryProofDetailed(entry, rawProof);
    return result.ok ? result.proof : null;
}

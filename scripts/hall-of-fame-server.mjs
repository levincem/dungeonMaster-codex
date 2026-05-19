import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    sanitizeHallOfFamePlayerName,
    verifyHallOfFameEntryProofDetailed,
} from './hall-of-fame-security.mjs';

const HALL_OF_FAME_VERSION = 1;
const HALL_OF_FAME_MAX_ENTRIES = 200;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_COUNTER = 10_000_000;
const MAX_DURATION_COUNTER = 1_000_000_000;
const MAX_NAMED_COUNTERS = 128;
const MAX_KEY_LENGTH = 64;
const MIN_COMPLETED_AT = Date.UTC(2020, 0, 1);
const HALL_OF_FAME_FILENAME = 'hall_of_fame.json';

function createActionCounters() {
    return {
        total: 0,
        melee: 0,
        projectile: 0,
        magic: 0,
        utility: 0,
    };
}

function createDamageTotals() {
    return {
        total: 0,
        melee: 0,
        projectile: 0,
        magic: 0,
        environment: 0,
        poison: 0,
        other: 0,
    };
}

function createSpellCounters() {
    return {
        attempted: 0,
        succeeded: 0,
        failed: 0,
    };
}

function createInitialGameStats(now = Date.now(), runId = 'run_legacy_server') {
    return {
        runId,
        startedAt: now,
        movement: {
            stepsForward: 0,
            stepsBackward: 0,
            strafesLeft: 0,
            strafesRight: 0,
            turnsLeft: 0,
            turnsRight: 0,
            bumps: 0,
            falls: 0,
        },
        exploration: {
            levelTransitions: 0,
            doorsToggled: 0,
            wallSensorsActivated: 0,
            fountainDrinks: 0,
            waterContainersFilled: 0,
            sleeps: 0,
            wakes: 0,
            resurrections: 0,
            timeByLevelMs: {},
            currentLevel: 0,
            currentLevelStartedAtTick: 0,
        },
        combat: {
            attacks: createActionCounters(),
            monstersKilled: 0,
            championsKilled: 0,
            damageDealt: createDamageTotals(),
            damageTaken: createDamageTotals(),
            damageTakenByCreature: {},
            byCreature: {},
        },
        magic: {
            spells: createSpellCounters(),
            manaSpent: 0,
            bySpell: {},
        },
        items: {
            pickedUp: 0,
            dropped: 0,
            thrown: 0,
            used: 0,
            storedInContainers: 0,
            takenFromContainers: 0,
            given: 0,
            equipped: 0,
            unequipped: 0,
        },
    };
}

function readCounter(value, keyPath) {
    if (value === undefined) return 0;
    if (!Number.isFinite(value) || value < 0 || value > MAX_COUNTER) {
        throw new Error(`Invalid counter: ${keyPath}`);
    }
    return Math.floor(value);
}

function readLargeCounter(value, keyPath) {
    if (value === undefined) return 0;
    if (!Number.isFinite(value) || value < 0 || value > MAX_DURATION_COUNTER) {
        throw new Error(`Invalid counter: ${keyPath}`);
    }
    return Math.floor(value);
}

function readTrimmedString(value, maxLength, fallback = '') {
    if (typeof value !== 'string') return fallback;
    return value.trim().slice(0, maxLength);
}

function readSafeId(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return /^[A-Za-z0-9_-]{8,96}$/.test(trimmed) ? trimmed : null;
}

function sanitizeNamedCounterKey(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().slice(0, MAX_KEY_LENGTH);
    if (!trimmed) return null;
    return trimmed.replace(/\s+/g, ' ');
}

function normalizeNamedCounters(source, keyPath) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
    const entries = Object.entries(source).slice(0, MAX_NAMED_COUNTERS);
    const next = {};
    for (const [rawKey, rawValue] of entries) {
        const key = sanitizeNamedCounterKey(rawKey);
        if (!key) continue;
        next[key] = readCounter(rawValue, `${keyPath}.${key}`);
    }
    return next;
}

function normalizeLargeNamedCounters(source, keyPath) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
    const entries = Object.entries(source).slice(0, MAX_NAMED_COUNTERS);
    const next = {};
    for (const [rawKey, rawValue] of entries) {
        const key = sanitizeNamedCounterKey(rawKey);
        if (!key) continue;
        next[key] = readLargeCounter(rawValue, `${keyPath}.${key}`);
    }
    return next;
}

function normalizeSpellCounterMap(source, keyPath) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
    const entries = Object.entries(source).slice(0, MAX_NAMED_COUNTERS);
    const next = {};
    for (const [rawKey, rawValue] of entries) {
        const key = sanitizeNamedCounterKey(rawKey);
        if (!key) continue;
        next[key] = normalizeSpellCounters(rawValue, `${keyPath}.${key}`);
    }
    return next;
}

function normalizeActionCounters(source, keyPath) {
    const initial = createActionCounters();
    const object = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    return {
        ...initial,
        total: readCounter(object.total, `${keyPath}.total`),
        melee: readCounter(object.melee, `${keyPath}.melee`),
        projectile: readCounter(object.projectile, `${keyPath}.projectile`),
        magic: readCounter(object.magic, `${keyPath}.magic`),
        utility: readCounter(object.utility, `${keyPath}.utility`),
    };
}

function normalizeDamageTotals(source, keyPath) {
    const initial = createDamageTotals();
    const object = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    return {
        ...initial,
        total: readCounter(object.total, `${keyPath}.total`),
        melee: readCounter(object.melee, `${keyPath}.melee`),
        projectile: readCounter(object.projectile, `${keyPath}.projectile`),
        magic: readCounter(object.magic, `${keyPath}.magic`),
        environment: readCounter(object.environment, `${keyPath}.environment`),
        poison: readCounter(object.poison, `${keyPath}.poison`),
        other: readCounter(object.other, `${keyPath}.other`),
    };
}

function normalizeSpellCounters(source, keyPath) {
    const initial = createSpellCounters();
    const object = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    return {
        ...initial,
        attempted: readCounter(object.attempted, `${keyPath}.attempted`),
        succeeded: readCounter(object.succeeded, `${keyPath}.succeeded`),
        failed: readCounter(object.failed, `${keyPath}.failed`),
    };
}

function normalizeFlatCounterGroup(source, keys, keyPath) {
    const object = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    return Object.fromEntries(keys.map((key) => [key, readCounter(object[key], `${keyPath}.${key}`)]));
}

function normalizeGameStats(source, completedAt, now = Date.now(), fallbackRunId = null) {
    const initial = createInitialGameStats(now, fallbackRunId ?? 'run_legacy_server');
    const object = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    const startedAt = Number.isFinite(object.startedAt) ? Math.floor(object.startedAt) : initial.startedAt;
    // Real playthroughs can legitimately span weeks or months of wall-clock time.
    // Rejecting long-lived saves here causes valid victories to bounce even though
    // the proof itself is otherwise sound.
    if (startedAt < MIN_COMPLETED_AT || startedAt > completedAt) {
        throw new Error('Invalid startedAt');
    }
    const runId = readSafeId(object.runId) ?? fallbackRunId ?? initial.runId;
    return {
        runId,
        startedAt,
        movement: normalizeFlatCounterGroup(object.movement, [
            'stepsForward', 'stepsBackward', 'strafesLeft', 'strafesRight', 'turnsLeft', 'turnsRight', 'bumps', 'falls',
        ], 'movement'),
        combat: {
            attacks: normalizeActionCounters(object.combat?.attacks, 'combat.attacks'),
            monstersKilled: readCounter(object.combat?.monstersKilled, 'combat.monstersKilled'),
            championsKilled: readCounter(object.combat?.championsKilled, 'combat.championsKilled'),
            damageDealt: normalizeDamageTotals(object.combat?.damageDealt, 'combat.damageDealt'),
            damageTaken: normalizeDamageTotals(object.combat?.damageTaken, 'combat.damageTaken'),
            damageTakenByCreature: normalizeNamedCounters(
                object.combat?.damageTakenByCreature,
                'combat.damageTakenByCreature',
            ),
            byCreature: normalizeNamedCounters(object.combat?.byCreature, 'combat.byCreature'),
        },
        magic: {
            spells: normalizeSpellCounters(object.magic?.spells, 'magic.spells'),
            manaSpent: readCounter(object.magic?.manaSpent, 'magic.manaSpent'),
            bySpell: normalizeSpellCounterMap(object.magic?.bySpell, 'magic.bySpell'),
        },
        items: normalizeFlatCounterGroup(object.items, [
            'pickedUp', 'dropped', 'thrown', 'used', 'storedInContainers',
            'takenFromContainers', 'given', 'equipped', 'unequipped',
        ], 'items'),
        exploration: {
            ...normalizeFlatCounterGroup(object.exploration, [
                'levelTransitions', 'doorsToggled', 'wallSensorsActivated', 'fountainDrinks',
                'waterContainersFilled', 'sleeps', 'wakes', 'resurrections',
            ], 'exploration'),
            timeByLevelMs: normalizeLargeNamedCounters(object.exploration?.timeByLevelMs, 'exploration.timeByLevelMs'),
            currentLevel: readCounter(object.exploration?.currentLevel, 'exploration.currentLevel'),
            currentLevelStartedAtTick: readCounter(
                object.exploration?.currentLevelStartedAtTick,
                'exploration.currentLevelStartedAtTick',
            ),
        },
    };
}

function buildSummary(stats, completedAt) {
    return {
        playTimeSec: Math.max(0, Math.floor((completedAt - stats.startedAt) / 1000)),
        monstersKilled: stats.combat.monstersKilled,
        spellsCast: stats.magic.spells.attempted,
        damageDealt: stats.combat.damageDealt.total,
        damageTaken: stats.combat.damageTaken.total,
        manaSpent: stats.magic.manaSpent,
    };
}

function buildServerHash({ id, name, completedAt, buildVersion, summary }) {
    return createHash('sha256')
        .update(JSON.stringify({
            id,
            name,
            completedAt,
            buildVersion,
            summary,
        }))
        .digest('hex')
        .slice(0, 24);
}

function readStoredServerRecordedAt(value, fallback, now) {
    if (!Number.isFinite(value)) return fallback;
    const normalized = Math.floor(value);
    if (normalized < MIN_COMPLETED_AT || normalized > now + 15 * 60 * 1000) {
        return fallback;
    }
    return normalized;
}

function readStoredServerHash(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim().toLowerCase();
    return /^[a-f0-9]{24}$/.test(trimmed) ? trimmed : fallback;
}

function summarizeProofMismatchDetails(source, normalizedEntry, proofResult) {
    if (!proofResult?.details || !normalizedEntry) return null;
    const submittedSummary = source?.summary && typeof source.summary === 'object' ? source.summary : {};
    const summaryDiff = {
        playTimeSec: {
            submitted: submittedSummary.playTimeSec ?? null,
            normalized: normalizedEntry.summary.playTimeSec,
        },
        monstersKilled: {
            submitted: submittedSummary.monstersKilled ?? null,
            normalized: normalizedEntry.summary.monstersKilled,
        },
        spellsCast: {
            submitted: submittedSummary.spellsCast ?? null,
            normalized: normalizedEntry.summary.spellsCast,
        },
        damageDealt: {
            submitted: submittedSummary.damageDealt ?? null,
            normalized: normalizedEntry.summary.damageDealt,
        },
        damageTaken: {
            submitted: submittedSummary.damageTaken ?? null,
            normalized: normalizedEntry.summary.damageTaken,
        },
        manaSpent: {
            submitted: submittedSummary.manaSpent ?? null,
            normalized: normalizedEntry.summary.manaSpent,
        },
    };

    return {
        ...proofResult.details,
        entryId: normalizedEntry.id,
        entryBuildVersion: normalizedEntry.buildVersion,
        entryCompletedAt: normalizedEntry.completedAt,
        entryStartedAt: normalizedEntry.stats.startedAt,
        submittedName: typeof source?.name === 'string' ? source.name : null,
        normalizedName: normalizedEntry.name,
        submittedBuildVersion: typeof source?.buildVersion === 'string' ? source.buildVersion : null,
        submittedByCreatureCount: Object.keys(source?.stats?.combat?.byCreature ?? {}).length,
        normalizedByCreatureCount: Object.keys(normalizedEntry.stats.combat.byCreature).length,
        submittedBySpellCount: Object.keys(source?.stats?.magic?.bySpell ?? {}).length,
        normalizedBySpellCount: Object.keys(normalizedEntry.stats.magic.bySpell).length,
        summaryDiff,
    };
}

function normalizeHallOfFameEntryDetailed(source, now = Date.now(), { preserveServerMetadata = false, requireProof = false } = {}) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return { entry: null, reason: 'entry payload must be an object', details: null };
    }
    const id = readSafeId(source.id);
    const name = sanitizeHallOfFamePlayerName(source.name);
    const completedAt = Number.isFinite(source.completedAt) ? Math.floor(source.completedAt) : NaN;
    if (!id) {
        return { entry: null, reason: 'entry id is invalid', details: null };
    }
    if (!name) {
        return { entry: null, reason: 'entry player name is invalid', details: null };
    }
    if (!Number.isFinite(completedAt) || completedAt < MIN_COMPLETED_AT || completedAt > now + 15 * 60 * 1000) {
        return { entry: null, reason: 'entry completedAt is invalid', details: null };
    }
    try {
        const stats = normalizeGameStats(source.stats, completedAt, now, id);
        const buildVersion = readTrimmedString(source.buildVersion, 32, 'unknown') || 'unknown';
        const summary = buildSummary(stats, completedAt);
        const normalizedEntry = {
            id,
            name,
            completedAt,
            buildVersion,
            stats,
            summary,
        };

        if (requireProof) {
            const proofResult = verifyHallOfFameEntryProofDetailed(normalizedEntry, source.proof);
            if (!proofResult.ok) {
                return {
                    entry: null,
                    reason: proofResult.reason,
                    details: summarizeProofMismatchDetails(source, normalizedEntry, proofResult),
                };
            }
        }

        const fallbackServerRecordedAt = now;
        const fallbackServerHash = buildServerHash({
            id,
            name,
            completedAt,
            buildVersion,
            summary,
        });
        return {
            entry: {
                ...normalizedEntry,
                serverRecordedAt: preserveServerMetadata
                    ? readStoredServerRecordedAt(source.serverRecordedAt, fallbackServerRecordedAt, now)
                    : fallbackServerRecordedAt,
                serverHash: preserveServerMetadata
                    ? readStoredServerHash(source.serverHash, fallbackServerHash)
                    : fallbackServerHash,
            },
            reason: null,
            details: null,
        };
    } catch (error) {
        return {
            entry: null,
            reason: error instanceof Error && error.message
                ? error.message
                : 'entry normalization failed',
            details: null,
        };
    }
}

function normalizeHallOfFameEntry(source, now = Date.now(), options = {}) {
    return normalizeHallOfFameEntryDetailed(source, now, options).entry;
}

function normalizeHallOfFameFile(source, now = Date.now(), { preserveServerMetadata = false } = {}) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return { version: HALL_OF_FAME_VERSION, entries: [] };
    }
    const entries = Array.isArray(source.entries)
        ? source.entries
            .map((entry) => normalizeHallOfFameEntry(entry, now, { preserveServerMetadata }))
            .filter(Boolean)
        : [];
    return {
        version: HALL_OF_FAME_VERSION,
        entries: entries
            .sort((left, right) => right.completedAt - left.completedAt)
            .slice(0, HALL_OF_FAME_MAX_ENTRIES),
    };
}

function createRateLimiter({ windowMs, maxWrites }) {
    const hits = new Map();
    return {
        check(clientIp, now = Date.now()) {
            const next = (hits.get(clientIp) ?? []).filter((ts) => now - ts < windowMs);
            if (next.length >= maxWrites) {
                hits.set(clientIp, next);
                return false;
            }
            next.push(now);
            hits.set(clientIp, next);
            return true;
        },
    };
}

function getClientIp(request, trustProxy) {
    if (trustProxy) {
        const forwarded = request.headers['x-forwarded-for'];
        if (typeof forwarded === 'string') {
            const [first] = forwarded.split(',').map((value) => value.trim()).filter(Boolean);
            if (first) return first;
        }
    }
    return request.socket.remoteAddress ?? 'unknown';
}

async function readRequestJson(request) {
    const declaredLength = Number(request.headers['content-length'] ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
        throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_BODY_BYTES) {
            throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
        }
        chunks.push(buffer);
    }
    if (size === 0) {
        throw Object.assign(new Error('Missing body'), { statusCode: 400 });
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        throw Object.assign(new Error('Invalid JSON'), { statusCode: 400 });
    }
}

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
    });
    response.end(JSON.stringify(payload));
}

function logHallOfFameRequestIssue(request, statusCode, message, details = null) {
    const prefix = '[hall-of-fame]';
    const line = `${prefix} ${request.method ?? 'UNKNOWN'} ${request.url ?? '/'} -> ${statusCode}: ${message}`;
    if (statusCode >= 500) {
        console.error(line);
        if (details) {
            console.error(`${prefix} details: ${JSON.stringify(details)}`);
        }
        return;
    }
    console.warn(line);
    if (details) {
        console.warn(`${prefix} details: ${JSON.stringify(details)}`);
    }
}

export function createHallOfFameStore({
    dataDir = path.resolve(process.cwd(), 'data', 'hall-of-fame'),
    now = () => Date.now(),
} = {}) {
    const resolvedDataDir = path.resolve(dataDir);
    const dataFilePath = path.join(resolvedDataDir, HALL_OF_FAME_FILENAME);
    let writeQueue = Promise.resolve();

    async function ensureDataDir() {
        await fs.mkdir(resolvedDataDir, { recursive: true, mode: 0o700 });
    }

    async function readFile() {
        await ensureDataDir();
        try {
            const raw = await fs.readFile(dataFilePath, 'utf8');
            return normalizeHallOfFameFile(JSON.parse(raw), now(), { preserveServerMetadata: true });
        } catch (error) {
            if (error && typeof error === 'object' && error.code === 'ENOENT') {
                return normalizeHallOfFameFile(null, now(), { preserveServerMetadata: true });
            }
            throw error;
        }
    }

    async function writeFile(nextFile) {
        await ensureDataDir();
        const normalized = normalizeHallOfFameFile(nextFile, now(), { preserveServerMetadata: true });
        const tempPath = path.join(resolvedDataDir, `${HALL_OF_FAME_FILENAME}.${process.pid}.${randomUUID()}.tmp`);
        const payload = `${JSON.stringify(normalized, null, 2)}\n`;
        await fs.writeFile(tempPath, payload, { encoding: 'utf8', mode: 0o600 });
        await fs.rename(tempPath, dataFilePath);
        return normalized;
    }

    return {
        async listEntries() {
            return readFile();
        },
        async appendEntry(entry) {
            const { entry: normalizedEntry, reason, details } = normalizeHallOfFameEntryDetailed(entry, now(), { requireProof: true });
            if (!normalizedEntry) {
                const suffix = reason ? `: ${reason}` : '';
                throw Object.assign(new Error(`Invalid hall of fame entry${suffix}`), {
                    statusCode: 400,
                    details,
                });
            }
            const nextWrite = writeQueue.catch(() => undefined).then(async () => {
                const current = await readFile();
                const entries = [
                    normalizedEntry,
                    ...current.entries.filter((candidate) => candidate.id !== normalizedEntry.id),
                ];
                return writeFile({
                    version: HALL_OF_FAME_VERSION,
                    entries,
                });
            });
            writeQueue = nextWrite.then(
                () => undefined,
                () => undefined,
            );
            return nextWrite;
        },
        dataDir: resolvedDataDir,
        dataFilePath,
    };
}

export function createHallOfFameRequestHandler({
    store = createHallOfFameStore(),
    trustProxy = false,
    rateLimitWindowMs = 60_000,
    rateLimitMaxWrites = 16,
} = {}) {
    const rateLimiter = createRateLimiter({
        windowMs: rateLimitWindowMs,
        maxWrites: rateLimitMaxWrites,
    });

    return async function handleHallOfFameRequest(request, response) {
        try {
            const url = new URL(request.url ?? '/', 'http://127.0.0.1');
            if (url.pathname !== '/api/hall-of-fame') {
                sendJson(response, 404, { error: 'Not found' });
                return;
            }

            if (request.method === 'OPTIONS') {
                response.writeHead(204, {
                    Allow: 'GET, POST, OPTIONS',
                    'Cache-Control': 'no-store',
                });
                response.end();
                return;
            }

            if (request.method === 'GET') {
                const file = await store.listEntries();
                sendJson(response, 200, file);
                return;
            }

            if (request.method !== 'POST') {
                response.writeHead(405, {
                    Allow: 'GET, POST, OPTIONS',
                    'Content-Type': 'application/json; charset=utf-8',
                    'Cache-Control': 'no-store',
                });
                response.end(JSON.stringify({ error: 'Method not allowed' }));
                return;
            }

            const contentType = request.headers['content-type'];
            if (typeof contentType !== 'string' || !contentType.toLowerCase().startsWith('application/json')) {
                sendJson(response, 415, { error: 'Content-Type must be application/json' });
                return;
            }

            const clientIp = getClientIp(request, trustProxy);
            if (!rateLimiter.check(clientIp)) {
                sendJson(response, 429, { error: 'Too many submissions' });
                return;
            }

            const body = await readRequestJson(request);
            const file = await store.appendEntry(body?.entry);
            sendJson(response, 201, file);
        } catch (error) {
            const statusCode = error && typeof error === 'object' && Number.isInteger(error.statusCode)
                ? error.statusCode
                : 500;
            const message = statusCode >= 500
                ? 'Internal server error'
                : String(error?.message ?? 'Request failed');
            const details = error && typeof error === 'object' && 'details' in error ? error.details : null;
            logHallOfFameRequestIssue(request, statusCode, message, details);
            sendJson(response, statusCode, {
                error: message,
            });
        }
    };
}

export function createHallOfFameServer(options = {}) {
    return http.createServer(createHallOfFameRequestHandler(options));
}

async function startFromCli() {
    const host = process.env.HOF_HOST || '127.0.0.1';
    const port = Number(process.env.HOF_PORT || 3001);
    const trustProxy = process.env.HOF_TRUST_PROXY === '1';
    const dataDir = process.env.HOF_DATA_DIR
        ? path.resolve(process.env.HOF_DATA_DIR)
        : path.resolve(process.cwd(), 'data', 'hall-of-fame');
    const server = createHallOfFameServer({
        trustProxy,
        store: createHallOfFameStore({ dataDir }),
    });

    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => resolve());
    });

    process.stdout.write(`Hall of Fame server listening on http://${host}:${port}\n`);
    process.stdout.write(`Hall of Fame data file: ${path.join(dataDir, HALL_OF_FAME_FILENAME)}\n`);
}

const executedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (executedAsScript) {
    startFromCli().catch((error) => {
        process.stderr.write(`${String(error?.stack ?? error)}\n`);
        process.exitCode = 1;
    });
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { buildHallOfFameEntry } from '../src/engine/hallOfFame.js';
import {
    HALL_OF_FAME_SUBMISSION_PROOF_VERSION,
    buildHallOfFameEntryProof,
} from '../src/engine/hallOfFameSecurity.js';
import { createInitialGameStats } from '../src/engine/systems/gameStats.js';

const FIXED_NOW = Date.UTC(2026, 4, 16, 12, 0, 0);
const LEGACY_HALL_OF_FAME_SUBMISSION_PROOF_VERSION = 1;
const importEsm = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<HallOfFameModule>;

interface HallOfFameStore {
    dataDir: string;
    dataFilePath: string;
    listEntries(): Promise<{ version: number; entries: unknown[] }>;
    appendEntry(entry: unknown): Promise<{ version: number; entries: unknown[] }>;
}

interface HallOfFameModule {
    createHallOfFameServer(options?: {
        store?: HallOfFameStore;
        trustProxy?: boolean;
        rateLimitWindowMs?: number;
        rateLimitMaxWrites?: number;
    }): http.Server;
    createHallOfFameStore(options?: {
        dataDir?: string;
        now?: () => number;
    }): HallOfFameStore;
}

interface JsonResponse {
    statusCode: number;
    body: unknown;
}

type HallOfFameEntrySnapshot = ReturnType<typeof buildHallOfFameEntry>;

function computeCompatHallOfFameDigest(input: string, proofVersion: number): string {
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

function canonicalizeProofPayload(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((entry) => canonicalizeProofPayload(entry));
    }
    if (!value || typeof value !== 'object') {
        return value;
    }
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
            .map(([key, nestedValue]) => [key, canonicalizeProofPayload(nestedValue)]),
    );
}

function buildLegacyV1Proof(entry: HallOfFameEntrySnapshot): NonNullable<ReturnType<typeof buildHallOfFameEntryProof>> {
    const proof = {
        proofVersion: LEGACY_HALL_OF_FAME_SUBMISSION_PROOF_VERSION,
        saveVersion: 2,
        savedAt: entry.completedAt,
        saveIntegrity: 'deadbeef',
        saveBuildVersion: entry.buildVersion,
        runId: entry.id,
        startedAt: entry.stats.startedAt,
    };
    const payload = JSON.stringify(canonicalizeProofPayload({
        proofVersion: proof.proofVersion,
        saveVersion: proof.saveVersion,
        savedAt: proof.savedAt,
        saveIntegrity: proof.saveIntegrity,
        saveBuildVersion: proof.saveBuildVersion,
        runId: proof.runId,
        startedAt: proof.startedAt,
        entry: {
            id: entry.id,
            name: entry.name,
            completedAt: entry.completedAt,
            buildVersion: entry.buildVersion,
            stats: entry.stats,
            summary: entry.summary,
        },
    }));

    return {
        ...proof,
        signature: computeCompatHallOfFameDigest(payload, proof.proofVersion),
    };
}

async function loadHallOfFameModule(): Promise<HallOfFameModule> {
    const modulePath = path.resolve(process.cwd(), 'scripts', 'hall-of-fame-server.mjs');
    return importEsm(pathToFileURL(modulePath).href);
}

async function startHallOfFameServer(dataDir: string): Promise<{
    server: http.Server;
    baseUrl: string;
    store: HallOfFameStore;
}> {
    const module = await loadHallOfFameModule();
    const store = module.createHallOfFameStore({
        dataDir,
        now: () => FIXED_NOW,
    });
    const server = module.createHallOfFameServer({
        store,
        rateLimitWindowMs: 60_000,
        rateLimitMaxWrites: 8,
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    assert(address && typeof address === 'object');

    return {
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
        store,
    };
}

async function requestJson(
    baseUrl: string,
    method: string,
    pathname: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
): Promise<JsonResponse> {
    const url = new URL(pathname, baseUrl);
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body), 'utf8');

    return new Promise((resolve, reject) => {
        const request = http.request(url, {
            method,
            headers: {
                Accept: 'application/json',
                ...(payload ? {
                    'Content-Type': 'application/json',
                    'Content-Length': String(payload.length),
                } : {}),
                ...extraHeaders,
            },
        }, (response) => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk) => {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            response.on('end', () => {
                const rawBody = Buffer.concat(chunks).toString('utf8');
                resolve({
                    statusCode: response.statusCode ?? 0,
                    body: rawBody ? JSON.parse(rawBody) : null,
                });
            });
        });

        request.once('error', reject);
        if (payload) request.write(payload);
        request.end();
    });
}

function createValidEntry(id = 'victory_abc12345') {
    const completedAt = FIXED_NOW - 1_000;
    const stats = createInitialGameStats(completedAt - 90_000);
    stats.runId = id;
    stats.movement.stepsForward = 12;
    stats.combat.monstersKilled = 7;
    stats.combat.damageDealt.total = 345;
    stats.combat.damageTaken.total = 21;
    stats.combat.byCreature.Screamer = 3;
    stats.magic.spells.attempted = 5;
    stats.magic.spells.succeeded = 4;
    stats.magic.spells.failed = 1;
    stats.magic.manaSpent = 33;
    stats.magic.bySpell.Lightning = {
        attempted: 2,
        succeeded: 2,
        failed: 0,
    };
    stats.items.pickedUp = 2;

    const entry = buildHallOfFameEntry('Tiggy', stats, completedAt);
    const proof = buildHallOfFameEntryProof(entry, {
        proofVersion: HALL_OF_FAME_SUBMISSION_PROOF_VERSION,
        saveVersion: 2,
        savedAt: completedAt,
        saveIntegrity: 'deadbeef',
        saveBuildVersion: entry.buildVersion,
        runId: entry.id,
        startedAt: entry.stats.startedAt,
    });
    assert.ok(proof, 'expected a valid hall of fame proof');

    return {
        ...entry,
        proof,
    };
}

test('hall of fame server returns an empty file before the first write', async (t) => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'dm-hof-empty-'));
    t.after(async () => {
        await rm(dataDir, { recursive: true, force: true });
    });

    const { server, baseUrl } = await startHallOfFameServer(dataDir);
    t.after(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    });

    const response = await requestJson(baseUrl, 'GET', '/api/hall-of-fame');
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
        version: 1,
        entries: [],
    });
});

test('hall of fame server writes only the configured JSON file and ignores path-like junk from the client', async (t) => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'dm-hof-store-'));
    t.after(async () => {
        await rm(dataDir, { recursive: true, force: true });
    });

    const { server, baseUrl, store } = await startHallOfFameServer(dataDir);
    t.after(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    });

    const response = await requestJson(baseUrl, 'POST', '/api/hall-of-fame', {
        path: '../../evil.json',
        entry: {
            ...createValidEntry(),
            dataDir: '../../also-ignored',
        },
    });

    assert.equal(response.statusCode, 201);
    const postBody = response.body as { entries: Array<{ id: string; summary: { playTimeSec: number; monstersKilled: number; manaSpent: number } }> };
    assert.equal(postBody.entries.length, 1);
    assert.equal(postBody.entries[0]?.id, 'victory_abc12345');
    assert.equal(postBody.entries[0]?.summary.playTimeSec, 90);
    assert.equal(postBody.entries[0]?.summary.monstersKilled, 7);
    assert.equal(postBody.entries[0]?.summary.manaSpent, 33);

    const files = await readdir(dataDir);
    assert.deepEqual(files, ['hall_of_fame.json']);

    const persisted = JSON.parse(await readFile(store.dataFilePath, 'utf8')) as { entries: Array<{ id: string }> };
    assert.equal(persisted.entries.length, 1);
    assert.equal(persisted.entries[0]?.id, 'victory_abc12345');
});

test('hall of fame server keeps serverRecordedAt stable after the initial write', async (t) => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'dm-hof-metadata-'));
    t.after(async () => {
        await rm(dataDir, { recursive: true, force: true });
    });

    const { server, baseUrl } = await startHallOfFameServer(dataDir);
    t.after(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    });

    const postResponse = await requestJson(baseUrl, 'POST', '/api/hall-of-fame', {
        entry: createValidEntry('victory_meta_01'),
    });
    assert.equal(postResponse.statusCode, 201);
    const postEntry = (postResponse.body as { entries: Array<{ id: string; serverRecordedAt: number; serverHash: string }> }).entries[0];
    assert.equal(postEntry?.id, 'victory_meta_01');
    assert.equal(postEntry?.serverRecordedAt, FIXED_NOW);

    const getResponse = await requestJson(baseUrl, 'GET', '/api/hall-of-fame');
    assert.equal(getResponse.statusCode, 200);
    const getEntry = (getResponse.body as { entries: Array<{ id: string; serverRecordedAt: number; serverHash: string }> }).entries[0];
    assert.equal(getEntry?.id, 'victory_meta_01');
    assert.equal(getEntry?.serverRecordedAt, FIXED_NOW);
    assert.equal(getEntry?.serverHash, postEntry?.serverHash);
});

test('hall of fame server exposes only the exact API route', async (t) => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'dm-hof-route-'));
    t.after(async () => {
        await rm(dataDir, { recursive: true, force: true });
    });

    const { server, baseUrl } = await startHallOfFameServer(dataDir);
    t.after(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    });

    const response = await requestJson(baseUrl, 'GET', '/api/hall-of-fame/anything');
    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, {
        error: 'Not found',
    });
});

test('hall of fame server sanitizes player names before persisting them', async (t) => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'dm-hof-name-'));
    t.after(async () => {
        await rm(dataDir, { recursive: true, force: true });
    });

    const { server, baseUrl } = await startHallOfFameServer(dataDir);
    t.after(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    });

    const entry = createValidEntry('victory_name_01');
    const response = await requestJson(baseUrl, 'POST', '/api/hall-of-fame', {
        entry: {
            ...entry,
            name: ' Ti!g gy ',
        },
    });

    assert.equal(response.statusCode, 201);
    const storedEntry = (response.body as { entries: Array<{ id: string; name: string }> }).entries[0];
    assert.equal(storedEntry?.id, 'victory_name_01');
    assert.equal(storedEntry?.name, 'Tiggy');
});

test('hall of fame server rejects submissions without a valid proof', async (t) => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'dm-hof-proof-'));
    t.after(async () => {
        await rm(dataDir, { recursive: true, force: true });
    });

    const { server, baseUrl } = await startHallOfFameServer(dataDir);
    t.after(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    });

    const entry = createValidEntry('victory_proof_01');
    const response = await requestJson(baseUrl, 'POST', '/api/hall-of-fame', {
        entry: {
            ...entry,
            proof: undefined,
        },
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
        error: 'Invalid hall of fame entry: proof payload is missing or malformed',
    });
});

test('hall of fame server returns a detailed reason when the proof build version does not match', async (t) => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'dm-hof-proof-detail-'));
    t.after(async () => {
        await rm(dataDir, { recursive: true, force: true });
    });

    const { server, baseUrl } = await startHallOfFameServer(dataDir);
    t.after(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    });

    const entry = createValidEntry('victory_proof_detail_01');
    const response = await requestJson(baseUrl, 'POST', '/api/hall-of-fame', {
        entry: {
            ...entry,
            buildVersion: '0.9.2-hotfix',
        },
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
        error: 'Invalid hall of fame entry: proof buildVersion does not match the hall of fame entry',
    });
});

test('hall of fame server accepts a proof when the submitted named-counter maps are reordered', async (t) => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'dm-hof-reordered-proof-'));
    t.after(async () => {
        await rm(dataDir, { recursive: true, force: true });
    });

    const { server, baseUrl } = await startHallOfFameServer(dataDir);
    t.after(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    });

    const completedAt = FIXED_NOW - 2_000;
    const stats = createInitialGameStats(completedAt - 120_000);
    stats.runId = 'victory_reordered_01';
    stats.exploration.timeByLevelMs = {
        0: 12_000,
        2: 24_000,
    };
    stats.combat.monstersKilled = 7;
    stats.combat.damageDealt.total = 345;
    stats.combat.damageTaken.total = 21;
    stats.combat.damageTakenByCreature = {
        Mummy: 9,
        Screamer: 12,
    };
    stats.combat.byCreature = {
        Screamer: 3,
        Vexirk: 1,
    };
    stats.magic.spells.attempted = 5;
    stats.magic.spells.succeeded = 4;
    stats.magic.spells.failed = 1;
    stats.magic.manaSpent = 33;
    stats.magic.bySpell = {
        'Lightning Bolt': {
            attempted: 2,
            succeeded: 2,
            failed: 0,
        },
        Zokathra: {
            attempted: 1,
            succeeded: 1,
            failed: 0,
        },
    };
    stats.items.pickedUp = 2;

    const entry = buildHallOfFameEntry('Tiggy', stats, completedAt);
    const proof = buildHallOfFameEntryProof(entry, {
        proofVersion: HALL_OF_FAME_SUBMISSION_PROOF_VERSION,
        saveVersion: 2,
        savedAt: completedAt,
        saveIntegrity: 'deadbeef',
        saveBuildVersion: entry.buildVersion,
        runId: entry.id,
        startedAt: entry.stats.startedAt,
    });
    assert.ok(proof, 'expected a valid hall of fame proof');

    const response = await requestJson(baseUrl, 'POST', '/api/hall-of-fame', {
        entry: {
            ...entry,
            proof,
            stats: {
                ...entry.stats,
                exploration: {
                    ...entry.stats.exploration,
                    timeByLevelMs: {
                        2: 24_000,
                        0: 12_000,
                    },
                },
                combat: {
                    ...entry.stats.combat,
                    damageTakenByCreature: {
                        Screamer: 12,
                        Mummy: 9,
                    },
                    byCreature: {
                        Screamer: 3,
                        Vexirk: 1,
                    },
                },
                magic: {
                    ...entry.stats.magic,
                    bySpell: {
                        'Lightning Bolt': {
                            attempted: 2,
                            succeeded: 2,
                            failed: 0,
                        },
                        Zokathra: {
                            attempted: 1,
                            succeeded: 1,
                            failed: 0,
                        },
                    },
                },
            },
        },
    });

    assert.equal(response.statusCode, 201);
    const entries = (response.body as { entries: Array<{ id: string }> }).entries;
    assert.equal(entries[0]?.id, 'victory_reordered_01');
});

test('hall of fame server accepts a proof when spell labels exceed the server key length limit', async (t) => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'dm-hof-long-spell-key-'));
    t.after(async () => {
        await rm(dataDir, { recursive: true, force: true });
    });

    const { server, baseUrl } = await startHallOfFameServer(dataDir);
    t.after(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    });

    const completedAt = FIXED_NOW - 2_500;
    const stats = createInitialGameStats(completedAt - 120_000);
    stats.runId = 'victory_long_spell_key_01';
    stats.combat.monstersKilled = 9;
    stats.combat.damageDealt.total = 512;
    stats.combat.damageTaken.total = 34;
    stats.magic.spells.attempted = 9;
    stats.magic.spells.succeeded = 9;
    stats.magic.manaSpent = 44;
    stats.magic.bySpell = {
        'Weaken Nonmaterial Beings - Launches a powerful spell against nonmaterial beings.': {
            attempted: 9,
            succeeded: 9,
            failed: 0,
        },
    };

    const entry = buildHallOfFameEntry('Tiggy', stats, completedAt);
    const proof = buildHallOfFameEntryProof(entry, {
        proofVersion: HALL_OF_FAME_SUBMISSION_PROOF_VERSION,
        saveVersion: 2,
        savedAt: completedAt,
        saveIntegrity: 'deadbeef',
        saveBuildVersion: entry.buildVersion,
        runId: entry.id,
        startedAt: entry.stats.startedAt,
    });
    assert.ok(proof, 'expected a valid hall of fame proof');

    const response = await requestJson(baseUrl, 'POST', '/api/hall-of-fame', {
        entry: {
            ...entry,
            proof,
        },
    });

    assert.equal(response.statusCode, 201);
    const entries = (response.body as { entries: Array<{ id: string }> }).entries;
    assert.equal(entries[0]?.id, 'victory_long_spell_key_01');
});

test('hall of fame server accepts legitimate victories from long-lived saves', async (t) => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'dm-hof-long-run-'));
    t.after(async () => {
        await rm(dataDir, { recursive: true, force: true });
    });

    const { server, baseUrl } = await startHallOfFameServer(dataDir);
    t.after(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    });

    const startedAt = Date.UTC(2026, 2, 1, 12, 0, 0);
    const completedAt = FIXED_NOW;
    const stats = createInitialGameStats(startedAt);
    stats.runId = 'victory_long_run_01';
    stats.combat.monstersKilled = 8;

    const entry = buildHallOfFameEntry('Tiggy', stats, completedAt);
    const proof = buildHallOfFameEntryProof(entry, {
        proofVersion: HALL_OF_FAME_SUBMISSION_PROOF_VERSION,
        saveVersion: 2,
        savedAt: completedAt,
        saveIntegrity: 'deadbeef',
        saveBuildVersion: entry.buildVersion,
        runId: entry.id,
        startedAt: entry.stats.startedAt,
    });
    assert.ok(proof, 'expected a valid hall of fame proof for a long-lived save');

    const response = await requestJson(baseUrl, 'POST', '/api/hall-of-fame', {
        entry: {
            ...entry,
            proof,
        },
    });

    assert.equal(response.statusCode, 201);
    const entries = (response.body as { entries: Array<{ id: string; summary: { playTimeSec: number } }> }).entries;
    assert.equal(entries[0]?.id, 'victory_long_run_01');
    assert.equal(entries[0]?.summary.playTimeSec, Math.floor((completedAt - startedAt) / 1000));
});

test('hall of fame server accepts a valid proof even when the save timestamp is older than the victory timestamp', async (t) => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'dm-hof-old-proof-'));
    t.after(async () => {
        await rm(dataDir, { recursive: true, force: true });
    });

    const { server, baseUrl } = await startHallOfFameServer(dataDir);
    t.after(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    });

    const startedAt = FIXED_NOW - (36 * 60 * 60 * 1000);
    const completedAt = FIXED_NOW;
    const stats = createInitialGameStats(startedAt);
    stats.runId = 'victory_old_proof_01';
    stats.combat.monstersKilled = 12;
    stats.combat.damageDealt.total = 640;
    stats.magic.spells.attempted = 18;

    const entry = buildHallOfFameEntry('Tiggy', stats, completedAt);
    const proof = buildHallOfFameEntryProof(entry, {
        proofVersion: HALL_OF_FAME_SUBMISSION_PROOF_VERSION,
        saveVersion: 2,
        savedAt: completedAt - (3 * 24 * 60 * 60 * 1000),
        saveIntegrity: 'deadbeef',
        saveBuildVersion: entry.buildVersion,
        runId: entry.id,
        startedAt: entry.stats.startedAt,
    });
    assert.ok(proof, 'expected a valid hall of fame proof');

    const response = await requestJson(baseUrl, 'POST', '/api/hall-of-fame', {
        entry: {
            ...entry,
            proof,
        },
    });

    assert.equal(response.statusCode, 201);
    const entries = (response.body as { entries: Array<{ id: string; summary: { monstersKilled: number; damageDealt: number } }> }).entries;
    assert.equal(entries[0]?.id, 'victory_old_proof_01');
    assert.equal(entries[0]?.summary.monstersKilled, 12);
    assert.equal(entries[0]?.summary.damageDealt, 640);
});

test('hall of fame server accepts a legacy v1 proof for entries that include exploration and creature-damage maps', async (t) => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'dm-hof-legacy-v1-'));
    t.after(async () => {
        await rm(dataDir, { recursive: true, force: true });
    });

    const { server, baseUrl } = await startHallOfFameServer(dataDir);
    t.after(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    });

    const completedAt = FIXED_NOW - 2_000;
    const stats = createInitialGameStats(completedAt - 120_000);
    stats.runId = 'victory_legacy_v1_01';
    stats.exploration.timeByLevelMs = {
        0: 12_000,
        2: 24_000,
    };
    stats.combat.monstersKilled = 7;
    stats.combat.damageDealt.total = 345;
    stats.combat.damageTaken.total = 21;
    stats.combat.damageTakenByCreature = {
        Mummy: 9,
        Screamer: 12,
    };
    stats.combat.byCreature = {
        Screamer: 3,
        Vexirk: 1,
    };
    stats.magic.spells.attempted = 5;
    stats.magic.spells.succeeded = 4;
    stats.magic.spells.failed = 1;
    stats.magic.manaSpent = 33;
    stats.magic.bySpell = {
        'Lightning Bolt': {
            attempted: 2,
            succeeded: 2,
            failed: 0,
        },
        Zokathra: {
            attempted: 1,
            succeeded: 1,
            failed: 0,
        },
    };

    const entry = buildHallOfFameEntry('Tiggy', stats, completedAt);
    const proof = buildLegacyV1Proof(entry);

    const response = await requestJson(baseUrl, 'POST', '/api/hall-of-fame', {
        entry: {
            ...entry,
            proof,
        },
    });

    assert.equal(response.statusCode, 201);
    const entries = (response.body as { entries: Array<{ id: string }> }).entries;
    assert.equal(entries[0]?.id, 'victory_legacy_v1_01');
});

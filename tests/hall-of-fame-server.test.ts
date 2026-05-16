import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const FIXED_NOW = Date.UTC(2026, 4, 16, 12, 0, 0);
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
    return {
        id,
        name: 'Tiggy',
        completedAt,
        buildVersion: '0.9.0-rc.1',
        stats: {
            startedAt: completedAt - 90_000,
            movement: {
                stepsForward: 12,
            },
            combat: {
                monstersKilled: 7,
                damageDealt: {
                    total: 345,
                },
                damageTaken: {
                    total: 21,
                },
                byCreature: {
                    Screamer: 3,
                },
            },
            magic: {
                spells: {
                    attempted: 5,
                    succeeded: 4,
                    failed: 1,
                },
                manaSpent: 33,
                bySpell: {
                    Lightning: {
                        attempted: 2,
                        succeeded: 2,
                        failed: 0,
                    },
                },
            },
            items: {
                pickedUp: 2,
            },
        },
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

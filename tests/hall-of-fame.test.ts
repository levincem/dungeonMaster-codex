import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHallOfFameEntry } from '../src/engine/hallOfFame.js';
import {
    HALL_OF_FAME_SUBMISSION_PROOF_VERSION,
    buildHallOfFameEntryProof,
} from '../src/engine/hallOfFameSecurity.js';
import { createInitialGameStats } from '../src/engine/systems/gameStats.js';

test('buildHallOfFameEntry uses the persisted run id as the victory id', () => {
    const stats = createInitialGameStats(1_000);
    const entry = buildHallOfFameEntry('Test', stats, 2_000);

    assert.equal(entry.id, stats.runId);
    assert.equal(entry.stats.runId, stats.runId);
});

test('buildHallOfFameEntry strips player names down to ASCII letters and digits', () => {
    const stats = createInitialGameStats(1_000);
    const entry = buildHallOfFameEntry('  Te! st_42  ', stats, 2_000);

    assert.equal(entry.name, 'Test42');
});

test('buildHallOfFameEntryProof binds the entry to a save fingerprint', () => {
    const stats = createInitialGameStats(1_000);
    const entry = buildHallOfFameEntry('Test', stats, 2_000);
    const proof = buildHallOfFameEntryProof(entry, {
        proofVersion: HALL_OF_FAME_SUBMISSION_PROOF_VERSION,
        saveVersion: 2,
        savedAt: 2_000,
        saveIntegrity: 'deadbeef',
        saveBuildVersion: entry.buildVersion,
        runId: entry.id,
        startedAt: entry.stats.startedAt,
    });

    assert.ok(proof);
    assert.equal(proof?.runId, entry.id);
    assert.match(proof?.signature ?? '', /^[a-f0-9]{16}$/);
});

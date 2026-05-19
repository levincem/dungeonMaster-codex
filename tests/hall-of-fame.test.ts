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

test('buildHallOfFameEntryProof is stable even when named counter maps use a different key order', () => {
    const stats = createInitialGameStats(1_000);
    stats.exploration.timeByLevelMs = {
        0: 3_600,
        2: 7_200,
        1: 4_800,
    };
    stats.combat.byCreature = {
        Vexirk: 2,
        Screamer: 4,
        Demon: 1,
    };
    stats.combat.damageTakenByCreature = {
        Demon: 14,
        Vexirk: 8,
        Screamer: 5,
    };
    stats.magic.bySpell = {
        Fireball: { attempted: 6, succeeded: 6, failed: 0 },
        'Poison Cloud': { attempted: 3, succeeded: 2, failed: 1 },
        'Lightning Bolt': { attempted: 5, succeeded: 5, failed: 0 },
    };

    const entry = buildHallOfFameEntry('Test', stats, 2_000);
    const reorderedEntry = {
        ...entry,
        stats: {
            ...entry.stats,
            exploration: {
                ...entry.stats.exploration,
                timeByLevelMs: {
                    2: 7_200,
                    0: 3_600,
                    1: 4_800,
                },
            },
            combat: {
                ...entry.stats.combat,
                damageTakenByCreature: {
                    Screamer: 5,
                    Demon: 14,
                    Vexirk: 8,
                },
                byCreature: {
                    Demon: 1,
                    Screamer: 4,
                    Vexirk: 2,
                },
            },
            magic: {
                ...entry.stats.magic,
                bySpell: {
                    'Lightning Bolt': { attempted: 5, succeeded: 5, failed: 0 },
                    'Poison Cloud': { attempted: 3, succeeded: 2, failed: 1 },
                    Fireball: { attempted: 6, succeeded: 6, failed: 0 },
                },
            },
        },
    };

    const proof = buildHallOfFameEntryProof(entry, {
        proofVersion: HALL_OF_FAME_SUBMISSION_PROOF_VERSION,
        saveVersion: 2,
        savedAt: 2_000,
        saveIntegrity: 'deadbeef',
        saveBuildVersion: entry.buildVersion,
        runId: entry.id,
        startedAt: entry.stats.startedAt,
    });
    const reorderedProof = buildHallOfFameEntryProof(reorderedEntry, {
        proofVersion: HALL_OF_FAME_SUBMISSION_PROOF_VERSION,
        saveVersion: 2,
        savedAt: 2_000,
        saveIntegrity: 'deadbeef',
        saveBuildVersion: reorderedEntry.buildVersion,
        runId: reorderedEntry.id,
        startedAt: reorderedEntry.stats.startedAt,
    });

    assert.equal(proof?.signature, reorderedProof?.signature);
});

test('buildHallOfFameEntryProof is stable when spell labels exceed the server key length limit', () => {
    const longSpellName = 'Weaken Nonmaterial Beings - Launches a powerful spell against nonmaterial beings.';
    const stats = createInitialGameStats(1_000);
    stats.magic.bySpell = {
        [longSpellName]: { attempted: 9, succeeded: 9, failed: 0 },
    };

    const entry = buildHallOfFameEntry('Test', stats, 2_000);
    const truncatedEntry = {
        ...entry,
        stats: {
            ...entry.stats,
            magic: {
                ...entry.stats.magic,
                bySpell: {
                    'Weaken Nonmaterial Beings': { attempted: 9, succeeded: 9, failed: 0 },
                },
            },
        },
    };

    const proof = buildHallOfFameEntryProof(entry, {
        proofVersion: HALL_OF_FAME_SUBMISSION_PROOF_VERSION,
        saveVersion: 2,
        savedAt: 2_000,
        saveIntegrity: 'deadbeef',
        saveBuildVersion: entry.buildVersion,
        runId: entry.id,
        startedAt: entry.stats.startedAt,
    });
    const truncatedProof = buildHallOfFameEntryProof(truncatedEntry, {
        proofVersion: HALL_OF_FAME_SUBMISSION_PROOF_VERSION,
        saveVersion: 2,
        savedAt: 2_000,
        saveIntegrity: 'deadbeef',
        saveBuildVersion: truncatedEntry.buildVersion,
        runId: truncatedEntry.id,
        startedAt: truncatedEntry.stats.startedAt,
    });

    assert.equal(proof?.signature, truncatedProof?.signature);
});

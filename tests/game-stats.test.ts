import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    applyGameStatsDelta,
    buildGameStatsTransitionDelta,
    createInitialGameStats,
    normalizeGameStats,
} from '../src/engine/systems/gameStats.js';

test('buildGameStatsTransitionDelta counts defeated creatures by name', () => {
    const delta = buildGameStatsTransitionDelta(
        {
            creatures: [
                {
                    id: 'screamer_1',
                    typeId: 6,
                    mapIndex: 0,
                    x: 1,
                    y: 1,
                    currentHP: 40,
                    alive: true,
                    cell: 'center',
                },
            ],
            championVitals: {},
            deadChampions: {},
        },
        {
            creatures: [
                {
                    id: 'screamer_1',
                    typeId: 6,
                    mapIndex: 0,
                    x: 1,
                    y: 1,
                    currentHP: 0,
                    alive: false,
                    cell: 'center',
                },
            ],
            championVitals: {},
            deadChampions: {},
        },
        'magic',
    );

    assert.equal(delta.combat?.monstersKilled, 1);
    assert.equal(delta.combat?.byCreature?.Screamer, 1);
});

test('applyGameStatsDelta merges per-creature kill counters', () => {
    const initial = createInitialGameStats(1000);
    const updated = applyGameStatsDelta(initial, {
        combat: {
            byCreature: {
                Screamer: 2,
                Mummy: 1,
            },
        },
    });
    const merged = applyGameStatsDelta(updated, {
        combat: {
            byCreature: {
                Screamer: 3,
            },
        },
    });

    assert.equal(merged.combat.byCreature.Screamer, 5);
    assert.equal(merged.combat.byCreature.Mummy, 1);
});

test('normalizeGameStats creates a run id for legacy stats payloads that do not have one', () => {
    const normalized = normalizeGameStats({ startedAt: 1_000 }, 2_000);

    assert.match(normalized.runId, /^[A-Za-z0-9_-]{8,96}$/);
    assert.equal(normalized.startedAt, 1_000);
});

test('normalizeGameStats preserves an existing run id', () => {
    const normalized = normalizeGameStats({ runId: 'run_legacy_12345678', startedAt: 1_000 }, 2_000);

    assert.equal(normalized.runId, 'run_legacy_12345678');
});

test('normalizeGameStats collapses descriptive spell-stat labels back to canonical spell names', () => {
    const normalized = normalizeGameStats({
        magic: {
            bySpell: {
                'Weaken Nonmaterial Beings - Launches a powerful spell against nonmaterial beings.': {
                    attempted: 9,
                    succeeded: 9,
                    failed: 0,
                },
                'Weaken Nonmaterial Beings': {
                    attempted: 2,
                    succeeded: 2,
                    failed: 0,
                },
                'Unknown rune combination.': {
                    attempted: 4,
                    succeeded: 0,
                    failed: 4,
                },
            },
        },
    }, 2_000);

    assert.deepEqual(normalized.magic.bySpell, {
        'Weaken Nonmaterial Beings': {
            attempted: 11,
            succeeded: 11,
            failed: 0,
        },
    });
});

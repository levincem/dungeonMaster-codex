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

test('buildGameStatsTransitionDelta attributes champion damage to the attacking creature name', () => {
    const delta = buildGameStatsTransitionDelta(
        {
            creatures: [],
            championVitals: { 1: { hp: 40 } as never },
            deadChampions: {},
            damageEvents: [],
        },
        {
            creatures: [],
            championVitals: { 1: { hp: 34 } as never },
            deadChampions: {},
            damageEvents: [{
                id: 'champ_dmg_1',
                level: 0,
                target: 'champion',
                championId: 1,
                amount: 6,
                sourceName: 'Mummy',
                ts: 1_000,
            }],
        },
        'melee',
    );

    assert.equal(delta.combat?.damageTaken?.total, 6);
    assert.equal(delta.combat?.damageTakenByCreature?.Mummy, 6);
});

test('buildGameStatsTransitionDelta records time spent on the previous level when changing depth', () => {
    const stats = createInitialGameStats(1_000);
    stats.exploration.currentLevel = 2;
    stats.exploration.currentLevelStartedAtTick = 100;

    const delta = buildGameStatsTransitionDelta(
        {
            creatures: [],
            championVitals: {},
            deadChampions: {},
            level: 2,
            elapsedGameTimeTicks: 150,
            gameStats: stats,
        },
        {
            creatures: [],
            championVitals: {},
            deadChampions: {},
            level: 3,
            elapsedGameTimeTicks: 160,
            gameStats: stats,
        },
        'environment',
    );

    assert.equal(delta.exploration?.timeByLevelMs?.['2'], 60 * 240);
    assert.equal(delta.exploration?.currentLevel, 3);
    assert.equal(delta.exploration?.currentLevelStartedAtTick, 160);
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

test('normalizeGameStats preserves new hall-of-fame stat maps and level timing trackers', () => {
    const normalized = normalizeGameStats({
        exploration: {
            timeByLevelMs: { 0: 1_200, 2: 3_400 },
            currentLevel: 2,
            currentLevelStartedAtTick: 456,
        },
        combat: {
            damageTakenByCreature: {
                Mummy: 12,
                Screamer: 5,
            },
        },
    }, 2_000);

    assert.deepEqual(normalized.exploration.timeByLevelMs, { 0: 1_200, 2: 3_400 });
    assert.equal(normalized.exploration.currentLevel, 2);
    assert.equal(normalized.exploration.currentLevelStartedAtTick, 456);
    assert.deepEqual(normalized.combat.damageTakenByCreature, { Mummy: 12, Screamer: 5 });
});

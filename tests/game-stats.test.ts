import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    applyGameStatsDelta,
    buildGameStatsTransitionDelta,
    createInitialGameStats,
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

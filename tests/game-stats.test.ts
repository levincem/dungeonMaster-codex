import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    applyGameStatsDelta,
    buildGameStatsTransitionDelta,
    createInitialGameStats,
    normalizeGameStats,
} from '../src/engine/systems/gameStats.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import type { CreatureInstance } from '../src/types/game.js';

function makeVitals(hp: number): ChampionVitals {
    return {
        hp,
        stamina: 100,
        mana: 50,
        food: 1000,
        water: 1000,
        currentStats: {
            luck: 40,
            strength: 40,
            dexterity: 40,
            wisdom: 40,
            vitality: 40,
            antiMagic: 40,
            antiFire: 40,
        },
        wounds: {
            rightHand: false,
            leftHand: false,
            head: false,
            torso: false,
            legs: false,
            feet: false,
        },
        poisonEntries: [],
    };
}

function makeCreature(id: string, currentHP: number, alive = true): CreatureInstance {
    return {
        id,
        groupId: 'group',
        typeId: 1,
        mapIndex: 0,
        x: 0,
        y: 0,
        currentHP,
        alive,
        cell: 'center',
        carriedItems: [],
    };
}

test('normalizeGameStats creates a complete zeroed stats shape for legacy saves', () => {
    const stats = normalizeGameStats(undefined, 12345);

    assert.equal(stats.startedAt, 12345);
    assert.equal(stats.movement.stepsForward, 0);
    assert.equal(stats.combat.damageDealt.total, 0);
    assert.equal(stats.combat.attacks.utility, 0);
    assert.deepEqual(stats.magic.bySpell, {});
    assert.equal(stats.items.pickedUp, 0);
});

test('applyGameStatsDelta accumulates action, damage, spell, and item counters', () => {
    const stats = applyGameStatsDelta(createInitialGameStats(100), {
        combat: {
            attacks: { total: 1, melee: 1 },
            damageDealt: { total: 12, melee: 12 },
        },
        magic: {
            spells: { attempted: 1, succeeded: 1 },
            manaSpent: 8,
            bySpell: {
                'Fireball': { attempted: 1, succeeded: 1 },
            },
        },
        items: { pickedUp: 2 },
    });

    assert.equal(stats.combat.attacks.total, 1);
    assert.equal(stats.combat.attacks.melee, 1);
    assert.equal(stats.combat.damageDealt.total, 12);
    assert.equal(stats.combat.damageDealt.melee, 12);
    assert.equal(stats.magic.spells.attempted, 1);
    assert.equal(stats.magic.manaSpent, 8);
    assert.equal(stats.magic.bySpell.Fireball.succeeded, 1);
    assert.equal(stats.items.pickedUp, 2);
});

test('buildGameStatsTransitionDelta derives damage and deaths from state transitions', () => {
    const before = {
        creatures: [makeCreature('a', 20), makeCreature('b', 7)],
        championVitals: { 1: makeVitals(80) },
        deadChampions: {},
    };
    const after = {
        creatures: [makeCreature('a', 5), makeCreature('b', 0, false)],
        championVitals: { 1: makeVitals(67) },
        deadChampions: { 1: true },
    };

    const delta = buildGameStatsTransitionDelta(before, after, 'magic');

    assert.equal(delta.combat?.damageDealt?.total, 22);
    assert.equal(delta.combat?.damageDealt?.magic, 22);
    assert.equal(delta.combat?.damageTaken?.total, 13);
    assert.equal(delta.combat?.damageTaken?.magic, 13);
    assert.equal(delta.combat?.monstersKilled, 1);
    assert.equal(delta.combat?.championsKilled, 1);
});

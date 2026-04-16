import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionCombat, DamageEvent } from '../src/engine/runtimeTypes.js';
import { tickCombatState } from '../src/engine/systems/combatTick.js';

const party: Champion[] = [
    {
        id: 1,
        name: 'Halk',
        title: 'Fighter',
        gender: 'M',
        class: 'Fighter',
        health: 60,
        stamina: 55,
        mana: 10,
        luck: 20,
        strength: 50,
        dexterity: 35,
        wisdom: 20,
        vitality: 45,
        antiMagic: 10,
        antiFire: 10,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: 'red',
        equipment: [],
        portrait: 'portrait.png',
    },
];

function createCombat(overrides: Partial<ChampionCombat> = {}): ChampionCombat {
    return {
        cooldown: 0,
        cooldownMax: 1,
        defenseModifier: 0,
        ...overrides,
    };
}

function createDamageEvent(overrides: Partial<DamageEvent> = {}): DamageEvent {
    return {
        id: 'dmg-1',
        level: 0,
        target: 'champion',
        championId: 1,
        amount: 4,
        ts: 0,
        ...overrides,
    };
}

test('tickCombatState decreases cooldowns and clears defense modifier when they expire', () => {
    const result = tickCombatState({
        party,
        championCombat: { 1: createCombat({ cooldown: 0.4, defenseModifier: 18 }) },
        damageEvents: [],
        delta: 0.5,
        now: 1000,
        damageEventLifetimeMs: 750,
    });

    assert.ok(result);
    assert.equal(result?.championCombat?.[1]?.cooldown, 0);
    assert.equal(result?.championCombat?.[1]?.defenseModifier, 0);
    assert.equal(result?.damageEvents, undefined);
});

test('tickCombatState keeps active defense modifier while cooldown is still running', () => {
    const result = tickCombatState({
        party,
        championCombat: { 1: createCombat({ cooldown: 1.5, defenseModifier: 12 }) },
        damageEvents: [],
        delta: 0.5,
        now: 1000,
        damageEventLifetimeMs: 750,
    });

    assert.ok(result);
    assert.equal(result?.championCombat?.[1]?.cooldown, 1);
    assert.equal(result?.championCombat?.[1]?.defenseModifier, 12);
});

test('tickCombatState prunes expired damage events and returns null when nothing changed', () => {
    const pruned = tickCombatState({
        party,
        championCombat: { 1: createCombat() },
        damageEvents: [
            createDamageEvent({ id: 'keep', ts: 700 }),
            createDamageEvent({ id: 'drop', ts: 100 }),
        ],
        delta: 0.25,
        now: 1000,
        damageEventLifetimeMs: 500,
    });

    assert.ok(pruned);
    assert.deepEqual(pruned?.damageEvents?.map((event) => event.id), ['keep']);

    const unchanged = tickCombatState({
        party,
        championCombat: { 1: createCombat() },
        damageEvents: [createDamageEvent({ id: 'keep', ts: 700 })],
        delta: 0.25,
        now: 1000,
        damageEventLifetimeMs: 500,
    });

    assert.equal(unchanged, null);
});

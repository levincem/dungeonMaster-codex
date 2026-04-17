import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionCombat, DamageEvent } from '../src/engine/runtimeTypes.js';
import {
    buildStoreCombatTickPatch,
    buildStoreTickDoorsPatch,
    buildStoreToggleDoorPatch,
} from '../src/engine/systems/storeDoorRuntime.js';

test('buildStoreToggleDoorPatch opens a closed door and clears an existing crush cycle', () => {
    const motions: Array<{ duration: number; volume: number }> = [];
    const result = buildStoreToggleDoorPatch(
        {
            level: 0,
            brokenDoors: new Set<string>(),
            openDoors: new Set<string>(),
            crushingDoors: { '0,5,6': { phase: 'closing', timer: 0.5 } },
            creatures: [],
        },
        6,
        5,
        {
            hasDoorButton: () => true,
            isDoorControlledByMechanism: () => false,
            isDoorLockedByWallSensor: () => false,
            playDoorMotion: (duration, volume) => motions.push({ duration, volume }),
            getDoorSoundVolume: () => 0.5,
            doorToggleSoundDurationMs: 1000,
            doorCloseDurationSeconds: 1,
        },
    );

    assert.deepEqual([...result.openDoors ?? []], ['0,5,6']);
    assert.deepEqual(result.crushingDoors, {});
    assert.deepEqual(motions, [{ duration: 1000, volume: 0.5 }]);
});

test('buildStoreTickDoorsPatch delegates door crush progress and emits damage', () => {
    const bumps: number[] = [];
    const result = buildStoreTickDoorsPatch(
        {
            crushingDoors: { '0,5,6': { phase: 'closing', timer: 0.1 } },
            openDoors: new Set<string>(),
            creatures: [{ id: 'creature-1', alive: true, mapIndex: 0, x: 6, y: 5, currentHP: 10 }],
            damageEvents: [],
        },
        0.2,
        {
            doorReboundDurationSeconds: 0.3,
            doorRecloseDurationSeconds: 0.4,
            buildCreatureDamageEvent: (_level, _x, _y, amount, creatureId) => ({ amount, creatureId }),
            playWallBump: () => {
                bumps.push(1);
            },
        },
    );

    assert.ok(result);
    assert.equal(result?.damageEvents?.length, 1);
    assert.equal(result?.crushingDoors?.['0,5,6']?.phase, 'bouncing');
    assert.equal(bumps.length, 1);
});

test('buildStoreCombatTickPatch delegates cleanup of expired damage events', () => {
    const champion: Champion = {
        id: 1,
        name: 'Test',
        title: 'Champion',
        gender: 'M',
        class: 'Fighter',
        health: 10,
        stamina: 10,
        mana: 0,
        luck: 10,
        strength: 10,
        dexterity: 10,
        wisdom: 10,
        vitality: 10,
        antiMagic: 0,
        antiFire: 0,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: 'test.png',
    };
    const combat: ChampionCombat = { cooldown: 0, cooldownMax: 1, defenseModifier: 0 };
    const damageEvent: DamageEvent = {
        id: 'old',
        level: 0,
        target: 'champion',
        championId: 1,
        amount: 1,
        ts: 0,
    };
    const result = buildStoreCombatTickPatch(
        {
            party: [champion],
            championCombat: { 1: combat },
            damageEvents: [damageEvent],
        },
        0.1,
        1000,
        200,
    );

    assert.ok(result);
    assert.deepEqual(result?.damageEvents, []);
});

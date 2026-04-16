import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tickCrushingDoors } from '../src/engine/systems/tickCrushingDoors.js';

type TestCreature = {
    id: string;
    alive: boolean;
    mapIndex: number;
    x: number;
    y: number;
    currentHP: number;
};

function createCreature(overrides: Partial<TestCreature> = {}): TestCreature {
    return {
        id: 'creature-1',
        alive: true,
        mapIndex: 2,
        x: 5,
        y: 4,
        currentHP: 10,
        ...overrides,
    };
}

test('tickCrushingDoors removes stale crush entries and closes the door when no blocker remains', () => {
    const patch = tickCrushingDoors(
        {
            crushingDoors: { '2,4,5': { phase: 'closing', timer: 0.2 } },
            openDoors: new Set(['2,4,5']),
            creatures: [],
            damageEvents: [],
        },
        0.1,
        {
            doorReboundDurationSeconds: 0.3,
            doorRecloseDurationSeconds: 0.5,
            buildCreatureDamageEvent: () => ({ id: 'unused' }),
            playWallBump: () => undefined,
        },
    );

    assert.ok(patch);
    assert.deepEqual(patch.crushingDoors, {});
    const openDoors = patch.openDoors;
    assert.ok(openDoors);
    assert.equal(openDoors.has('2,4,5'), false);
});

test('tickCrushingDoors bounces the door back open and damages the blocker when closing finishes', () => {
    let bumpCount = 0;
    const patch = tickCrushingDoors(
        {
            crushingDoors: { '2,4,5': { phase: 'closing', timer: 0.05 } },
            openDoors: new Set<string>(),
            creatures: [createCreature()],
            damageEvents: [],
        },
        0.1,
        {
            doorReboundDurationSeconds: 0.38,
            doorRecloseDurationSeconds: 0.5,
            buildCreatureDamageEvent: (level, x, y, amount, creatureId) => ({
                level,
                x,
                y,
                amount,
                creatureId,
            }),
            playWallBump: () => {
                bumpCount += 1;
            },
        },
    );

    assert.ok(patch);
    const crushingDoors = patch.crushingDoors;
    const openDoors = patch.openDoors;
    const creatures = patch.creatures;
    const damageEvents = patch.damageEvents;
    assert.ok(crushingDoors);
    assert.ok(openDoors);
    assert.ok(creatures);
    assert.ok(damageEvents);
    assert.equal(crushingDoors['2,4,5']?.phase, 'bouncing');
    assert.equal(crushingDoors['2,4,5']?.timer, 0.38);
    assert.equal(openDoors.has('2,4,5'), true);
    assert.equal(creatures[0]?.currentHP, 5);
    assert.deepEqual(damageEvents, [{ level: 2, x: 5, y: 4, amount: 5, creatureId: 'creature-1' }]);
    assert.equal(bumpCount, 1);
});

test('tickCrushingDoors restarts the closing phase after the bounce expires', () => {
    const patch = tickCrushingDoors(
        {
            crushingDoors: { '2,4,5': { phase: 'bouncing', timer: 0.05 } },
            openDoors: new Set(['2,4,5']),
            creatures: [createCreature()],
            damageEvents: [],
        },
        0.1,
        {
            doorReboundDurationSeconds: 0.38,
            doorRecloseDurationSeconds: 0.5,
            buildCreatureDamageEvent: () => ({ id: 'unused' }),
            playWallBump: () => undefined,
        },
    );

    assert.ok(patch);
    const crushingDoors = patch.crushingDoors;
    const openDoors = patch.openDoors;
    assert.ok(crushingDoors);
    assert.ok(openDoors);
    assert.equal(crushingDoors['2,4,5']?.phase, 'closing');
    assert.equal(crushingDoors['2,4,5']?.timer, 0.5);
    assert.equal(openDoors.has('2,4,5'), false);
});

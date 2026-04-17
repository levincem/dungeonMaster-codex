import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureInstance } from '../src/types/game.js';
import { resolveOriginalArchenemyDoubleMoveDestination } from '../src/engine/systems/originalArchenemyMovement.js';

function createCreature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
    return {
        id: 'chaos',
        typeId: 1,
        mapIndex: 0,
        x: 5,
        y: 5,
        currentHP: 100,
        alive: true,
        cell: 'frontLeft',
        carriedItems: [],
        ...overrides,
    };
}

test('resolveOriginalArchenemyDoubleMoveDestination skips intermediate validation and lands two tiles away', () => {
    const mover = createCreature();
    const result = resolveOriginalArchenemyDoubleMoveDestination(
        mover,
        0,
        5,
        5,
        'EAST',
        [mover],
        (_level, y, x) => x === 7 && y === 5,
        () => true,
    );

    assert.deepEqual(result, { x: 7, y: 5 });
});

test('resolveOriginalArchenemyDoubleMoveDestination rejects blocked destinations', () => {
    const mover = createCreature();
    const result = resolveOriginalArchenemyDoubleMoveDestination(
        mover,
        0,
        5,
        5,
        'NORTH',
        [mover],
        () => false,
        () => true,
    );

    assert.equal(result, null);
});

test('resolveOriginalArchenemyDoubleMoveDestination rejects saturated destination tiles', () => {
    const mover = createCreature();
    const result = resolveOriginalArchenemyDoubleMoveDestination(
        mover,
        0,
        5,
        5,
        'SOUTH',
        [mover],
        () => true,
        () => false,
    );

    assert.equal(result, null);
});

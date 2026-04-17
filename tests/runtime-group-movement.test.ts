import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    getRuntimeGroupMovementPlanKey,
    resolveSharedRuntimeGroupMovement,
} from '../src/engine/systems/runtimeGroupMovement.js';

test('getRuntimeGroupMovementPlanKey groups creatures by group id and source tile', () => {
    assert.equal(
        getRuntimeGroupMovementPlanKey({
            groupId: 'group-a',
            mapIndex: 2,
            x: 4,
            y: 7,
        }),
        'group-a|2|4|7',
    );

    assert.equal(
        getRuntimeGroupMovementPlanKey({
            mapIndex: 2,
            x: 4,
            y: 7,
        }),
        null,
    );
});

test('resolveSharedRuntimeGroupMovement reuses the first planned move for creatures sharing a tile group', () => {
    const plannedMoves = new Map();
    let computeCalls = 0;

    const first = resolveSharedRuntimeGroupMovement(
        {
            groupId: 'group-a',
            mapIndex: 2,
            x: 4,
            y: 7,
        },
        plannedMoves,
        () => {
            computeCalls += 1;
            return { kind: 'move' as const, x: 5, y: 7 };
        },
    );

    const second = resolveSharedRuntimeGroupMovement(
        {
            groupId: 'group-a',
            mapIndex: 2,
            x: 4,
            y: 7,
        },
        plannedMoves,
        () => {
            computeCalls += 1;
            return { kind: 'move' as const, x: 4, y: 8 };
        },
    );

    assert.deepEqual(first, { kind: 'move', x: 5, y: 7 });
    assert.deepEqual(second, { kind: 'move', x: 5, y: 7 });
    assert.equal(computeCalls, 1);
});

test('resolveSharedRuntimeGroupMovement keeps different tiles of the same group independent', () => {
    const plannedMoves = new Map();
    let computeCalls = 0;

    const first = resolveSharedRuntimeGroupMovement(
        {
            groupId: 'group-a',
            mapIndex: 2,
            x: 4,
            y: 7,
        },
        plannedMoves,
        () => {
            computeCalls += 1;
            return { kind: 'move' as const, x: 5, y: 7 };
        },
    );

    const second = resolveSharedRuntimeGroupMovement(
        {
            groupId: 'group-a',
            mapIndex: 2,
            x: 4,
            y: 8,
        },
        plannedMoves,
        () => {
            computeCalls += 1;
            return { kind: 'hold' as const };
        },
    );

    assert.deepEqual(first, { kind: 'move', x: 5, y: 7 });
    assert.deepEqual(second, { kind: 'hold' });
    assert.equal(computeCalls, 2);
});

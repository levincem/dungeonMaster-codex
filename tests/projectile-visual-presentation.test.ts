import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRID_SIZE } from '../src/engine/constants.js';
import { PHYSICAL_PROJECTILE_STEP_MS } from '../src/engine/time.js';
import {
    getPhysicalProjectileTravelProgress,
    resolvePhysicalProjectileLaunchPosition,
    resolvePhysicalProjectilePosition,
} from '../src/components/Dungeon/physicalProjectilePresentation.js';

test('getPhysicalProjectileTravelProgress spans the whole segment duration', () => {
    const nextMoveAt = 1000;
    assert.equal(getPhysicalProjectileTravelProgress(nextMoveAt, nextMoveAt - PHYSICAL_PROJECTILE_STEP_MS), 0);
    assert.equal(getPhysicalProjectileTravelProgress(nextMoveAt, nextMoveAt), 1);
});

test('resolvePhysicalProjectilePosition interpolates from the previous tile into the current tile', () => {
    const nextMoveAt = 1000;

    const halfway = resolvePhysicalProjectilePosition({
        x: 3,
        y: 2,
        direction: 'EAST',
        now: nextMoveAt - (PHYSICAL_PROJECTILE_STEP_MS / 2),
        nextMoveAt,
    });

    assert.deepEqual(halfway, [
        (2.5) * GRID_SIZE,
        GRID_SIZE * 0.14,
        2 * GRID_SIZE,
    ]);
});

test('resolvePhysicalProjectileLaunchPosition interpolates from the launch tile into the next tile', () => {
    const startedAt = 1000;

    const halfway = resolvePhysicalProjectileLaunchPosition({
        x: 3,
        y: 2,
        direction: 'EAST',
        now: startedAt + (PHYSICAL_PROJECTILE_STEP_MS / 2),
        startedAt,
    });

    assert.deepEqual(halfway, [
        (3.5) * GRID_SIZE,
        GRID_SIZE * 0.14,
        2 * GRID_SIZE,
    ]);
});

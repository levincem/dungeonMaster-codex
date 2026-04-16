import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    getDirectionStep,
    getOppositeDirection,
    getPrimaryDirectionTowardTarget,
    getSecondaryDirectionTowardTarget,
} from '../src/engine/systems/directionState.js';

test('getPrimaryDirectionTowardTarget prefers the dominant axis toward the target', () => {
    assert.equal(getPrimaryDirectionTowardTarget(5, 5, 8, 6), 'EAST');
    assert.equal(getPrimaryDirectionTowardTarget(5, 5, 4, 9), 'SOUTH');
    assert.equal(getPrimaryDirectionTowardTarget(5, 5, 2, 5), 'WEST');
});

test('getSecondaryDirectionTowardTarget returns the fallback axis toward the target', () => {
    assert.equal(getSecondaryDirectionTowardTarget(5, 5, 8, 6), 'SOUTH');
    assert.equal(getSecondaryDirectionTowardTarget(5, 5, 4, 9), 'WEST');
});

test('getDirectionStep and getOppositeDirection stay consistent for all cardinal directions', () => {
    assert.deepEqual(getDirectionStep('NORTH'), [0, -1]);
    assert.deepEqual(getDirectionStep('SOUTH'), [0, 1]);
    assert.deepEqual(getDirectionStep('EAST'), [1, 0]);
    assert.deepEqual(getDirectionStep('WEST'), [-1, 0]);
    assert.equal(getOppositeDirection('NORTH'), 'SOUTH');
    assert.equal(getOppositeDirection('SOUTH'), 'NORTH');
    assert.equal(getOppositeDirection('EAST'), 'WEST');
    assert.equal(getOppositeDirection('WEST'), 'EAST');
});

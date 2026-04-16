import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRID_SIZE } from '../src/engine/constants.js';
import { formatKeybinding, matchesKeybinding, normalizeBindingKey } from '../src/engine/options.js';
import { getCreatureCellOffsetXZ } from '../src/components/Dungeon/creatureCellOffsets.js';

test('normalizeBindingKey lowercases single characters only', () => {
    assert.equal(normalizeBindingKey('A'), 'a');
    assert.equal(normalizeBindingKey('ArrowUp'), 'ArrowUp');
});

test('matchesKeybinding normalizes keys consistently', () => {
    assert.equal(matchesKeybinding(['ArrowUp', 'z'], 'Z'), true);
    assert.equal(matchesKeybinding(['ArrowUp', 'z'], 'x'), false);
});

test('formatKeybinding renders arrows and letters for UI', () => {
    assert.equal(formatKeybinding(['ArrowUp', 'z']), '↑ / Z');
});

test('creature cell offsets keep centered creatures centered', () => {
    assert.deepEqual(getCreatureCellOffsetXZ('NORTH', 'center'), [0, 0]);
});

test('creature cell offsets rotate with party direction', () => {
    assert.deepEqual(getCreatureCellOffsetXZ('NORTH', 'frontLeft'), [GRID_SIZE * 0.22, -GRID_SIZE * 0.18]);
    assert.deepEqual(getCreatureCellOffsetXZ('EAST', 'frontLeft'), [GRID_SIZE * 0.18, GRID_SIZE * 0.22]);
    assert.deepEqual(getCreatureCellOffsetXZ('SOUTH', 'backRight'), [GRID_SIZE * 0.22, -GRID_SIZE * 0.18]);
});

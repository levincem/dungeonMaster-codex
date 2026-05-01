import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRID_SIZE } from '../src/engine/constants.js';
import { DEFAULT_KEYBINDINGS, formatKeybinding, matchesKeybinding, normalizeBindingKey } from '../src/engine/options.js';
import { getCreatureCellOffsetXZ } from '../src/components/Dungeon/creatureCellOffsets.js';

test('normalizeBindingKey lowercases single characters only', () => {
    assert.equal(normalizeBindingKey('A'), 'a');
    assert.equal(normalizeBindingKey('ArrowUp'), 'ArrowUp');
});

test('matchesKeybinding normalizes keys consistently', () => {
    assert.equal(matchesKeybinding(['ArrowUp', 'w'], 'W'), true);
    assert.equal(matchesKeybinding(['ArrowUp', 'w'], 'x'), false);
});

test('formatKeybinding renders arrows and letters for UI', () => {
    assert.equal(formatKeybinding(['ArrowUp', 'w']), '↑ / W');
});

test('default movement bindings use QWERTY letters while keeping arrows', () => {
    assert.deepEqual(DEFAULT_KEYBINDINGS, {
        moveForward: ['ArrowUp', 'w'],
        moveBackward: ['ArrowDown', 's'],
        turnLeft: ['ArrowLeft', 'a'],
        turnRight: ['ArrowRight', 'd'],
        strafeLeft: ['q'],
        strafeRight: ['e'],
    });
});

test('creature cell offsets keep centered creatures centered', () => {
    assert.deepEqual(getCreatureCellOffsetXZ('NORTH', 'center'), [0, 0]);
});

test('creature cell offsets rotate with party direction', () => {
    assert.deepEqual(getCreatureCellOffsetXZ('NORTH', 'frontLeft'), [GRID_SIZE * 0.22, -GRID_SIZE * 0.18]);
    assert.deepEqual(getCreatureCellOffsetXZ('EAST', 'frontLeft'), [GRID_SIZE * 0.18, GRID_SIZE * 0.22]);
    assert.deepEqual(getCreatureCellOffsetXZ('SOUTH', 'backRight'), [GRID_SIZE * 0.22, -GRID_SIZE * 0.18]);
});

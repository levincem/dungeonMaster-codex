import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_GAME_OPTIONS, normalizeGameOptions } from '../src/engine/options.js';

test('normalizeGameOptions restores defaults for legacy partial options', () => {
    const normalized = normalizeGameOptions({
        keybindings: {
            moveForward: ['w'],
        } as typeof DEFAULT_GAME_OPTIONS.keybindings,
    });

    assert.equal(normalized.showMinimap, false);
    assert.deepEqual(normalized.keybindings.moveForward, ['w']);
    assert.deepEqual(normalized.keybindings.turnRight, DEFAULT_GAME_OPTIONS.keybindings.turnRight);
});

test('normalizeGameOptions keeps explicit minimap preference', () => {
    const normalized = normalizeGameOptions({
        showMinimap: true,
        keybindings: DEFAULT_GAME_OPTIONS.keybindings,
    });

    assert.equal(normalized.showMinimap, true);
});

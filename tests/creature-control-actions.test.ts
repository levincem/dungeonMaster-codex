import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCreatureControlAction } from '../src/engine/systems/creatureControlActions.js';

test('resolveCreatureControlAction applies confuse timing and timer floors', () => {
    const result = resolveCreatureControlAction(
        'Confuse',
        1000,
        { mt: 0.25, at: 0.5 },
        { quantizeDurationMs: (durationMs) => durationMs + 10 },
    );

    assert.equal(result.expiresAt, 91010);
    assert.deepEqual(result.nextTimers, { mt: 0.75, at: 1.25 });
});

test('resolveCreatureControlAction applies fluxcage timing and preserves missing timers', () => {
    const result = resolveCreatureControlAction(
        'Fluxcage',
        200,
        undefined,
        { quantizeDurationMs: (durationMs) => durationMs },
    );

    assert.equal(result.expiresAt, 120200);
    assert.equal(result.nextTimers, undefined);
});

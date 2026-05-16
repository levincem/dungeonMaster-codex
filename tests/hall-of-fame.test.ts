import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHallOfFameEntry } from '../src/engine/hallOfFame.js';
import { createInitialGameStats } from '../src/engine/systems/gameStats.js';

test('buildHallOfFameEntry uses the persisted run id as the victory id', () => {
    const stats = createInitialGameStats(1_000);
    const entry = buildHallOfFameEntry('Test', stats, 2_000);

    assert.equal(entry.id, stats.runId);
    assert.equal(entry.stats.runId, stats.runId);
});

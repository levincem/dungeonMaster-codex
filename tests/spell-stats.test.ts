import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizePersistedSpellStatsName,
    resolveSpellStatsName,
} from '../src/engine/systems/spellStats.js';

test('resolveSpellStatsName keeps the canonical spell name for powered variants', () => {
    assert.equal(
        resolveSpellStatsName(['pal', 'oh', 'kath', 'ra'], 'Lightning Bolt (difficulty 5)'),
        'Lightning Bolt',
    );
});

test('resolveSpellStatsName falls back to the feedback message for unknown rune combinations', () => {
    assert.equal(
        resolveSpellStatsName(['lo', 'unknown'], 'Mystery Spell (difficulty 1)'),
        'Mystery Spell',
    );
});

test('normalizePersistedSpellStatsName strips descriptive suffixes back to the canonical spell name', () => {
    assert.equal(
        normalizePersistedSpellStatsName('Weaken Nonmaterial Beings - Launches a powerful spell against nonmaterial beings.'),
        'Weaken Nonmaterial Beings',
    );
    assert.equal(
        normalizePersistedSpellStatsName('Vi Potion fails.'),
        'Vi Potion',
    );
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSpellVisualSoundNames } from '../src/engine/systems/storeSpellRuntime.js';

test('resolveSpellVisualSoundNames maps new fireball and generic spell visuals to the original impact sounds', () => {
    const previous = [
        { id: 'existing-fire' },
    ];

    const next = [
        { id: 'existing-fire', effect: 'fireball' as const, kind: 'wall' as const },
        { id: 'new-fire', effect: 'fireball' as const, kind: 'wall' as const },
        { id: 'new-lightning', effect: 'lightning' as const, kind: 'creature' as const },
        { id: 'new-death', effect: 'poison_cloud' as const, kind: 'death' as const },
    ];

    assert.deepEqual(
        resolveSpellVisualSoundNames(previous, next),
        ['exploding_fireball', 'exploding_spell'],
    );
});

test('resolveSpellVisualSoundNames ignores recycled events, slime visuals, and death dust', () => {
    const previous = [
        { id: 'existing-open' },
    ];

    const next = [
        { id: 'existing-open', effect: 'open' as const, kind: 'wall' as const },
        { id: 'new-slime', effect: 'slime' as const, kind: 'creature' as const },
        { id: 'new-death', effect: 'fireball' as const, kind: 'death' as const },
    ];

    assert.deepEqual(resolveSpellVisualSoundNames(previous, next), []);
});

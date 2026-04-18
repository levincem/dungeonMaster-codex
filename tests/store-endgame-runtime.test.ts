import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStoreEndgameRuntime } from '../src/engine/systems/storeEndgameRuntime.js';

test('store endgame runtime builds deterministic spell events and poison clouds with injected ids', () => {
    const runtime = createStoreEndgameRuntime({
        quantizeMsToOriginalVbls: (value) => value + 1,
        getMap: () => ({ tiles: [[{ objects: [] }]] }),
        nowMs: () => 777,
        buildRandomToken: () => 'seeded',
    });

    assert.deepEqual(
        runtime.buildEndgameSpellEvent('fireball', 2, 3, 4, 55, 1.4),
        {
            id: 'endgame_fireball_55_seeded',
            level: 2,
            x: 3,
            y: 4,
            effect: 'fireball',
            visualScale: 1.4,
            ts: 55,
            kind: 'creature',
            height: 0.02,
        },
    );
    assert.deepEqual(
        runtime.buildActivePoisonCloud(2, 3, 4, 9, 12, 1.2),
        {
            id: 'poisoncloud_777_seeded',
            level: 2,
            x: 3,
            y: 4,
            remainingAttack: 9,
            nextPulseGameTick: 12,
            visualScale: 1.2,
        },
    );
    assert.equal(runtime.endgameFuseUpdateMs, 97);
    assert.equal(runtime.endgameMessageIntervalMs, 781);
    assert.equal(runtime.endgameFinalDelayMs, 601);
});

test('store endgame runtime extracts ordered endgame messages from the start tile text objects', () => {
    const runtime = createStoreEndgameRuntime({
        quantizeMsToOriginalVbls: (value) => value,
        getMap: () => ({
            tiles: [[{
                objects: [
                    { category: 'Text', text: 'B Second message' },
                    { category: 'Text', text: 'A First message' },
                    { category: 'Text', text: 'not ordered' },
                    { category: 'Door' },
                ],
            }]],
        }),
    });

    assert.deepEqual(runtime.getEndgameMessagesForMap(0), [
        'First message',
        'Second message',
    ]);
});

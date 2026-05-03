import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectCreatureFloorSensorTransitions } from '../src/engine/systems/creatureSensorTransitions.js';

test('collectCreatureFloorSensorTransitions treats creature death as leaving the current tile', () => {
    const transitions = collectCreatureFloorSensorTransitions(
        [{ id: 'mummy', mapIndex: 3, x: 7, y: 5, alive: true }],
        [{ id: 'mummy', mapIndex: 3, x: 7, y: 5, alive: false }],
    );

    assert.deepEqual(transitions, [{
        creatureId: 'mummy',
        type: 'leave',
        level: 3,
        x: 7,
        y: 5,
    }]);
});

test('collectCreatureFloorSensorTransitions keeps the existing leave then enter order for living movers', () => {
    const transitions = collectCreatureFloorSensorTransitions(
        [{ id: 'worm', mapIndex: 2, x: 4, y: 8, alive: true }],
        [{ id: 'worm', mapIndex: 2, x: 5, y: 8, alive: true }],
    );

    assert.deepEqual(transitions, [
        {
            creatureId: 'worm',
            type: 'leave',
            level: 2,
            x: 4,
            y: 8,
        },
        {
            creatureId: 'worm',
            type: 'enter',
            level: 2,
            x: 5,
            y: 8,
        },
    ]);
});

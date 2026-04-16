import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SensorObject } from '../src/types/game.js';
import { triggerWallPushSensors } from '../src/engine/systems/wallPushSensors.js';

function createSensor(overrides: Partial<SensorObject> = {}): SensorObject {
    return {
        category: 'Sensor',
        index: 4,
        tilePos: 'North',
        type: 6,
        data: 0,
        graphic: 0,
        isLocal: false,
        delay: 0,
        sound: true,
        revert: false,
        action: 'Set',
        onceOnly: false,
        targetY: 7,
        targetX: 8,
        targetDir: 'North',
        ...overrides,
    };
}

test('triggerWallPushSensors ignores non-push sensors and applies queued effects on the push face', () => {
    const matching = createSensor();
    const skippedButton = createSensor({ index: 5, type: 1 });
    const skippedOtherFace = createSensor({ index: 6, tilePos: 'East' });
    const doorTargets: Array<{ level: number; x: number; y: number } | null> = [];

    const result = triggerWallPushSensors<{ openDoors: Set<string> }, { level: number; sensorIndex: number; remaining: number }>(
        2,
        8,
        7,
        'NORTH',
        { openDoors: new Set<string>() },
        [],
        {
            getTile: () => ({ type: 'Wall', objects: [matching, skippedButton, skippedOtherFace] }),
            asSensor: (obj: unknown) => (obj && typeof obj === 'object' && 'category' in obj ? obj as SensorObject : null),
            resolvePushFace: () => 'North',
            isWallLockSensor: () => false,
            queueOrComputeSensorEffect: (_sensor, _level, _ss, pending) => ({
                sensorChanges: { openDoors: new Set(['2,7,8']) },
                pendingSensorEvents: [...pending, { level: 2, sensorIndex: 4, remaining: 1 }],
            }),
            resolveDoorSoundTarget: () => ({ level: 2, x: 8, y: 7 }),
            playDoorMotion: (target) => {
                doorTargets.push(target);
            },
            diffSensorState: (_before, after) => ({ openDoors: after.openDoors }),
        },
    );

    assert.deepEqual([...result.sensorChanges.openDoors!], ['2,7,8']);
    assert.deepEqual(result.pendingSensorEvents, [{ level: 2, sensorIndex: 4, remaining: 1 }]);
    assert.deepEqual(doorTargets, [{ level: 2, x: 8, y: 7 }]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SensorObject } from '../src/types/game.js';
import { getRequiredSensorItemName, isSpecificObjectFloorSensor } from '../src/data/mechanisms.js';

function createSensor(overrides: Partial<SensorObject> = {}): SensorObject {
    return {
        category: 'Sensor',
        index: 1,
        tilePos: 'North',
        type: 1,
        data: 0,
        graphic: 0,
        isLocal: false,
        delay: 0,
        sound: false,
        revert: false,
        action: 'Set',
        onceOnly: false,
        targetY: 0,
        targetX: 0,
        targetDir: 'North',
        ...overrides,
    };
}

test('isSpecificObjectFloorSensor accepts floor type 3 sensors that require a named object', () => {
    const compassPlate = createSensor({ type: 3, requiredObjectName: 'COMPASS' });
    const genericGroupPlate = createSensor({ type: 3 });
    const explicitObjectPlate = createSensor({ type: 4, requiredObjectName: 'Gold Key' });

    assert.equal(getRequiredSensorItemName(compassPlate), 'COMPASS');
    assert.equal(isSpecificObjectFloorSensor(compassPlate), true);
    assert.equal(isSpecificObjectFloorSensor(genericGroupPlate), false);
    assert.equal(isSpecificObjectFloorSensor(explicitObjectPlate), true);
});

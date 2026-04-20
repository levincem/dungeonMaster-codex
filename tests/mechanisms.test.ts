import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SensorObject } from '../src/types/game.js';
import { describeFloorSensor, getRequiredSensorItemName, isSpecificObjectFloorSensor } from '../src/data/mechanisms.js';

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

test('isSpecificObjectFloorSensor only treats floor type 4 as an object plate', () => {
    const partyPlate = createSensor({ type: 3, requiredObjectName: 'COMPASS' });
    const genericPartyPlate = createSensor({ type: 3 });
    const explicitObjectPlate = createSensor({ type: 4, requiredObjectName: 'Gold Key' });

    assert.equal(getRequiredSensorItemName(explicitObjectPlate), 'Gold Key');
    assert.equal(isSpecificObjectFloorSensor(partyPlate), false);
    assert.equal(isSpecificObjectFloorSensor(genericPartyPlate), false);
    assert.equal(isSpecificObjectFloorSensor(explicitObjectPlate), true);
});

test('describeFloorSensor distinguishes party presence from party orientation plates', () => {
    assert.equal(describeFloorSensor(createSensor({ type: 3, data: 0 })), 'Capteur de passage (party)');
    assert.equal(describeFloorSensor(createSensor({ type: 3, data: 2 })), 'Capteur d orientation (party)');
    assert.equal(describeFloorSensor(createSensor({ type: 4, data: 0 })), 'Dalle de pression (objet specifique)');
});

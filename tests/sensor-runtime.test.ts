import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CardinalDir, GameMap, SensorObject } from '../src/types/game.js';
import {
    getWallFaceSensorsInRuntimeOrder,
    getWallSensorRotationKey,
    hasWallFaceLocalRotationEffect,
    rotateWallFaceSensors,
    shouldRotateWallFaceAfterActivation,
} from '../src/engine/systems/sensorRuntime.js';

function createSensor(index: number, tilePos: CardinalDir, multipleValue?: number, isLocal = false): SensorObject {
    return {
        category: 'Sensor',
        index,
        tilePos,
        type: 1,
        data: 0,
        graphic: 0,
        isLocal,
        multipleValue,
        delay: 0,
        sound: false,
        revert: false,
        action: 'Set',
        onceOnly: false,
        targetY: 0,
        targetX: 0,
        targetDir: 'North',
    };
}

function createMapWithWallSensors(...sensors: SensorObject[]): GameMap {
    return {
        index: 0,
        name: 'Test',
        level: 0,
        width: 1,
        height: 1,
        difficulty: 0,
        tiles: [[{ x: 0, y: 0, type: 'Wall', objects: sensors }]],
    };
}

test('getWallFaceSensorsInRuntimeOrder applies rotation offsets cyclically', () => {
    const map = createMapWithWallSensors(
        createSensor(1, 'North'),
        createSensor(2, 'North'),
        createSensor(3, 'North'),
    );
    const mapResolver = () => map;

    assert.deepEqual(
        getWallFaceSensorsInRuntimeOrder(0, 0, 0, 'North', {}, mapResolver).map((sensor) => sensor.index),
        [1, 2, 3],
    );
    assert.deepEqual(
        getWallFaceSensorsInRuntimeOrder(
            0,
            0,
            0,
            'North',
            { [getWallSensorRotationKey(0, 0, 0, 'North')]: 1 },
            mapResolver,
        ).map((sensor) => sensor.index),
        [2, 3, 1],
    );
});

test('rotateWallFaceSensors advances offsets and resets back to identity', () => {
    const map = createMapWithWallSensors(createSensor(1, 'North'), createSensor(2, 'North'));
    const mapResolver = () => map;
    const key = getWallSensorRotationKey(0, 0, 0, 'North');

    const rotatedOnce = rotateWallFaceSensors(0, 0, 0, 'North', {}, mapResolver);
    assert.deepEqual(rotatedOnce, { [key]: 1 });

    const rotatedTwice = rotateWallFaceSensors(0, 0, 0, 'North', rotatedOnce, mapResolver);
    assert.deepEqual(rotatedTwice, {});
});

test('hasWallFaceLocalRotationEffect only matches local rotating sensors', () => {
    assert.equal(hasWallFaceLocalRotationEffect(createSensor(1, 'North', 1, true)), true);
    assert.equal(hasWallFaceLocalRotationEffect(createSensor(2, 'North', 2, true)), true);
    assert.equal(hasWallFaceLocalRotationEffect(createSensor(3, 'North', 0, true)), false);
    assert.equal(hasWallFaceLocalRotationEffect(createSensor(4, 'North', 1, false)), false);
});

test('shouldRotateWallFaceAfterActivation only returns true when a local rotating sensor is present on the face', () => {
    const rotatingMap = createMapWithWallSensors(
        createSensor(1, 'North', 1, true),
        createSensor(2, 'East', 1, true),
    );
    const staticMap = createMapWithWallSensors(createSensor(3, 'North', 0, false));

    assert.equal(shouldRotateWallFaceAfterActivation(0, 0, 0, 'North', {}, () => rotatingMap), true);
    assert.equal(shouldRotateWallFaceAfterActivation(0, 0, 0, 'South', {}, () => rotatingMap), false);
    assert.equal(shouldRotateWallFaceAfterActivation(0, 0, 0, 'North', {}, () => staticMap), false);
});

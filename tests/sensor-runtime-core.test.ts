import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CardinalDir, GameMap, SensorObject } from '../src/types/game.js';
import {
    buildSensorStateSnapshot,
    buildWallLauncherProjectiles,
    findSensorPlacement,
    getSensorStateKey,
    readWallSensorRuntimeData,
    writeWallSensorRuntimeData,
} from '../src/engine/systems/sensorRuntimeCore.js';

function createSensor(
    index: number,
    tilePos: CardinalDir,
    overrides: Partial<SensorObject> = {},
): SensorObject {
    return {
        category: 'Sensor',
        index,
        tilePos,
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

function createMap(width: number, height: number, sensor?: SensorObject): GameMap {
    return {
        index: 0,
        name: 'Test',
        level: 0,
        width,
        height,
        difficulty: 1,
        tiles: Array.from({ length: height }, (_, y) =>
            Array.from({ length: width }, (_, x) => ({
                x,
                y,
                type: sensor && x === 1 && y === 1 ? 'Wall' : 'Floor',
                objects: sensor && x === 1 && y === 1 ? [sensor] : [],
            })),
        ),
    };
}

test('getSensorStateKey and buildSensorStateSnapshot return stable defaults', () => {
    assert.equal(getSensorStateKey(2, 7), '2_7');

    const snapshot = buildSensorStateSnapshot({
        level: 3,
        position: [4, 5],
        elapsedGameTimeTicks: 12,
    });

    assert.equal(snapshot.currentLevel, 3);
    assert.deepEqual(snapshot.currentPosition, [4, 5]);
    assert.equal(snapshot.elapsedGameTimeTicks, 12);
    assert.equal(snapshot.openDoors.size, 0);
    assert.equal(snapshot.projectiles.length, 0);
    assert.equal(snapshot.creatures.length, 0);
});

test('readWallSensorRuntimeData and writeWallSensorRuntimeData preserve sensor defaults', () => {
    const sensor = createSensor(9, 'North', { data: 3 });

    assert.equal(readWallSensorRuntimeData(0, sensor, {}), 3);

    const updated = writeWallSensorRuntimeData(0, sensor, {}, 5);
    assert.deepEqual(updated, { '0_9': 5 });
    assert.equal(readWallSensorRuntimeData(0, sensor, updated), 5);

    const restored = writeWallSensorRuntimeData(0, sensor, updated, 3);
    assert.deepEqual(restored, {});
});

test('findSensorPlacement returns the sensor tile coordinates', () => {
    const sensor = createSensor(4, 'West');
    const map = createMap(3, 3, sensor);

    const placement = findSensorPlacement(0, 4, () => map);

    assert.ok(placement);
    assert.equal(placement.x, 1);
    assert.equal(placement.y, 1);
    assert.equal(placement.tile.type, 'Wall');
    assert.equal(placement.sensor.index, 4);
});

test('buildWallLauncherProjectiles creates explosion projectiles from wall launchers', () => {
    const sensor = createSensor(11, 'East', {
        type: 8,
        data: 2,
        kineticEnergy: 5,
        stepEnergy: 1,
    });
    const map = createMap(4, 4, sensor);

    const projectiles = buildWallLauncherProjectiles(0, 1, 1, sensor, 1000, () => map);

    assert.equal(projectiles.length, 1);
    assert.equal(projectiles[0]?.x, 2);
    assert.equal(projectiles[0]?.y, 1);
    assert.equal(projectiles[0]?.direction, 'EAST');
    assert.equal(projectiles[0]?.effect, 'lightning');
    assert.equal(projectiles[0]?.visualScale, 1.04);
});

test('buildWallLauncherProjectiles creates physical item launchers with drops', () => {
    const sensor = createSensor(12, 'South', {
        type: 9,
        data: 55,
        kineticEnergy: 6,
        stepEnergy: 0,
    });
    const map = createMap(4, 4, sensor);

    const projectiles = buildWallLauncherProjectiles(
        0,
        1,
        1,
        sensor,
        2000,
        () => map,
        () => ({ rawName: 'Poison Dart', baseDamage: 4 }),
    );

    assert.equal(projectiles.length, 2);
    assert.equal(projectiles[0]?.effect, 'physical');
    assert.equal(projectiles[0]?.direction, 'SOUTH');
    assert.equal(projectiles[0]?.physicalItem?.category, 'Weapon');
    assert.equal(projectiles[0]?.physicalItem?.typeId, 31);
});

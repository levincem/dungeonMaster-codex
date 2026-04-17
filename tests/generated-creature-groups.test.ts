import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createGeneratedCreatureGroupInstances,
    getCreatureTileCapacity,
    getGeneratedCreatureCellsForOccupancy,
} from '../src/engine/systems/generatedCreatureGroups.js';

test('getCreatureTileCapacity follows original size buckets', () => {
    assert.equal(getCreatureTileCapacity(0), 4);
    assert.equal(getCreatureTileCapacity(1), 2);
    assert.equal(getCreatureTileCapacity(2), 1);
    assert.equal(getCreatureTileCapacity(3), 1);
});

test('getGeneratedCreatureCellsForOccupancy rotates half-tile and quarter-tile groups', () => {
    assert.deepEqual(getGeneratedCreatureCellsForOccupancy(2, 2, 0), ['frontLeft', 'frontRight']);
    assert.deepEqual(getGeneratedCreatureCellsForOccupancy(2, 2, 1), ['frontRight', 'frontLeft']);
    assert.deepEqual(
        getGeneratedCreatureCellsForOccupancy(4, 4, 1),
        ['frontRight', 'backRight', 'backLeft', 'frontLeft'],
    );
});

test('createGeneratedCreatureGroupInstances clamps the group to tile capacity and registers timers', () => {
    const registeredTimers: Array<{ id: string; mt: number; at: number }> = [];

    const creatures = createGeneratedCreatureGroupInstances(
        2,
        5,
        6,
        12,
        3,
        4,
        'group-1',
        {
            getCreatureDefinition: () => ({
                baseHP: 20,
                moveSpd: 12,
                atkSpd: 18,
                sizeOnTile: 1,
            }),
            getEffectiveHealthMultiplier: () => 2,
            randomInt: () => 0,
            createCreatureId: (_level, _x, _y, _typeId, ordinal) => `generated-${ordinal}`,
            registerCreatureTimers: (id, timers) => {
                registeredTimers.push({ id, ...timers });
            },
            createCreature: (args) => ({
                ...args,
                alive: true,
                carriedItems: [],
            }),
        },
    );

    assert.equal(creatures.length, 2);
    assert.deepEqual(
        creatures.map((creature) => creature.cell),
        ['frontLeft', 'frontRight'],
    );
    assert.deepEqual(
        creatures.map((creature) => creature.currentHP),
        [40, 40],
    );
    assert.equal(registeredTimers.length, 2);
    assert.equal(registeredTimers[0]?.id, 'generated-0');
});

test('createGeneratedCreatureGroupInstances returns an empty list when the creature type is unknown', () => {
    const creatures = createGeneratedCreatureGroupInstances(
        0,
        1,
        1,
        99,
        0,
        2,
        'group-x',
        {
            getCreatureDefinition: () => undefined,
            getEffectiveHealthMultiplier: () => 1,
            randomInt: () => 0,
            createCreatureId: () => 'unused',
            createCreature: (args) => args,
        },
    );

    assert.deepEqual(creatures, []);
});

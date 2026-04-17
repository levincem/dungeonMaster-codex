import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    canMaterializeReservedGeneratorSpawnOnLevel,
    canReserveApproximateGeneratorGroupOnLevel,
    collectRuntimeGroupsOnLevel,
    getApproximateActiveGroupCountOnLevel,
    getApproximateGeneratorOccupiedGroupCountOnLevel,
    getApproximateReservedGeneratorGroupCountOnLevel,
    getRuntimeGroupCapacitySnapshotOnLevel,
} from '../src/engine/systems/generatorCapacity.js';

test('getApproximateActiveGroupCountOnLevel counts unique live groups on the requested level', () => {
    const count = getApproximateActiveGroupCountOnLevel(2, [
        { alive: true, mapIndex: 2, x: 1, y: 1, groupId: 'group-a' },
        { alive: true, mapIndex: 2, x: 1, y: 1, groupId: 'group-a' },
        { alive: true, mapIndex: 2, x: 4, y: 5, groupId: 'group-b' },
        { alive: false, mapIndex: 2, x: 4, y: 5, groupId: 'group-c' },
        { alive: true, mapIndex: 3, x: 4, y: 5, groupId: 'group-d' },
    ]);

    assert.equal(count, 2);
});

test('getApproximateReservedGeneratorGroupCountOnLevel counts pending generator group reservations', () => {
    const count = getApproximateReservedGeneratorGroupCountOnLevel(2, [
        { spawnLevel: 2, spawnX: 1, spawnY: 1, groupId: 'pending-a' },
        { spawnLevel: 2, spawnX: 1, spawnY: 1, groupId: 'pending-a' },
        { spawnLevel: 2, spawnX: 2, spawnY: 2, groupId: 'pending-b' },
        { spawnLevel: 3, spawnX: 2, spawnY: 2, groupId: 'pending-c' },
    ]);

    assert.equal(count, 2);
});

test('getApproximateGeneratorOccupiedGroupCountOnLevel combines live and pending generator groups', () => {
    const count = getApproximateGeneratorOccupiedGroupCountOnLevel(
        2,
        [
            { alive: true, mapIndex: 2, x: 1, y: 1, groupId: 'group-a' },
            { alive: true, mapIndex: 2, x: 4, y: 5, groupId: 'group-b' },
        ],
        [
            { spawnLevel: 2, spawnX: 3, spawnY: 3, groupId: 'pending-a' },
            { spawnLevel: 2, spawnX: 4, spawnY: 4, groupId: 'pending-b' },
        ],
    );

    assert.equal(count, 4);
});

test('collectRuntimeGroupsOnLevel builds explicit alive and reserved runtime group records', () => {
    const records = collectRuntimeGroupsOnLevel(
        2,
        [
            { alive: true, mapIndex: 2, x: 1, y: 1, groupId: 'group-a' },
            { alive: true, mapIndex: 2, x: 1, y: 1, groupId: 'group-a' },
            { alive: true, mapIndex: 2, x: 3, y: 4 },
        ],
        [
            { spawnLevel: 2, spawnX: 6, spawnY: 7, groupId: 'pending-a' },
            { spawnLevel: 2, spawnX: 6, spawnY: 7, groupId: 'pending-a' },
        ],
    );

    assert.deepEqual(records, [
        {
            groupId: 'group-a',
            level: 2,
            lifecycle: 'alive',
            memberCount: 2,
            tileKeys: ['2,1,1'],
            hasExplicitGroupId: true,
        },
        {
            groupId: 'tile_3,4',
            level: 2,
            lifecycle: 'alive',
            memberCount: 1,
            tileKeys: ['2,3,4'],
            hasExplicitGroupId: false,
        },
        {
            groupId: 'pending-a',
            level: 2,
            lifecycle: 'reserved',
            memberCount: 2,
            tileKeys: ['2,6,7'],
            hasExplicitGroupId: true,
        },
    ]);
});

test('getRuntimeGroupCapacitySnapshotOnLevel keeps active, reserved and occupied counts distinct', () => {
    const snapshot = getRuntimeGroupCapacitySnapshotOnLevel(
        2,
        [
            { alive: true, mapIndex: 2, x: 1, y: 1, groupId: 'group-a' },
            { alive: true, mapIndex: 2, x: 2, y: 2, groupId: 'group-b' },
        ],
        [
            { spawnLevel: 2, spawnX: 6, spawnY: 7, groupId: 'pending-a' },
            { spawnLevel: 2, spawnX: 8, spawnY: 9, groupId: 'pending-b' },
            { spawnLevel: 2, spawnX: 10, spawnY: 11, groupId: 'pending-c' },
        ],
    );

    assert.deepEqual(snapshot, {
        activeGroups: 2,
        reservedGroups: 3,
        occupiedGroups: 5,
    });
});

test('canReserveApproximateGeneratorGroupOnLevel keeps a five-slot margin for new groups', () => {
    assert.equal(
        canReserveApproximateGeneratorGroupOnLevel(
            2,
            Array.from({ length: 55 }, (_, index) => ({
                alive: true,
                mapIndex: 2,
                x: index,
                y: 0,
                groupId: `group-${index}`,
            })),
            [],
        ),
        false,
    );

    assert.equal(
        canReserveApproximateGeneratorGroupOnLevel(
            2,
            Array.from({ length: 54 }, (_, index) => ({
                alive: true,
                mapIndex: 2,
                x: index,
                y: 0,
                groupId: `group-${index}`,
            })),
            Array.from({ length: 5 }, (_, index) => ({
                spawnLevel: 2,
                spawnX: index,
                spawnY: 1,
                groupId: `pending-${index}`,
            })),
        ),
        false,
    );
});

test('canMaterializeReservedGeneratorSpawnOnLevel allows a reserved group to resolve within total slot capacity', () => {
    assert.equal(
        canMaterializeReservedGeneratorSpawnOnLevel(
            2,
            Array.from({ length: 55 }, (_, index) => ({
                alive: true,
                mapIndex: 2,
                x: index,
                y: 0,
                groupId: `group-${index}`,
            })),
            [{ spawnLevel: 2, spawnX: 0, spawnY: 1, groupId: 'pending-a' }],
        ),
        true,
    );
});

test('off-level generator capacity checks still apply the spawn-level capacity snapshot', () => {
    const crowdedCreatures = Array.from({ length: 60 }, (_, index) => ({
        alive: true,
        mapIndex: 2,
        x: index,
        y: 0,
        groupId: `group-${index}`,
    }));

    assert.equal(
        canReserveApproximateGeneratorGroupOnLevel(
            2,
            crowdedCreatures,
            [],
        ),
        false,
    );

    assert.equal(
        canMaterializeReservedGeneratorSpawnOnLevel(
            2,
            crowdedCreatures,
            [{ spawnLevel: 2, spawnX: 0, spawnY: 1, groupId: 'pending-a' }],
        ),
        false,
    );
});

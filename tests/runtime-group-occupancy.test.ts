import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canCreatureShareRuntimeTile } from '../src/engine/systems/runtimeGroupOccupancy.js';

type TestCreature = {
    id: string;
    alive: boolean;
    mapIndex: number;
    x: number;
    y: number;
    typeId: number;
    groupId?: string;
};

const getTileCapacity = (occupants: readonly TestCreature[]) =>
    occupants[0]?.typeId === 99 ? 1 : 4;

test('canCreatureShareRuntimeTile allows creatures from the same runtime group to share a tile', () => {
    const mover: TestCreature = {
        id: 'a',
        alive: true,
        mapIndex: 2,
        x: 5,
        y: 5,
        typeId: 3,
        groupId: 'group-a',
    };
    const occupants: TestCreature[] = [
        mover,
        {
            id: 'b',
            alive: true,
            mapIndex: 2,
            x: 6,
            y: 5,
            typeId: 3,
            groupId: 'group-a',
        },
    ];

    assert.equal(
        canCreatureShareRuntimeTile(mover, 2, 6, 5, occupants, getTileCapacity),
        true,
    );
});

test('canCreatureShareRuntimeTile blocks merging two different runtime groups on one tile', () => {
    const mover: TestCreature = {
        id: 'a',
        alive: true,
        mapIndex: 2,
        x: 5,
        y: 5,
        typeId: 3,
        groupId: 'group-a',
    };
    const occupants: TestCreature[] = [
        mover,
        {
            id: 'b',
            alive: true,
            mapIndex: 2,
            x: 6,
            y: 5,
            typeId: 3,
            groupId: 'group-b',
        },
    ];

    assert.equal(
        canCreatureShareRuntimeTile(mover, 2, 6, 5, occupants, getTileCapacity),
        false,
    );
});

test('canCreatureShareRuntimeTile blocks tiles that already contain mixed runtime groups', () => {
    const mover: TestCreature = {
        id: 'a',
        alive: true,
        mapIndex: 2,
        x: 5,
        y: 5,
        typeId: 3,
        groupId: 'group-a',
    };
    const occupants: TestCreature[] = [
        mover,
        {
            id: 'b',
            alive: true,
            mapIndex: 2,
            x: 6,
            y: 5,
            typeId: 3,
            groupId: 'group-b',
        },
        {
            id: 'c',
            alive: true,
            mapIndex: 2,
            x: 6,
            y: 5,
            typeId: 3,
            groupId: 'group-c',
        },
    ];

    assert.equal(
        canCreatureShareRuntimeTile(mover, 2, 6, 5, occupants, getTileCapacity),
        false,
    );
});

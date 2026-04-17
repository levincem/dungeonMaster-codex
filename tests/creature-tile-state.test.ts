import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureCell } from '../src/types/game.js';
import {
    getCreatureCellsForOccupancy,
    getTileCapacityForCreatures,
    isCreatureCellOccupiedOnTile,
    normalizeCreatureCells,
    normalizeCreatureCellsOnTile,
} from '../src/engine/systems/creatureTileState.js';

type TestCreature = {
    id: string;
    alive: boolean;
    mapIndex: number;
    x: number;
    y: number;
    typeId: number;
    cell: CreatureCell;
};

function createCreature(id: string, overrides: Partial<TestCreature> = {}): TestCreature {
    return {
        id,
        alive: true,
        mapIndex: 0,
        x: 5,
        y: 5,
        typeId: 1,
        cell: 'center',
        ...overrides,
    };
}

const getCreatureTileCapacity = (typeId: number) => {
    if (typeId === 2) return 2;
    if (typeId === 3) return 1;
    return 4;
};

test('getTileCapacityForCreatures uses the tightest occupant capacity', () => {
    const creatures = [
        createCreature('a', { typeId: 1 }),
        createCreature('b', { typeId: 2 }),
        createCreature('c', { typeId: 3 }),
    ];

    assert.equal(getTileCapacityForCreatures(creatures, getCreatureTileCapacity), 1);
});

test('getCreatureCellsForOccupancy maps counts to expected cells', () => {
    assert.deepEqual(getCreatureCellsForOccupancy(1, 4), ['center']);
    assert.deepEqual(getCreatureCellsForOccupancy(2, 2), ['frontLeft', 'frontRight']);
    assert.deepEqual(
        getCreatureCellsForOccupancy(4, 4),
        ['frontLeft', 'frontRight', 'backLeft', 'backRight'],
    );
});

test('normalizeCreatureCellsOnTile reorders living occupants into canonical cells', () => {
    const creatures = [
        createCreature('b', { cell: 'backRight' }),
        createCreature('a', { cell: 'frontRight' }),
        createCreature('c', { cell: 'frontLeft' }),
    ];

    const normalized = normalizeCreatureCellsOnTile(creatures, 0, 5, 5, getCreatureTileCapacity);

    assert.deepEqual(
        normalized.map((creature) => [creature.id, creature.cell]),
        [
            ['b', 'backLeft'],
            ['a', 'frontRight'],
            ['c', 'frontLeft'],
        ],
    );
});

test('normalizeCreatureCells applies normalization tile by tile', () => {
    const creatures = [
        createCreature('a', { x: 1, y: 1, cell: 'backRight' }),
        createCreature('b', { x: 1, y: 1, cell: 'center' }),
        createCreature('c', { x: 2, y: 2, cell: 'backLeft', typeId: 2 }),
        createCreature('d', { x: 2, y: 2, cell: 'frontLeft', typeId: 2 }),
    ];

    const normalized = normalizeCreatureCells(creatures, getCreatureTileCapacity);

    assert.deepEqual(
        normalized.map((creature) => [creature.id, creature.cell]),
        [
            ['a', 'frontRight'],
            ['b', 'frontLeft'],
            ['c', 'frontRight'],
            ['d', 'frontLeft'],
        ],
    );
});

test('isCreatureCellOccupiedOnTile ignores the mover and only checks matching alive occupants', () => {
    const mover = createCreature('a', { cell: 'frontLeft' });
    const creatures = [
        mover,
        createCreature('b', { cell: 'frontRight' }),
        createCreature('dead', { alive: false, cell: 'backLeft' }),
    ];

    assert.equal(isCreatureCellOccupiedOnTile(creatures, mover, 'frontRight'), true);
    assert.equal(isCreatureCellOccupiedOnTile(creatures, mover, 'backLeft'), false);
});

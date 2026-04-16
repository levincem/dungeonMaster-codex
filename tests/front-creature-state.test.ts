import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureInstance } from '../src/types/game.js';
import {
    creaturesInFront,
    getCreatureColumn,
    isCreatureContactCell,
    selectFrontCreatureTarget,
} from '../src/engine/systems/frontCreatureState.js';

function createCreature(
    id: string,
    overrides: Partial<CreatureInstance> = {},
): CreatureInstance {
    return {
        id,
        typeId: 1,
        mapIndex: 0,
        x: 5,
        y: 4,
        currentHP: 10,
        alive: true,
        cell: 'frontLeft',
        ...overrides,
    };
}

test('getCreatureColumn and isCreatureContactCell classify creature cells consistently', () => {
    assert.equal(getCreatureColumn('frontLeft'), 'left');
    assert.equal(getCreatureColumn('backRight'), 'right');
    assert.equal(getCreatureColumn('center'), 'center');
    assert.equal(isCreatureContactCell('frontRight'), true);
    assert.equal(isCreatureContactCell('backLeft'), false);
});

test('selectFrontCreatureTarget prefers contact creatures in the requested column', () => {
    const front = [
        createCreature('back-left', { cell: 'backLeft' }),
        createCreature('front-right', { cell: 'frontRight' }),
        createCreature('front-left', { cell: 'frontLeft' }),
    ];

    assert.equal(selectFrontCreatureTarget(front, 'left')?.id, 'front-left');
    assert.equal(selectFrontCreatureTarget(front, 'right')?.id, 'front-right');
});

test('creaturesInFront filters the tile ahead and sorts by contact priority', () => {
    const creatures = [
        createCreature('behind', { x: 5, y: 5 }),
        createCreature('back-right', { cell: 'backRight' }),
        createCreature('center', { cell: 'center' }),
        createCreature('front-right', { cell: 'frontRight' }),
        createCreature('dead-front-left', { cell: 'frontLeft', alive: false }),
    ];

    const result = creaturesInFront(0, [5, 5], 'NORTH', creatures);

    assert.deepEqual(result.map((creature) => creature.id), ['center', 'front-right', 'back-right']);
});

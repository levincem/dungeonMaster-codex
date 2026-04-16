import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { CreatureInstance } from '../src/types/game.js';
import { getChampionPreferredColumn, resolveAttackFrontContext } from '../src/engine/systems/attackFrontContext.js';

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champion ${id}`,
        title: 'The Tester',
        gender: 'M',
        class: 'Fighter',
        health: 100,
        stamina: 100,
        mana: 10,
        luck: 10,
        strength: 10,
        dexterity: 10,
        wisdom: 10,
        vitality: 10,
        antiMagic: 0,
        antiFire: 0,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: 'portrait.png',
    };
}

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
        currentHP: 20,
        alive: true,
        cell: 'frontLeft',
        ...overrides,
    };
}

test('getChampionPreferredColumn maps party slots to original left/right columns', () => {
    const party = [createChampion(1), createChampion(2), createChampion(3), createChampion(4)];

    assert.equal(getChampionPreferredColumn(party, 1), 'left');
    assert.equal(getChampionPreferredColumn(party, 2), 'right');
    assert.equal(getChampionPreferredColumn(party, 3), 'left');
    assert.equal(getChampionPreferredColumn(party, 4), 'right');
});

test('resolveAttackFrontContext returns the front creatures and the preferred target for the acting champion', () => {
    const party = [createChampion(1), createChampion(2)];
    const creatures = [
        createCreature('back-right', { cell: 'backRight' }),
        createCreature('front-right', { cell: 'frontRight' }),
        createCreature('front-left', { cell: 'frontLeft' }),
    ];

    const leftContext = resolveAttackFrontContext(0, [5, 5], 'NORTH', creatures, party, 1);
    const rightContext = resolveAttackFrontContext(0, [5, 5], 'NORTH', creatures, party, 2);

    assert.deepEqual(leftContext.front.map((creature) => creature.id), ['front-left', 'front-right', 'back-right']);
    assert.equal(leftContext.target?.id, 'front-left');
    assert.equal(rightContext.target?.id, 'front-right');
});

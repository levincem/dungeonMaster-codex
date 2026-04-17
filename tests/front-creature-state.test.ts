import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureInstance } from '../src/types/game.js';
import {
    creaturesInFront,
    getCreatureColumn,
    isCreatureContactCell,
    resolveCreatureContactAdvance,
    selectCreatureAttackTarget,
    selectFrontCreatureTarget,
} from '../src/engine/systems/frontCreatureState.js';
import type { Champion } from '../src/types/champion.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';

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

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champ ${id}`,
        title: 'The Target',
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
        antiMagic: 10,
        antiFire: 10,
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

function createVitals(hp: number): ChampionVitals {
    return {
        hp,
        stamina: 50,
        mana: 10,
        food: 900,
        water: 900,
        currentStats: {
            luck: 10,
            strength: 10,
            dexterity: 10,
            wisdom: 10,
            vitality: 10,
            antiMagic: 10,
            antiFire: 10,
        },
        wounds: {
            rightHand: false,
            leftHand: false,
            head: false,
            torso: false,
            legs: false,
            feet: false,
        },
        poisonEntries: [],
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

test('selectCreatureAttackTarget follows column priority and skips dead champions', () => {
    const party = [createChampion(1), createChampion(2), createChampion(3), createChampion(4)];
    const vitals = {
        1: createVitals(0),
        2: createVitals(20),
        3: createVitals(10),
        4: createVitals(5),
    };

    assert.equal(selectCreatureAttackTarget(party, vitals, 'frontLeft')?.id, 2);
    assert.equal(selectCreatureAttackTarget(party, vitals, 'frontRight')?.id, 2);
});

test('selectCreatureAttackTarget uses the attacker position to favor the champions exposed on that side', () => {
    const party = [createChampion(1), createChampion(2), createChampion(3), createChampion(4)];
    const vitals = {
        1: createVitals(20),
        2: createVitals(20),
        3: createVitals(20),
        4: createVitals(20),
    };

    const frontTarget = selectCreatureAttackTarget(
        party,
        vitals,
        'backLeft',
        false,
        false,
        () => 0,
        {
            partyPosition: [5, 5],
            attackerPosition: { x: 5, y: 4 },
            partyDirection: 'NORTH',
        },
    );
    const backTarget = selectCreatureAttackTarget(
        party,
        vitals,
        'backLeft',
        false,
        false,
        () => 0,
        {
            partyPosition: [5, 5],
            attackerPosition: { x: 5, y: 6 },
            partyDirection: 'NORTH',
        },
    );
    const leftTarget = selectCreatureAttackTarget(
        party,
        vitals,
        'frontLeft',
        false,
        false,
        () => 0,
        {
            partyPosition: [5, 5],
            attackerPosition: { x: 4, y: 5 },
            partyDirection: 'NORTH',
        },
    );

    assert.equal(frontTarget?.id, 1);
    assert.equal(backTarget?.id, 3);
    assert.equal(leftTarget?.id, 1);
});

test('selectCreatureAttackTarget can pick any living champion for all-sides attacks', () => {
    const party = [createChampion(1), createChampion(2)];
    const vitals = {
        1: createVitals(0),
        2: createVitals(20),
    };

    const target = selectCreatureAttackTarget(
        party,
        vitals,
        'frontLeft',
        true,
        false,
        () => 0,
    );

    assert.equal(target?.id, 2);
});

test('resolveCreatureContactAdvance moves a back-row creature into the preferred front contact cell', () => {
    const creature = createCreature('rear', { cell: 'backRight' });

    const result = resolveCreatureContactAdvance(
        creature,
        [creature],
        {
            frightened: false,
            movedThisTick: false,
            adjacentAfterMove: true,
            attackReach: 1,
            creatureSizeOnTile: 0,
        },
        {
            isCreatureCellOccupiedOnTile: () => false,
            nextMonsterMoveDelaySeconds: () => 0.6,
        },
    );

    assert.deepEqual(result, { targetCell: 'frontRight', nextMoveTimer: 0.3 });
});

test('resolveCreatureContactAdvance returns null when the creature cannot advance into contact', () => {
    const creature = createCreature('rear', { cell: 'backLeft' });

    const result = resolveCreatureContactAdvance(
        creature,
        [creature],
        {
            frightened: false,
            movedThisTick: false,
            adjacentAfterMove: true,
            attackReach: 1,
            creatureSizeOnTile: 0,
        },
        {
            isCreatureCellOccupiedOnTile: () => true,
            nextMonsterMoveDelaySeconds: () => 0.6,
        },
    );

    assert.equal(result, null);
});

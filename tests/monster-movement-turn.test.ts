import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureInstance } from '../src/types/game.js';
import { resolveMonsterMovementTurn } from '../src/engine/systems/monsterMovementTurn.js';

function createCreature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
    return {
        id: 'creature-1',
        typeId: 1,
        mapIndex: 0,
        x: 5,
        y: 4,
        currentHP: 12,
        alive: true,
        cell: 'frontLeft',
        carriedItems: [],
        ...overrides,
    };
}

const baseDeps = {
    randomInt: () => 0,
    monsterWalkable: () => true,
    canCreatureShareTile: () => true,
    canArchenemyDoubleMove: () => null,
    nextMonsterMoveDelaySeconds: () => 0.6,
};

test('resolveMonsterMovementTurn skips the turn when fluxcaged but still refreshes the move timer', () => {
    const creature = createCreature();

    const result = resolveMonsterMovementTurn(
        {
            creature,
            creatures: [creature],
            groupMovementPlans: new Map(),
            canDetectParty: true,
            rememberedTarget: null,
            partyPosition: [5, 5],
            currentDistance: 1,
            adjacent: false,
            frightened: false,
            confused: false,
            fluxcaged: true,
            prefersRangedSpacing: false,
            attackReach: 1,
            isArchenemy: false,
            currentMoveTimer: 0,
            moveSpeed: 10,
        },
        baseDeps,
    );

    assert.equal(result.kind, 'skipTurn');
    assert.equal(result.moveTimer, 0.6);
    assert.equal(result.movedThisTick, false);
    assert.equal(result.x, creature.x);
    assert.equal(result.y, creature.y);
});

test('resolveMonsterMovementTurn skips the turn when ranged spacing resolves to hold', () => {
    const creature = createCreature();

    const result = resolveMonsterMovementTurn(
        {
            creature,
            creatures: [creature],
            groupMovementPlans: new Map(),
            canDetectParty: true,
            rememberedTarget: null,
            partyPosition: [5, 5],
            currentDistance: 2,
            adjacent: false,
            frightened: false,
            confused: false,
            fluxcaged: false,
            prefersRangedSpacing: true,
            attackReach: 2,
            isArchenemy: false,
            currentMoveTimer: 0,
            moveSpeed: 10,
        },
        baseDeps,
    );

    assert.equal(result.kind, 'skipTurn');
    assert.equal(result.moveTimer, 0.6);
    assert.equal(result.movedThisTick, false);
});

test('resolveMonsterMovementTurn reuses a shared movement plan for a grouped creature', () => {
    const first = createCreature({ id: 'g1-a', groupId: 'g1' });
    const second = createCreature({ id: 'g1-b', groupId: 'g1' });
    const groupPlans = new Map();

    const firstResult = resolveMonsterMovementTurn(
        {
            creature: first,
            creatures: [first, second],
            groupMovementPlans: groupPlans,
            canDetectParty: true,
            rememberedTarget: null,
            partyPosition: [5, 7],
            currentDistance: 3,
            adjacent: false,
            frightened: false,
            confused: false,
            fluxcaged: false,
            prefersRangedSpacing: false,
            attackReach: 1,
            isArchenemy: false,
            currentMoveTimer: 0,
            moveSpeed: 10,
        },
        baseDeps,
    );

    const secondResult = resolveMonsterMovementTurn(
        {
            creature: second,
            creatures: [first, second],
            groupMovementPlans: groupPlans,
            canDetectParty: true,
            rememberedTarget: null,
            partyPosition: [5, 7],
            currentDistance: 3,
            adjacent: false,
            frightened: false,
            confused: false,
            fluxcaged: false,
            prefersRangedSpacing: false,
            attackReach: 1,
            isArchenemy: false,
            currentMoveTimer: 0,
            moveSpeed: 10,
        },
        baseDeps,
    );

    assert.equal(firstResult.kind, 'move');
    assert.equal(secondResult.kind, 'move');
    assert.deepEqual(
        { x: secondResult.x, y: secondResult.y, usesTeleport: secondResult.usesTeleport },
        { x: firstResult.x, y: firstResult.y, usesTeleport: firstResult.usesTeleport },
    );
});

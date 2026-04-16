import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureInstance } from '../src/types/game.js';
import { resolveCreatureMovementState } from '../src/engine/systems/creatureMovementState.js';

function createCreature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
    return {
        id: 'creature-1',
        typeId: 1,
        mapIndex: 0,
        x: 5,
        y: 5,
        currentHP: 20,
        alive: true,
        cell: 'frontLeft',
        carriedItems: [],
        ...overrides,
    };
}

test('resolveCreatureMovementState picks the farthest flee option when frightened', () => {
    const result = resolveCreatureMovementState(
        {
            creature: createCreature(),
            canDetectParty: true,
            rememberedTarget: null,
            partyPosition: [5, 7],
            currentDistance: 2,
            frightened: true,
            prefersRangedSpacing: false,
            attackReach: 1,
            isArchenemy: false,
        },
        {
            randomInt: () => 0,
            monsterWalkable: () => true,
            tileAvailable: () => true,
            canArchenemyDoubleMove: () => null,
        },
    );

    assert.deepEqual(result, { kind: 'move', x: 4, y: 5 });
});

test('resolveCreatureMovementState returns hold when a ranged creature already has spacing', () => {
    const result = resolveCreatureMovementState(
        {
            creature: createCreature(),
            canDetectParty: true,
            rememberedTarget: null,
            partyPosition: [5, 7],
            currentDistance: 2,
            frightened: false,
            prefersRangedSpacing: true,
            attackReach: 3,
            isArchenemy: false,
        },
        {
            randomInt: () => 0,
            monsterWalkable: () => true,
            tileAvailable: () => true,
            canArchenemyDoubleMove: () => null,
        },
    );

    assert.deepEqual(result, { kind: 'hold' });
});

test('resolveCreatureMovementState falls back to patrol movement when direct chase is blocked', () => {
    const blocked = new Set(['6,5', '5,6']);
    const result = resolveCreatureMovementState(
        {
            creature: createCreature(),
            canDetectParty: true,
            rememberedTarget: null,
            partyPosition: [7, 7],
            currentDistance: 4,
            frightened: false,
            prefersRangedSpacing: false,
            attackReach: 1,
            isArchenemy: false,
        },
        {
            randomInt: () => 0,
            monsterWalkable: (_level, y, x) => !blocked.has(`${x},${y}`),
            tileAvailable: () => true,
            canArchenemyDoubleMove: () => null,
        },
    );

    assert.deepEqual(result, { kind: 'move', x: 4, y: 5 });
});

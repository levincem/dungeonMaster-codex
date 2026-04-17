import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureInstance, GameTile, TeleporterObject } from '../src/types/game.js';
import { resolveMonsterDestinationTurn } from '../src/engine/systems/monsterDestinationTurn.js';

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
    getTile: () => undefined as GameTile | undefined,
    getTeleporter: () => undefined as TeleporterObject | undefined,
    resolveCreatureTeleporterTransport: () => ({ level: 0, x: 7, y: 4, cell: 'frontRight' as const }),
    monsterWalkable: () => true,
    canCreatureShareTile: () => true,
    normalizeCreatureCellsOnTile: (creatures: CreatureInstance[]) => creatures,
};

test('resolveMonsterDestinationTurn keeps the same array when the creature stays on its source tile', () => {
    const creature = createCreature();
    const creatures = [creature];

    const result = resolveMonsterDestinationTurn(
        {
            creature,
            creatures,
            creatureIndex: 0,
            destination: { mapIndex: 0, x: creature.x, y: creature.y },
            openTeleporters: new Set(),
        },
        baseDeps,
    );

    assert.equal(result.creatures, creatures);
    assert.equal(result.destinationMapIndex, creature.mapIndex);
    assert.equal(result.x, creature.x);
    assert.equal(result.y, creature.y);
    assert.equal(result.cell, creature.cell);
});

test('resolveMonsterDestinationTurn updates the creature and normalizes both source and destination tiles', () => {
    const creature = createCreature();
    const creatures = [creature];
    const normalizeCalls: Array<[number, number, number]> = [];

    const result = resolveMonsterDestinationTurn(
        {
            creature,
            creatures,
            creatureIndex: 0,
            destination: { mapIndex: 0, x: 6, y: 4 },
            openTeleporters: new Set(),
        },
        {
            ...baseDeps,
            normalizeCreatureCellsOnTile: (nextCreatures, level, x, y) => {
                normalizeCalls.push([level, x, y]);
                return nextCreatures;
            },
        },
    );

    assert.notEqual(result.creatures, creatures);
    assert.equal(result.creatures[0]?.x, 6);
    assert.equal(result.creatures[0]?.y, 4);
    assert.equal(result.destinationMapIndex, 0);
    assert.deepEqual(normalizeCalls, [
        [0, 5, 4],
        [0, 6, 4],
    ]);
});

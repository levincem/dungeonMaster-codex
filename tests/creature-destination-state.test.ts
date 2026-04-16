import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureInstance, GameTile, TeleporterObject } from '../src/types/game.js';
import { resolveCreatureDestinationState } from '../src/engine/systems/creatureDestinationState.js';

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

function createTeleporterTile(): GameTile {
    return {
        x: 6,
        y: 5,
        type: 'Teleporter',
        objects: [{
            category: 'Teleporter',
            index: 0,
            tilePos: 'North',
            sound: false,
            scope: 'global',
            destMap: 1,
            destX: 2,
            destY: 3,
            rotation: 'North',
            rotationType: 0,
        } satisfies TeleporterObject],
    };
}

test('resolveCreatureDestinationState keeps the current destination when the tile is not a teleporter', () => {
    const result = resolveCreatureDestinationState(
        {
            creature: createCreature(),
            destination: { mapIndex: 0, x: 6, y: 5 },
            movementDirection: 'EAST',
            openTeleporters: new Set<string>(),
        },
        {
            getTile: () => ({ x: 6, y: 5, type: 'Floor', objects: [] }),
            getTeleporter: () => undefined,
            resolveCreatureTeleporterTransport: () => {
                throw new Error('teleporter transport should not run');
            },
            monsterWalkable: () => true,
            canCreatureShareTile: () => true,
        },
    );

    assert.deepEqual(result, {
        mapIndex: 0,
        x: 6,
        y: 5,
        cell: 'frontLeft',
    });
});

test('resolveCreatureDestinationState applies open teleporter transport when the landing is valid', () => {
    const result = resolveCreatureDestinationState(
        {
            creature: createCreature(),
            destination: { mapIndex: 0, x: 6, y: 5 },
            movementDirection: 'EAST',
            openTeleporters: new Set<string>(['0,5,6']),
        },
        {
            getTile: () => createTeleporterTile(),
            getTeleporter: (tile) => tile.objects[0] as TeleporterObject,
            resolveCreatureTeleporterTransport: () => ({
                level: 1,
                x: 2,
                y: 3,
                cell: 'backRight',
            }),
            monsterWalkable: () => true,
            canCreatureShareTile: () => true,
        },
    );

    assert.deepEqual(result, {
        mapIndex: 1,
        x: 2,
        y: 3,
        cell: 'backRight',
    });
});

test('resolveCreatureDestinationState ignores teleporter transport when the landing is blocked', () => {
    const result = resolveCreatureDestinationState(
        {
            creature: createCreature(),
            destination: { mapIndex: 0, x: 6, y: 5 },
            movementDirection: 'EAST',
            openTeleporters: new Set<string>(['0,5,6']),
        },
        {
            getTile: () => createTeleporterTile(),
            getTeleporter: (tile) => tile.objects[0] as TeleporterObject,
            resolveCreatureTeleporterTransport: () => ({
                level: 1,
                x: 2,
                y: 3,
                cell: 'backRight',
            }),
            monsterWalkable: () => false,
            canCreatureShareTile: () => true,
        },
    );

    assert.deepEqual(result, {
        mapIndex: 0,
        x: 6,
        y: 5,
        cell: 'frontLeft',
    });
});

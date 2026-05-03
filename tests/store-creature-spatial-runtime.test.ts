import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureInstance, GameMap, GameTile } from '../src/types/game.js';
import { createStoreCreatureSpatialRuntime } from '../src/engine/systems/storeCreatureSpatialRuntime.js';

function createFloorTile(x: number, y: number): GameTile {
    return {
        x,
        y,
        type: 'Floor',
        objects: [],
    };
}

function createDoorTile(x: number, y: number, doorType: number): GameTile {
    return {
        x,
        y,
        type: 'Door',
        objects: [{
            category: 'Door',
            index: 0,
            tilePos: 'North',
            destructChop: false,
            destructFire: false,
            hasButton: false,
            openDirection: 'Horizontal',
            ornate: 0,
            doorType,
        }],
    };
}

function createMap(tiles: GameTile[][]): GameMap {
    return {
        index: 0,
        name: 'Test Map',
        level: 0,
        width: tiles[0]?.length ?? 0,
        height: tiles.length,
        difficulty: 1,
        tiles,
    };
}

function createCreature(overrides: Partial<CreatureInstance>): CreatureInstance {
    return {
        id: 'creature',
        typeId: 1,
        mapIndex: 0,
        x: 0,
        y: 0,
        currentHP: 10,
        alive: true,
        cell: 'center',
        carriedItems: [],
        ...overrides,
    };
}

test('store creature spatial runtime builds stable init ids and seeded generator ids', () => {
    const runtime = createStoreCreatureSpatialRuntime({
        creatureTypes: {},
        now: () => 123,
        buildRandomToken: () => 'seeded',
    });

    assert.equal(runtime.buildRuntimeCreatureGroupId('init', 1, 2, 3, 4), 'init_1_2_3_4');
    assert.equal(
        runtime.buildRuntimeCreatureGroupId('generator', 1, 2, 3, 4),
        'generator_1_2_3_4_123_seeded',
    );
});

test('store creature spatial runtime normalizes tile cells and enforces same-group sharing rules', () => {
    const runtime = createStoreCreatureSpatialRuntime({
        creatureTypes: {
            1: { sizeOnTile: 1 },
        },
    });
    const creatures = [
        createCreature({ id: 'a', groupId: 'group-1', cell: 'center' }),
        createCreature({ id: 'b', groupId: 'group-1', cell: 'center' }),
    ];

    const normalized = runtime.normalizeCreatureCells(creatures);

    assert.deepEqual(
        normalized.map((creature) => creature.cell),
        ['frontLeft', 'frontRight'],
    );
    assert.equal(runtime.isCreatureCellOccupiedOnTile(normalized, normalized[0]!, 'frontRight'), true);
    assert.equal(
        runtime.canCreatureShareTile(
            createCreature({ id: 'c', groupId: 'group-1' }),
            0,
            0,
            0,
            normalized,
        ),
        false,
    );
    assert.equal(
        runtime.canCreatureShareTile(
            createCreature({ id: 'c', groupId: 'group-2' }),
            0,
            0,
            0,
            normalized,
        ),
        false,
    );
});

test('store creature spatial runtime resolves original archenemy double move through the shared tile rules', () => {
    const runtime = createStoreCreatureSpatialRuntime({
        creatureTypes: {
            1: { sizeOnTile: 0 },
        },
    });
    const mover = createCreature({ id: 'mover', groupId: 'group-1', x: 2, y: 2 });

    assert.deepEqual(
        runtime.resolveArchenemyDoubleMoveDestinationOriginal(
            mover,
            0,
            2,
            2,
            'EAST',
            [],
            () => true,
        ),
        { x: 4, y: 2 },
    );
    assert.equal(
        runtime.resolveArchenemyDoubleMoveDestinationOriginal(
            mover,
            0,
            2,
            2,
            'EAST',
            [createCreature({ id: 'blocker', groupId: 'other', x: 4, y: 2 })],
            () => true,
        ),
        null,
    );
});

test('store creature spatial runtime line of sight respects walls and closed vision-blocking doors', () => {
    const runtime = createStoreCreatureSpatialRuntime({
        creatureTypes: {},
        getDoorObject: (tile) =>
            tile.type === 'Door'
                ? { doorType: 7 }
                : null,
        doorBlocksVision: (doorType) => doorType === 7,
    });
    const mapWithDoor = createMap([[
        createFloorTile(0, 0),
        createDoorTile(1, 0, 7),
        createFloorTile(2, 0),
    ]]);
    const mapWithWall = createMap([[
        createFloorTile(0, 0),
        { ...createFloorTile(1, 0), type: 'Wall' },
        createFloorTile(2, 0),
    ]]);

    assert.equal(runtime.hasLineOfSight(mapWithDoor, 0, new Set<string>(), new Set<string>(), 0, 0, 2, 0), false);
    assert.equal(
        runtime.hasLineOfSight(mapWithDoor, 0, new Set<string>(['0,0,1']), new Set<string>(), 0, 0, 2, 0),
        true,
    );
    assert.equal(runtime.hasLineOfSight(mapWithWall, 0, new Set<string>(), new Set<string>(), 0, 0, 2, 0), false);
});

test('store creature spatial runtime line of sight does not slip through diagonal wall corners', () => {
    const runtime = createStoreCreatureSpatialRuntime({
        creatureTypes: {},
    });
    const map = createMap([
        [
            createFloorTile(0, 0),
            createFloorTile(1, 0),
            createFloorTile(2, 0),
        ],
        [
            createFloorTile(0, 1),
            { ...createFloorTile(1, 1), type: 'Wall' },
            createFloorTile(2, 1),
        ],
        [
            createFloorTile(0, 2),
            createFloorTile(1, 2),
            createFloorTile(2, 2),
        ],
    ]);

    assert.equal(runtime.hasLineOfSight(map, 0, new Set<string>(), new Set<string>(), 0, 0, 2, 2), false);
});

test('store creature spatial runtime line of sight respects closed and opened trick walls', () => {
    const runtime = createStoreCreatureSpatialRuntime({
        creatureTypes: {},
    });
    const mapWithTrickWall = createMap([[
        createFloorTile(0, 0),
        { ...createFloorTile(1, 0), type: 'TrickWall' },
        createFloorTile(2, 0),
    ]]);

    assert.equal(
        runtime.hasLineOfSight(mapWithTrickWall, 0, new Set<string>(), new Set<string>(), 0, 0, 2, 0),
        false,
    );
    assert.equal(
        runtime.hasLineOfSight(mapWithTrickWall, 0, new Set<string>(), new Set<string>(['0,0,1']), 0, 0, 2, 0),
        true,
    );
});

test('store creature spatial runtime line of sight treats imaginary trick walls as already passable', () => {
    const runtime = createStoreCreatureSpatialRuntime({
        creatureTypes: {},
    });
    const mapWithImaginaryTrickWall = createMap([[
        createFloorTile(0, 0),
        { ...createFloorTile(1, 0), type: 'TrickWall', imaginary: true },
        createFloorTile(2, 0),
    ]]);

    assert.equal(
        runtime.hasLineOfSight(mapWithImaginaryTrickWall, 0, new Set<string>(), new Set<string>(), 0, 0, 2, 0),
        true,
    );
});

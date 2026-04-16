import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameTile, TeleporterObject } from '../src/types/game.js';
import {
    getTeleporter,
    getTeleporterRotationDirection,
    getTeleporterRotationQuarterTurns,
    resolveCreatureTeleporterTransport,
    resolvePitLanding,
    resolveProjectileTeleporterTransport,
    rotateCreatureCell,
} from '../src/engine/systems/terrainTransport.js';

function createTeleporterTile(
    x: number,
    y: number,
    teleporter: Partial<TeleporterObject> = {},
): GameTile {
    return {
        x,
        y,
        type: 'Teleporter',
        objects: [{
            category: 'Teleporter',
            index: teleporter.index ?? 1,
            tilePos: teleporter.tilePos ?? 'North',
            sound: teleporter.sound ?? false,
            scope: teleporter.scope ?? 'local',
            rotationType: teleporter.rotationType ?? 0,
            rotation: teleporter.rotation ?? 'North',
            destX: teleporter.destX ?? x,
            destY: teleporter.destY ?? y,
            destMap: teleporter.destMap ?? 0,
        }],
    };
}

test('getTeleporter returns the teleporter object from a teleporter tile', () => {
    const tile = createTeleporterTile(1, 2, { index: 9 });
    assert.equal(getTeleporter(tile)?.index, 9);
});

test('teleporter rotation resolves using explicit and original runtime metadata', () => {
    const teleporter = createTeleporterTile(0, 0, { rotationType: 0, rotation: 'East' }).objects[0] as TeleporterObject;

    assert.equal(
        getTeleporterRotationDirection(0, 0, 0, teleporter, 'NORTH', () => null),
        'EAST',
    );
    assert.equal(
        getTeleporterRotationDirection(0, 0, 0, { ...teleporter, rotationType: 1, rotation: 'South' }, 'EAST', () => null),
        'SOUTH',
    );
    assert.equal(
        getTeleporterRotationDirection(
            0,
            0,
            0,
            {
                ...teleporter,
                rotationType: undefined,
                rotation: undefined,
            } as unknown as TeleporterObject,
            'WEST',
            () => ({ rotationType: 1, rotation: 'East' }),
        ),
        'EAST',
    );
    assert.equal(
        getTeleporterRotationQuarterTurns(0, 0, 0, teleporter, 'NORTH', () => null),
        1,
    );
});

test('rotateCreatureCell rotates quadrant cells while preserving center', () => {
    assert.equal(rotateCreatureCell('center', 3), 'center');
    assert.equal(rotateCreatureCell('frontLeft', 1), 'frontRight');
    assert.equal(rotateCreatureCell('frontLeft', 2), 'backRight');
    assert.equal(rotateCreatureCell('frontLeft', 3), 'backLeft');
});

test('resolveProjectileTeleporterTransport follows open teleporter chains', () => {
    const tiles = new Map<string, GameTile>([
        ['0,1,1', createTeleporterTile(1, 1, { index: 10, rotationType: 0, rotation: 'East', destMap: 1, destX: 2, destY: 3 })],
        ['1,3,2', createTeleporterTile(2, 3, { index: 20, rotationType: 1, rotation: 'South', destMap: 2, destX: 4, destY: 5 })],
    ]);

    const result = resolveProjectileTeleporterTransport(
        { openTeleporters: new Set(['0,1,1', '1,3,2']) },
        0,
        1,
        1,
        'NORTH',
        {
            getTile: (level, x, y) => tiles.get(`${level},${y},${x}`),
            getOriginalTeleporterRuntime: () => null,
        },
    );

    assert.deepEqual(result, { level: 2, x: 4, y: 5, direction: 'SOUTH' });
});

test('resolveCreatureTeleporterTransport rotates both direction and creature cell', () => {
    const tiles = new Map<string, GameTile>([
        ['0,1,1', createTeleporterTile(1, 1, { index: 30, rotationType: 0, rotation: 'East', destMap: 0, destX: 2, destY: 2 })],
    ]);

    const result = resolveCreatureTeleporterTransport(
        { openTeleporters: new Set(['0,1,1']) },
        0,
        1,
        1,
        'NORTH',
        'frontLeft',
        {
            getTile: (level, x, y) => tiles.get(`${level},${y},${x}`),
            getOriginalTeleporterRuntime: () => null,
        },
    );

    assert.deepEqual(result, {
        level: 0,
        x: 2,
        y: 2,
        direction: 'EAST',
        cell: 'frontRight',
    });
});

test('resolvePitLanding falls through chained open pits until a walkable landing tile', () => {
    const tiles = new Map<string, GameTile>([
        ['1,4,3', { x: 3, y: 4, type: 'Pit', objects: [] }],
        ['2,4,3', { x: 3, y: 4, type: 'Pit', objects: [] }],
        ['3,4,3', { x: 3, y: 4, type: 'Floor', objects: [] }],
    ]);

    const result = resolvePitLanding(
        1,
        4,
        3,
        new Set<string>(),
        new Set<string>(),
        new Set(['1,4,3', '2,4,3']),
        {
            getTile: (level, x, y) => tiles.get(`${level},${y},${x}`),
            isWalkable: (level, y, x) => level === 3 && y === 4 && x === 3,
        },
    );

    assert.deepEqual(result, { level: 3, y: 4, x: 3 });
    assert.equal(
        resolvePitLanding(
            1,
            4,
            3,
            new Set<string>(),
            new Set<string>(),
            new Set(['1,4,3', '2,4,3']),
            {
                getTile: (level, x, y) => tiles.get(`${level},${y},${x}`),
                isWalkable: () => false,
            },
        ),
        null,
    );
});

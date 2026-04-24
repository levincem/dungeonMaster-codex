import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameTile, TeleporterObject } from '../src/types/game.js';
import {
    resolveCreatureTeleporterTransport,
    resolveProjectileTeleporterTransport,
} from '../src/engine/systems/terrainTransport.js';

function createTeleporterTile(overrides: Partial<TeleporterObject> = {}): GameTile {
    return {
        x: 13,
        y: 16,
        type: 'Teleporter',
        open: true,
        visible: true,
        objects: [{
            category: 'Teleporter',
            index: 16,
            tilePos: 'North',
            sound: false,
            scope: 'Items',
            destMap: 1,
            destX: 14,
            destY: 14,
            rotationType: 0,
            rotation: 'North',
            ...overrides,
        } satisfies TeleporterObject],
    };
}

test('resolveProjectileTeleporterTransport does not move the party through an item-only teleporter', () => {
    const result = resolveProjectileTeleporterTransport(
        { openTeleporters: new Set(['1,16,13']) },
        1,
        13,
        16,
        'SOUTH',
        {
            getTile: () => createTeleporterTile(),
            getOriginalTeleporterRuntime: () => ({ scope: 'Items', rotationType: 0, rotation: 'North' }),
            isCreatureAllowedOnMap: () => true,
            getCreatureWariness: () => 0,
        },
        'party',
    );

    assert.deepEqual(result, {
        level: 1,
        x: 13,
        y: 16,
        direction: 'SOUTH',
    });
});

test('resolveProjectileTeleporterTransport still moves items through an item-only teleporter', () => {
    const result = resolveProjectileTeleporterTransport(
        { openTeleporters: new Set(['1,16,13']) },
        1,
        13,
        16,
        'NORTH',
        {
            getTile: () => createTeleporterTile(),
            getOriginalTeleporterRuntime: () => ({ scope: 'Items', rotationType: 0, rotation: 'North' }),
            isCreatureAllowedOnMap: () => true,
            getCreatureWariness: () => 0,
        },
    );

    assert.deepEqual(result, {
        level: 1,
        x: 14,
        y: 14,
        direction: 'NORTH',
    });
});

test('resolveCreatureTeleporterTransport ignores an item-only teleporter for creatures', () => {
    const result = resolveCreatureTeleporterTransport(
        { openTeleporters: new Set(['1,16,13']) },
        1,
        13,
        16,
        'EAST',
        'frontLeft',
        12,
        {
            getTile: () => createTeleporterTile(),
            getOriginalTeleporterRuntime: () => ({ scope: 'Items', rotationType: 0, rotation: 'North' }),
            isCreatureAllowedOnMap: () => true,
            getCreatureWariness: () => 0,
        },
    );

    assert.deepEqual(result, {
        level: 1,
        x: 13,
        y: 16,
        direction: 'EAST',
        cell: 'frontLeft',
    });
});

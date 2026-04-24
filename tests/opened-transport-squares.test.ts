import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureInstance, FloorItem, GameTile } from '../src/types/game.js';
import type { SpellVisualEvent } from '../src/engine/runtimeTypes.js';
import { applyOpenedTeleporterEffects } from '../src/engine/systems/openedTransportSquares.js';

function createCreature(id: string, overrides: Partial<CreatureInstance> = {}): CreatureInstance {
    return {
        id,
        typeId: 1,
        mapIndex: 0,
        x: 1,
        y: 1,
        currentHP: 30,
        alive: true,
        cell: 'center',
        ...overrides,
    };
}

function createTeleporterTile(x: number, y: number, destMap: number, destX: number, destY: number): GameTile {
    return {
        x,
        y,
        type: 'Teleporter',
        objects: [{
            category: 'Teleporter',
            index: 1,
            tilePos: 'North',
            sound: false,
            scope: 'local',
            rotationType: 0,
            rotation: 'North',
            destMap,
            destX,
            destY,
        }],
    };
}

test('applyOpenedTeleporterEffects moves the party through newly opened teleporters and applies telefrag', () => {
    const floorItems: FloorItem[] = [];
    const spellVisualEvents: SpellVisualEvent[] = [];

    const result = applyOpenedTeleporterEffects(
        {
            level: 0,
            position: [4, 5],
            direction: 'NORTH',
            hydratedLevels: new Set<number>([0]),
            creatures: [createCreature('c1')],
            floorItems,
            spellVisualEvents,
            openDoors: new Set<string>(),
            openWalls: new Set<string>(),
            openPits: new Set<string>(),
            openTeleporters: new Set<string>(['0,4,5']),
            championInventories: {},
            championEquipment: {},
            pendingSensorEvents: [],
        },
        ['0,4,5'],
        {
            getTile: (level, x, y) => level === 0 && x === 5 && y === 4 ? createTeleporterTile(x, y, 1, 7, 8) : undefined,
            getTeleporter: (tile) => tile.objects[0]?.category === 'Teleporter' ? tile.objects[0] : undefined,
            resolveProjectileTeleporterTransport: () => ({ level: 1, x: 7, y: 8, direction: 'EAST' }),
            applyPartyTelefragAtSquare: () => ({
                creatures: [createCreature('c1', { mapIndex: 1, x: 7, y: 8, alive: false, currentHP: 0 })],
                floorItems: [{ id: 'loot-1', category: 'Misc', typeId: 1, mapIndex: 1, x: 7, y: 8, tilePos: 'North' }],
                spellVisualEvents: [{ id: 'fx-1', level: 1, x: 7, y: 8, effect: 'fireball', ts: 0, kind: 'death' }],
            }),
            buildLevelHydrationPatch: () => null,
            applyCreaturesStandingOnOpenTeleporter: () => null,
        },
    );

    assert.equal(result.changed, true);
    assert.deepEqual(result.position, [8, 7]);
    assert.equal(result.level, 1);
    assert.equal(result.direction, 'EAST');
    assert.equal(result.floorItems.length, 1);
    assert.equal(result.spellVisualEvents.length, 1);
});

test('applyOpenedTeleporterEffects also applies creature teleports on opened squares', () => {
    const result = applyOpenedTeleporterEffects(
        {
            level: 0,
            position: [0, 0],
            direction: 'NORTH',
            hydratedLevels: new Set<number>([0]),
            creatures: [createCreature('c2', { mapIndex: 0, x: 2, y: 3 })],
            floorItems: [],
            spellVisualEvents: [],
            openDoors: new Set<string>(),
            openWalls: new Set<string>(),
            openPits: new Set<string>(),
            openTeleporters: new Set<string>(['0,3,2']),
            championInventories: {},
            championEquipment: {},
            pendingSensorEvents: [],
        },
        ['0,3,2'],
        {
            getTile: (level, x, y) => level === 0 && x === 2 && y === 3 ? createTeleporterTile(x, y, 0, 4, 5) : undefined,
            getTeleporter: (tile) => tile.objects[0]?.category === 'Teleporter' ? tile.objects[0] : undefined,
            resolveProjectileTeleporterTransport: () => ({ level: 0, x: 2, y: 3, direction: 'NORTH' }),
            applyPartyTelefragAtSquare: () => null,
            buildLevelHydrationPatch: () => null,
            applyCreaturesStandingOnOpenTeleporter: () => ({
                creatures: [createCreature('c2', { mapIndex: 0, x: 4, y: 5 })],
            }),
        },
    );

    assert.equal(result.changed, true);
    assert.deepEqual(
        result.creatures[0] && {
            mapIndex: result.creatures[0].mapIndex,
            x: result.creatures[0].x,
            y: result.creatures[0].y,
        },
        { mapIndex: 0, x: 4, y: 5 },
    );
});

test('applyOpenedTeleporterEffects triggers floor sensors before transporting the party through a newly opened teleporter', () => {
    const result = applyOpenedTeleporterEffects(
        {
            level: 3,
            position: [30, 17],
            direction: 'SOUTH',
            hydratedLevels: new Set<number>([3]),
            creatures: [],
            floorItems: [],
            spellVisualEvents: [],
            openDoors: new Set<string>(),
            openWalls: new Set<string>(),
            openPits: new Set<string>(),
            openTeleporters: new Set<string>(['3,30,17']),
            championInventories: {},
            championEquipment: {},
            pendingSensorEvents: [],
        },
        ['3,30,17'],
        {
            getTile: (level, x, y) => level === 3 && x === 17 && y === 30 ? createTeleporterTile(x, y, 3, 15, 30) : undefined,
            getTeleporter: (tile) => tile.objects[0]?.category === 'Teleporter' ? tile.objects[0] : undefined,
            resolveProjectileTeleporterTransport: () => ({ level: 3, x: 15, y: 30, direction: 'SOUTH' }),
            applyPartyTelefragAtSquare: () => null,
            buildLevelHydrationPatch: () => null,
            applyCreaturesStandingOnOpenTeleporter: () => null,
            triggerFloorSensorsOnOpenedPartyTeleporter: () => ({
                openDoors: new Set<string>(['3,30,14']),
                openWalls: new Set<string>(),
                openPits: new Set<string>(),
                openTeleporters: new Set<string>(['3,30,17']),
                pendingSensorEvents: [{ level: 3, sensorIndex: 104, remaining: 2 }],
            }),
        },
    );

    assert.equal(result.changed, true);
    assert.deepEqual(result.position, [30, 15]);
    assert.equal(result.openDoors.has('3,30,14'), true);
    assert.deepEqual(result.pendingSensorEvents, [{ level: 3, sensorIndex: 104, remaining: 2 }]);
});

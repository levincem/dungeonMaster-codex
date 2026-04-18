import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureInstance, FloorItem, GameTile } from '../src/types/game.js';
import type { DamageEvent, SpellVisualEvent } from '../src/engine/runtimeTypes.js';
import {
    applyCreaturesStandingOnOpenPit,
    applyCreaturesStandingOnOpenTeleporter,
    applyPartyTelefragAtSquare,
} from '../src/engine/systems/terrainEffects.js';

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

function createDeathEvent(creatureId: string): SpellVisualEvent {
    return {
        id: `death-${creatureId}`,
        level: 0,
        x: 0,
        y: 0,
        effect: 'fireball',
        ts: 0,
        kind: 'death',
    };
}

function createDamageEvent(creatureId: string, amount: number): DamageEvent {
    return {
        id: `damage-${creatureId}`,
        level: 0,
        target: 'creature',
        creatureId,
        amount,
        ts: 0,
    };
}

test('applyPartyTelefragAtSquare kills creatures on the square and drops their items', () => {
    const carried: FloorItem = { id: 'loot-1', category: 'Misc', typeId: 1, mapIndex: 0, x: 1, y: 1, tilePos: 'North' };
    const state = {
        creatures: [createCreature('c1', { carriedItems: [carried] })],
        floorItems: [] as FloorItem[],
        spellVisualEvents: [] as SpellVisualEvent[],
    };

    const result = applyPartyTelefragAtSquare(state, 0, 1, 1, {
        dropCreatureCarriedItems: (creatures, floorItems, creatureId) => ({
            creatures,
            floorItems: [...floorItems, { ...carried, id: `dropped-${creatureId}` }],
        }),
        buildDeathDustEvent: () => createDeathEvent('c1'),
        normalizeCreatureCellsOnTile: (creatures) => creatures,
    });

    assert.ok(result);
    assert.equal(result?.creatures[0]?.alive, false);
    assert.equal(result?.creatures[0]?.currentHP, 0);
    assert.equal(result?.floorItems[0]?.id, 'dropped-c1');
    assert.equal(result?.spellVisualEvents.length, 1);
});

test('applyCreaturesStandingOnOpenPit moves surviving creatures to the landing tile and records damage', () => {
    const state = {
        level: 0,
        position: [0, 0] as [number, number],
        hydratedLevels: new Set<number>([2]),
        creatures: [createCreature('c2', { mapIndex: 2, x: 4, y: 5, currentHP: 50 })],
        floorItems: [] as FloorItem[],
        damageEvents: [] as DamageEvent[],
        spellVisualEvents: [] as SpellVisualEvent[],
        openDoors: new Set<string>(),
        openWalls: new Set<string>(),
        openPits: new Set<string>(['2,5,4']),
    };

    const result = applyCreaturesStandingOnOpenPit(state, 2, 4, 5, {
        resolvePitLanding: () => ({ level: 3, x: 6, y: 7 }),
        isWalkable: () => true,
        canCreatureShareTile: () => true,
        dropCreatureCarriedItems: (creatures, floorItems) => ({ creatures, floorItems }),
        buildDeathDustEvent: () => createDeathEvent('c2'),
        buildCreatureDamageEvent: (_level, _x, _y, amount, creatureId) => createDamageEvent(creatureId, amount),
        normalizeCreatureCellsOnTile: (creatures) => creatures,
        buildLevelHydrationPatch: () => null,
    });

    assert.ok(result);
    assert.deepEqual(
        result?.creatures[0] && {
            mapIndex: result.creatures[0].mapIndex,
            x: result.creatures[0].x,
            y: result.creatures[0].y,
            currentHP: result.creatures[0].currentHP,
            alive: result.creatures[0].alive,
        },
        { mapIndex: 3, x: 6, y: 7, currentHP: 30, alive: true },
    );
    assert.equal(result?.damageEvents[0]?.amount, 20);
    assert.equal(result?.spellVisualEvents.length, 0);
});

test('applyCreaturesStandingOnOpenTeleporter teleports creatures when the destination is valid', () => {
    const teleporterTile: GameTile = {
        x: 2,
        y: 3,
        type: 'Teleporter',
        objects: [{
            category: 'Teleporter',
            index: 1,
            tilePos: 'North',
            sound: false,
            scope: 'local',
            rotationType: 0,
            rotation: 'North',
            destX: 8,
            destY: 9,
            destMap: 1,
        }],
    };
    const state = {
        level: 0,
        position: [0, 0] as [number, number],
        hydratedLevels: new Set<number>([0]),
        creatures: [createCreature('c3', { mapIndex: 0, x: 2, y: 3, cell: 'frontLeft' })],
        openDoors: new Set<string>(),
        openWalls: new Set<string>(),
        openPits: new Set<string>(),
        openTeleporters: new Set<string>(['0,3,2']),
    };

    const result = applyCreaturesStandingOnOpenTeleporter(state, 0, 2, 3, {
        getTile: () => teleporterTile,
        getTeleporter: (tile) => tile.objects[0]?.category === 'Teleporter' ? tile.objects[0] : undefined,
        resolveCreatureTeleporterTransport: () => ({ level: 1, x: 8, y: 9, direction: 'EAST', cell: 'frontRight' }),
        isWalkable: () => true,
        canCreatureShareTile: () => true,
        normalizeCreatureCellsOnTile: (creatures) => creatures,
        buildLevelHydrationPatch: () => null,
    });

    assert.ok(result);
    assert.deepEqual(
        result?.creatures[0] && {
            mapIndex: result.creatures[0].mapIndex,
            x: result.creatures[0].x,
            y: result.creatures[0].y,
            cell: result.creatures[0].cell,
        },
        { mapIndex: 1, x: 8, y: 9, cell: 'frontRight' },
    );
});

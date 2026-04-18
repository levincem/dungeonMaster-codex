import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../src/types/game.js';
import type { ChampionVitals, Direction, SpellVisualEvent } from '../src/engine/runtimeTypes.js';
import { resolveTeleporterStepTransport } from '../src/engine/systems/teleporterStepTransport.js';

type TestPendingSensorEvent = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type TestSensorState = {
    openDoors: Set<string>;
    marker?: string;
};

type TestPatch = Record<string, unknown>;

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champ ${id}`,
        title: 'Adventurer',
        gender: 'M',
        class: 'Fighter',
        health: 30,
        stamina: 40,
        mana: 5,
        luck: 10,
        strength: 10,
        dexterity: 10,
        wisdom: 10,
        vitality: 10,
        antiMagic: 0,
        antiFire: 0,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: '',
    };
}

function createState() {
    return {
        level: 0,
        position: [2, 3] as [number, number],
        direction: 'NORTH' as Direction,
        party: [createChampion(1)],
        openTeleporters: new Set<string>(['0,4,5']),
        creatures: [] as CreatureInstance[],
        floorItems: [] as FloorItem[],
        spellVisualEvents: [] as SpellVisualEvent[],
        championInventories: {} as Record<number, FloorItem[]>,
        championEquipment: {} as Record<number, ChampionEquipment>,
        pendingSensorEvents: [{ level: 0, sensorIndex: 1, remaining: 5 }] as TestPendingSensorEvent[],
        elapsedGameTimeTicks: 456,
    };
}

test('resolveTeleporterStepTransport returns null when the teleporter is not open', () => {
    const state = { ...createState(), openTeleporters: new Set<string>() };

    const result = resolveTeleporterStepTransport<typeof state, TestSensorState, TestPendingSensorEvent, TestPatch>(
        state,
        4,
        5,
        null,
        {
            resolveProjectileTeleporterTransport: () => ({ level: 0, x: 5, y: 4, direction: 'NORTH' }),
            buildSensorStateSnapshot: () => ({ openDoors: new Set<string>() }),
            transitionFloorSensors: () => ({ sensorChanges: {}, pendingSensorEvents: [] }),
            applyPartyTelefragAtSquare: () => null,
            buildLevelHydrationPatch: () => null,
            applyImmediateTransportSquareEffects: (_state, basePatch) => basePatch,
            computeMovementCooldown: () => 0.5,
            playTeleport: () => undefined,
        },
    );

    assert.equal(result, null);
});

test('resolveTeleporterStepTransport handles cross-level teleports before immediate transport effects', () => {
    const state = createState();
    let playCount = 0;
    let capturedPatch: TestPatch | null = null;

    const result = resolveTeleporterStepTransport<typeof state, TestSensorState, TestPendingSensorEvent, TestPatch>(
        state,
        4,
        5,
        { 1: { hp: 28 } as ChampionVitals },
        {
            resolveProjectileTeleporterTransport: () => ({ level: 1, x: 7, y: 8, direction: 'EAST' }),
            buildSensorStateSnapshot: () => ({ openDoors: new Set<string>() }),
            transitionFloorSensors: () => ({ sensorChanges: {}, pendingSensorEvents: [] }),
            applyPartyTelefragAtSquare: () => ({
                floorItems: [{ id: 'loot-1', category: 'Misc', typeId: 1, mapIndex: 1, x: 7, y: 8, tilePos: 'North' }],
                spellVisualEvents: [{ id: 'fx-1', level: 1, x: 7, y: 8, effect: 'fireball', ts: 0, kind: 'death' }],
            }),
            buildLevelHydrationPatch: () => null,
            applyImmediateTransportSquareEffects: (_state, basePatch) => {
                capturedPatch = basePatch;
                return basePatch;
            },
            computeMovementCooldown: () => 1.5,
            playTeleport: () => {
                playCount += 1;
            },
        },
    );

    assert.ok(result);
    assert.equal(playCount, 1);
    const patch = capturedPatch as unknown as TestPatch;
    assert.equal(patch.level, 1);
    assert.deepEqual(patch.position, [8, 7]);
    assert.equal(patch.direction, 'EAST');
    assert.equal(patch.lastPartyMoveGameTick, 456);
    assert.equal(patch.movementCooldown, 1.5);
    assert.equal((patch.floorItems as FloorItem[]).length, 1);
    assert.equal((patch.spellVisualEvents as SpellVisualEvent[]).length, 1);
});

test('resolveTeleporterStepTransport handles same-level teleports with floor sensor transition', () => {
    const state = createState();
    let playCount = 0;
    let transitionSnapshot: TestSensorState | null = null;
    let capturedPatch: TestPatch | null = null;

    const result = resolveTeleporterStepTransport<typeof state, TestSensorState, TestPendingSensorEvent, TestPatch>(
        state,
        4,
        5,
        null,
        {
            resolveProjectileTeleporterTransport: () => ({ level: 0, x: 6, y: 7, direction: 'WEST' }),
            buildSensorStateSnapshot: () => ({ openDoors: new Set<string>(), marker: 'snapshot' }),
            transitionFloorSensors: (_level, _fromX, _fromY, _toX, _toY, _partySize, ss) => {
                transitionSnapshot = ss;
                return {
                    sensorChanges: { openDoors: new Set(['sensor-door']), marker: 'enter' },
                    pendingSensorEvents: [{ level: 0, sensorIndex: 2, remaining: 1 }],
                    blockedMessage: 'teleported',
                };
            },
            applyPartyTelefragAtSquare: () => ({
                creatures: [{ id: 'c1', typeId: 1, mapIndex: 0, x: 6, y: 7, currentHP: 0, alive: false, cell: 'center' }],
            }),
            buildLevelHydrationPatch: () => null,
            applyImmediateTransportSquareEffects: (_state, basePatch) => {
                capturedPatch = basePatch;
                return basePatch;
            },
            computeMovementCooldown: () => 2,
            playTeleport: () => {
                playCount += 1;
            },
        },
    );

    assert.ok(result);
    assert.equal(playCount, 1);
    assert.equal(result?.blockedMessage, 'teleported');
    assert.deepEqual(transitionSnapshot, { openDoors: new Set<string>(), marker: 'snapshot' });
    const patch = capturedPatch as unknown as TestPatch;
    assert.deepEqual(patch.position, [7, 6]);
    assert.equal(patch.direction, 'WEST');
    assert.equal(patch.movementCooldown, 2);
    assert.deepEqual(patch.pendingSensorEvents, [{ level: 0, sensorIndex: 2, remaining: 1 }]);
    assert.equal((patch.openDoors as Set<string>).has('sensor-door'), true);
    assert.equal(patch.marker, 'enter');
    assert.equal((patch.creatures as CreatureInstance[]).length, 1);
});

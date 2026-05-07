import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../src/types/game.js';
import type { ChampionVitals, GameOptions } from '../src/engine/runtimeTypes.js';
import { normalizeCreatureCellsOnTile as normalizeCreatureCellsOnTileSystem } from '../src/engine/systems/creatureTileState.js';
import {
    buildKillCreaturePatch,
    buildPruneDeadCreaturesPatch,
    buildSetGameOptionsPatch,
    buildStoreKillChampionPatch,
    buildTogglePausePatch,
    buildToggleSleepPatch,
    buildWakeUpPatch,
} from '../src/engine/systems/storeStateRuntime.js';

const normalizeCreatureCellsOnTile = (creatures: CreatureInstance[], level: number, x: number, y: number) =>
    normalizeCreatureCellsOnTileSystem(creatures, level, x, y, () => 4);

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champion ${id}`,
        title: 'Tester',
        gender: 'M',
        class: 'Fighter',
        health: 100,
        stamina: 80,
        mana: 20,
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

function createVitals(hp: number): ChampionVitals {
    return {
        hp,
        stamina: 50,
        mana: 30,
        food: 100,
        water: 100,
        currentStats: {
            luck: 10,
            strength: 10,
            dexterity: 10,
            wisdom: 10,
            vitality: 10,
            antiMagic: 0,
            antiFire: 0,
        },
        wounds: {
            head: false,
            torso: false,
            leftHand: false,
            rightHand: false,
            legs: false,
            feet: false,
        },
        poisonEntries: [],
    };
}

test('buildSetGameOptionsPatch merges partial keybindings into the existing options', () => {
    const state = {
        gameOptions: {
            keybindings: {
                moveForward: ['w'],
                moveBackward: ['s'],
                turnLeft: ['a'],
                turnRight: ['d'],
                strafeLeft: ['q'],
                strafeRight: ['e'],
            },
        } satisfies GameOptions,
    };

    const patch = buildSetGameOptionsPatch(state, {
        keybindings: {
            moveForward: ['ArrowUp'],
            moveBackward: ['s'],
            turnLeft: ['a'],
            turnRight: ['d'],
            strafeLeft: ['q'],
            strafeRight: ['e'],
        },
    });

    assert.deepEqual(patch, {
        gameOptions: {
            keybindings: {
                moveForward: ['ArrowUp'],
                moveBackward: ['s'],
                turnLeft: ['a'],
                turnRight: ['d'],
                strafeLeft: ['q'],
                strafeRight: ['e'],
            },
        },
    });
});

test('buildKillCreaturePatch marks the creature dead and returns dropped items', () => {
    const state = {
        creatures: [
            { id: 'creature-1', alive: true, mapIndex: 0, x: 4, y: 5, typeId: 1, cell: 'frontLeft' } as CreatureInstance,
            { id: 'creature-2', alive: true, mapIndex: 0, x: 4, y: 5, typeId: 1, cell: 'backLeft' } as CreatureInstance,
            { id: 'creature-3', alive: true, mapIndex: 0, x: 4, y: 5, typeId: 1, cell: 'backRight' } as CreatureInstance,
        ],
        floorItems: [] as FloorItem[],
    };

    const patch = buildKillCreaturePatch(state, 'creature-1', {
        dropCreatureCarriedItems: (creatures, floorItems) => {
            void floorItems;
            return {
                creatures,
                floorItems: [{ id: 'loot', category: 'Weapon', typeId: 1, mapIndex: 0, x: 0, y: 0, tilePos: 'North' }],
            };
        },
        normalizeCreatureCellsOnTile,
    });

    assert.equal(patch.creatures[0]?.alive, false);
    assert.deepEqual(
        patch.creatures.map((creature) => [creature.id, creature.alive, creature.cell]),
        [
            ['creature-1', false, 'frontLeft'],
            ['creature-2', true, 'frontLeft'],
            ['creature-3', true, 'frontRight'],
        ],
    );
    assert.deepEqual(patch.floorItems, [
        { id: 'loot', category: 'Weapon', typeId: 1, mapIndex: 0, x: 0, y: 0, tilePos: 'North' },
    ]);
});

test('buildPruneDeadCreaturesPatch drops dead creatures once their gameplay effects are resolved', () => {
    const state = {
        creatures: [
            { id: 'creature-1', alive: true } as CreatureInstance,
            { id: 'creature-2', alive: false } as CreatureInstance,
            { id: 'creature-3', alive: true } as CreatureInstance,
        ],
        floorItems: [] as FloorItem[],
    };

    assert.deepEqual(buildPruneDeadCreaturesPatch(state), {
        creatures: [
            { id: 'creature-1', alive: true },
            { id: 'creature-3', alive: true },
        ],
    });
    assert.equal(
        buildPruneDeadCreaturesPatch({
            ...state,
            creatures: state.creatures.filter((creature) => creature.alive),
        }),
        null,
    );
});

test('buildStoreKillChampionPatch only delegates for champions already at zero hp', () => {
    const baseState = {
        level: 0,
        position: [4, 5] as [number, number],
        party: [createChampion(1)],
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: {} as ChampionEquipment },
        floorItems: [] as FloorItem[],
        deadChampions: {},
        selectedChampionIndex: 0,
        championVitals: { 1: createVitals(0) },
    };

    const patch = buildStoreKillChampionPatch(baseState, 1, 999, {
        applyChampionDeathDropsToPartyState: (_state, championIds, now) => ({
            championIds,
            now,
        }),
    });
    assert.deepEqual(patch, { championIds: [1], now: 999 });

    assert.equal(
        buildStoreKillChampionPatch(
            { ...baseState, championVitals: { 1: createVitals(5) } },
            1,
            999,
            {
                applyChampionDeathDropsToPartyState: () => ({ bad: true }),
            },
        ),
        null,
    );
});

test('buildToggleSleepPatch toggles sleep, clears cast result, and blocks invalid cases', () => {
    const exploringState = {
        gamePhase: 'exploration',
        party: [{ id: 1 }],
        sleeping: false,
        lastCastResult: { message: 'old' },
    };

    assert.deepEqual(
        buildToggleSleepPatch(exploringState, {
            isPartyRested: () => false,
        }),
        { sleeping: true, lastCastResult: null },
    );

    assert.deepEqual(
        buildToggleSleepPatch(exploringState, {
            isPartyRested: () => true,
        }),
        { sleeping: false },
    );

    assert.equal(
        buildToggleSleepPatch(
            { ...exploringState, gamePhase: 'title' },
            { isPartyRested: () => false },
        ),
        null,
    );
});

test('buildWakeUpPatch only returns a patch while sleeping', () => {
    assert.deepEqual(buildWakeUpPatch({ sleeping: true }), { sleeping: false });
    assert.equal(buildWakeUpPatch({ sleeping: false }), null);
});

test('buildTogglePausePatch toggles pause only during active gameplay phases', () => {
    const state = {
        gamePhase: 'exploration',
        sleeping: false,
        paused: false,
        lastCastResult: { message: 'old' },
    };

    assert.deepEqual(buildTogglePausePatch(state), { paused: true, lastCastResult: null });
    assert.deepEqual(buildTogglePausePatch({ ...state, paused: true }), { paused: false, lastCastResult: null });
    assert.equal(buildTogglePausePatch({ ...state, sleeping: true }), null);
    assert.equal(buildTogglePausePatch({ ...state, gamePhase: 'title' }), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import {
    buildDropInventoryItemRuntimePatch,
    buildPickupItemToChampionRuntimePatch,
} from '../src/engine/systems/floorItemCommandRuntime.js';
import { buildStoreSelectedChampionPickupPatch } from '../src/engine/systems/storeFloorItemRuntime.js';

type PendingSensorEvent = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

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

function createItem(id: string, overrides: Partial<FloorItem> = {}): FloorItem {
    return {
        id,
        category: 'Weapon',
        typeId: 1,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
        ...overrides,
    };
}

test('buildPickupItemToChampionRuntimePatch delegates to the pickup transfer helper', () => {
    const state = {
        floorItems: [createItem('sword')],
        party: [createChampion(1)],
        championInventories: { 1: [] as FloorItem[] },
        activeFloorDrag: null,
        lastCastResult: null,
    };

    const patch = buildPickupItemToChampionRuntimePatch(
        state,
        'sword',
        1,
        {
            transferFloorItemToChampionState: (
                _state: typeof state,
                itemId: string,
                championId: number,
            ) => ({
                championInventories: { [championId]: [createItem(itemId)] },
            }),
        },
    );

    assert.deepEqual(patch, {
        championInventories: { 1: [createItem('sword')] },
    });
});

test('buildStoreSelectedChampionPickupPatch picks up with the currently selected champion', () => {
    const state = {
        level: 0,
        position: [0, 0] as [number, number],
        direction: 'NORTH' as const,
        floorItems: [createItem('sword')],
        party: [createChampion(1), createChampion(2)],
        selectedChampionIndex: 1,
        championInventories: { 1: [] as FloorItem[], 2: [] as FloorItem[] },
        activeFloorDrag: null,
        lastCastResult: null,
    };

    const patch = buildStoreSelectedChampionPickupPatch(
        state,
        'sword',
        {
            buildPickupPatch: (_state, itemId, championId) => ({
                championInventories: {
                    ...state.championInventories,
                    [championId]: [createItem(itemId)],
                },
            }),
        },
    );

    assert.deepEqual(patch, {
        championInventories: {
            1: [],
            2: [createItem('sword')],
        },
    });
});

test('buildDropInventoryItemRuntimePatch returns the altar resurrection patch first', () => {
    const bones = createItem('bones', {
        category: 'Misc',
        typeId: 5,
        championId: 7,
    });
    const state = {
        level: 0,
        position: [4, 5] as [number, number],
        party: [createChampion(1)],
        floorItems: [] as FloorItem[],
        championInventories: { 1: [bones] },
        championEquipment: { 1: {} as ChampionEquipment },
        deadChampions: { 7: createChampion(7) },
        pendingSensorEvents: [] as PendingSensorEvent[],
    };

    const patch = buildDropInventoryItemRuntimePatch(
        state,
        1,
        bones.id,
        {
            isAltarTile: () => true,
            buildViAltarResurrectionPatch: () => ({ party: [] }),
            buildSensorStateSnapshot: () => ({}),
            triggerFloorSensors: () => ({ sensorChanges: {}, pendingSensorEvents: [] }),
            applyImmediateTransportSquareEffects: (_currentState, basePatch) => basePatch,
        },
    );

    assert.deepEqual(patch, { party: [] });
});

test('buildDropInventoryItemRuntimePatch drops the item, triggers sensors and applies transport effects', () => {
    const item = createItem('sword');
    const state = {
        level: 0,
        position: [4, 5] as [number, number],
        party: [createChampion(1)],
        floorItems: [] as FloorItem[],
        championInventories: { 1: [item] },
        championEquipment: { 1: {} as ChampionEquipment },
        deadChampions: {},
        pendingSensorEvents: [{ level: 0, sensorIndex: 2, remaining: 3 }] as PendingSensorEvent[],
    };

    const patch = buildDropInventoryItemRuntimePatch(
        state,
        1,
        item.id,
        {
            isAltarTile: () => false,
            buildViAltarResurrectionPatch: () => null,
            buildSensorStateSnapshot: () => ({ snapshot: true }),
            triggerFloorSensors: (_level, x, y, _sensorState, _inventories, _equipment, floorItems) => ({
                sensorChanges: {
                    floorItems,
                    marker: `${x},${y}`,
                },
                pendingSensorEvents: [],
            }),
            applyImmediateTransportSquareEffects: (_currentState, basePatch) => ({
                ...basePatch,
                transported: true,
            }),
        },
    );

    assert.deepEqual(patch, {
        championInventories: { 1: [] },
        floorItems: [{ ...item, mapIndex: 0, x: 5, y: 4, tilePos: 'North' }],
        marker: '5,4',
        pendingSensorEvents: [],
        transported: true,
    });
});

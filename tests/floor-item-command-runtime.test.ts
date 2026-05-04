import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import {
    buildDropInventoryItemToTileRuntimePatch,
    buildDropInventoryItemRuntimePatch,
    buildMoveFloorItemToTileRuntimePatch,
    buildPickupItemToChampionRuntimePatch,
    buildThrowFloorItemRuntimePatch,
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
        level: 0,
        floorItems: [createItem('sword')],
        party: [createChampion(1)],
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: {} as ChampionEquipment },
        activeFloorDrag: null,
        lastCastResult: null,
        pendingSensorEvents: [] as PendingSensorEvent[],
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

test('buildPickupItemToChampionRuntimePatch clears item-held floor sensors when the last item leaves the tile', () => {
    const item = createItem('boulder', { category: 'Misc', typeId: 25, x: 25, y: 1 });
    const state = {
        level: 1,
        floorItems: [item],
        party: [createChampion(1)],
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: {} as ChampionEquipment },
        activeFloorDrag: null,
        lastCastResult: null,
        pendingSensorEvents: [{ level: 1, sensorIndex: 8, remaining: 0 }] as PendingSensorEvent[],
    };
    const modes: string[] = [];

    const patch = buildPickupItemToChampionRuntimePatch(
        state,
        item.id,
        1,
        {
            transferFloorItemToChampionState: () => ({
                floorItems: [],
                championInventories: { 1: [item] },
                activeFloorDrag: null,
            }),
            buildSensorStateSnapshot: () => ({ snapshot: true }),
            triggerFloorSensors: (
                _level,
                _x,
                _y,
                _sensorState,
                _inventories,
                _equipment,
                floorItems,
                _pending,
                _source,
                mode,
            ) => {
                modes.push(mode);
                return {
                    sensorChanges: { floorItems, openDoors: new Set<string>() },
                    pendingSensorEvents: [],
                };
            },
        },
    );

    assert.deepEqual(modes, ['leave']);
    assert.deepEqual(patch, {
        floorItems: [],
        championInventories: { 1: [item] },
        activeFloorDrag: null,
        openDoors: new Set<string>(),
        pendingSensorEvents: [],
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
        floorItems: [{ ...item, mapIndex: 0, x: 5, y: 4, tilePos: 'North', projectileDropped: undefined }],
        marker: '5,4',
        pendingSensorEvents: [],
        transported: true,
    });
});

test('buildDropInventoryItemRuntimePatch tags floor-sensor checks as item-driven', () => {
    const item = createItem('coin', { category: 'Misc', typeId: 6 });
    const sources: string[] = [];
    const state = {
        level: 0,
        position: [4, 5] as [number, number],
        party: [createChampion(1)],
        floorItems: [] as FloorItem[],
        championInventories: { 1: [item] },
        championEquipment: { 1: {} as ChampionEquipment },
        deadChampions: {},
        pendingSensorEvents: [] as PendingSensorEvent[],
    };

    buildDropInventoryItemRuntimePatch(
        state,
        1,
        item.id,
        {
            isAltarTile: () => false,
            buildViAltarResurrectionPatch: () => null,
            buildSensorStateSnapshot: () => ({ snapshot: true }),
            triggerFloorSensors: (
                _level,
                _x,
                _y,
                _sensorState,
                _inventories,
                _equipment,
                floorItems,
                _pending,
                source,
            ) => {
                sources.push(source);
                return {
                    sensorChanges: { floorItems },
                    pendingSensorEvents: [],
                };
            },
            applyImmediateTransportSquareEffects: (_currentState, basePatch) => basePatch,
        },
    );

    assert.deepEqual(sources, ['item']);
});

test('buildDropInventoryItemToTileRuntimePatch can place a carried item on the front tile', () => {
    const item = createItem('club');
    const state = {
        level: 0,
        position: [4, 5] as [number, number],
        direction: 'NORTH' as const,
        party: [createChampion(1)],
        floorItems: [] as FloorItem[],
        championInventories: { 1: [item] },
        championEquipment: { 1: {} as ChampionEquipment },
        deadChampions: {},
        pendingSensorEvents: [] as PendingSensorEvent[],
    };

    const patch = buildDropInventoryItemToTileRuntimePatch(
        state,
        1,
        item.id,
        5,
        3,
        {
            isAltarTile: () => false,
            buildViAltarResurrectionPatch: () => null,
            buildSensorStateSnapshot: () => ({ snapshot: true }),
            triggerFloorSensors: (_level, x, y, _sensorState, _inventories, _equipment, floorItems) => ({
                sensorChanges: { floorItems, marker: `${x},${y}` },
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
        floorItems: [{ ...item, mapIndex: 0, x: 5, y: 3, tilePos: 'North', projectileDropped: undefined }],
        marker: '5,3',
        pendingSensorEvents: [],
    });
});

test('buildMoveFloorItemToTileRuntimePatch clears source sensors then triggers destination sensors', () => {
    const item = createItem('scroll', { category: 'Scroll', x: 5, y: 3 });
    const modes: Array<{ mode: string; x: number; y: number }> = [];
    const state = {
        level: 0,
        position: [4, 5] as [number, number],
        direction: 'NORTH' as const,
        party: [createChampion(1)],
        floorItems: [item],
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: {} as ChampionEquipment },
        deadChampions: {},
        pendingSensorEvents: [] as PendingSensorEvent[],
        activeFloorDrag: { itemId: item.id, pointerX: 10, pointerY: 10 },
    };

    const patch = buildMoveFloorItemToTileRuntimePatch(
        state,
        item.id,
        1,
        5,
        4,
        {
            buildSensorStateSnapshot: () => ({ snapshot: true }),
            triggerFloorSensors: (_level, x, y, _sensorState, _inventories, _equipment, floorItems, _pending, _source, mode) => {
                modes.push({ mode, x, y });
                return {
                    sensorChanges: { floorItems },
                    pendingSensorEvents: [],
                };
            },
            applyImmediateTransportSquareEffects: (_currentState, basePatch) => ({
                ...basePatch,
                transported: true,
            }),
        },
    );

    assert.deepEqual(modes, [
        { mode: 'leave', x: 5, y: 3 },
        { mode: 'enter', x: 5, y: 4 },
    ]);
    assert.deepEqual(patch, {
        floorItems: [{ ...item, mapIndex: 0, x: 5, y: 4, tilePos: 'North', projectileDropped: undefined }],
        pendingSensorEvents: [],
        activeFloorDrag: null,
        transported: true,
    });
});

test('buildMoveFloorItemToTileRuntimePatch still finalizes the actively dragged item after the party moved away', () => {
    const item = createItem('dragged-scroll', { category: 'Scroll', x: 1, y: 1 });
    const state = {
        level: 0,
        position: [8, 8] as [number, number],
        direction: 'NORTH' as const,
        party: [createChampion(1)],
        floorItems: [item],
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: {} as ChampionEquipment },
        deadChampions: {},
        pendingSensorEvents: [] as PendingSensorEvent[],
        activeFloorDrag: { itemId: item.id, pointerX: 10, pointerY: 10 },
    };

    const patch = buildMoveFloorItemToTileRuntimePatch(
        state,
        item.id,
        1,
        8,
        8,
        {
            buildSensorStateSnapshot: () => ({ snapshot: true }),
            triggerFloorSensors: (_level, _x, _y, _sensorState, _inventories, _equipment, floorItems) => ({
                sensorChanges: { floorItems },
                pendingSensorEvents: [],
            }),
            applyImmediateTransportSquareEffects: (_currentState, basePatch) => ({
                ...basePatch,
                transported: true,
            }),
        },
    );

    assert.deepEqual(patch, {
        floorItems: [{ ...item, mapIndex: 0, x: 8, y: 8, tilePos: 'North', projectileDropped: undefined }],
        pendingSensorEvents: [],
        activeFloorDrag: null,
        transported: true,
    });
});

test('buildThrowFloorItemRuntimePatch removes the floor item and appends a projectile', () => {
    const item = createItem('dagger', { x: 5, y: 3, typeId: 8 });
    const projectile = {
        id: 'projectile_1',
        level: 0,
        x: 5,
        y: 4,
        direction: 'NORTH' as const,
        effect: 'physical' as const,
        damage: [2, 4] as [number, number],
        nextMoveAt: 0,
        remainingRange: 4,
        remainingAttack: 4,
        stepDecay: 1,
        physicalItem: item,
    };
    const state = {
        level: 0,
        position: [4, 5] as [number, number],
        direction: 'NORTH' as const,
        party: [createChampion(1)],
        floorItems: [item],
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: {} as ChampionEquipment },
        deadChampions: {},
        pendingSensorEvents: [] as PendingSensorEvent[],
        activeFloorDrag: { itemId: item.id, pointerX: 10, pointerY: 10 },
        projectiles: [],
    };

    const patch = buildThrowFloorItemRuntimePatch(
        state,
        item.id,
        1,
        {
            buildSensorStateSnapshot: () => ({ snapshot: true }),
            triggerFloorSensors: () => ({
                sensorChanges: { floorItems: [] },
                pendingSensorEvents: [],
            }),
            buildProjectile: () => projectile,
            buildThrowXpPatch: () => ({ marker: 'xp' } as never),
        },
    );

    assert.deepEqual(patch, {
        floorItems: [],
        pendingSensorEvents: [],
        activeFloorDrag: null,
        projectiles: [projectile],
        marker: 'xp',
    });
});

test('buildThrowFloorItemRuntimePatch still throws the actively dragged item after the party moved away', () => {
    const item = createItem('dragged-dagger', { x: 1, y: 1, typeId: 8 });
    const projectile = {
        id: 'projectile_dragged',
        level: 0,
        x: 8,
        y: 8,
        direction: 'NORTH' as const,
        effect: 'physical' as const,
        damage: [2, 4] as [number, number],
        nextMoveAt: 0,
        remainingRange: 4,
        remainingAttack: 4,
        stepDecay: 1,
        physicalItem: item,
    };
    const state = {
        level: 0,
        position: [8, 8] as [number, number],
        direction: 'NORTH' as const,
        party: [createChampion(1)],
        floorItems: [item],
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: {} as ChampionEquipment },
        deadChampions: {},
        pendingSensorEvents: [] as PendingSensorEvent[],
        activeFloorDrag: { itemId: item.id, pointerX: 10, pointerY: 10 },
        projectiles: [],
    };

    const patch = buildThrowFloorItemRuntimePatch(
        state,
        item.id,
        1,
        {
            buildSensorStateSnapshot: () => ({ snapshot: true }),
            triggerFloorSensors: () => ({
                sensorChanges: { floorItems: [] },
                pendingSensorEvents: [],
            }),
            buildProjectile: () => projectile,
        },
    );

    assert.deepEqual(patch, {
        floorItems: [],
        pendingSensorEvents: [],
        activeFloorDrag: null,
        projectiles: [projectile],
    });
});

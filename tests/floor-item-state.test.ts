import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { FloorItem, GameTile, SensorObject } from '../src/types/game.js';
import {
    buildFloorItemPickupPatch,
    canPartyReachFloorItem,
    hasHiddenFirestaffPickupRestriction,
    transferFloorItemToChampionState,
} from '../src/engine/systems/floorItemState.js';

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champion ${id}`,
        title: 'The Tester',
        gender: 'M',
        class: 'Fighter',
        health: 120,
        stamina: 90,
        mana: 30,
        luck: 40,
        strength: 45,
        dexterity: 35,
        wisdom: 25,
        vitality: 50,
        antiMagic: 10,
        antiFire: 11,
        skills: {
            fighter: [1, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#ffffff',
        equipment: [],
        portrait: 'portrait.png',
    };
}

function createFloorItem(id: string, typeId: number, overrides: Partial<FloorItem> = {}): FloorItem {
    return {
        id,
        category: 'Weapon',
        typeId,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
        ...overrides,
    };
}

function createSensor(requiredObjectName: string): SensorObject {
    return {
        category: 'Sensor',
        index: 1,
        tilePos: 'North',
        type: 17,
        data: 0,
        graphic: 0,
        isLocal: false,
        delay: 0,
        sound: false,
        revert: false,
        action: 'Set',
        onceOnly: false,
        targetY: 0,
        targetX: 0,
        targetDir: 'North',
        requiredObjectName,
    };
}

test('hasHiddenFirestaffPickupRestriction only blocks complete Firestaff rewards hidden in wall sensors', () => {
    const firestaff = createFloorItem('firestaff', 45);
    const wallTile: GameTile = { x: 0, y: 0, type: 'Wall', objects: [createSensor('THE FIRESTAFF')] };
    const floorTile: GameTile = { x: 0, y: 0, type: 'Floor', objects: [createSensor('THE FIRESTAFF')] };

    assert.equal(hasHiddenFirestaffPickupRestriction(firestaff, wallTile), true);
    assert.equal(hasHiddenFirestaffPickupRestriction(firestaff, floorTile), false);
    assert.equal(hasHiddenFirestaffPickupRestriction(createFloorItem('sword', 1), wallTile), false);
});

test('buildFloorItemPickupPatch removes the floor item, adds it to inventory and clears matching drag state', () => {
    const item = createFloorItem('sword', 1);
    const patch = buildFloorItemPickupPatch(
        {
            level: 0,
            position: [0, 0],
            direction: 'NORTH',
            floorItems: [item],
            party: [createChampion(1)],
            championInventories: { 1: [] },
            activeFloorDrag: { itemId: item.id, pointerX: 10, pointerY: 20 },
        },
        item,
        1,
        { visibleTexts: new Set<string>(['altar']) },
    );

    assert.deepEqual(patch.floorItems, []);
    assert.deepEqual(patch.championInventories[1]?.map((entry) => entry.id), [item.id]);
    assert.equal(patch.activeFloorDrag, null);
    assert.deepEqual([...patch.visibleTexts], ['altar']);
});

test('transferFloorItemToChampionState returns a warning instead of hidden Firestaff pickup', () => {
    const firestaff = createFloorItem('firestaff', 45);
    const pickupState: {
        level: number;
        position: [number, number];
        direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
        floorItems: FloorItem[];
        party: Champion[];
        championInventories: Record<number, FloorItem[]>;
        activeFloorDrag: { itemId: string; pointerX: number; pointerY: number } | null;
        lastCastResult: { success: boolean; message: string; ts: number } | null;
    } = {
        level: 0,
        position: [0, 0],
        direction: 'NORTH',
        floorItems: [firestaff],
        party: [createChampion(1)],
        championInventories: { 1: [] },
        activeFloorDrag: null,
        lastCastResult: null,
    };
    const patch = transferFloorItemToChampionState(
        pickupState,
        firestaff.id,
        1,
        {
            getTile: () => ({ x: 0, y: 0, type: 'Wall', objects: [createSensor('THE FIRESTAFF')] }),
            buildPickupPatch: buildFloorItemPickupPatch,
            clearAlcoveStateOnPickup: () => ({}),
            buildHiddenFirestaffMessage: () => ({ success: false, message: 'blocked', ts: 0 }),
        },
    );

    assert.deepEqual(patch, { lastCastResult: { success: false, message: 'blocked', ts: 0 } });
});

test('transferFloorItemToChampionState applies alcove cleanup before pickup', () => {
    const item = createFloorItem('sword', 1);
    const pickupState: {
        level: number;
        position: [number, number];
        direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
        floorItems: FloorItem[];
        party: Champion[];
        championInventories: Record<number, FloorItem[]>;
        activeFloorDrag: { itemId: string; pointerX: number; pointerY: number } | null;
        lastCastResult: { success: boolean; message: string; ts: number } | null;
    } = {
        level: 0,
        position: [0, 0],
        direction: 'NORTH',
        floorItems: [item],
        party: [createChampion(1)],
        championInventories: { 1: [] },
        activeFloorDrag: null,
        lastCastResult: null,
    };
    const patch = transferFloorItemToChampionState(
        pickupState,
        item.id,
        1,
        {
            getTile: () => ({ x: 0, y: 0, type: 'Floor', objects: [] }),
            buildPickupPatch: buildFloorItemPickupPatch,
            clearAlcoveStateOnPickup: () => ({ visibleTexts: new Set<string>(['cleared']) }),
            buildHiddenFirestaffMessage: () => ({ success: false, message: 'blocked', ts: 0 }),
        },
    );

    assert.ok(patch && 'championInventories' in patch);
    assert.deepEqual(patch.championInventories[1]?.map((entry: FloorItem) => entry.id), [item.id]);
    assert.deepEqual([...(patch.visibleTexts as Set<string>)], ['cleared']);
});

test('canPartyReachFloorItem only allows items on the current or front tile', () => {
    const state = {
        level: 0,
        position: [5, 5] as [number, number],
        direction: 'NORTH' as const,
    };

    assert.equal(canPartyReachFloorItem(state, createFloorItem('current', 1, { x: 5, y: 5 })), true);
    assert.equal(canPartyReachFloorItem(state, createFloorItem('front', 1, { x: 5, y: 4 })), true);
    assert.equal(canPartyReachFloorItem(state, createFloorItem('far', 1, { x: 5, y: 2 })), false);
    assert.equal(canPartyReachFloorItem(state, createFloorItem('other-level', 1, { mapIndex: 1 })), false);
});

test('transferFloorItemToChampionState ignores distant items', () => {
    const item = createFloorItem('distant', 1, { x: 5, y: 2 });
    const pickupState: {
        level: number;
        position: [number, number];
        direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
        floorItems: FloorItem[];
        party: Champion[];
        championInventories: Record<number, FloorItem[]>;
        activeFloorDrag: { itemId: string; pointerX: number; pointerY: number } | null;
        lastCastResult: { success: boolean; message: string; ts: number } | null;
    } = {
        level: 0,
        position: [5, 5] as [number, number],
        direction: 'NORTH' as const,
        floorItems: [item],
        party: [createChampion(1)],
        championInventories: { 1: [] as FloorItem[] },
        activeFloorDrag: null,
        lastCastResult: null,
    };

    const patch = transferFloorItemToChampionState(
        pickupState,
        item.id,
        1,
        {
            getTile: () => ({ x: item.x, y: item.y, type: 'Floor', objects: [] }),
            buildPickupPatch: buildFloorItemPickupPatch,
            clearAlcoveStateOnPickup: () => ({}),
            buildHiddenFirestaffMessage: () => ({ success: false, message: 'blocked', ts: 0 }),
        },
    );

    assert.equal(patch, null);
});

test('transferFloorItemToChampionState returns null when the target backpack is full', async () => {
    const { MAX_CHAMPION_INVENTORY_ITEMS } = await import('../src/engine/systems/inventoryState.js');
    const item = createFloorItem('floor-item', 1);
    const fullInventory = Array.from({ length: MAX_CHAMPION_INVENTORY_ITEMS }, (_, index) =>
        createFloorItem(`inv-${index}`, index + 10),
    );
    const pickupState: {
        level: number;
        position: [number, number];
        direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
        floorItems: FloorItem[];
        party: Champion[];
        championInventories: Record<number, FloorItem[]>;
        activeFloorDrag: { itemId: string; pointerX: number; pointerY: number } | null;
        lastCastResult: { success: boolean; message: string; ts: number } | null;
    } = {
        level: 0,
        position: [0, 0],
        direction: 'NORTH',
        floorItems: [item],
        party: [createChampion(1)],
        championInventories: { 1: fullInventory },
        activeFloorDrag: null,
        lastCastResult: null,
    };

    const patch = transferFloorItemToChampionState(
        pickupState,
        item.id,
        1,
        {
            getTile: () => ({ x: 0, y: 0, type: 'Floor', objects: [] }),
            buildPickupPatch: buildFloorItemPickupPatch,
            clearAlcoveStateOnPickup: () => ({}),
            buildHiddenFirestaffMessage: () => ({ success: false, message: 'blocked', ts: 0 }),
        },
    );

    assert.equal(patch, null);
});

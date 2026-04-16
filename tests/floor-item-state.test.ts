import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { FloorItem, GameTile, SensorObject } from '../src/types/game.js';
import {
    buildFloorItemPickupPatch,
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

function createFloorItem(id: string, typeId: number): FloorItem {
    return {
        id,
        category: 'Weapon',
        typeId,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
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
        floorItems: FloorItem[];
        party: Champion[];
        championInventories: Record<number, FloorItem[]>;
        activeFloorDrag: { itemId: string; pointerX: number; pointerY: number } | null;
        lastCastResult: { success: boolean; message: string; ts: number } | null;
    } = {
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
        floorItems: FloorItem[];
        party: Champion[];
        championInventories: Record<number, FloorItem[]>;
        activeFloorDrag: { itemId: string; pointerX: number; pointerY: number } | null;
        lastCastResult: { success: boolean; message: string; ts: number } | null;
    } = {
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

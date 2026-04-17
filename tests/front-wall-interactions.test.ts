import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FloorItem } from '../src/types/game.js';
import {
    resolveFrontWallTarget,
    tryUseChampionItemOnFrontWall,
    tryUseFloorItemOnFrontWall,
} from '../src/engine/systems/frontWallInteractions.js';

function createWeapon(id: string, typeId: number): FloorItem {
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

function createState() {
    const item = { ...createWeapon('item-1', 7), mapIndex: 3 };
    return {
        level: 3,
        position: [5, 6] as [number, number],
        direction: 'NORTH' as const,
        championInventories: { 1: [item] },
        championEquipment: { 1: {} },
        floorItems: [item],
        activeFloorDrag: { itemId: item.id },
    };
}

function createDeps(overrides: Partial<Parameters<typeof tryUseChampionItemOnFrontWall<typeof createState extends () => infer T ? T : never, unknown, Record<string, unknown>>>[2]> = {}) {
    return {
        buildSensorStateSnapshot: () => ({ snapshot: true }),
        isAltarWallFace: () => false,
        buildViAltarResurrectionPatch: () => null,
        triggerLockSensors: () => ({ sensorChanges: {}, newInventories: null, newEquipment: null, matched: false }),
        triggerAnyObjectWallSensor: () => ({ sensorChanges: {}, matched: false }),
        triggerAlcoveDepositSensor: () => ({ sensorChanges: {}, newInventories: null, newEquipment: null, depositedItem: null, matched: false }),
        triggerObjectExchangerSensor: () => ({ sensorChanges: {}, newInventories: null, newEquipment: null, matched: false }),
        applyFirestaffExchangerReward: (_state: unknown, _wallX: number, _wallY: number, _face: string, _candidate: FloorItem | undefined, _receiver: { championId: number; fromSlot: 'inventory' | string }, nextInventories: Record<number, FloorItem[]> | null, nextEquipment: Record<number, unknown> | null, nextFloorItems: FloorItem[]) => ({
            nextInventories,
            nextEquipment: nextEquipment as Record<number, import('../src/types/game.js').ChampionEquipment> | null,
            nextFloorItems,
            transformed: false,
        }),
        applyImmediateTransportSquareEffects: (_state: unknown, patch: Record<string, unknown>) => patch,
        buildAttackResultMessage: (message: string) => ({ message }),
        ...overrides,
    };
}

test('resolveFrontWallTarget maps party direction to wall coordinates and face', () => {
    assert.deepEqual(resolveFrontWallTarget([5, 6], 'NORTH'), { wallX: 6, wallY: 4, face: 'South' });
    assert.deepEqual(resolveFrontWallTarget([5, 6], 'SOUTH'), { wallX: 6, wallY: 6, face: 'North' });
    assert.deepEqual(resolveFrontWallTarget([5, 6], 'EAST'), { wallX: 7, wallY: 5, face: 'West' });
    assert.deepEqual(resolveFrontWallTarget([5, 6], 'WEST'), { wallX: 5, wallY: 5, face: 'East' });
});

test('tryUseChampionItemOnFrontWall returns the lock patch first when matched', () => {
    const state = createState();
    const deps = createDeps({
        triggerLockSensors: () => ({
            sensorChanges: { openDoors: ['3,4,6'] },
            newInventories: { 1: [] },
            newEquipment: null,
            matched: true,
        }),
    });

    const result = tryUseChampionItemOnFrontWall(state, { championId: 1, itemId: 'item-1', fromSlot: 'inventory' }, deps);

    assert.equal(result.matched, true);
    assert.equal(result.shouldPlayPlate, true);
    assert.deepEqual(result.patch, {
        openDoors: ['3,4,6'],
        championInventories: { 1: [] },
    });
});

test('tryUseFloorItemOnFrontWall clears the drag state and adds the message when Firestaff transforms', () => {
    const state = createState();
    const deps = createDeps({
        triggerObjectExchangerSensor: () => ({
            sensorChanges: { activeSensors: ['3_99'] },
            newInventories: { 1: [] },
            newEquipment: null,
            matched: true,
        }),
        applyFirestaffExchangerReward: (_state: unknown, _wallX: number, _wallY: number, _face: string, _candidate: FloorItem | undefined, _receiver: { championId: number; fromSlot: 'inventory' | string }, nextInventories: Record<number, FloorItem[]> | null, nextEquipment: Record<number, unknown> | null, nextFloorItems: FloorItem[]) => {
            void nextFloorItems;
            return ({
            nextInventories,
            nextEquipment: nextEquipment as Record<number, import('../src/types/game.js').ChampionEquipment> | null,
            nextFloorItems: [],
            transformed: true,
            });
        },
    });

    const result = tryUseFloorItemOnFrontWall(state, 'item-1', 1, deps);

    assert.equal(result.matched, true);
    assert.equal(result.shouldPlayPlate, true);
    assert.deepEqual(result.patch, {
        activeSensors: ['3_99'],
        championInventories: { 1: [] },
        floorItems: [],
        activeFloorDrag: null,
        lastCastResult: { message: 'Le Firestaff absorbe l energie de l Amalgam.' },
    });
});

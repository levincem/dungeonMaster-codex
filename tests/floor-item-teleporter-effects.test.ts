import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import { applyFloorItemTeleporterEffects } from '../src/engine/systems/floorItemTeleporterEffects.js';

type PendingSensorEvent = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

function createItem(id: string, overrides: Partial<FloorItem> = {}): FloorItem {
    return {
        id,
        category: 'Misc',
        typeId: 29,
        rawName: 'Gem',
        mapIndex: 1,
        x: 13,
        y: 16,
        tilePos: 'North',
        ...overrides,
    };
}

test('applyFloorItemTeleporterEffects moves an item from an item-only teleporter to its destination sensor tile', () => {
    const item = createItem('gem');
    const triggers: Array<{ mode: 'enter' | 'leave'; level: number; x: number; y: number; ids: string[] }> = [];
    const state = {
        floorItems: [] as FloorItem[],
        openTeleporters: new Set<string>(['1,16,13']),
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: {} as ChampionEquipment },
        pendingSensorEvents: [] as PendingSensorEvent[],
    };

    const patch = applyFloorItemTeleporterEffects<
        typeof state,
        { snapshot: true },
        PendingSensorEvent,
        { floorItems: FloorItem[] }
    >(
        state,
        {
            floorItems: [item],
        },
        {
            buildSensorStateSnapshot: () => ({ snapshot: true }),
            triggerFloorSensors: (level, x, y, _sensorState, _inventories, _equipment, floorItems, pendingSensorEvents, _source, mode) => {
                triggers.push({ level, x, y, mode, ids: floorItems.map((entry) => entry.id) });
                return {
                    sensorChanges: { floorItems },
                    pendingSensorEvents,
                };
            },
            resolveProjectileTeleporterTransport: (_transportState, level, x, y) => {
                if (level === 1 && x === 13 && y === 16) {
                    return { level: 1, x: 14, y: 14, direction: 'NORTH' as const };
                }
                return { level, x, y, direction: 'NORTH' as const };
            },
        },
    );

    assert.deepEqual(patch.floorItems, [
        {
            ...item,
            mapIndex: 1,
            x: 14,
            y: 14,
            tilePos: 'North',
        },
    ]);
    assert.deepEqual(triggers, [
        { mode: 'leave', level: 1, x: 13, y: 16, ids: [] },
        { mode: 'enter', level: 1, x: 14, y: 14, ids: ['gem'] },
    ]);
});

test('applyFloorItemTeleporterEffects also moves an item when the teleporter opens under it', () => {
    const item = createItem('coin');
    const openedState = {
        floorItems: [item],
        openTeleporters: new Set<string>(),
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: {} as ChampionEquipment },
        pendingSensorEvents: [] as PendingSensorEvent[],
    };

    const patch = applyFloorItemTeleporterEffects<
        typeof openedState,
        { snapshot: true },
        PendingSensorEvent,
        Partial<typeof openedState>
    >(
        openedState,
        {
            openTeleporters: new Set<string>(['1,16,13']),
        },
        {
            buildSensorStateSnapshot: () => ({ snapshot: true }),
            triggerFloorSensors: (_level, _x, _y, _sensorState, _inventories, _equipment, _floorItems, pendingSensorEvents) => ({
                sensorChanges: {},
                pendingSensorEvents,
            }),
            resolveProjectileTeleporterTransport: (_transportState, level, x, y) => (
                level === 1 && x === 13 && y === 16
                    ? { level: 1, x: 14, y: 14, direction: 'NORTH' as const }
                    : { level, x, y, direction: 'NORTH' as const }
            ),
        },
    );

    assert.deepEqual(patch.floorItems, [
        {
            ...item,
            mapIndex: 1,
            x: 14,
            y: 14,
            tilePos: 'North',
        },
    ]);
});

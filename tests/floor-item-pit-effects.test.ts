import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../src/types/game.js';
import { applyFloorItemPitEffects } from '../src/engine/systems/floorItemPitEffects.js';

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
        mapIndex: 7,
        x: 1,
        y: 2,
        tilePos: 'North',
        ...overrides,
    };
}

function createState(overrides: Partial<{
    hydratedLevels: Set<number>;
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    pendingSensorEvents: PendingSensorEvent[];
}> = {}) {
    return {
        hydratedLevels: new Set<number>([7]),
        creatures: [] as CreatureInstance[],
        floorItems: [] as FloorItem[],
        openDoors: new Set<string>(),
        openWalls: new Set<string>(),
        openPits: new Set<string>(['7,1,1']),
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: {} as ChampionEquipment },
        pendingSensorEvents: [] as PendingSensorEvent[],
        ...overrides,
    };
}

test('applyFloorItemPitEffects drops a moved item through an already open pit', () => {
    const item = createItem('gem-moved');
    const transitions: Array<{ mode: 'enter' | 'leave'; level: number; x: number; y: number; ids: string[] }> = [];
    const state = createState({
        floorItems: [item],
    });

    const patch = applyFloorItemPitEffects<
        typeof state,
        { snapshot: true },
        PendingSensorEvent,
        Partial<typeof state>
    >(
        state,
        {
            floorItems: [{ ...item, x: 1, y: 1 }],
        },
        {
            buildSensorStateSnapshot: () => ({ snapshot: true }),
            triggerFloorSensors: (level, x, y, _sensorState, _inventories, _equipment, floorItems, pendingSensorEvents, _source, mode) => {
                transitions.push({ mode, level, x, y, ids: floorItems.map((entry) => entry.id) });
                return {
                    sensorChanges: { floorItems },
                    pendingSensorEvents,
                };
            },
            resolvePitLanding: (_level, y, x) => ({ level: 8, x: x + 8, y: y + 6 }),
            buildLevelHydrationPatch: () => ({
                hydratedLevels: new Set<number>([7, 8]),
            }),
        },
    );

    assert.deepEqual(patch.floorItems, [
        {
            ...item,
            mapIndex: 8,
            x: 9,
            y: 7,
            tilePos: 'North',
        },
    ]);
    assert.deepEqual([...patch.hydratedLevels ?? []], [7, 8]);
    assert.deepEqual(transitions, [
        { mode: 'leave', level: 7, x: 1, y: 1, ids: [] },
        { mode: 'enter', level: 8, x: 9, y: 7, ids: ['gem-moved'] },
    ]);
});

test('applyFloorItemPitEffects also drops a newly added item through an already open pit', () => {
    const thrownGem = createItem('gem-thrown', {
        x: 1,
        y: 1,
        projectileDropped: true,
    });
    const state = createState();

    const patch = applyFloorItemPitEffects<
        typeof state,
        { snapshot: true },
        PendingSensorEvent,
        Partial<typeof state>
    >(
        state,
        {
            floorItems: [thrownGem],
        },
        {
            buildSensorStateSnapshot: () => ({ snapshot: true }),
            triggerFloorSensors: (_level, _x, _y, _sensorState, _inventories, _equipment, floorItems, pendingSensorEvents) => ({
                sensorChanges: { floorItems },
                pendingSensorEvents,
            }),
            resolvePitLanding: (_level, y, x) => ({ level: 8, x: x + 8, y: y + 6 }),
            buildLevelHydrationPatch: () => null,
        },
    );

    assert.deepEqual(patch.floorItems, [
        {
            ...thrownGem,
            mapIndex: 8,
            x: 9,
            y: 7,
            tilePos: 'North',
        },
    ]);
});

test('applyFloorItemPitEffects drops an item when a pit opens under it without moving the item first', () => {
    const item = createItem('gem-opened', { x: 1, y: 1 });
    const state = createState({
        floorItems: [item],
        openPits: new Set<string>(),
    });

    const patch = applyFloorItemPitEffects<
        typeof state,
        { snapshot: true },
        PendingSensorEvent,
        Partial<typeof state>
    >(
        state,
        {
            openPits: new Set<string>(['7,1,1']),
        },
        {
            buildSensorStateSnapshot: () => ({ snapshot: true }),
            triggerFloorSensors: (_level, _x, _y, _sensorState, _inventories, _equipment, floorItems, pendingSensorEvents) => ({
                sensorChanges: { floorItems },
                pendingSensorEvents,
            }),
            resolvePitLanding: (_level, y, x) => ({ level: 8, x: x + 8, y: y + 6 }),
            buildLevelHydrationPatch: () => null,
        },
    );

    assert.deepEqual(patch.floorItems, [
        {
            ...item,
            mapIndex: 8,
            x: 9,
            y: 7,
            tilePos: 'North',
        },
    ]);
});

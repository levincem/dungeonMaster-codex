import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import {
    buildFillWaterRuntimePatch,
    buildUseItemRuntimePatch,
    runChampionItemOnFrontWallRuntime,
    runFloorItemOnFrontWallRuntime,
} from '../src/engine/systems/itemCommandRuntime.js';

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

function createVitals(): ChampionVitals {
    return {
        hp: 50,
        stamina: 40,
        mana: 10,
        food: 0,
        water: 0,
        currentStats: {
            luck: 10,
            strength: 10,
            dexterity: 10,
            wisdom: 10,
            vitality: 10,
            antiMagic: 10,
            antiFire: 10,
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

function createPotion(id: string): FloorItem {
    return {
        id,
        category: 'Potion',
        typeId: 1,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

test('buildUseItemRuntimePatch delegates to the use-item state builder', () => {
    const potion = createPotion('potion-1');
    const patch = buildUseItemRuntimePatch(
        {
            party: [createChampion(1)],
            championVitals: { 1: createVitals() },
            championInventories: { 1: [potion] },
            championEquipment: { 1: {} as ChampionEquipment },
            activePotionBoosts: [],
            activeShields: [],
        },
        1,
        potion.id,
        'inventory',
        1000,
        {
            locateChampionItem: () => ({
                inventory: [potion],
                equipment: {} as ChampionEquipment,
                inventoryIndex: 0,
                item: potion,
            }),
            getEffectiveChampionStatsRuntime: () => ({ stamina: 80, mana: 20, health: 100 }),
            normalizeChampionCurrentStats: (_champion, currentStats) => currentStats,
            resolveUseItemConsumption: () => ({
                kind: 'handled',
                nextVitals: { ...createVitals(), hp: 70 },
                replacementItem: null,
                shouldConsumeOriginal: true,
                activeShields: [],
            }),
            buildUseItemPatch: (args) => ({ hp: args.nextVitals.hp }),
        },
    );

    assert.deepEqual(patch, { hp: 70 });
});

test('buildFillWaterRuntimePatch requires a fountain before delegating', () => {
    const flask = {
        id: 'flask',
        category: 'Potion',
        typeId: 20,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
        waterCharges: 0,
        waterMaxCharges: 1,
    } satisfies FloorItem;

    const noFountain = buildFillWaterRuntimePatch(
        {
            level: 0,
            position: [5, 5],
            direction: 'NORTH',
            championInventories: { 1: [flask] },
            championEquipment: { 1: {} },
        },
        1,
        flask.id,
        {
            isFacingFountain: () => false,
            canFillWaterContainer: () => true,
            fillWaterContainer: () => flask,
        },
    );
    assert.equal(noFountain, null);

    const filledFlask = { ...flask, typeId: 15, waterCharges: 1 };
    const patch = buildFillWaterRuntimePatch(
        {
            level: 0,
            position: [5, 5],
            direction: 'NORTH',
            championInventories: { 1: [flask] },
            championEquipment: { 1: {} },
        },
        1,
        flask.id,
        {
            isFacingFountain: () => true,
            canFillWaterContainer: () => true,
            fillWaterContainer: () => filledFlask,
        },
    );

    assert.deepEqual(patch, {
        championInventories: { 1: [filledFlask] },
    });
});

test('runChampionItemOnFrontWallRuntime delegates to front-wall interactions', () => {
    const state = {
        level: 0,
        position: [5, 5] as [number, number],
        direction: 'NORTH' as const,
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: {} as ChampionEquipment },
        floorItems: [] as FloorItem[],
        activeFloorDrag: null,
    };

    const result = runChampionItemOnFrontWallRuntime(
        state,
        1,
        'item-1',
        'inventory',
        {
            buildSensorStateSnapshot: () => ({}),
            isAltarWallFace: () => false,
            buildViAltarResurrectionPatch: () => null,
            triggerLockSensors: () => ({ sensorChanges: { openDoors: ['0,4,5'] }, newInventories: null, newEquipment: null, matched: true }),
            triggerAnyObjectWallSensor: () => ({ sensorChanges: {}, matched: false }),
            triggerAlcoveDepositSensor: () => ({ sensorChanges: {}, newInventories: null, newEquipment: null, depositedItem: null, matched: false }),
            triggerObjectExchangerSensor: () => ({ sensorChanges: {}, newInventories: null, newEquipment: null, matched: false }),
            applyFirestaffExchangerReward: () => ({ nextInventories: null, nextEquipment: null, nextFloorItems: [], transformed: false }),
            applyImmediateTransportSquareEffects: (_currentState, patch) => patch,
            buildAttackResultMessage: (message: string) => ({ message }),
        },
    );

    assert.equal(result.matched, true);
    assert.equal(result.shouldPlayPlate, true);
    assert.deepEqual(result.patch, { openDoors: ['0,4,5'] });
});

test('runFloorItemOnFrontWallRuntime delegates to front-wall floor item interactions', () => {
    const item = createPotion('item-1');
    const state = {
        level: 0,
        position: [5, 5] as [number, number],
        direction: 'NORTH' as const,
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: {} as ChampionEquipment },
        floorItems: [item],
        activeFloorDrag: { itemId: item.id },
    };

    const result = runFloorItemOnFrontWallRuntime(
        state,
        item.id,
        1,
        {
            buildSensorStateSnapshot: () => ({}),
            isAltarWallFace: () => false,
            buildViAltarResurrectionPatch: () => null,
            triggerLockSensors: () => ({ sensorChanges: {}, newInventories: null, newEquipment: null, matched: false }),
            triggerAnyObjectWallSensor: () => ({ sensorChanges: {}, matched: false }),
            triggerAlcoveDepositSensor: () => ({ sensorChanges: {}, newInventories: null, newEquipment: null, depositedItem: null, matched: false }),
            triggerObjectExchangerSensor: () => ({ sensorChanges: { activeSensors: ['0_1'] }, newInventories: { 1: [] }, newEquipment: null, matched: true }),
            applyFirestaffExchangerReward: () => ({ nextInventories: { 1: [] }, nextEquipment: null, nextFloorItems: [], transformed: true }),
            applyImmediateTransportSquareEffects: (_currentState, patch) => patch,
            buildAttackResultMessage: (message: string) => ({ message }),
        },
    );

    assert.equal(result.matched, true);
    assert.equal(result.shouldPlayPlate, true);
    assert.deepEqual(result.patch, {
        activeSensors: ['0_1'],
        championInventories: { 1: [] },
        floorItems: [],
        activeFloorDrag: null,
        lastCastResult: { message: 'The Firestaff absorbs the energy of the Amalgam.' },
    });
});

test('runChampionItemOnFrontWallRuntime revives bones on the Vi altar before wall sensors', () => {
    const bones: FloorItem = {
        id: 'bones-1',
        category: 'Misc',
        typeId: 5,
        championId: 7,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
    const state = {
        level: 0,
        position: [5, 5] as [number, number],
        direction: 'NORTH' as const,
        championInventories: { 1: [bones] },
        championEquipment: { 1: {} as ChampionEquipment },
        floorItems: [] as FloorItem[],
        activeFloorDrag: null,
    };

    const result = runChampionItemOnFrontWallRuntime(
        state,
        1,
        bones.id,
        'inventory',
        {
            buildSensorStateSnapshot: () => {
                throw new Error('sensor snapshot should not run for altar resurrection');
            },
            isAltarWallFace: () => true,
            buildViAltarResurrectionPatch: (_currentState, deadChampionId, consumedItemId, carriedBy) => ({
                deadChampionId,
                consumedItemId,
                carriedBy,
            }),
            triggerLockSensors: () => ({ sensorChanges: {}, newInventories: null, newEquipment: null, matched: false }),
            triggerAnyObjectWallSensor: () => ({ sensorChanges: {}, matched: false }),
            triggerAlcoveDepositSensor: () => ({ sensorChanges: {}, newInventories: null, newEquipment: null, depositedItem: null, matched: false }),
            triggerObjectExchangerSensor: () => ({ sensorChanges: {}, newInventories: null, newEquipment: null, matched: false }),
            applyFirestaffExchangerReward: () => ({ nextInventories: null, nextEquipment: null, nextFloorItems: [], transformed: false }),
            applyImmediateTransportSquareEffects: (_currentState, patch) => patch,
            buildAttackResultMessage: (message: string) => ({ message }),
        },
    );

    assert.equal(result.matched, true);
    assert.equal(result.shouldPlayPlate, false);
    assert.deepEqual(result.patch, {
        deadChampionId: 7,
        consumedItemId: bones.id,
        carriedBy: { championId: 1, fromSlot: 'inventory' },
    });
});

test('runFloorItemOnFrontWallRuntime revives bones on the Vi altar and clears floor drag', () => {
    const bones: FloorItem = {
        id: 'bones-2',
        category: 'Misc',
        typeId: 5,
        championId: 8,
        mapIndex: 0,
        x: 4,
        y: 4,
        tilePos: 'North',
    };
    const state = {
        level: 0,
        position: [5, 5] as [number, number],
        direction: 'NORTH' as const,
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: {} as ChampionEquipment },
        floorItems: [bones],
        activeFloorDrag: { itemId: bones.id },
    };

    const result = runFloorItemOnFrontWallRuntime(
        state,
        bones.id,
        1,
        {
            buildSensorStateSnapshot: () => {
                throw new Error('sensor snapshot should not run for altar resurrection');
            },
            isAltarWallFace: () => true,
            buildViAltarResurrectionPatch: (_currentState, deadChampionId, consumedItemId, carriedBy) => ({
                deadChampionId,
                consumedItemId,
                carriedBy,
            }),
            triggerLockSensors: () => ({ sensorChanges: {}, newInventories: null, newEquipment: null, matched: false }),
            triggerAnyObjectWallSensor: () => ({ sensorChanges: {}, matched: false }),
            triggerAlcoveDepositSensor: () => ({ sensorChanges: {}, newInventories: null, newEquipment: null, depositedItem: null, matched: false }),
            triggerObjectExchangerSensor: () => ({ sensorChanges: {}, newInventories: null, newEquipment: null, matched: false }),
            applyFirestaffExchangerReward: () => ({ nextInventories: null, nextEquipment: null, nextFloorItems: [], transformed: false }),
            applyImmediateTransportSquareEffects: (_currentState, patch) => patch,
            buildAttackResultMessage: (message: string) => ({ message }),
        },
    );

    assert.equal(result.matched, true);
    assert.equal(result.shouldPlayPlate, false);
    assert.deepEqual(result.patch, {
        deadChampionId: 8,
        consumedItemId: bones.id,
        carriedBy: null,
        activeFloorDrag: null,
    });
});

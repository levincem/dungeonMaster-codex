import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import { buildFillWaterRuntimePatch, buildUseItemRuntimePatch } from '../src/engine/systems/itemCommandRuntime.js';
import { buildResurrectChampionRuntimePatch } from '../src/engine/systems/itemCarryCommandRuntime.js';
import {
    buildStoreFillWaterPatch,
    buildStoreResurrectChampionPatch,
    buildStoreUseItemPatch,
    createStoreFillWaterRuntimeDeps,
    createStoreResurrectChampionRuntimeDeps,
    createStoreUseItemRuntimeDeps,
} from '../src/engine/systems/storeItemRuntime.js';

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

test('createStoreUseItemRuntimeDeps wires nested consumption deps into the runtime helper', () => {
    const potion: FloorItem = {
        id: 'potion-1',
        category: 'Potion',
        typeId: 1,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
    let seenMaxFood = 0;

    const deps = createStoreUseItemRuntimeDeps({
        locateChampionItem: () => ({
            inventory: [potion],
            equipment: {} as ChampionEquipment,
            inventoryIndex: 0,
            item: potion,
        }),
        getEffectiveChampionStatsRuntime: () => ({ stamina: 80, mana: 20, health: 100 }),
        normalizeChampionCurrentStats: (_champion, currentStats) => currentStats,
        consumptionDeps: {
            isWaterContainer: () => false,
            consumeWaterContainer: () => null,
            clampFoodWater: (value) => value,
            getPotionDef: () => ({ id: 1, name: 'Potion', effect: 'health', drinkable: true }),
            getMiscNutrition: () => null,
            resolvePotionConsumption: (args) => {
                seenMaxFood = args.normalizedStats.luck;
                return {
                    nextVitals: createVitals(),
                    replacementItem: {
                        id: 'flask',
                        category: 'Potion',
                        typeId: 0,
                        mapIndex: 0,
                        x: 0,
                        y: 0,
                        tilePos: 'North',
                    },
                };
            },
            maxFood: 2048,
            maxWater: 2048,
        },
        buildUseItemPatch: (args) => ({ hp: args.nextVitals.hp }),
    });

    const patch = buildStoreUseItemPatch(
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
        deps,
    );

    assert.equal(seenMaxFood, 10);
    assert.deepEqual(patch, { hp: 50 });
    assert.deepEqual(
        buildUseItemRuntimePatch(
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
            deps,
        ),
        { hp: 50 },
    );
});

test('createStoreFillWaterRuntimeDeps and buildStoreFillWaterPatch delegate to the fill-water runtime', () => {
    const flask: FloorItem = {
        id: 'flask',
        category: 'Potion',
        typeId: 20,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
        waterCharges: 0,
        waterMaxCharges: 1,
    };
    const filledFlask = { ...flask, typeId: 15, waterCharges: 1 };

    const deps = createStoreFillWaterRuntimeDeps({
        isFacingFountain: () => true,
        canFillWaterContainer: () => true,
        fillWaterContainer: () => filledFlask,
    });

    const state = {
        level: 0,
        position: [5, 5] as [number, number],
        direction: 'NORTH' as const,
        championInventories: { 1: [flask] },
        championEquipment: { 1: {} as ChampionEquipment },
    };

    assert.deepEqual(buildStoreFillWaterPatch(state, 1, flask.id, deps), {
        championInventories: { 1: [filledFlask] },
    });
    assert.deepEqual(buildFillWaterRuntimePatch(state, 1, flask.id, deps), {
        championInventories: { 1: [filledFlask] },
    });
});

test('createStoreResurrectChampionRuntimeDeps and buildStoreResurrectChampionPatch delegate to resurrection runtime', () => {
    const deadChampion = createChampion(7);
    const bones: FloorItem = {
        id: 'bones-1',
        category: 'Misc',
        typeId: 5,
        championId: deadChampion.id,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
    const state = {
        level: 0,
        position: [4, 5] as [number, number],
        party: [createChampion(1)],
        championInventories: { 1: [bones] },
        championEquipment: { 1: {} as ChampionEquipment },
        floorItems: [] as FloorItem[],
        deadChampions: { [deadChampion.id]: deadChampion },
    };
    const deps = createStoreResurrectChampionRuntimeDeps({
        maxPartySize: 4,
        isAltarTile: () => true,
        buildViAltarResurrectionPatch: (_state, deadChampionId, bonesItemId, carriedBy) => ({
            deadChampionId,
            bonesItemId,
            carriedBy,
        }),
    });

    assert.deepEqual(buildStoreResurrectChampionPatch(state, bones.id, deps), {
        deadChampionId: deadChampion.id,
        bonesItemId: bones.id,
        carriedBy: 1,
    });
    assert.deepEqual(buildResurrectChampionRuntimePatch(state, bones.id, deps), {
        deadChampionId: deadChampion.id,
        bonesItemId: bones.id,
        carriedBy: 1,
    });
});

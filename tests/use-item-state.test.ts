import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import { buildUseItemStatePatch } from '../src/engine/systems/useItemState.js';

function createChampion(id: number): Champion {
    return {
        id,
        name: 'Halk',
        title: 'The Brave',
        gender: 'M',
        class: 'Fighter',
        health: 100,
        stamina: 80,
        mana: 20,
        strength: 20,
        dexterity: 16,
        wisdom: 8,
        vitality: 15,
        antiMagic: 6,
        antiFire: 4,
        luck: 10,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: 'portrait.png',
    };
}

const potion: FloorItem = {
    id: 'potion-1',
    category: 'Potion',
    typeId: 1,
    rawName: 'Potion',
    mapIndex: 0,
    x: 0,
    y: 0,
    tilePos: 'North',
};

test('buildUseItemStatePatch returns null when the item cannot be located', () => {
    const patch = buildUseItemStatePatch(
        {
            party: [createChampion(1)],
            championVitals: { 1: { hp: 50, stamina: 40, mana: 10, food: 0, water: 0, currentStats: { luck: 10, strength: 10, dexterity: 10, wisdom: 10, vitality: 10, antiMagic: 10, antiFire: 10 }, wounds: { head: false, torso: false, leftHand: false, rightHand: false, legs: false, feet: false }, poisonEntries: [] } },
            championInventories: { 1: [] },
            championEquipment: { 1: {} as ChampionEquipment },
            activePotionBoosts: [],
            activeShields: [],
        },
        1,
        'missing',
        'inventory',
        1000,
        {
            locateChampionItem: () => null,
            getEffectiveChampionStatsRuntime: () => ({ stamina: 80, mana: 20, health: 100 }),
            normalizeChampionCurrentStats: (_champion, currentStats) => currentStats,
            resolveUseItemConsumption: () => ({ kind: 'unhandled' }),
            buildUseItemPatch: () => ({}),
        },
    );

    assert.equal(patch, null);
});

test('buildUseItemStatePatch delegates consumption and patch building', () => {
    const baseVitals = {
        hp: 50,
        stamina: 40,
        mana: 10,
        food: 0,
        water: 0,
        currentStats: { luck: 10, strength: 10, dexterity: 10, wisdom: 10, vitality: 10, antiMagic: 10, antiFire: 10 },
        wounds: { head: false, torso: false, leftHand: false, rightHand: false, legs: false, feet: false },
        poisonEntries: [],
    };
    const patch = buildUseItemStatePatch(
        {
            party: [createChampion(1)],
            championVitals: { 1: baseVitals },
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
                nextVitals: { ...baseVitals, hp: 70 },
                replacementItem: null,
                shouldConsumeOriginal: true,
                activeShields: [],
            }),
            buildUseItemPatch: (args) => ({ championId: args.championId, hp: args.nextVitals.hp }),
        },
    );

    assert.deepEqual(patch, { championId: 1, hp: 70 });
});

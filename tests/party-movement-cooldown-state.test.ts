import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import {
    computeChampionMovementTicks,
    computePartyMovementCooldownSeconds,
} from '../src/engine/systems/partyMovementCooldownState.js';

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champion ${id}`,
        title: 'The Swift',
        gender: 'M',
        class: 'Ninja',
        health: 100,
        stamina: 80,
        mana: 20,
        luck: 10,
        strength: 18,
        dexterity: 16,
        wisdom: 10,
        vitality: 12,
        antiMagic: 5,
        antiFire: 4,
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

function createVitals(): ChampionVitals {
    return {
        hp: 50,
        stamina: 40,
        mana: 10,
        food: 100,
        water: 100,
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

test('computeChampionMovementTicks rewards boots of speed', () => {
    const ticks = computeChampionMovementTicks(
        createChampion(1),
        createVitals(),
        { feet: { id: 'boots', category: 'Armor', typeId: 0, rawName: 'Boots of Speed', mapIndex: 0, x: 0, y: 0, tilePos: 'North' } },
        [],
        {},
        {
            getTotalWeight: () => 0,
            getChampionMaxLoad: () => 10,
        },
    );

    assert.equal(ticks, 1);
});

test('computePartyMovementCooldownSeconds uses the slowest champion', () => {
    const cooldown = computePartyMovementCooldownSeconds(
        {
            party: [createChampion(1), createChampion(2)],
            championVitals: {
                1: createVitals(),
                2: { ...createVitals(), wounds: { ...createVitals().wounds, feet: true } },
            },
            championEquipment: { 1: {}, 2: {} },
            championInventories: { 1: [], 2: [] },
            activePotionBoosts: [],
        },
        {
            getTotalWeight: () => 0,
            getChampionMaxLoad: () => 10,
            getChampionRuntimeBonuses: () => ({}),
        },
    );

    assert.ok(cooldown > 0.42);
    assert.ok(cooldown < 0.43);
});

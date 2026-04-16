import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import { applyPartyLoadBasedFatigueState } from '../src/engine/systems/partyFatigueState.js';

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champion ${id}`,
        title: 'The Brave',
        gender: 'M',
        class: 'Fighter',
        health: 100,
        stamina: 80,
        mana: 20,
        luck: 10,
        strength: 20,
        dexterity: 16,
        wisdom: 14,
        vitality: 15,
        antiMagic: 6,
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
        hp: 40,
        stamina: 20,
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

test('applyPartyLoadBasedFatigueState applies stamina loss from load ratio', () => {
    const patch = applyPartyLoadBasedFatigueState(
        {
            party: [createChampion(1)],
            championVitals: { 1: createVitals() },
            championEquipment: { 1: {} },
            championInventories: { 1: [] },
            activePotionBoosts: [],
        },
        3,
        {
            getEffectiveChampionStatsRuntime: () => ({ stamina: 30 }),
            getTotalWeight: () => 20,
            getChampionMaxLoad: () => 10,
            getChampionRuntimeBonuses: () => ({}),
            applyChampionStaminaDeltaOriginal: (vitals, _max, delta) => ({
                ...vitals,
                stamina: vitals.stamina + delta,
            }),
        },
    );

    assert.ok(patch);
    assert.equal(patch?.[1]?.stamina, 13);
});

test('applyPartyLoadBasedFatigueState returns null when no living champion changes', () => {
    const patch = applyPartyLoadBasedFatigueState(
        {
            party: [createChampion(1)],
            championVitals: { 1: { ...createVitals(), hp: 0 } },
            championEquipment: { 1: {} },
            championInventories: { 1: [] },
            activePotionBoosts: [],
        },
        3,
        {
            getEffectiveChampionStatsRuntime: () => ({ stamina: 30 }),
            getTotalWeight: () => 20,
            getChampionMaxLoad: () => 10,
            getChampionRuntimeBonuses: () => ({}),
            applyChampionStaminaDeltaOriginal: (vitals) => vitals,
        },
    );

    assert.equal(patch, null);
});

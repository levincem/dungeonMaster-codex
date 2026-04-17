import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import { applyFrontRowWallBumpDamageState, applyPartyWideIncomingAttackState } from '../src/engine/systems/partyIncomingDamageState.js';

function createChampion(id: number, name: string): Champion {
    return {
        id,
        name,
        title: 'The Brave',
        gender: 'M',
        class: 'Fighter',
        health: 100,
        stamina: 80,
        mana: 20,
        luck: 10,
        strength: 20,
        dexterity: 16,
        wisdom: 8,
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

const baseState = {
    level: 0,
    position: [1, 2] as [number, number],
    party: [createChampion(1, 'Halk'), createChampion(2, 'Tiggy')],
    championInventories: {},
    championEquipment: {},
    floorItems: [],
    deadChampions: {},
    selectedChampionIndex: 0,
    damageEvents: [],
    activeShields: [],
    activePotionBoosts: [],
};

const vitals = {
    1: {
        hp: 30,
        stamina: 10,
        mana: 5,
        food: 0,
        water: 0,
        currentStats: { luck: 10, strength: 10, dexterity: 10, wisdom: 10, vitality: 10, antiMagic: 10, antiFire: 10 },
        wounds: { head: false, torso: false, leftHand: false, rightHand: false, legs: false, feet: false },
        poisonEntries: [],
    },
    2: {
        hp: 30,
        stamina: 10,
        mana: 5,
        food: 0,
        water: 0,
        currentStats: { luck: 10, strength: 10, dexterity: 10, wisdom: 10, vitality: 10, antiMagic: 10, antiFire: 10 },
        wounds: { head: false, torso: false, leftHand: false, rightHand: false, legs: false, feet: false },
        poisonEntries: [],
    },
};

test('applyFrontRowWallBumpDamageState damages the front row', () => {
    const patch = applyFrontRowWallBumpDamageState(
        baseState,
        vitals,
        1000,
        {
            randomInt: () => 0,
            buildChampionDamageEvent: () => ({
                id: 'event-1',
                level: 0,
                target: 'champion',
                amount: 1,
                ts: 0,
            }),
            buildDeathDrop: (state) => ({
                party: state.party,
                floorItems: state.floorItems,
                championInventories: state.championInventories,
                championEquipment: state.championEquipment,
                deadChampions: state.deadChampions,
            }),
        },
    );

    assert.ok(patch);
    assert.equal((patch?.championVitals as typeof vitals)[1].hp, 29);
    assert.equal((patch?.championVitals as typeof vitals)[2].hp, 29);
});

test('applyPartyWideIncomingAttackState records damage events and death drops', () => {
    const patch = applyPartyWideIncomingAttackState(
        baseState,
        vitals,
        10,
        'Blunt',
        ['legs'],
        1000,
        false,
        {
            rollOriginalPartyWideAttack: (damage) => damage,
            resolveChampionIncomingAttack: (_state, _champion, currentVitals) => ({
                damage: currentVitals.hp,
                nextVitals: { ...currentVitals, hp: 0 },
            }),
            buildChampionDamageEvent: (level, championId, damage) => ({
                id: `event-${championId}`,
                level,
                target: 'champion',
                championId,
                amount: damage,
                ts: 0,
            }),
            buildDeathDrop: (state, championId) => ({
                party: state.party.filter((champion) => champion.id !== championId),
                floorItems: state.floorItems,
                championInventories: state.championInventories,
                championEquipment: state.championEquipment,
                deadChampions: { ...state.deadChampions, [championId]: createChampion(championId, 'Dead') },
            }),
        },
    );

    assert.ok(patch);
    assert.deepEqual((patch?.party as Champion[]).map((champion) => champion.id), []);
    assert.equal((patch?.damageEvents as Array<{ championId: number; damage: number }>).length, 2);
});

test('applyPartyWideIncomingAttackState preserves nextVitals even when incoming damage resolves to zero', () => {
    const patch = applyPartyWideIncomingAttackState(
        baseState,
        vitals,
        10,
        'Blunt',
        ['legs'],
        1000,
        false,
        {
            rollOriginalPartyWideAttack: (damage) => damage,
            resolveChampionIncomingAttack: (_state, champion, currentVitals) => ({
                damage: 0,
                nextVitals: {
                    ...currentVitals,
                    currentStats: {
                        ...currentVitals.currentStats,
                        luck: currentVitals.currentStats.luck + champion.id,
                    },
                },
            }),
            buildChampionDamageEvent: () => {
                throw new Error('damage event should not be emitted for zero damage');
            },
            buildDeathDrop: () => {
                throw new Error('death drop should not happen for zero damage');
            },
        },
    );

    assert.ok(patch);
    assert.equal((patch?.championVitals as typeof vitals)[1].currentStats.luck, 11);
    assert.equal((patch?.championVitals as typeof vitals)[2].currentStats.luck, 12);
    assert.equal(patch?.damageEvents, undefined);
});

test('applyPartyWideIncomingAttackState rolls spread attack separately for each living champion', () => {
    const rolled: number[] = [];
    const patch = applyPartyWideIncomingAttackState(
        baseState,
        vitals,
        10,
        'Blunt',
        ['legs'],
        1000,
        true,
        {
            rollOriginalPartyWideAttack: (damage) => {
                const next = damage + rolled.length + 1;
                rolled.push(next);
                return next;
            },
            resolveChampionIncomingAttack: (_state, champion, currentVitals, attack) => ({
                damage: attack,
                nextVitals: { ...currentVitals, hp: currentVitals.hp - (champion.id === 1 ? 11 : 12) },
            }),
            buildChampionDamageEvent: (level, championId, damage) => ({
                id: `event-${championId}`,
                level,
                target: 'champion',
                championId,
                amount: damage,
                ts: 0,
            }),
            buildDeathDrop: () => {
                throw new Error('death drop should not happen in spread test');
            },
        },
    );

    assert.deepEqual(rolled, [11, 12]);
    assert.deepEqual(
        (patch?.damageEvents as Array<{ championId: number; amount: number }>).map((entry) => entry.amount),
        [11, 12],
    );
});

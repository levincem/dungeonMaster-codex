import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import { resolveCreatureAttackTargetState } from '../src/engine/systems/creatureAttackTargetState.js';

function createChampion(id: number, name: string): Champion {
    return {
        id,
        name,
        title: 'The Target',
        gender: 'M',
        class: 'Fighter',
        health: 80,
        stamina: 60,
        mana: 10,
        luck: 10,
        strength: 20,
        dexterity: 16,
        wisdom: 8,
        vitality: 14,
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

function createVitals(hp: number): ChampionVitals {
    return {
        hp,
        stamina: 30,
        mana: 5,
        food: 900,
        water: 900,
        currentStats: {
            luck: 10,
            strength: 20,
            dexterity: 16,
            wisdom: 8,
            vitality: 14,
            antiMagic: 6,
            antiFire: 4,
        },
        wounds: {
            rightHand: false,
            leftHand: false,
            head: false,
            torso: false,
            legs: false,
            feet: false,
        },
        poisonEntries: [],
    };
}

function createItem(id: string): FloorItem {
    return {
        id,
        category: 'Misc',
        typeId: 1,
        rawName: id,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

test('resolveCreatureAttackTargetState returns empty defaults when no target is selected', () => {
    const result = resolveCreatureAttackTargetState({
        party: [createChampion(1, 'Halk')],
        championVitals: { 1: createVitals(20) },
        championInventories: { 1: [createItem('apple')] },
        championEquipment: { 1: {} },
        selectedTargetId: null,
    });

    assert.deepEqual(result, {
        targetChampion: null,
        targetVitals: null,
        targetInventory: [],
        targetEquipment: {},
    });
});

test('resolveCreatureAttackTargetState resolves champion, vitals, inventory and equipment together', () => {
    const targetChampion = createChampion(2, 'Tiggy');
    const targetEquipment: ChampionEquipment = { torso: createItem('mail') };
    const result = resolveCreatureAttackTargetState({
        party: [createChampion(1, 'Halk'), targetChampion],
        championVitals: { 2: createVitals(24) },
        championInventories: { 2: [createItem('compass')] },
        championEquipment: { 2: targetEquipment },
        selectedTargetId: 2,
    });

    assert.equal(result.targetChampion?.id, 2);
    assert.equal(result.targetVitals?.hp, 24);
    assert.deepEqual(result.targetInventory, [createItem('compass')]);
    assert.deepEqual(result.targetEquipment, targetEquipment);
});

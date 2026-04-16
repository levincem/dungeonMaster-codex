import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import { buildTickMonstersPatch } from '../src/engine/systems/tickMonstersFinalize.js';

function createChampion(id: number, name: string): Champion {
    return {
        id,
        name,
        title: 'The Survivor',
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

test('buildTickMonstersPatch returns null when nothing changed', () => {
    const sharedParty = [createChampion(1, 'Halk')];
    const sharedCreatures: never[] = [];
    const sharedProjectiles: never[] = [];
    const sharedChampionVitals = {};
    const sharedDamageEvents: never[] = [];
    const sharedChampionInventories = {};
    const sharedChampionEquipment = {};
    const patch = buildTickMonstersPatch({
        creatures: sharedCreatures,
        baseCreatures: sharedCreatures,
        projectiles: sharedProjectiles,
        baseProjectiles: sharedProjectiles,
        championVitals: sharedChampionVitals,
        baseChampionVitals: sharedChampionVitals,
        damageEvents: sharedDamageEvents,
        baseDamageEvents: sharedDamageEvents,
        championInventories: sharedChampionInventories,
        baseChampionInventories: sharedChampionInventories,
        championEquipment: sharedChampionEquipment,
        baseChampionEquipment: sharedChampionEquipment,
        lastCreatureAttackGameTick: 0,
        baseLastCreatureAttackGameTick: 0,
        party: sharedParty,
        baseParty: sharedParty,
        selectedChampionIndex: 0,
        floorItems: [],
        deadChampions: {},
    });

    assert.equal(patch, null);
});

test('buildTickMonstersPatch includes updated party payload and clamps selected champion index', () => {
    const patch = buildTickMonstersPatch({
        creatures: [],
        baseCreatures: [],
        projectiles: [],
        baseProjectiles: [],
        championVitals: {},
        baseChampionVitals: {},
        damageEvents: [],
        baseDamageEvents: [],
        championInventories: {},
        baseChampionInventories: {},
        championEquipment: {},
        baseChampionEquipment: {},
        lastCreatureAttackGameTick: 0,
        baseLastCreatureAttackGameTick: 0,
        party: [createChampion(2, 'Tiggy')],
        baseParty: [createChampion(1, 'Halk'), createChampion(2, 'Tiggy')],
        selectedChampionIndex: 3,
        floorItems: [],
        deadChampions: {},
    });

    assert.ok(patch);
    assert.equal(patch?.selectedChampionIndex, 0);
});

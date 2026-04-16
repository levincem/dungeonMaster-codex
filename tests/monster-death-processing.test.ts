import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import { processMonsterTickChampionDeaths } from '../src/engine/systems/monsterDeathProcessing.js';

function createChampion(id: number, name: string): Champion {
    return {
        id,
        name,
        title: 'The Fallen',
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

test('processMonsterTickChampionDeaths applies buildDeathDrop in sequence for all dead champions', () => {
    const calls: number[] = [];
    const result = processMonsterTickChampionDeaths(
        {
            level: 0,
            position: [1, 2],
            party: [createChampion(1, 'Halk'), createChampion(2, 'Tiggy')],
            championInventories: {},
            championEquipment: {},
            floorItems: [],
            deadChampions: {},
        },
        [1, 2],
        1000,
        {
            buildDeathDrop: (state, championId) => {
                const fallen = state.party.find((champion) => champion.id === championId);
                calls.push(championId);
                return {
                    party: state.party.filter((champion) => champion.id !== championId),
                    deadChampions: {
                        ...state.deadChampions,
                        ...(fallen ? { [championId]: fallen } : {}),
                    },
                    championInventories: state.championInventories,
                    championEquipment: state.championEquipment,
                    floorItems: state.floorItems,
                };
            },
        },
    );

    assert.deepEqual(calls, [1, 2]);
    assert.deepEqual(result.party.map((champion) => champion.id), []);
    assert.deepEqual(Object.keys(result.deadChampions), ['1', '2']);
});

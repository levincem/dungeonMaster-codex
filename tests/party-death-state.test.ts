import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import { applyChampionDeathDropsToPartyState } from '../src/engine/systems/partyDeathState.js';

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

test('applyChampionDeathDropsToPartyState applies death drops sequentially and clamps selection', () => {
    const patch = applyChampionDeathDropsToPartyState(
        {
            level: 0,
            position: [1, 2],
            party: [createChampion(1, 'Halk'), createChampion(2, 'Tiggy')],
            championInventories: {},
            championEquipment: {},
            floorItems: [],
            deadChampions: {},
            selectedChampionIndex: 2,
        },
        [1],
        1000,
        {
            buildDeathDrop: (state, championId) => {
                const fallen = state.party.find((champion) => champion.id === championId)!;
                return {
                    party: state.party.filter((champion) => champion.id !== championId),
                    floorItems: state.floorItems,
                    championInventories: state.championInventories,
                    championEquipment: state.championEquipment,
                    deadChampions: { ...state.deadChampions, [championId]: fallen },
                };
            },
        },
    );

    assert.ok(patch);
    assert.deepEqual(patch?.party.map((champion) => champion.id), [2]);
    assert.equal(patch?.selectedChampionIndex, 0);
});

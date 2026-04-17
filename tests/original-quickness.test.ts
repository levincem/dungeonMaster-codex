import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeOriginalQuickness } from '../src/engine/systems/originalQuickness.js';
import type { Champion } from '../src/types/champion.js';

function createChampion(): Champion {
    return {
        id: 1,
        name: 'Tiggy',
        title: 'The Swift',
        gender: 'F',
        class: 'Wizard',
        health: 90,
        stamina: 70,
        mana: 40,
        luck: 12,
        strength: 18,
        dexterity: 24,
        wisdom: 28,
        vitality: 22,
        antiMagic: 10,
        antiFire: 8,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [1, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: 'portrait.png',
    };
}

test('computeOriginalQuickness applies the extra original sleep penalty', () => {
    const champion = createChampion();
    const awake = computeOriginalQuickness(
        champion,
        {},
        [],
        champion.stamina,
        undefined,
        undefined,
        false,
        () => 0,
        {
            getEffectiveChampionStatsWithBonuses: (currentChampion) => ({ dexterity: currentChampion.dexterity }),
            getTotalWeight: () => 0,
            getChampionMaxLoad: () => 100,
        },
    );
    const sleeping = computeOriginalQuickness(
        champion,
        {},
        [],
        champion.stamina,
        undefined,
        undefined,
        true,
        () => 0,
        {
            getEffectiveChampionStatsWithBonuses: (currentChampion) => ({ dexterity: currentChampion.dexterity }),
            getTotalWeight: () => 0,
            getChampionMaxLoad: () => 100,
        },
    );

    assert.equal(awake, 12);
    assert.equal(sleeping, 6);
});

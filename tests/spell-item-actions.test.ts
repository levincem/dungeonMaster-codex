import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildPlasmaSpellStatePatch,
    buildPotionSpellStatePatch,
} from '../src/engine/systems/spellItemActions.js';

test('buildPotionSpellStatePatch wires potion spell creation through the shared builders', () => {
    const patch = buildPotionSpellStatePatch({
        championId: 1,
        now: 1000,
        spell: {
            runes: ['lo', 'vi'],
            name: 'Potion',
            effect: 'potion',
            manaCost: 8,
            manaBase: 8,
            castSkill: 'priest',
            description: 'Potion',
        },
        currentEquipment: {
            rightHand: {
                id: 'flask',
                category: 'Potion',
                typeId: 20,
                mapIndex: 0,
                x: 0,
                y: 0,
                tilePos: 'North',
            },
        },
        nextVitals: { hp: 10 } as never,
        currentChampionVitals: { 1: { hp: 12 } } as never,
        currentChampionEquipment: { 1: {} } as never,
        randomInt: () => 0,
        resolvePotionName: () => 'Vi Potion',
    });

    assert.equal(patch.championVitals[1]?.hp, 10);
    assert.equal(patch.championEquipment?.[1]?.rightHand?.category, 'Potion');
});

test('buildPlasmaSpellStatePatch wires plasma creation through the shared builders', () => {
    const patch = buildPlasmaSpellStatePatch({
        championId: 2,
        now: 1000,
        level: 0,
        position: [4, 5],
        currentEquipment: {},
        nextVitals: { hp: 9 } as never,
        currentChampionVitals: { 2: { hp: 11 } } as never,
        currentChampionEquipment: { 2: {} } as never,
        currentFloorItems: [],
        buildDroppedItem: (item) => ({ ...item, mapIndex: 0, x: 5, y: 4, tilePos: 'North' }),
        plasmaName: 'Zokathra',
    });

    assert.equal(patch.championVitals[2]?.hp, 9);
    assert.ok(patch.championEquipment?.[2]?.rightHand || patch.floorItems?.length);
});

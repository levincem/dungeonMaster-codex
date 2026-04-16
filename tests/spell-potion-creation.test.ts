import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildPotionSpellPatch,
    resolvePotionSpellResult,
} from '../src/engine/systems/spellPotionCreation.js';

function createSpell(runes: string[]) {
    return {
        runes,
        name: 'spell',
        effect: 'potion' as const,
        manaCost: 8,
        manaBase: 8,
        castSkill: 'priest' as const,
        description: 'spell',
    };
}

test('resolvePotionSpellResult returns invalid when the spell is not a potion spell', () => {
    const result = resolvePotionSpellResult(
        createSpell(['lo', 'ful', 'ir']),
        {},
        {
            randomInt: () => 0,
            resolvePotionName: () => 'Potion',
        },
    );

    assert.deepEqual(result, { kind: 'invalid' });
});

test('resolvePotionSpellResult reports a missing flask when neither hand contains one', () => {
    const result = resolvePotionSpellResult(
        createSpell(['lo', 'vi']),
        {
            rightHand: { id: 'torch', category: 'Weapon', typeId: 2, mapIndex: 0, x: 0, y: 0, tilePos: 'North' },
        },
        {
            randomInt: () => 0,
            resolvePotionName: () => 'Vi Potion',
        },
    );

    assert.deepEqual(result, { kind: 'missing_flask' });
});

test('resolvePotionSpellResult upgrades the first flask hand into the generated potion', () => {
    const result = resolvePotionSpellResult(
        createSpell(['lo', 'vi']),
        {
            rightHand: { id: 'flask', category: 'Potion', typeId: 20, mapIndex: 0, x: 0, y: 0, tilePos: 'North' },
            leftHand: { id: 'other', category: 'Potion', typeId: 20, mapIndex: 0, x: 0, y: 0, tilePos: 'North' },
        },
        {
            randomInt: () => 5,
            resolvePotionName: () => 'Vi Potion',
        },
    );

    assert.deepEqual(result, {
        kind: 'success',
        slot: 'rightHand',
        potion: {
            id: 'flask',
            category: 'Potion',
            typeId: 14,
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
            rawName: 'Vi Potion',
            potionPower: 45,
        },
    });
});

test('buildPotionSpellPatch returns vitals only when the spell is invalid', () => {
    const patch = buildPotionSpellPatch({
        championId: 3,
        now: 100,
        result: { kind: 'invalid' },
        currentChampionVitals: { 3: { hp: 10 } } as never,
        nextVitals: { hp: 8 } as never,
        currentChampionEquipment: { 3: { rightHand: { id: 'x' } } } as never,
        currentEquipment: { rightHand: { id: 'x' } } as never,
    });

    assert.deepEqual(patch, {
        championVitals: { 3: { hp: 8 } },
    });
});

test('buildPotionSpellPatch reports the missing flask message', () => {
    const patch = buildPotionSpellPatch({
        championId: 3,
        now: 200,
        result: { kind: 'missing_flask' },
        currentChampionVitals: { 3: { hp: 10 } } as never,
        nextVitals: { hp: 9 } as never,
        currentChampionEquipment: { 3: {} } as never,
        currentEquipment: {},
    });

    assert.deepEqual(patch, {
        championVitals: { 3: { hp: 9 } },
        lastCastResult: {
            success: false,
            message: 'Il faut une flasque vide dans la main.',
            ts: 200,
        },
    });
});

test('buildPotionSpellPatch installs the new potion in the resolved hand slot', () => {
    const potion = { id: 'flask', category: 'Potion', typeId: 14 } as never;
    const patch = buildPotionSpellPatch({
        championId: 7,
        now: 300,
        result: { kind: 'success', slot: 'leftHand', potion },
        currentChampionVitals: { 7: { hp: 10 } } as never,
        nextVitals: { hp: 7 } as never,
        currentChampionEquipment: { 7: { rightHand: { id: 'torch' } } } as never,
        currentEquipment: { rightHand: { id: 'torch' } } as never,
    });

    assert.deepEqual(patch, {
        championVitals: { 7: { hp: 7 } },
        championEquipment: {
            7: {
                rightHand: { id: 'torch' },
                leftHand: potion,
            },
        },
    });
});

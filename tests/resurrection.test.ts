import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { FloorItem } from '../src/types/game.js';
import {
    buildViAltarResurrectionPatch,
    createReincarnatedChampion,
    createViAltarRevivedChampion,
    isAltarTile,
} from '../src/engine/systems/resurrection.js';

function createChampion(id: number, name: string): Champion {
    return {
        id,
        name,
        title: 'The Test',
        gender: 'F',
        class: 'Wizard',
        health: 96,
        stamina: 84,
        mana: 52,
        luck: 11,
        strength: 60,
        dexterity: 58,
        wisdom: 72,
        vitality: 63,
        antiMagic: 47,
        antiFire: 49,
        skills: {
            fighter: [2, 1, 0, 0],
            ninja: [3, 2, 1, 0],
            priest: [4, 3, 2, 1],
            wizard: [5, 4, 3, 2],
        },
        color: '#abc',
        equipment: [],
        portrait: 'portrait.png',
    };
}

function createBonesItem(id: string, championId: number): FloorItem {
    return {
        id,
        category: 'Misc',
        typeId: 5,
        rawName: 'Bones',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
        championId,
    };
}

test('createReincarnatedChampion halves core pools, clears skills and redistributes bonuses', () => {
    const champion = createChampion(1, 'Tiggy');
    const sequence = [0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4];
    let index = 0;

    const result = createReincarnatedChampion(champion, (max) => {
        const next = sequence[index] ?? 0;
        index += 1;
        return next % max;
    });

    assert.equal(result.health, 48);
    assert.equal(result.stamina, 42);
    assert.equal(result.mana, 26);
    assert.deepEqual(result.skills, {
        fighter: [0, 0, 0, 0],
        ninja: [0, 0, 0, 0],
        priest: [0, 0, 0, 0],
        wizard: [0, 0, 0, 0],
    });
    assert.deepEqual(
        {
            luck: result.luck,
            strength: result.strength,
            dexterity: result.dexterity,
            wisdom: result.wisdom,
            vitality: result.vitality,
            antiMagic: result.antiMagic,
            antiFire: result.antiFire,
        },
        {
            luck: 13,
            strength: 55,
            dexterity: 53,
            wisdom: 65,
            vitality: 58,
            antiMagic: 43,
            antiFire: 44,
        },
    );
});

test('createViAltarRevivedChampion applies the altar health reduction floor', () => {
    const champion = createChampion(2, 'Halk');
    assert.equal(createViAltarRevivedChampion(champion).health, 94);
    assert.equal(createViAltarRevivedChampion({ ...champion, health: 20 }).health, 25);
});

test('isAltarTile detects altar text objects only', () => {
    const getTile = (_level: number, x: number, y: number) => (
        x === 4 && y === 7
            ? {
                x,
                y,
                type: 'Floor' as const,
                objects: [{ category: 'Text' as const, text: 'VI ALTAR', index: 1, tilePos: 'North' as const, visible: true }],
            }
            : {
                x,
                y,
                type: 'Floor' as const,
                objects: [{ category: 'Text' as const, text: 'NOTHING', index: 2, tilePos: 'North' as const, visible: true }],
            }
    );

    assert.equal(isAltarTile(0, 4, 7, getTile), true);
    assert.equal(isAltarTile(0, 1, 1, getTile), false);
});

test('buildViAltarResurrectionPatch revives the champion and consumes carried bones', () => {
    const deadChampion = createChampion(3, 'Syra');
    const bones = createBonesItem('bones-1', deadChampion.id);

    const result = buildViAltarResurrectionPatch(
        {
            party: [],
            championVitals: {},
            championInventories: { 9: [bones] },
            championEquipment: {},
            floorItems: [createBonesItem('bones-floor', 99)],
            deadChampions: { [deadChampion.id]: deadChampion },
        },
        deadChampion.id,
        bones.id,
        9,
        {
            createChampionVitals: (champion, hp, stamina, mana, food, water) => ({
                championId: champion.id,
                hp,
                stamina,
                mana,
                food,
                water,
            }),
            maxFood: 2048,
            maxWater: 2048,
        },
    );

    assert.ok(result);
    assert.equal(result?.party?.[0]?.id, deadChampion.id);
    assert.deepEqual(result?.championInventories, { 9: [], [deadChampion.id]: [] });
    assert.deepEqual(result?.championEquipment, { [deadChampion.id]: {} });
    assert.equal(result?.floorItems?.length, 1);
    assert.equal((result?.championVitals as Record<number, { hp: number }>)[deadChampion.id]?.hp, 47);
    assert.deepEqual(Object.keys(result?.deadChampions ?? {}), []);
});

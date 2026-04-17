import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment } from '../src/types/game.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import {
    computeOriginalChampionWoundDefense,
    getOriginalArmorDefense,
} from '../src/engine/systems/originalWoundDefense.js';

function createChampion(): Champion {
    return {
        id: 1,
        name: 'Halk',
        title: 'The Tested',
        gender: 'M',
        class: 'Fighter',
        health: 100,
        stamina: 40,
        mana: 10,
        luck: 10,
        strength: 20,
        dexterity: 12,
        wisdom: 8,
        vitality: 16,
        antiMagic: 0,
        antiFire: 0,
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
        hp: 35,
        stamina: 20,
        mana: 5,
        food: 900,
        water: 900,
        currentStats: {
            luck: 10,
            strength: 20,
            dexterity: 12,
            wisdom: 8,
            vitality: 16,
            antiMagic: 0,
            antiFire: 0,
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

const armorDefs = new Map<number, { armor: number; sharpDefense?: number; isShield?: boolean; weight?: number }>([
    [1, { armor: 8, sharpDefense: 6, isShield: false, weight: 3 }],
    [2, { armor: 6, sharpDefense: 4, isShield: true, weight: 8 }],
]);

const deps = {
    getArmorDef: (typeId: number) => {
        const def = armorDefs.get(typeId);
        return def ? { ...def, name: `armor-${typeId}` } : undefined;
    },
    getEffectiveChampionStatsWithBonuses: () => ({
        strength: 20,
        stamina: 40,
        vitality: 16,
    }),
    getChampionMaxLoad: () => 160,
};

test('getOriginalArmorDefense applies sharp defense scaling from armor data', () => {
    assert.equal(getOriginalArmorDefense(1, 'mail', false, deps), 8);
    assert.equal(getOriginalArmorDefense(1, 'mail', true, deps), 10);
});

test('computeOriginalChampionWoundDefense includes armor, shield and local wound penalty', () => {
    const equip: ChampionEquipment = {
        torso: {
            id: 'torso-armor',
            category: 'Armor',
            typeId: 1,
            rawName: 'mail',
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
        },
        rightHand: {
            id: 'shield',
            category: 'Armor',
            typeId: 2,
            rawName: 'shield',
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
        },
    };
    const vitals = createVitals();
    vitals.wounds.torso = true;

    const rolls = [2, 4, 1];
    const defense = computeOriginalChampionWoundDefense(
        {
            champion: createChampion(),
            equip,
            currentVitals: vitals,
            woundSlot: 'torso',
            useSharpDefense: false,
            defenseModifier: 3,
            runtimeBonuses: {},
            woundDefenseFactors: [1, 2, 3, 4, 5, 6],
        },
        () => rolls.shift() ?? 0,
        deps,
    );

    assert.equal(defense, 2);
});

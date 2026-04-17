import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import { resolveChampionIncomingAttack } from '../src/engine/systems/incomingAttackState.js';

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champion ${id}`,
        title: 'The Brave',
        gender: 'M',
        class: 'Fighter',
        health: 100,
        stamina: 80,
        mana: 20,
        luck: 10,
        strength: 20,
        dexterity: 16,
        wisdom: 14,
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

function createVitals(): ChampionVitals {
    return {
        hp: 40,
        stamina: 20,
        mana: 10,
        food: 0,
        water: 0,
        currentStats: {
            luck: 10,
            strength: 10,
            dexterity: 10,
            wisdom: 10,
            vitality: 10,
            antiMagic: 10,
            antiFire: 10,
        },
        wounds: {
            head: false,
            torso: false,
            leftHand: false,
            rightHand: false,
            legs: false,
            feet: false,
        },
        poisonEntries: [],
    };
}

const baseState = {
    championEquipment: {},
    activePotionBoosts: [],
    activeShields: [],
};

const baseDeps = {
    randomInt: () => 0,
    applyChampionWound: (vitals: ChampionVitals, slot: keyof ChampionVitals['wounds']) => ({
        ...vitals,
        wounds: { ...vitals.wounds, [slot]: true },
    }),
    adjustByAttribute: (value: number) => value,
    getEffectiveChampionStatsWithBonuses: () => ({ vitality: 12, wisdom: 15 }),
    computeChampionWoundDefense: () => 0,
    getPsychicAdjustedAttack: (attack: number) => attack - 3,
    getChampionAdjustedAttackFromResistance: (_champion: Champion, _equip: unknown, attack: number) => attack - 2,
    getActiveShieldDefense: () => 0,
    scaleOriginalAttack: (value: number, shift: number, factor: number) => Math.floor((value * factor) / (1 << shift)),
    getChampionRuntimeBonuses: () => ({}),
};

test('resolveChampionIncomingAttack returns zero damage for non-positive attacks', () => {
    const vitals = createVitals();
    const result = resolveChampionIncomingAttack(
        baseState,
        createChampion(1),
        vitals,
        0,
        'Blunt',
        ['torso'],
        1000,
        baseDeps,
    );

    assert.equal(result.damage, 0);
    assert.equal(result.nextVitals, vitals);
});

test('resolveChampionIncomingAttack applies mental damage after psychic adjustment', () => {
    const result = resolveChampionIncomingAttack(
        baseState,
        createChampion(1),
        createVitals(),
        10,
        'Mental',
        ['head'],
        1000,
        baseDeps,
    );

    assert.equal(result.damage, 7);
    assert.equal(result.nextVitals.hp, 33);
});

test('resolveChampionIncomingAttack can apply wounds on surviving non-normal hits', () => {
    const result = resolveChampionIncomingAttack(
        baseState,
        createChampion(1),
        createVitals(),
        20,
        'Sharp',
        ['head', 'torso'],
        1000,
        {
            ...baseDeps,
            scaleOriginalAttack: (value: number) => value,
        },
    );

    assert.equal(result.damage, 20);
    assert.equal(result.nextVitals.hp, 20);
    assert.equal(result.nextVitals.wounds.head, true);
});

test('resolveChampionIncomingAttack applies physical shields through the wound-defense path', () => {
    const champion = createChampion(1);
    const vitals = createVitals();
    const withoutShield = resolveChampionIncomingAttack(
        baseState,
        champion,
        vitals,
        10,
        'Sharp',
        ['torso'],
        1000,
        {
            ...baseDeps,
            scaleOriginalAttack: (value: number, shift: number, factor: number) =>
                Math.floor((value * factor) / (1 << shift)),
        },
    );

    const withShield = resolveChampionIncomingAttack(
        {
            ...baseState,
            activeShields: [{ id: 'party-shield', expiresAt: 2000, defense: 40, kind: 'physical' }],
        },
        champion,
        vitals,
        10,
        'Sharp',
        ['torso'],
        1000,
        {
            ...baseDeps,
            getActiveShieldDefense: (_shields, _nowMs, shieldKind) => shieldKind === 'physical' ? 40 : 0,
            scaleOriginalAttack: (value: number, shift: number, factor: number) =>
                Math.floor((value * factor) / (1 << shift)),
        },
    );

    assert.equal(withoutShield.damage, 20);
    assert.equal(withShield.damage, 14);
});

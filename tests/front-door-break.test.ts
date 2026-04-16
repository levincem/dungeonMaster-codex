import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, GameTile } from '../src/types/game.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import type { WeaponAttackOption } from '../src/data/weaponAttacks.js';
import { tryBreakFrontDoor } from '../src/engine/systems/frontDoorBreak.js';

function createChampion(): Champion {
    return {
        id: 1,
        name: 'Halk',
        title: 'The Tester',
        gender: 'M',
        class: 'Fighter',
        health: 120,
        stamina: 90,
        mana: 10,
        luck: 20,
        strength: 50,
        dexterity: 25,
        wisdom: 12,
        vitality: 40,
        antiMagic: 4,
        antiFire: 6,
        skills: {
            fighter: [1, 0, 0, 0],
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
        hp: 100,
        stamina: 70,
        mana: 10,
        food: 900,
        water: 900,
        currentStats: {
            luck: 20,
            strength: 50,
            dexterity: 25,
            wisdom: 12,
            vitality: 40,
            antiMagic: 4,
            antiFire: 6,
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

function createAttack(strengthRequired: number): WeaponAttackOption {
    return {
        attackType: 0,
        enumName: 'Hack',
        displayName: 'Hack',
        requiresCharges: false,
        masteryThreshold: 0,
        source: 'primary',
        attack: {
            index: 0,
            enumName: 'Hack',
            displayName: 'Hack',
            experienceForAttacking: 5,
            skillNumber: 0,
            defenseModifier: 0,
            staminaCost: 5,
            strengthRequired,
            baseDamage: 20,
            disableTime: 10,
        },
    };
}

function createDoorTile(destructChop: boolean): GameTile {
    return {
        x: 4,
        y: 2,
        type: 'Door',
        objects: [
            {
                category: 'Door',
                index: 0,
                tilePos: 'North',
                destructChop,
                destructFire: false,
                hasButton: false,
                openDirection: 'Vertical',
                ornate: 0,
                doorType: 2,
            },
        ],
    } as GameTile;
}

const baseDeps = {
    getFrontPosition: () => ({ x: 4, y: 2 }),
    getEffectiveChampionStatsRuntime: () => ({ strength: 20 }),
    getWeaponMaxDamage: () => 8,
    randomInt: () => 6,
    buildAttackResultMessage: (message: string, success = false) => ({ success, message, ts: 1 }),
};

test('tryBreakFrontDoor returns null when the front tile is not a breakable door', () => {
    const result = tryBreakFrontDoor(
        {
            level: 0,
            position: [3, 3],
            direction: 'NORTH',
            openDoors: new Set(),
            brokenDoors: new Set(),
            championVitals: { 1: createVitals() },
        },
        createChampion(),
        {} as ChampionEquipment,
        [],
        createAttack(4),
        {
            ...baseDeps,
            getTile: () => ({ x: 4, y: 2, type: 'Wall', objects: [] } as GameTile),
        },
    );

    assert.equal(result, null);
});

test('tryBreakFrontDoor returns a resisted message when the break power is insufficient', () => {
    const result = tryBreakFrontDoor(
        {
            level: 0,
            position: [3, 3],
            direction: 'NORTH',
            openDoors: new Set(),
            brokenDoors: new Set(),
            championVitals: { 1: createVitals() },
        },
        createChampion(),
        {} as ChampionEquipment,
        [],
        createAttack(0),
        {
            ...baseDeps,
            getTile: () => createDoorTile(true),
            getEffectiveChampionStatsRuntime: () => ({ strength: 5 }),
            getWeaponMaxDamage: () => 2,
            randomInt: () => 1,
        },
    );

    assert.equal(result?.message.message, 'La porte resiste.');
    assert.equal(result?.message.success, false);
});

test('tryBreakFrontDoor opens and marks a breakable door when the power threshold is met', () => {
    const result = tryBreakFrontDoor(
        {
            level: 0,
            position: [3, 3],
            direction: 'NORTH',
            openDoors: new Set(['0,1,1']),
            brokenDoors: new Set(),
            championVitals: { 1: createVitals() },
        },
        createChampion(),
        {} as ChampionEquipment,
        [],
        createAttack(4),
        {
            ...baseDeps,
            getTile: () => createDoorTile(true),
        },
    );

    assert.deepEqual([...result?.openDoors ?? []], ['0,1,1', '0,2,4']);
    assert.deepEqual([...result?.brokenDoors ?? []], ['0,2,4']);
    assert.equal(result?.message.message, 'La porte cede.');
    assert.equal(result?.message.success, true);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FloorItem } from '../src/types/game.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import { buildHandledNonProjectileSpellPatch } from '../src/engine/systems/spellNonProjectileEffects.js';

function createVitals(overrides: Partial<ChampionVitals> = {}): ChampionVitals {
    return {
        hp: 20,
        stamina: 40,
        mana: 15,
        food: 500,
        water: 500,
        currentStats: {
            luck: 10,
            strength: 10,
            dexterity: 10,
            wisdom: 10,
            vitality: 10,
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
        ...overrides,
    };
}

function createArgs() {
    return {
        championId: 1,
        championHealth: 50,
        now: 1000,
        level: 0,
        position: [4, 5] as [number, number],
        nextVitals: createVitals(),
        currentChampionVitals: { 1: createVitals({ hp: 18 }) },
        currentChampionEquipment: { 1: {} },
        currentEquipment: {},
        currentFloorItems: [],
        currentSpellLights: [],
        currentActiveShields: [],
        invisibleUntil: 0,
        seeThroughWallsUntil: 0,
        magicVisionUntil: 0,
        footprintsUntil: 0,
        quantizeDurationMs: (durationMs: number) => durationMs,
        randomInt: () => 0,
        resolvePotionName: () => 'Vi Potion',
        plasmaName: 'Zokathra',
        buildDroppedItem: (item: FloorItem) => item,
    };
}

test('buildHandledNonProjectileSpellPatch handles heal through the shared dispatcher', () => {
    const patch = buildHandledNonProjectileSpellPatch({
        ...createArgs(),
        spell: {
            runes: ['lo', 'vi'],
            name: 'Heal',
            effect: 'heal',
            manaCost: 4,
            manaBase: 4,
            castSkill: 'priest',
            description: 'Heal',
        },
    });

    assert.equal(patch?.championVitals[1]?.hp, 50);
});

test('buildHandledNonProjectileSpellPatch delegates simple timed and item spells', () => {
    const shieldPatch = buildHandledNonProjectileSpellPatch({
        ...createArgs(),
        spell: {
            runes: ['lo', 'ya', 'ir'],
            name: 'Shield',
            effect: 'shield',
            manaCost: 6,
            manaBase: 3,
            castSkill: 'wizard',
            description: 'Shield',
        },
    });
    const potionPatch = buildHandledNonProjectileSpellPatch({
        ...createArgs(),
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
    });

    assert.equal(shieldPatch?.activeShields?.length, 1);
    assert.equal(potionPatch?.championEquipment?.[1]?.rightHand?.category, 'Potion');
});

test('buildHandledNonProjectileSpellPatch returns null for projectile spells', () => {
    const patch = buildHandledNonProjectileSpellPatch({
        ...createArgs(),
        spell: {
            runes: ['lo', 'ful', 'ir'],
            name: 'Fireball',
            effect: 'fireball',
            manaCost: 4,
            manaBase: 4,
            castSkill: 'wizard',
            description: 'Fireball',
        },
    });

    assert.equal(patch, null);
});

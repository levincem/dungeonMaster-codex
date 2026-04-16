import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FloorItem } from '../src/types/game.js';
import type { ChampionVitals, PartyShield } from '../src/engine/runtimeTypes.js';
import { resolvePotionConsumption } from '../src/engine/systems/potionConsumption.js';

function createPotionItem(overrides: Partial<FloorItem> = {}): FloorItem {
    return {
        id: 'potion_1',
        category: 'Potion',
        typeId: 1,
        rawName: 'Potion',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
        potionPower: 80,
        ...overrides,
    };
}

function createVitals(overrides: Partial<ChampionVitals> = {}): ChampionVitals {
    return {
        hp: 40,
        stamina: 50,
        mana: 30,
        food: 500,
        water: 500,
        currentStats: {
            luck: 10,
            strength: 11,
            dexterity: 12,
            wisdom: 13,
            vitality: 14,
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

function createShield(overrides: Partial<PartyShield> = {}): PartyShield {
    return {
        id: 'shield_1',
        expiresAt: 2000,
        defense: 24,
        kind: 'physical',
        championId: 1,
        ...overrides,
    };
}

const deps = {
    adjustStatisticCurrentValue: (currentValue: number, delta: number) => currentValue + delta,
    buildEmptyFlaskReplacement: (item: FloorItem): FloorItem => ({
        ...item,
        id: `${item.id}_empty`,
        rawName: 'Empty Flask',
    }),
    getPartyShieldKind: (shield: PartyShield) => shield.kind ?? 'physical',
    quantizeDurationMs: (durationMs: number) => durationMs,
    healChampionWounds: () => ({}),
    timerTickMs: 10,
};

test('resolvePotionConsumption applies stat potions and returns an empty flask replacement', () => {
    const vitals = createVitals();
    const result = resolvePotionConsumption(
        {
            effect: 'dexterity',
            item: createPotionItem(),
            championId: 1,
            vitals,
            effective: { stamina: 80, mana: 70, health: 60 },
            normalizedStats: vitals.currentStats,
            activeShields: [],
            now: 1000,
        },
        deps,
    );

    assert.ok(result);
    assert.equal(result?.nextVitals.currentStats.dexterity, 23);
    assert.equal(result?.replacementItem.rawName, 'Empty Flask');
  });

test('resolvePotionConsumption replaces the champion physical shield with a fresh potion shield', () => {
    const result = resolvePotionConsumption(
        {
            effect: 'shield',
            item: createPotionItem({ id: 'shield_potion', potionPower: 120 }),
            championId: 1,
            vitals: createVitals(),
            effective: { stamina: 80, mana: 70, health: 60 },
            normalizedStats: createVitals().currentStats,
            activeShields: [
                createShield({ id: 'old_physical', championId: 1, defense: 20 }),
                createShield({ id: 'ally_fire', championId: 2, kind: 'fire', defense: 30 }),
            ],
            now: 1000,
        },
        deps,
    );

    assert.ok(result?.activeShields);
    assert.deepEqual(
        result?.activeShields?.map((shield) => ({ id: shield.id, championId: shield.championId, kind: shield.kind })),
        [
            { id: 'ally_fire', championId: 2, kind: 'fire' },
            { id: 'champion_shield_shield_potion', championId: 1, kind: 'physical' },
        ],
    );
    assert.equal(result?.activeShields?.[1]?.expiresAt, 1000 + 3240);
});

test('resolvePotionConsumption returns null for non-drinkable runtime potion effects', () => {
    const result = resolvePotionConsumption(
        {
            effect: 'poisonCloud',
            item: createPotionItem(),
            championId: 1,
            vitals: createVitals(),
            effective: { stamina: 80, mana: 70, health: 60 },
            normalizedStats: createVitals().currentStats,
            activeShields: [],
            now: 1000,
        },
        deps,
    );

    assert.equal(result, null);
});

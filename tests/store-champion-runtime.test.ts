import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyChampionTemporaryXP, createEmptyChampionXP } from '../src/data/skillProgression.js';
import type { Champion } from '../src/types/champion.js';

async function loadStoreChampionRuntime() {
    return import('../src/engine/systems/storeChampionRuntime.js');
}

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champion ${id}`,
        title: 'The Tested',
        gender: 'M',
        class: 'Wizard',
        health: 80,
        stamina: 70,
        mana: 60,
        luck: 11,
        strength: 12,
        dexterity: 13,
        wisdom: 14,
        vitality: 15,
        antiMagic: 16,
        antiFire: 17,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [1, 0, 0, 0],
            wizard: [2, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: 'portrait.png',
    };
}

test('store champion runtime clamps vitals and food or water within source-backed bounds', async () => {
    const { clampFoodWater, clampVital } = await loadStoreChampionRuntime();
    assert.equal(clampVital(-5, 40), 0);
    assert.equal(clampVital(50, 40), 40);
    assert.equal(clampFoodWater(-5000, 2048), -1024);
    assert.equal(clampFoodWater(5000, 2048), 2048);
});

test('store champion runtime builds champion vitals and empty flask replacements', async () => {
    const { buildEmptyFlaskReplacement, createChampionVitals } = await loadStoreChampionRuntime();
    const champion = createChampion(1);
    const vitals = createChampionVitals(champion, 30, 20, 10, 1234, 1111);
    const flask = buildEmptyFlaskReplacement(
        {
            id: 'potion-1',
            category: 'Potion',
            typeId: 12,
            rawName: 'YA POTION',
            mapIndex: 0,
            x: 1,
            y: 2,
            tilePos: 'North',
        },
        (category, typeId) => `${category}:${typeId}`,
    );

    assert.deepEqual(vitals, {
        hp: 30,
        stamina: 20,
        mana: 10,
        food: 1234,
        water: 1111,
        currentStats: {
            luck: 11,
            strength: 12,
            dexterity: 13,
            wisdom: 14,
            vitality: 15,
            antiMagic: 16,
            antiFire: 17,
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
    });
    assert.equal(flask.typeId, 20);
    assert.equal(flask.rawName, 'Potion:20');
    assert.equal(flask.waterCharges, 0);
    assert.equal(flask.waterMaxCharges, 1);
});

test('store champion runtime computes equipment mastery bonuses and permanent plus temporary skill levels', async () => {
    const { getChampionSkillLevelFromXP, getEquipmentSkillLevelModifier } = await loadStoreChampionRuntime();
    const champion = createChampion(2);
    const permanent = createEmptyChampionXP();
    permanent.wizard = 500;
    const temporary = createEmptyChampionTemporaryXP();
    temporary.wizard = 250;

    const wizardModifier = getEquipmentSkillLevelModifier('wizard', {
        rightHand: {
            id: 'staff',
            category: 'Weapon',
            typeId: 45,
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
        },
        neck: {
            id: 'jewel',
            category: 'Misc',
            typeId: 41,
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
        },
    });
    const healModifier = getEquipmentSkillLevelModifier('heal', {
        rightHand: {
            id: 'lyf',
            category: 'Weapon',
            typeId: 42,
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
        },
    });

    assert.equal(wizardModifier, 3);
    assert.equal(healModifier, 1);
    assert.ok(
        getChampionSkillLevelFromXP(permanent, temporary, 'wizard', { bonusLevels: wizardModifier }) >
        getChampionSkillLevelFromXP(permanent, temporary, 'wizard'),
    );
    assert.ok(
        getChampionSkillLevelFromXP(permanent, temporary, 'wizard') >=
        getChampionSkillLevelFromXP(permanent, undefined, 'wizard'),
    );
    void champion;
});

test('store champion runtime relaxes current stats toward effective targets and preserves potion boosts', async () => {
    const { getChampionStatRelaxTargets, relaxChampionCurrentStatsTowardMaximum } = await loadStoreChampionRuntime();
    const champion = createChampion(3);
    const targets = getChampionStatRelaxTargets(
        champion,
        {},
        [{
            id: 'boost-1',
            championId: 3,
            stat: 'strength',
            amount: 5,
            expiresAt: 2000,
        }],
        {
            getChampionPotionBonuses: (activePotionBoosts) => ({
                strength: activePotionBoosts[0]?.amount ?? 0,
            }),
            getEffectiveChampionStatsWithBonuses: (inputChampion, _equip, bonuses) => ({
                health: inputChampion.health,
                stamina: inputChampion.stamina,
                mana: inputChampion.mana,
                luck: inputChampion.luck + (bonuses?.luck ?? 0),
                strength: inputChampion.strength + (bonuses?.strength ?? 0),
                dexterity: inputChampion.dexterity + (bonuses?.dexterity ?? 0),
                wisdom: inputChampion.wisdom + (bonuses?.wisdom ?? 0),
                vitality: inputChampion.vitality + (bonuses?.vitality ?? 0),
                antiMagic: inputChampion.antiMagic + (bonuses?.antiMagic ?? 0),
                antiFire: inputChampion.antiFire + (bonuses?.antiFire ?? 0),
            }),
        },
        1000,
    );
    const relaxed = relaxChampionCurrentStatsTowardMaximum(
        {
            luck: 8,
            strength: 25,
            dexterity: 11,
            wisdom: 20,
            vitality: 10,
            antiMagic: 20,
            antiFire: 5,
        },
        targets,
    );

    assert.equal(targets.strength, champion.strength + 5);
    assert.equal(relaxed.luck, 9);
    assert.equal(relaxed.strength, 24);
    assert.equal(relaxed.dexterity, 12);
    assert.equal(relaxed.antiFire, 6);
});

test('store champion runtime keeps original statistic gains bounded for high current values', async () => {
    const { adjustOriginalStatisticCurrentValue } = await loadStoreChampionRuntime();
    assert.equal(adjustOriginalStatisticCurrentValue(100, 4), 104);
    assert.equal(adjustOriginalStatisticCurrentValue(130, 4), 133);
    assert.equal(adjustOriginalStatisticCurrentValue(160, 8), 163);
    assert.equal(adjustOriginalStatisticCurrentValue(5, -20), 0);
});

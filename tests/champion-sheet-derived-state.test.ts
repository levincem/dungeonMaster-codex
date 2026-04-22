import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildChampionSheetFrontWallContext,
    buildChampionSheetLoadSummary,
    buildChampionSheetVitalsSummary,
    findActivePartyChampion,
    getChampionPotionBonusesForSheet,
    getFirstEquipTargetSlot,
} from '../src/components/UI/championSheetDerivedState.js';
import type { EquipSlotKey } from '../src/types/items.js';
import type { ChampionEquipment, FloorItem, GameTile } from '../src/types/game.js';

type TestMechanism = {
    trigger: 'wall-lock' | 'alcove' | 'object-exchanger' | 'other';
};

function createChampion() {
    return {
        id: 1,
        name: 'Tiggy',
        title: 'Apprentice',
        class: 'Wizard',
        portrait: 'tiggy.png',
        health: 120,
        stamina: 90,
        mana: 40,
        strength: 35,
        dexterity: 44,
        wisdom: 55,
        vitality: 38,
        antiMagic: 21,
        antiFire: 17,
        luck: 13,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
    };
}

function createFloorItem(id: string, category: FloorItem['category'] = 'Weapon'): FloorItem {
    return {
        id,
        category,
        typeId: 0,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

function createTile(type: GameTile['type']): GameTile {
    return {
        x: 0,
        y: 0,
        type,
        objects: [],
    };
}

test('getChampionPotionBonusesForSheet merges timed boosts with current stat deltas', () => {
    const champion = createChampion();

    const bonuses = getChampionPotionBonusesForSheet(
        champion,
        {
            currentStats: {
                strength: 39,
                wisdom: 61,
                antiMagic: 25,
                luck: 18,
            },
        },
        [
            { championId: 1, stat: 'strength', amount: 2, expiresAt: 150 },
            { championId: 1, stat: 'antiMagic', amount: 3, expiresAt: 150 },
            { championId: 2, stat: 'wisdom', amount: 99, expiresAt: 150 },
            { championId: 1, stat: 'dexterity', amount: 5, expiresAt: 90 },
        ],
        1,
        100,
    );

    assert.deepEqual(bonuses, {
        mana: 0,
        strength: 6,
        dexterity: 0,
        wisdom: 6,
        vitality: 0,
        antiMagic: 7,
        antiFire: 0,
        luck: 5,
    });
});

test('findActivePartyChampion returns the live party instance for reincarnated champions', () => {
    const reincarnated = {
        ...createChampion(),
        id: 1,
        health: 60,
        stamina: 45,
        strength: 29,
    };

    assert.equal(findActivePartyChampion([reincarnated], 1), reincarnated);
    assert.equal(findActivePartyChampion([reincarnated], 99), null);
    assert.equal(findActivePartyChampion([reincarnated], null), null);
});

test('buildChampionSheetVitalsSummary derives severities and wound text from vitals', () => {
    const champion = createChampion();

    const summary = buildChampionSheetVitalsSummary({
        champion,
        vitals: {
            hp: 88,
            stamina: 47,
            mana: 25,
            food: 120,
            water: 240,
            wounds: {
                legs: true,
                feet: true,
            },
        },
        effectiveMana: 40,
        maxFood: 2048,
        maxWater: 2048,
        criticalFoodThreshold: 160,
        lowFoodThreshold: 400,
        criticalWaterThreshold: 220,
        lowWaterThreshold: 500,
        injuredLegsLabel: 'Injured legs',
        injuredFeetLabel: 'Injured feet',
    });

    assert.equal(summary.hp, 88);
    assert.equal(summary.stamina, 47);
    assert.equal(summary.mana, 25);
    assert.equal(summary.foodSeverity, 'critical');
    assert.equal(summary.waterSeverity, 'warning');
    assert.equal(summary.woundText, 'Injured legs · Injured feet');
});

test('buildChampionSheetLoadSummary flags warning and overload thresholds', () => {
    assert.deepEqual(
        buildChampionSheetLoadSummary({ weight: 52, maxWeight: 80 }),
        {
            weight: 52,
            maxWeight: 80,
            overloaded: false,
            loadWarn: true,
            loadSeverity: 'warning',
        },
    );

    assert.equal(
        buildChampionSheetLoadSummary({ weight: 90, maxWeight: 80 }).loadSeverity,
        'critical',
    );
});

test('buildChampionSheetFrontWallContext resolves fountain, altar, wall mechanisms, and dismissal gating', () => {
    const wallTile = createTile('Wall');
    const frontMechanism: TestMechanism = { trigger: 'alcove' };

    const context = buildChampionSheetFrontWallContext<TestMechanism>({
        level: 0,
        position: [5, 5],
        direction: 'NORTH',
        firedSensors: new Set(),
        getTileAt: (_level, tileX, tileY) => (tileX === 5 && tileY === 4 ? wallTile : undefined),
        hasEffectiveOriginalWallOverlayAt: (_level, tileX, tileY, face, overlayName) =>
            tileX === 5 && tileY === 4 && face === 'South' && overlayName === 'Fountain',
        isAltarWallFace: () => false,
        getMechanismsAtFace: () => [frontMechanism, { trigger: 'other' }],
        isFrontWallMechanism: (mechanism) => mechanism.trigger !== 'other',
    });

    assert.deepEqual(context, {
        facingFountain: true,
        facingAltar: false,
        frontWallItemMechanism: frontMechanism,
        canDismissChampion: true,
    });

    const blockedDismiss = buildChampionSheetFrontWallContext<TestMechanism>({
        level: 0,
        position: [1, 1],
        direction: 'EAST',
        firedSensors: new Set(['0_64']),
        getTileAt: () => wallTile,
        hasEffectiveOriginalWallOverlayAt: () => false,
        isAltarWallFace: () => true,
        getMechanismsAtFace: () => [],
        isFrontWallMechanism: () => true,
    });

    assert.equal(blockedDismiss.facingAltar, true);
    assert.equal(blockedDismiss.frontWallItemMechanism, null);
    assert.equal(blockedDismiss.canDismissChampion, false);
});

test('buildChampionSheetFrontWallContext keeps fountain interaction when the front tile lookup is temporarily unavailable', () => {
    const context = buildChampionSheetFrontWallContext<TestMechanism>({
        level: 1,
        position: [7, 5],
        direction: 'WEST',
        firedSensors: new Set(),
        getTileAt: () => undefined,
        hasEffectiveOriginalWallOverlayAt: (_level, tileX, tileY, face, overlayName) =>
            tileX === 4 && tileY === 7 && face === 'East' && overlayName === 'Fountain',
        isAltarWallFace: () => false,
        getMechanismsAtFace: () => [],
        isFrontWallMechanism: () => false,
    });

    assert.equal(context.facingFountain, true);
    assert.equal(context.facingAltar, false);
    assert.equal(context.frontWallItemMechanism, null);
});

test('getFirstEquipTargetSlot prefers an empty valid slot before falling back to the first slot', () => {
    const item = createFloorItem('sword');
    const equip: ChampionEquipment = {
        rightHand: createFloorItem('mace'),
    };

    const firstChoice = getFirstEquipTargetSlot(
        item,
        equip,
        () => ['rightHand', 'leftHand'] satisfies EquipSlotKey[],
    );

    assert.equal(firstChoice, 'leftHand');

    const fallback = getFirstEquipTargetSlot(
        item,
        { rightHand: createFloorItem('mace'), leftHand: createFloorItem('dagger') },
        () => ['rightHand', 'leftHand'] satisfies EquipSlotKey[],
    );

    assert.equal(fallback, 'rightHand');
});

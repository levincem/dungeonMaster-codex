import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildChampionRecentDamageMap,
    buildHudCastState,
    buildCombatGridSlotState,
    buildHudFrontStateSummary,
    didPartyTakeSingleStep,
    selectHudRunes,
} from '../src/components/UI/hudDerivedState.js';
import type { ChampionCombat, DamageEvent } from '../src/engine/runtimeTypes.js';
import type { GameMap, GameTile } from '../src/types/game.js';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import type { WeaponAttackOption } from '../src/data/weaponAttacks.js';
import { getPreferredCombatItem } from '../src/data/equipment.js';

type TestChampion = {
    id: number;
    name: string;
    class: string;
    portrait: string;
    health: number;
    stamina: number;
    mana: number;
    strength: number;
    dexterity: number;
    wisdom: number;
    vitality: number;
    antiMagic: number;
    antiFire: number;
    luck: number;
    skills: {
        fighter: [number, number, number, number];
        ninja: [number, number, number, number];
        priest: [number, number, number, number];
        wizard: [number, number, number, number];
    };
};

function createTile(x: number, y: number, type: GameTile['type']): GameTile {
    return { x, y, type, objects: [] };
}

function createMap(width: number, height: number, fill: GameTile['type'] = 'Floor'): GameMap {
    return {
        index: 0,
        name: 'test',
        level: 0,
        width,
        height,
        difficulty: 0,
        mapOffset: { x: 10, y: 20 },
        tiles: Array.from({ length: height }, (_, y) =>
            Array.from({ length: width }, (_, x) => createTile(x, y, fill))),
    };
}

function createChampion(id: number, name: string): TestChampion {
    return {
        id,
        name,
        class: 'Fighter',
        portrait: `${name}.png`,
        health: 100,
        stamina: 90,
        mana: 40,
        strength: 50,
        dexterity: 40,
        wisdom: 30,
        vitality: 35,
        antiMagic: 25,
        antiFire: 20,
        luck: 15,
        skills: { fighter: [0, 0, 0, 0], ninja: [0, 0, 0, 0], priest: [0, 0, 0, 0], wizard: [0, 0, 0, 0] },
    };
}

test('buildHudFrontStateSummary reports closed and opened obstacle states with local and global coordinates', () => {
    const map = createMap(4, 4);
    map.tiles[1][2] = createTile(2, 1, 'Door');

    const closed = buildHudFrontStateSummary({
        currentMap: map,
        level: 0,
        position: [1, 1],
        direction: 'EAST',
        openDoors: new Set(),
        openWalls: new Set(),
        openPits: new Set(),
        openTeleporters: new Set(),
    });

    assert.deepEqual(closed, {
        frontLocalX: 2,
        frontLocalY: 1,
        frontGlobalX: 12,
        frontGlobalY: 21,
        frontState: 'Door closed blocked',
    });

    const open = buildHudFrontStateSummary({
        currentMap: map,
        level: 0,
        position: [1, 1],
        direction: 'EAST',
        openDoors: new Set(['0,1,2']),
        openWalls: new Set(),
        openPits: new Set(),
        openTeleporters: new Set(),
    });

    assert.equal(open.frontState, 'Door open walk');
});

test('buildHudFrontStateSummary reports teleporter activity from runtime openTeleporters state', () => {
    const map = createMap(3, 3);
    map.tiles[1][2] = createTile(2, 1, 'Teleporter');

    const inactive = buildHudFrontStateSummary({
        currentMap: map,
        level: 0,
        position: [1, 1],
        direction: 'EAST',
        openDoors: new Set(),
        openWalls: new Set(),
        openPits: new Set(),
        openTeleporters: new Set(),
    });
    assert.equal(inactive.frontState, 'Teleporter inactive walk');

    const active = buildHudFrontStateSummary({
        currentMap: map,
        level: 0,
        position: [1, 1],
        direction: 'EAST',
        openDoors: new Set(),
        openWalls: new Set(),
        openPits: new Set(),
        openTeleporters: new Set(['0,1,2']),
    });
    assert.equal(active.frontState, 'Teleporter active walk');
});

test('buildChampionRecentDamageMap keeps only the latest recent damage entries for current party members', () => {
    const party = [createChampion(1, 'Tiggy'), createChampion(2, 'Halk')];
    const damageEvents: DamageEvent[] = [
        { id: 'a', level: 0, target: 'champion', championId: 1, amount: 4, ts: 1 },
        { id: 'b', level: 0, target: 'champion', championId: 2, amount: 7, kind: 'poison', ts: 2 },
        { id: 'c', level: 0, target: 'champion', championId: 1, amount: 9, ts: 3 },
        { id: 'd', level: 0, target: 'creature', creatureId: 'x', amount: 12, ts: 4 },
        { id: 'e', level: 0, target: 'champion', championId: 1, amount: 11, kind: 'poison', ts: 5 },
        { id: 'f', level: 0, target: 'champion', championId: 999, amount: 13, ts: 6 },
    ];

    assert.deepEqual(buildChampionRecentDamageMap({ party, damageEvents }), {
        1: [
            { amount: 9, kind: 'normal' },
            { amount: 11, kind: 'poison' },
        ],
        2: [{ amount: 7, kind: 'poison' }],
    });
});

test('buildCombatGridSlotState derives readiness, images, names, and usable attacks from injected HUD dependencies', () => {
    const champion = createChampion(1, 'Alex');
    const jab = { attackType: 0, displayName: 'Jab', masteryThreshold: 0, attack: { skillNumber: 1 } } as WeaponAttackOption;
    const cleave = { attackType: 1, displayName: 'Cleave', masteryThreshold: 2, attack: { skillNumber: 2 } } as WeaponAttackOption;
    const championCombat: Record<number, ChampionCombat> = {
        1: { cooldown: 0, cooldownMax: 12, defenseModifier: 0 },
    };
    const championEquipment: Record<number, ChampionEquipment> = {
        1: { rightHand: { id: 'axe', category: 'Weapon', typeId: 3, mapIndex: 0, x: 0, y: 0, tilePos: 'North' } },
    };

    const state = buildCombatGridSlotState({
        champion,
        championCombat,
        championEquipment,
        emptyWeaponImage: 'empty.png',
        fistLabel: 'FIST',
        direction: 'NORTH',
        resolveWeaponImage: () => 'axe.png',
        resolveWeaponName: () => 'Execution Axe',
        getAllAttacks: () => [jab, cleave],
        getAttackMasteryLevel: (_championId, attack) => attack.attackType === 0 ? 3 : 1,
    });

    assert.equal(state.ready, true);
    assert.equal(state.cooldownRatio, 0);
    assert.equal(state.weaponImage, 'axe.png');
    assert.equal(state.weaponName, 'Execution Axe');
    assert.deepEqual(state.allAttacks, [jab]);
    assert.deepEqual(state.usableAttacks, [jab]);
});

test('buildCombatGridSlotState can surface the next throwable quiver item when the hand is empty', () => {
    const champion = createChampion(1, 'Wu Tse');
    const throwAttack = {
        attackType: 3,
        displayName: 'Throw',
        enumName: 'Throw',
        masteryThreshold: 0,
        attack: { skillNumber: 1 },
    } as WeaponAttackOption;
    const star: FloorItem = {
        id: 'star',
        category: 'Weapon',
        typeId: 32,
        rawName: 'Throwing Star',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
    const championCombat: Record<number, ChampionCombat> = {
        1: { cooldown: 0, cooldownMax: 12, defenseModifier: 0 },
    };
    const championEquipment: Record<number, ChampionEquipment> = {
        1: { quiver1: star },
    };

    const state = buildCombatGridSlotState({
        champion,
        championCombat,
        championEquipment,
        emptyWeaponImage: 'empty.png',
        fistLabel: 'FIST',
        direction: 'NORTH',
        resolveWeaponImage: (_championId, equipment) =>
            getPreferredCombatItem(equipment, {
                getWeaponAttackOptions: (item) => item?.id === 'star' ? [throwAttack] : [],
                isThrowAttack: (attack) => attack?.enumName === 'Throw',
            })?.item?.id === 'star'
                ? 'star.png'
                : 'empty.png',
        resolveWeaponName: (_championId, equipment) =>
            getPreferredCombatItem(equipment, {
                getWeaponAttackOptions: (item) => item?.id === 'star' ? [throwAttack] : [],
                isThrowAttack: (attack) => attack?.enumName === 'Throw',
            })?.item?.rawName ?? 'FIST',
        getAllAttacks: (_championId, equipment) => getPreferredCombatItem(equipment, {
            getWeaponAttackOptions: (item) => item?.id === 'star' ? [throwAttack] : [],
            isThrowAttack: (attack) => attack?.enumName === 'Throw',
        })?.item?.id === 'star'
            ? [throwAttack]
            : [],
        getAttackMasteryLevel: () => 3,
    });

    assert.equal(state.weaponImage, 'star.png');
    assert.equal(state.weaponName, 'Throwing Star');
    assert.deepEqual(state.allAttacks, [throwAttack]);
    assert.deepEqual(state.usableAttacks, [throwAttack]);
});

test('selectHudRunes truncates at an existing rune and refuses to exceed four runes', () => {
    assert.deepEqual(selectHudRunes(['FUL', 'IR'], 'IR'), ['FUL']);
    assert.deepEqual(selectHudRunes(['FUL', 'IR', 'BRO', 'NETA'], 'DES'), ['FUL', 'IR', 'BRO', 'NETA']);
    assert.deepEqual(selectHudRunes(['FUL', 'IR'], 'BRO'), ['FUL', 'IR', 'BRO']);
});

test('didPartyTakeSingleStep only reports adjacent same-level movement', () => {
    assert.equal(didPartyTakeSingleStep({
        previousLevel: 0,
        nextLevel: 0,
        previousPosition: [4, 4],
        nextPosition: [4, 5],
    }), true);
    assert.equal(didPartyTakeSingleStep({
        previousLevel: 0,
        nextLevel: 1,
        previousPosition: [4, 4],
        nextPosition: [4, 5],
    }), false);
    assert.equal(didPartyTakeSingleStep({
        previousLevel: 0,
        nextLevel: 0,
        previousPosition: [4, 4],
        nextPosition: [6, 4],
    }), false);
});

test('buildHudCastState derives selected champion, active family, and cast availability', () => {
    const party = [createChampion(1, 'Alex'), createChampion(2, 'Tiggy')];

    const readyState = buildHudCastState({
        selectedRunes: ['FUL', 'IR'],
        activeCasterChampionId: 2,
        party,
        championVitals: {
            2: { mana: 18 },
        },
        championCombat: {
            2: { cooldown: 0 },
        },
        findSpell: () => ({ manaCost: 12 }),
        runeFamilyCount: 4,
    });

    assert.equal(readyState.currentFamilyIdx, 2);
    assert.equal(readyState.casterChampion?.id, 2);
    assert.equal(readyState.canCast, true);

    const blockedState = buildHudCastState({
        selectedRunes: ['FUL', 'IR'],
        activeCasterChampionId: 1,
        party,
        championVitals: {
            1: { mana: 5 },
        },
        championCombat: {
            1: { cooldown: 4 },
        },
        findSpell: () => ({ manaCost: 8 }),
        runeFamilyCount: 4,
    });

    assert.equal(blockedState.canCast, false);
});

test('buildHudCastState allows the active spell caster to differ from the selected portrait', () => {
    const party = [createChampion(1, 'Alex'), createChampion(2, 'Tiggy')];

    const state = buildHudCastState({
        selectedRunes: ['FUL', 'BRO'],
        activeCasterChampionId: 2,
        party,
        championVitals: {
            1: { mana: 40 },
            2: { mana: 14 },
        },
        championCombat: {
            1: { cooldown: 0 },
            2: { cooldown: 0 },
        },
        findSpell: () => ({ manaCost: 12 }),
        runeFamilyCount: 4,
    });

    assert.equal(state.casterChampion?.id, 2);
    assert.equal(state.casterChampionMana, 14);
    assert.equal(state.canCast, true);
});

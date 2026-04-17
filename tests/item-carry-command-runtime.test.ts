import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import type { Projectile } from '../src/engine/runtimeTypes.js';
import {
    buildResurrectChampionRuntimePatch,
    buildThrowCarriedItemRuntimePatch,
} from '../src/engine/systems/itemCarryCommandRuntime.js';

function createChampion(id: number, name = `Champion ${id}`): Champion {
    return {
        id,
        name,
        title: 'Tester',
        gender: 'M',
        class: 'Fighter',
        health: 100,
        stamina: 80,
        mana: 20,
        luck: 10,
        strength: 10,
        dexterity: 10,
        wisdom: 10,
        vitality: 10,
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
        portrait: '',
    };
}

function createItem(id: string, overrides: Partial<FloorItem> = {}): FloorItem {
    return {
        id,
        category: 'Weapon',
        typeId: 1,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
        ...overrides,
    };
}

test('buildThrowCarriedItemRuntimePatch throws inventory items and merges XP patch', () => {
    const sword = createItem('sword');
    const projectile: Projectile = {
        id: 'projectile-1',
        level: 0,
        x: 5,
        y: 4,
        direction: 'NORTH',
        effect: 'physical',
        damage: [4, 6],
        nextMoveAt: 100,
        physicalItem: sword,
    };
    const state = {
        party: [createChampion(1)],
        championInventories: { 1: [sword] },
        championEquipment: { 1: {} as ChampionEquipment },
        projectiles: [] as Projectile[],
    };

    const patch = buildThrowCarriedItemRuntimePatch(
        state,
        1,
        sword.id,
        'inventory',
        {
            buildProjectile: () => projectile,
            buildThrowXpPatch: () => ({ championXP: { 1: { throw: 5 } } }),
            throwChampionCarriedItem: (_state, championId, itemId, _fromSlot, currentProjectile) => ({
                championInventories: { [championId]: [] },
                projectiles: [currentProjectile],
                thrownItemId: itemId,
            }),
        },
    );

    assert.deepEqual(patch, {
        championInventories: { 1: [] },
        projectiles: [projectile],
        thrownItemId: 'sword',
        championXP: { 1: { throw: 5 } },
    });
});

test('buildThrowCarriedItemRuntimePatch returns null when the carried item is missing', () => {
    const state = {
        party: [createChampion(1)],
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: {} as ChampionEquipment },
        projectiles: [] as Projectile[],
    };

    const patch = buildThrowCarriedItemRuntimePatch(
        state,
        1,
        'missing',
        'inventory',
        {
            buildProjectile: () => ({ id: 'p', level: 0, x: 0, y: 0, direction: 'NORTH', effect: 'physical', damage: [1, 1], nextMoveAt: 0 }),
            buildThrowXpPatch: () => null,
            throwChampionCarriedItem: () => null,
        },
    );

    assert.equal(patch, null);
});

test('buildResurrectChampionRuntimePatch finds carried bones and delegates resurrection', () => {
    const deadChampion = createChampion(7, 'Dead');
    const bones = createItem('bones-1', {
        category: 'Misc',
        typeId: 5,
        championId: deadChampion.id,
    });
    const state = {
        level: 0,
        position: [4, 5] as [number, number],
        party: [createChampion(1)],
        championInventories: { 1: [bones] },
        championEquipment: { 1: {} as ChampionEquipment },
        floorItems: [] as FloorItem[],
        deadChampions: { [deadChampion.id]: deadChampion },
    };

    const patch = buildResurrectChampionRuntimePatch(
        state,
        bones.id,
        {
            maxPartySize: 4,
            isAltarTile: () => true,
            buildViAltarResurrectionPatch: (_state, deadChampionId, bonesItemId, carriedBy) => ({
                deadChampionId,
                bonesItemId,
                carriedBy,
            }),
        },
    );

    assert.deepEqual(patch, {
        deadChampionId: deadChampion.id,
        bonesItemId: bones.id,
        carriedBy: 1,
    });
});

test('buildResurrectChampionRuntimePatch returns null when the altar preconditions are not met', () => {
    const deadChampion = createChampion(7, 'Dead');
    const bones = createItem('bones-1', {
        category: 'Misc',
        typeId: 5,
        championId: deadChampion.id,
    });
    const state = {
        level: 0,
        position: [4, 5] as [number, number],
        party: [createChampion(1), createChampion(2), createChampion(3), createChampion(4)],
        championInventories: { 1: [bones] },
        championEquipment: { 1: {} as ChampionEquipment },
        floorItems: [] as FloorItem[],
        deadChampions: { [deadChampion.id]: deadChampion },
    };

    const patch = buildResurrectChampionRuntimePatch(
        state,
        bones.id,
        {
            maxPartySize: 4,
            isAltarTile: () => true,
            buildViAltarResurrectionPatch: () => ({ ok: true }),
        },
    );

    assert.equal(patch, null);
});

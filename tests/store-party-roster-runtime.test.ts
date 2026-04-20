import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import {
    buildAddToPartyPatch,
    buildRemoveFromPartyPatch,
} from '../src/engine/systems/storePartyRosterRuntime.js';

function createChampion(id: number, overrides: Partial<Champion> = {}): Champion {
    return {
        id,
        name: `Champion ${id}`,
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
        ...overrides,
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

test('buildAddToPartyPatch initializes missing roster state for a recruited champion', () => {
    const champion = createChampion(3);
    const starterEquipment = {
        rightHand: createItem('torch', { category: 'Weapon', typeId: 2 }),
    } as ChampionEquipment;
    const starterInventory = [createItem('apple')];
    const state = {
        party: [] as Champion[],
        championInventories: {},
        championEquipment: {},
        championVitals: {},
        championXP: {},
        championTemporaryXP: {},
        championCombat: {},
        torchBurnStart: {},
    };

    const patch = buildAddToPartyPatch(state, champion, 'resurrect', {
        maxPartySize: 4,
        createReincarnatedChampion: (entry) => entry,
        getChampionStarterLoadout: () => ({
            equipment: starterEquipment,
            inventory: starterInventory,
        }),
        seedTorchBurnStartFromEquipment: (_equipment, currentTorchBurnStart) => ({
            ...currentTorchBurnStart,
            torch: 123,
        }),
        createChampionVitals: (entry, hp, stamina, mana) => ({
            championId: entry.id,
            hp,
            stamina,
            mana,
        }),
        createEmptyChampionXP: () => ({ mode: 'empty' }),
        buildInitialChampionXP: (entry) => ({ mode: 'initial', championId: entry.id }),
        createEmptyChampionTemporaryXP: () => ({ temporary: true }),
        createChampionCombatState: (cooldownSec) => ({ cooldown: cooldownSec }),
    });

    assert.deepEqual(patch, {
        party: [champion],
        gateOpen: false,
        championInventories: { 3: starterInventory },
        championEquipment: { 3: starterEquipment },
        championVitals: {
            3: {
                championId: 3,
                hp: 100,
                stamina: 80,
                mana: 20,
            },
        },
        championXP: { 3: { mode: 'initial', championId: 3 } },
        championTemporaryXP: { 3: { temporary: true } },
        championCombat: { 3: { cooldown: 0 } },
        torchBurnStart: { torch: 123 },
    });
});

test('buildAddToPartyPatch returns null for duplicate or full-party recruits', () => {
    const champion = createChampion(1);
    const baseState = {
        party: [champion],
        championInventories: {},
        championEquipment: {},
        championVitals: {},
        championXP: {},
        championTemporaryXP: {},
        championCombat: {},
        torchBurnStart: {},
    };
    const deps = {
        maxPartySize: 4,
        createReincarnatedChampion: (entry: Champion) => entry,
        getChampionStarterLoadout: () => ({
            equipment: {} as ChampionEquipment,
            inventory: [] as FloorItem[],
        }),
        seedTorchBurnStartFromEquipment: (_equipment: ChampionEquipment, currentTorchBurnStart: Record<string, number>) =>
            currentTorchBurnStart,
        createChampionVitals: () => ({}),
        createEmptyChampionXP: () => ({}),
        buildInitialChampionXP: () => ({}),
        createEmptyChampionTemporaryXP: () => ({}),
        createChampionCombatState: () => ({}),
    };

    assert.equal(buildAddToPartyPatch(baseState, champion, 'resurrect', deps), null);
    assert.equal(
        buildAddToPartyPatch(
            { ...baseState, party: [createChampion(1), createChampion(2), createChampion(3), createChampion(4)] },
            createChampion(5),
            'resurrect',
            deps,
        ),
        null,
    );
});

test('buildRemoveFromPartyPatch drops inventory and equipment onto the current floor tile', () => {
    const state = {
        level: 2,
        position: [6, 7] as [number, number],
        party: [createChampion(1), createChampion(2)],
        floorItems: [createItem('floor')],
        championInventories: {
            2: [createItem('apple')],
        },
        championEquipment: {
            2: {
                leftHand: createItem('dagger'),
            } as ChampionEquipment,
        },
    };

    const patch = buildRemoveFromPartyPatch(state, 2);

    assert.deepEqual(patch, {
        party: [createChampion(1)],
        gateOpen: false,
        floorItems: [
            createItem('floor'),
            createItem('apple', { mapIndex: 2, x: 7, y: 6 }),
            createItem('dagger', { mapIndex: 2, x: 7, y: 6 }),
        ],
        championInventories: {
            2: [],
        },
        championEquipment: {
            2: {},
        },
    });
});

test('buildRemoveFromPartyPatch keeps carried gear in champion storage when dismissing in the Hall of Champions', () => {
    const state = {
        level: 0,
        position: [6, 7] as [number, number],
        party: [createChampion(1), createChampion(2)],
        floorItems: [createItem('floor')],
        championInventories: {
            2: [createItem('apple')],
        },
        championEquipment: {
            2: {
                leftHand: createItem('dagger'),
            } as ChampionEquipment,
        },
    };

    const patch = buildRemoveFromPartyPatch(state, 2);

    assert.deepEqual(patch, {
        party: [createChampion(1)],
        gateOpen: false,
        floorItems: [createItem('floor')],
        championInventories: {
            2: [
                createItem('apple'),
                createItem('dagger'),
            ],
        },
        championEquipment: {
            2: {},
        },
    });
});

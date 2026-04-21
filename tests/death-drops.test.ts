import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeathDrop } from '../src/engine/systems/deathDrops.js';
import type { Champion } from '../src/types/champion.js';
import type { FloorItem } from '../src/types/game.js';

function createItem(id: string, category: FloorItem['category'], typeId: number): FloorItem {
    return {
        id,
        category,
        typeId,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

function createChampion(id: number, name: string): Champion {
    return {
        id,
        name,
        title: 'The Test',
        gender: 'M',
        class: 'Fighter',
        health: 100,
        stamina: 100,
        mana: 10,
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
        portrait: 'portrait.png',
    };
}

test('buildDeathDrop drops inventory, equipment and bones at the party position', () => {
    const champion = createChampion(1, 'Elija');
    const inventoryItem = createItem('inv-1', 'Misc', 1);
    const equippedItem = createItem('eq-1', 'Weapon', 7);

    const result = buildDeathDrop(
        {
            level: 3,
            position: [9, 10],
            party: [champion],
            championInventories: { [champion.id]: [inventoryItem] },
            championEquipment: { [champion.id]: { rightHand: equippedItem } },
            floorItems: [],
            deadChampions: {},
        },
        champion.id,
        123456,
    );

    assert.equal(result.party.length, 0);
    assert.deepEqual(result.championInventories[champion.id], []);
    assert.deepEqual(result.championEquipment[champion.id], {});
    assert.equal(result.deadChampions[champion.id]?.id, champion.id);
    assert.deepEqual(
        result.floorItems.map((item) => ({
            id: item.id,
            mapIndex: item.mapIndex,
            x: item.x,
            y: item.y,
            tilePos: item.tilePos,
            championId: item.championId,
        })),
        [
            { id: 'inv-1', mapIndex: 3, x: 10, y: 9, tilePos: 'North', championId: undefined },
            { id: 'eq-1', mapIndex: 3, x: 10, y: 9, tilePos: 'North', championId: undefined },
            { id: `bones_${champion.id}_123456`, mapIndex: 3, x: 10, y: 9, tilePos: 'North', championId: champion.id },
        ],
    );
});

test('buildDeathDrop leaves deadChampions unchanged when the champion is already absent from party', () => {
    const champion = createChampion(2, 'Halk');
    const existing = createChampion(3, 'Syra');

    const result = buildDeathDrop(
        {
            level: 0,
            position: [1, 2],
            party: [],
            championInventories: {},
            championEquipment: {},
            floorItems: [],
            deadChampions: { [existing.id]: existing },
        },
        champion.id,
        42,
    );

    assert.deepEqual(Object.keys(result.deadChampions).map(Number), [existing.id]);
    assert.equal(result.floorItems.at(-1)?.id, `bones_${champion.id}_42`);
});

test('buildDeathDrop follows the original I562 possession drop order before bones', () => {
    const champion = createChampion(4, 'Tiggy');
    const inventory: FloorItem[] = [];
    inventory[0] = createItem('bag-13', 'Misc', 1);
    inventory[1] = createItem('bag-14', 'Misc', 2);

    const result = buildDeathDrop(
        {
            level: 1,
            position: [3, 4],
            party: [champion],
            championInventories: { [champion.id]: inventory },
            championEquipment: {
                [champion.id]: {
                    leftHand: createItem('left-hand', 'Weapon', 8),
                    rightHand: createItem('right-hand', 'Weapon', 9),
                    head: createItem('head', 'Armor', 26),
                    torso: createItem('torso', 'Armor', 16),
                    legs: createItem('legs', 'Armor', 17),
                    feet: createItem('feet', 'Armor', 4),
                    neck: createItem('neck', 'Misc', 48),
                    pocket1: createItem('pocket-1', 'Potion', 20),
                    pocket2: createItem('pocket-2', 'Scroll', 0),
                    quiver1: createItem('quiver-1', 'Weapon', 27),
                    quiver2: createItem('quiver-2', 'Weapon', 28),
                    quiver3: createItem('quiver-3', 'Weapon', 31),
                    quiver4: createItem('quiver-4', 'Weapon', 32),
                },
            },
            floorItems: [],
            deadChampions: {},
        },
        champion.id,
        999,
    );

    assert.deepEqual(
        result.floorItems.map((item) => item.id),
        [
            'feet',
            'legs',
            'quiver-4',
            'quiver-3',
            'quiver-2',
            'quiver-1',
            'pocket-2',
            'pocket-1',
            'torso',
            'bag-13',
            'bag-14',
            'neck',
            'head',
            'left-hand',
            'right-hand',
            `bones_${champion.id}_999`,
        ],
    );
});

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

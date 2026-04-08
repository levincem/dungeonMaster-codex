import { getEquippableSlots } from './equipment';
import type { ChampionEquipment, FloorItem } from '../types/game';

type StarterItemSpec = {
    category: FloorItem['category'];
    typeId: number;
    rawName: string;
    count?: number;
};

export interface ChampionStarterLoadout {
    equipped: StarterItemSpec[];
    inventory?: StarterItemSpec[];
}

function repeatItems(items: StarterItemSpec[]): StarterItemSpec[] {
    const expanded: StarterItemSpec[] = [];
    for (const item of items) {
        const count = item.count ?? 1;
        for (let i = 0; i < count; i += 1) {
            expanded.push({ ...item, count: undefined });
        }
    }
    return expanded;
}

export const CHAMPION_STARTER_LOADOUTS: Record<number, ChampionStarterLoadout> = {
    14: { equipped: repeatItems([
        { category: 'Armor', typeId: 8, rawName: 'Ghi' },
        { category: 'Armor', typeId: 22, rawName: 'Ghi Trousers' },
        { category: 'Weapon', typeId: 13, rawName: 'Samurai Sword' },
    ]) },
    4: { equipped: repeatItems([
        { category: 'Armor', typeId: 34, rawName: 'Mithral Aketon' },
        { category: 'Armor', typeId: 22, rawName: 'Blue Pants' },
        { category: 'Armor', typeId: 37, rawName: 'Hosen' },
        { category: 'Weapon', typeId: 16, rawName: 'Torch' },
    ]) },
    5: { equipped: repeatItems([
        { category: 'Armor', typeId: 11, rawName: 'Silk Shirt' },
        { category: 'Armor', typeId: 12, rawName: 'Gunna' },
        { category: 'Armor', typeId: 17, rawName: 'Sandals' },
        { category: 'Misc', typeId: 39, rawName: 'Moonstone' },
    ]) },
    6: { equipped: repeatItems([
        { category: 'Armor', typeId: 3, rawName: 'Leather Jerkin' },
        { category: 'Armor', typeId: 17, rawName: 'Leather Pants' },
        { category: 'Armor', typeId: 18, rawName: 'Suede Boots' },
        { category: 'Weapon', typeId: 27, rawName: 'Arrow', count: 2 },
    ]) },
    7: { equipped: repeatItems([
        { category: 'Armor', typeId: 10, rawName: 'Tunic' },
        { category: 'Armor', typeId: 17, rawName: 'Leather Pants' },
        { category: 'Armor', typeId: 4, rawName: 'Leather Boots' },
        { category: 'Misc', typeId: 46, rawName: "Rabbit's Foot" },
    ]) },
    11: { equipped: repeatItems([
        { category: 'Armor', typeId: 3, rawName: 'Leather Jerkin' },
        { category: 'Armor', typeId: 17, rawName: 'Leather Pants' },
        { category: 'Armor', typeId: 18, rawName: 'Suede Boots' },
        { category: 'Weapon', typeId: 29, rawName: 'Sling' },
    ]) },
    20: { equipped: repeatItems([
        { category: 'Armor', typeId: 10, rawName: 'Tunic' },
        { category: 'Armor', typeId: 22, rawName: 'Blue Pants' },
        { category: 'Armor', typeId: 17, rawName: 'Sandals' },
        { category: 'Weapon', typeId: 34, rawName: 'Staff' },
    ]) },
    3: { equipped: [] },
    21: { equipped: repeatItems([
        { category: 'Armor', typeId: 1, rawName: 'Cloak Of Night' },
    ]) },
    19: { equipped: repeatItems([
        { category: 'Armor', typeId: 14, rawName: 'Halter' },
        { category: 'Armor', typeId: 12, rawName: 'Gunna' },
        { category: 'Armor', typeId: 17, rawName: 'Sandals' },
        { category: 'Misc', typeId: 48, rawName: 'Choker' },
        { category: 'Weapon', typeId: 10, rawName: 'Sword' },
    ]) },
    17: { equipped: repeatItems([
        { category: 'Armor', typeId: 11, rawName: 'Silk Shirt' },
        { category: 'Armor', typeId: 17, rawName: 'Leather Pants' },
        { category: 'Armor', typeId: 4, rawName: 'Leather Boots' },
        { category: 'Misc', typeId: 45, rawName: 'Rope' },
    ]) },
    8: {
        equipped: repeatItems([
            { category: 'Armor', typeId: 6, rawName: 'Robe (Body)' },
            { category: 'Armor', typeId: 26, rawName: 'Robe (Legs)' },
            { category: 'Armor', typeId: 17, rawName: 'Sandals' },
        ]),
        inventory: repeatItems([
            { category: 'Misc', typeId: 31, rawName: 'Bread' },
            { category: 'Misc', typeId: 32, rawName: 'Cheese' },
            { category: 'Misc', typeId: 29, rawName: 'Apple' },
        ]),
    },
    22: { equipped: repeatItems([
        { category: 'Armor', typeId: 3, rawName: 'Leather Jerkin' },
        { category: 'Potion', typeId: 20, rawName: 'Empty Flask' },
    ]) },
    16: { equipped: repeatItems([
        { category: 'Armor', typeId: 10, rawName: 'Tunic' },
        { category: 'Armor', typeId: 17, rawName: 'Leather Pants' },
        { category: 'Armor', typeId: 18, rawName: 'Suede Boots' },
        { category: 'Weapon', typeId: 18, rawName: 'Axe' },
    ]) },
    13: { equipped: repeatItems([
        { category: 'Armor', typeId: 14, rawName: 'Halter' },
        { category: 'Armor', typeId: 29, rawName: 'Barbarian Hide' },
        { category: 'Armor', typeId: 54, rawName: 'Hide Shield' },
        { category: 'Weapon', typeId: 8, rawName: 'Dagger', count: 2 },
    ]) },
    9: { equipped: repeatItems([
        { category: 'Armor', typeId: 3, rawName: 'Leather Jerkin' },
        { category: 'Armor', typeId: 17, rawName: 'Leather Pants' },
        { category: 'Armor', typeId: 4, rawName: 'Leather Boots' },
    ]) },
    18: { equipped: repeatItems([
        { category: 'Armor', typeId: 15, rawName: 'Kirtle' },
        { category: 'Armor', typeId: 12, rawName: 'Gunna' },
        { category: 'Armor', typeId: 17, rawName: 'Sandals' },
        { category: 'Weapon', typeId: 35, rawName: 'Wand' },
    ]) },
    10: { equipped: repeatItems([
        { category: 'Armor', typeId: 11, rawName: 'Silk Shirt' },
        { category: 'Armor', typeId: 13, rawName: 'Tabard' },
        { category: 'Armor', typeId: 17, rawName: 'Sandals' },
        { category: 'Weapon', typeId: 32, rawName: 'Throwing Star', count: 3 },
    ]) },
    23: { equipped: [] },
    1: { equipped: repeatItems([
        { category: 'Armor', typeId: 25, rawName: 'Bezerker Helm' },
        { category: 'Armor', typeId: 29, rawName: 'Barbarian Hide' },
        { category: 'Armor', typeId: 17, rawName: 'Sandals' },
        { category: 'Weapon', typeId: 23, rawName: 'Club' },
    ]) },
    2: {
        equipped: repeatItems([
            { category: 'Armor', typeId: 2, rawName: 'Elven Doublet' },
            { category: 'Armor', typeId: 13, rawName: 'Tabard' },
        ]),
        inventory: repeatItems([
            { category: 'Misc', typeId: 29, rawName: 'Apple' },
        ]),
    },
    15: { equipped: repeatItems([
        { category: 'Armor', typeId: 3, rawName: 'Leather Jerkin' },
        { category: 'Armor', typeId: 22, rawName: 'Blue Pants' },
        { category: 'Armor', typeId: 4, rawName: 'Leather Boots' },
        { category: 'Weapon', typeId: 31, rawName: 'Poison Dart', count: 2 },
    ]) },
    12: { equipped: repeatItems([
        { category: 'Armor', typeId: 2, rawName: 'Elven Doublet' },
        { category: 'Armor', typeId: 14, rawName: 'Elven Huke' },
        { category: 'Armor', typeId: 15, rawName: 'Elven Boots' },
        { category: 'Weapon', typeId: 25, rawName: 'Bow' },
    ]) },
    0: { equipped: repeatItems([
        { category: 'Armor', typeId: 6, rawName: 'Robe (Body)' },
        { category: 'Armor', typeId: 26, rawName: 'Robe (Legs)' },
        { category: 'Armor', typeId: 17, rawName: 'Sandals' },
        { category: 'Misc', typeId: 42, rawName: 'Magical Box (Blue)' },
    ]) },
};

function buildStarterItem(
    championId: number,
    kind: 'equipped' | 'inventory',
    index: number,
    spec: StarterItemSpec,
): FloorItem {
    return {
        id: `starter_${championId}_${kind}_${index}_${spec.category}_${spec.typeId}`,
        category: spec.category,
        typeId: spec.typeId,
        rawName: spec.rawName,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

export function buildChampionStarterLoadout(
    championId: number,
): { equipment: ChampionEquipment; inventory: FloorItem[] } {
    const loadout = CHAMPION_STARTER_LOADOUTS[championId] ?? { equipped: [], inventory: [] };
    const equipment: ChampionEquipment = {};
    const inventory: FloorItem[] = [];

    const equippedItems = loadout.equipped.map((spec, index) => buildStarterItem(championId, 'equipped', index, spec));
    const inventoryItems = (loadout.inventory ?? []).map((spec, index) => buildStarterItem(championId, 'inventory', index, spec));

    for (const item of equippedItems) {
        if (item.category === 'Misc') {
            if (/moonstone|rabbit|magical box/i.test(item.rawName ?? '')) {
                if (!equipment.pocket1) equipment.pocket1 = item;
                else if (!equipment.pocket2) equipment.pocket2 = item;
                else inventory.push(item);
            } else if (/choker/i.test(item.rawName ?? '')) {
                if (!equipment.pocket1) equipment.pocket1 = item;
                else if (!equipment.pocket2) equipment.pocket2 = item;
                else inventory.push(item);
            } else {
                inventory.push(item);
            }
            continue;
        }

        const preferredSlots = getEquippableSlots(item);
        const targetSlot = preferredSlots.find((slot) => !equipment[slot]);
        if (targetSlot) equipment[targetSlot] = item;
        else inventory.push(item);
    }

    inventory.push(...inventoryItems);
    return { equipment, inventory };
}

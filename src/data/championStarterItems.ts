import { getEquippableSlots } from './equipment';
import { getItemTypeIdByName } from './items';
import type { ChampionEquipment, FloorItem } from '../types/game';

type StarterItemSpec = {
    category: FloorItem['category'];
    typeId?: number;
    rawName: string;
    count?: number;
};

export interface ChampionStarterLoadout {
    equipped: StarterItemSpec[];
    inventory?: StarterItemSpec[];
}

function starterItem(
    category: FloorItem['category'],
    rawName: string,
    count?: number,
): StarterItemSpec {
    return { category, rawName, count };
}

function syntheticStarterArmor(typeId: number, rawName: string): StarterItemSpec {
    return { category: 'Armor', typeId, rawName };
}

function findTypeIdByName(
    category: FloorItem['category'],
    rawName: string,
): number | undefined {
    if (category === 'Scroll' || category === 'Container') return undefined;
    return getItemTypeIdByName(category, rawName);
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
        starterItem('Armor', 'Ghi'),
        starterItem('Armor', 'Ghi Trousers'),
        starterItem('Weapon', 'Samurai Sword'),
    ]) },
    4: { equipped: repeatItems([
        starterItem('Armor', 'Mithral Aketon'),
        syntheticStarterArmor(-5, 'Blue Pants'),
        starterItem('Armor', 'Hosen'),
        starterItem('Weapon', 'Torch'),
    ]) },
    5: { equipped: repeatItems([
        starterItem('Armor', 'Silk Shirt'),
        starterItem('Armor', 'Gunna'),
        syntheticStarterArmor(-6, 'Sandals'),
        starterItem('Misc', 'Moonstone'),
    ]) },
    6: { equipped: repeatItems([
        starterItem('Armor', 'Leather Jerkin'),
        starterItem('Armor', 'Leather Pants'),
        starterItem('Armor', 'Suede Boots'),
        starterItem('Weapon', 'Arrow', 2),
    ]) },
    7: { equipped: repeatItems([
        starterItem('Armor', 'Tunic'),
        starterItem('Armor', 'Leather Pants'),
        starterItem('Armor', 'Leather Boots'),
        starterItem('Misc', "Rabbit's Foot"),
    ]) },
    11: { equipped: repeatItems([
        starterItem('Armor', 'Leather Jerkin'),
        starterItem('Armor', 'Leather Pants'),
        starterItem('Armor', 'Suede Boots'),
        starterItem('Weapon', 'Sling'),
    ]) },
    20: { equipped: repeatItems([
        starterItem('Armor', 'Tunic'),
        syntheticStarterArmor(-5, 'Blue Pants'),
        syntheticStarterArmor(-6, 'Sandals'),
        starterItem('Weapon', 'Staff'),
    ]) },
    3: { equipped: [] },
    21: { equipped: repeatItems([
        starterItem('Armor', 'Cloak Of Night'),
    ]) },
    19: { equipped: repeatItems([
        starterItem('Armor', 'Halter'),
        starterItem('Armor', 'Gunna'),
        syntheticStarterArmor(-6, 'Sandals'),
        starterItem('Misc', 'Choker'),
        starterItem('Weapon', 'Sword'),
    ]) },
    17: { equipped: repeatItems([
        starterItem('Armor', 'Silk Shirt'),
        starterItem('Armor', 'Leather Pants'),
        starterItem('Armor', 'Leather Boots'),
        starterItem('Misc', 'Rope'),
    ]) },
    8: {
        equipped: repeatItems([
            syntheticStarterArmor(-1, 'Robe (Body)'),
            syntheticStarterArmor(-2, 'Robe (Legs)'),
            syntheticStarterArmor(-6, 'Sandals'),
        ]),
        inventory: repeatItems([
            starterItem('Misc', 'Bread'),
            starterItem('Misc', 'Cheese'),
            starterItem('Misc', 'Apple'),
        ]),
    },
    22: { equipped: repeatItems([
        starterItem('Armor', 'Leather Jerkin'),
        { category: 'Potion', typeId: 20, rawName: 'Empty Flask' },
    ]) },
    16: { equipped: repeatItems([
        starterItem('Armor', 'Tunic'),
        starterItem('Armor', 'Leather Pants'),
        starterItem('Armor', 'Suede Boots'),
        starterItem('Weapon', 'Axe'),
    ]) },
    13: { equipped: repeatItems([
        starterItem('Armor', 'Halter'),
        starterItem('Armor', 'Barbarian Hide'),
        syntheticStarterArmor(-7, 'Hide Shield'),
        starterItem('Weapon', 'Dagger', 2),
    ]) },
    9: { equipped: repeatItems([
        starterItem('Armor', 'Leather Jerkin'),
        starterItem('Armor', 'Leather Pants'),
        starterItem('Armor', 'Leather Boots'),
    ]) },
    18: { equipped: repeatItems([
        syntheticStarterArmor(-3, 'Kirtle'),
        starterItem('Armor', 'Gunna'),
        syntheticStarterArmor(-6, 'Sandals'),
        starterItem('Weapon', 'Wand'),
    ]) },
    10: { equipped: repeatItems([
        starterItem('Armor', 'Silk Shirt'),
        syntheticStarterArmor(-4, 'Tabard'),
        syntheticStarterArmor(-6, 'Sandals'),
        starterItem('Weapon', 'Throwing Star', 3),
    ]) },
    23: { equipped: [] },
    1: { equipped: repeatItems([
        starterItem('Armor', 'Bezerker Helm'),
        starterItem('Armor', 'Barbarian Hide'),
        syntheticStarterArmor(-6, 'Sandals'),
        starterItem('Weapon', 'Club'),
    ]) },
    2: {
        equipped: repeatItems([
            starterItem('Armor', 'Elven Doublet'),
            syntheticStarterArmor(-4, 'Tabard'),
        ]),
        inventory: repeatItems([
            starterItem('Misc', 'Apple'),
        ]),
    },
    15: { equipped: repeatItems([
        starterItem('Armor', 'Leather Jerkin'),
        syntheticStarterArmor(-5, 'Blue Pants'),
        starterItem('Armor', 'Leather Boots'),
        starterItem('Weapon', 'Poison Dart', 2),
    ]) },
    12: { equipped: repeatItems([
        starterItem('Armor', 'Elven Doublet'),
        starterItem('Armor', 'Elven Huke'),
        starterItem('Armor', 'Elven Boots'),
        starterItem('Weapon', 'Bow'),
    ]) },
    0: { equipped: repeatItems([
        syntheticStarterArmor(-1, 'Robe (Body)'),
        syntheticStarterArmor(-2, 'Robe (Legs)'),
        syntheticStarterArmor(-6, 'Sandals'),
        starterItem('Misc', 'Magical Box (Blue)'),
    ]) },
};

function buildStarterItem(
    championId: number,
    kind: 'equipped' | 'inventory',
    index: number,
    spec: StarterItemSpec,
): FloorItem {
    const typeId =
        findTypeIdByName(spec.category, spec.rawName)
        ?? spec.typeId;
    if (typeId === undefined) {
        throw new Error(`Unable to resolve starter item "${spec.rawName}" for champion ${championId}.`);
    }
    return {
        id: `starter_${championId}_${kind}_${index}_${spec.category}_${typeId}`,
        category: spec.category,
        typeId,
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
            const preferredSlots = getEquippableSlots(item);
            const targetSlot = preferredSlots.find((slot) => !equipment[slot]);
            if (targetSlot) equipment[targetSlot] = item;
            else inventory.push(item);
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

// Item definitions — sourced from Old_data/game_db.json
// Weapons, Armor, Potions, Misc

import weaponsCatalog from '../../public/original_weapons_catalog.json';
import armorCatalog from '../../public/original_armor_catalog.json';
import potionsCatalog from '../../public/original_potions_catalog.json';
import miscCatalog from '../../public/original_misc_catalog.json';
import type { WeaponDef, ArmorDef, PotionDef, MiscDef } from '../types/items';

// ─── Weapons ──────────────────────────────────────────────────────────────────

const LEGACY_WEAPON_TYPES: Record<number, WeaponDef> = {
     0: { id:  0, name: 'Vorpal Blade',     type: 'Sword',   damage: [10, 25], weight:  8, atkSpd: 20, twoHanded: false },
     2: { id:  2, name: 'Fury',             type: 'Sword',   damage: [20, 35], weight: 12, atkSpd: 22, twoHanded: false },
     8: { id:  8, name: 'Arrow',            type: 'Ammo',    damage: [ 8, 15], weight:  1, atkSpd:  0, twoHanded: false },
     9: { id:  9, name: 'Slayer',           type: 'Ammo',    damage: [20, 30], weight:  1, atkSpd:  0, twoHanded: false },
    10: { id: 10, name: 'Rocket',           type: 'Ammo',    damage: [30, 45], weight:  2, atkSpd:  0, twoHanded: false },
    16: { id: 16, name: 'Torch',            type: 'Torch',   damage: [ 4,  8], weight:  3, atkSpd: 20, twoHanded: false, luminous: true },
    17: { id: 17, name: 'Gem of Ages',      type: 'Special', damage: [ 0,  0], weight:  1, atkSpd:  0, twoHanded: false },
    18: { id: 18, name: 'Etoile',           type: 'Special', damage: [ 0,  0], weight:  2, atkSpd:  0, twoHanded: false },
    19: { id: 19, name: 'Yew Staff',        type: 'Staff',   damage: [ 8, 18], weight: 10, atkSpd: 24, twoHanded: true },
    20: { id: 20, name: 'Staff of Claws',   type: 'Staff',   damage: [20, 35], weight: 12, atkSpd: 24, twoHanded: true },
    21: { id: 21, name: 'Staff',            type: 'Staff',   damage: [ 5, 12], weight:  8, atkSpd: 22, twoHanded: true },
    22: { id: 22, name: 'Wand',             type: 'Wand',    damage: [ 5, 10], weight:  3, atkSpd: 18, twoHanded: false },
    23: { id: 23, name: 'Teowand',          type: 'Wand',    damage: [10, 20], weight:  4, atkSpd: 18, twoHanded: false },
    25: { id: 25, name: 'Axe of Strength',  type: 'Axe',     damage: [30, 45], weight: 15, atkSpd: 28, twoHanded: false },
    26: { id: 26, name: 'Executioner',      type: 'Axe',     damage: [35, 55], weight: 18, atkSpd: 30, twoHanded: true },
    27: { id: 27, name: 'Dagger of Fear',   type: 'Dagger',  damage: [15, 25], weight:  4, atkSpd: 14, twoHanded: false },
    32: { id: 32, name: 'Dagger',           type: 'Dagger',  damage: [10, 18], weight:  3, atkSpd: 14, twoHanded: false },
    33: { id: 33, name: 'Falchion',         type: 'Sword',   damage: [22, 34], weight: 10, atkSpd: 20, twoHanded: false },
    34: { id: 34, name: 'Rapier',           type: 'Sword',   damage: [18, 28], weight:  7, atkSpd: 16, twoHanded: false },
    35: { id: 35, name: 'Sabre',            type: 'Sword',   damage: [28, 42], weight: 11, atkSpd: 20, twoHanded: false },
    36: { id: 36, name: 'Sword',            type: 'Sword',   damage: [24, 36], weight: 12, atkSpd: 22, twoHanded: false },
    40: { id: 40, name: 'Bow',              type: 'Bow',     damage: [ 0,  0], weight:  8, atkSpd:  0, twoHanded: true,  ranged: true },
    41: { id: 41, name: 'Crossbow',         type: 'Bow',     damage: [ 0,  0], weight: 10, atkSpd:  0, twoHanded: true,  ranged: true },
    42: { id: 42, name: 'Long Bow',         type: 'Bow',     damage: [ 0,  0], weight:  9, atkSpd:  0, twoHanded: true,  ranged: true },
    48: { id: 48, name: 'Rock',             type: 'Thrown',  damage: [ 6, 12], weight:  4, atkSpd:  0, twoHanded: false, thrown: true },
    49: { id: 49, name: 'Poison Dart',      type: 'Thrown',  damage: [ 4,  8], weight:  1, atkSpd:  0, twoHanded: false, thrown: true, poison: true },
    50: { id: 50, name: 'Throwing Star',    type: 'Thrown',  damage: [10, 18], weight:  2, atkSpd:  0, twoHanded: false, thrown: true },
    56: { id: 56, name: 'Sling',            type: 'Bow',     damage: [ 0,  0], weight:  3, atkSpd:  0, twoHanded: true,  ranged: true },
    63: { id: 63, name: 'Master Key',       type: 'Key',     damage: [ 0,  0], weight:  1, atkSpd:  0, twoHanded: false },
};

// ─── Armor ────────────────────────────────────────────────────────────────────

const LEGACY_ARMOR_TYPES: Record<number, ArmorDef> = {
    // Torso
     0: { id:  0, name: 'Cape',                  slot: 'torso', armor:  0, weight:  1 },
     1: { id:  1, name: 'Cloak of Night',         slot: 'torso', armor:  6, weight:  3 },
     2: { id:  2, name: 'Elven Doublet',          slot: 'torso', armor: 10, weight:  5 },
     3: { id:  3, name: 'Leather Jerkin',         slot: 'torso', armor: 14, weight:  7 },
     4: { id:  4, name: 'Suede Doublet',          slot: 'torso', armor: 12, weight:  6 },
     5: { id:  5, name: 'Robe of the Kite Lord',  slot: 'torso', armor: 25, weight:  8 },
     6: { id:  6, name: 'Robe',                   slot: 'torso', armor:  5, weight:  4 },
     7: { id:  7, name: 'Barbarian Doublet',      slot: 'torso', armor: 16, weight:  8 },
     8: { id:  8, name: 'Gi',                     slot: 'torso', armor:  8, weight:  4 },
     9: { id:  9, name: 'Plate Mail',             slot: 'torso', armor: 35, weight: 25 },
    10: { id: 10, name: 'Tunic',                  slot: 'torso', armor:  4, weight:  3 },
    41: { id: 41, name: 'Torso Plate',            slot: 'torso', armor: 40, weight: 30 },
    // Feet
    16: { id: 16, name: 'Leather Boots',          slot: 'feet',  armor:  6, weight:  4 },
    17: { id: 17, name: 'Sandals',                slot: 'feet',  armor:  2, weight:  2 },
    18: { id: 18, name: 'Hosen',                  slot: 'legs',  armor:  8, weight:  5 },
    19: { id: 19, name: 'Chain Mail Aketon',      slot: 'feet',  armor: 20, weight: 15 },
    20: { id: 20, name: 'Elven Boots',            slot: 'feet',  armor: 10, weight:  3 },
    21: { id: 21, name: 'Suede Boots',            slot: 'feet',  armor:  8, weight:  4 },
    43: { id: 43, name: 'Foot Plate',             slot: 'feet',  armor: 18, weight: 12 },
    // Legs
    22: { id: 22, name: 'Blue Pants',             slot: 'legs',  armor:  6, weight:  4 },
    23: { id: 23, name: 'Mail Aketon',            slot: 'legs',  armor: 14, weight:  8 },
    24: { id: 24, name: 'Leg Mail',               slot: 'legs',  armor: 18, weight: 12 },
    25: { id: 25, name: 'Leather Pants',          slot: 'legs',  armor:  8, weight:  5 },
    42: { id: 42, name: 'Leg Plate',              slot: 'legs',  armor: 25, weight: 18 },
    // Head
    32: { id: 32, name: 'Helmet',                 slot: 'head',  armor: 15, weight:  8 },
    33: { id: 33, name: 'Armet',                  slot: 'head',  armor: 22, weight: 12 },
    34: { id: 34, name: 'Crown of Nerra',         slot: 'head',  armor: 28, weight: 10 },
    35: { id: 35, name: "Vilmain's Hat",          slot: 'head',  armor:  5, weight:  3 },
    // Neck
    40: { id: 40, name: 'Neck Plate',             slot: 'neck',  armor: 12, weight:  6 },
    // Hands
    48: { id: 48, name: 'Gauntlets',              slot: 'hands', armor: 12, weight:  7 },
    49: { id: 49, name: 'Gloves',                 slot: 'hands', armor:  6, weight:  3 },
    // Belt
    56: { id: 56, name: 'Belt',                   slot: 'belt',  armor:  0, weight:  2 },
};

// ─── Potions ──────────────────────────────────────────────────────────────────

const LEGACY_POTION_TYPES: Record<number, PotionDef> = {
     0: { id:  0, name: 'Mon Potion',          effect: 'spellPower', level: 1 },
     1: { id:  1, name: 'Um Potion',           effect: 'spellPower', level: 2 },
     2: { id:  2, name: 'Dee Potion',          effect: 'spellPower', level: 3 },
     3: { id:  3, name: 'Zo Potion',           effect: 'spellPower', level: 4 },
     4: { id:  4, name: 'Ful Potion',          effect: 'spellPower', level: 5 },
     8: { id:  8, name: 'Health Potion',       effect: 'health',     restore: 100 },
     9: { id:  9, name: 'Stamina Potion',      effect: 'stamina',    restore: 100 },
    10: { id: 10, name: 'Mana Potion',         effect: 'mana',       restore: 100 },
    11: { id: 11, name: 'Antidote',            effect: 'poison',     restore: 0 },
    13: { id: 13, name: 'Strength Potion',     effect: 'strength',   boost: 10, duration: 1000 },
    14: { id: 14, name: 'Dexterity Potion',    effect: 'dexterity',  boost: 10, duration: 1000 },
    15: { id: 15, name: 'Wisdom Potion',       effect: 'wisdom',     boost: 10, duration: 1000 },
    16: { id: 16, name: 'Vitality Potion',     effect: 'vitality',   boost: 10, duration: 1000 },
    17: { id: 17, name: 'Anti-Magic Potion',   effect: 'antiMagic',  boost: 20, duration: 1000 },
    18: { id: 18, name: 'Anti-Fire Potion',    effect: 'antiFire',   boost: 20, duration: 1000 },
    24: { id: 24, name: 'Waterskin (water)',   effect: 'stamina',    restore: 30 },
};

// ─── Misc ─────────────────────────────────────────────────────────────────────

// Type IDs confirmed by cross-referencing champion starting equipment (Hall of Champions wall tiles)
// and floor items with the DM1 item location table.
const LEGACY_MISC_TYPES: Record<number, MiscDef> = {
    // ── Food (confirmed) ──────────────────────────────────────────────────────
     1: { id:  1, name: 'Water',          usable: true,  food: true, nutrition: 0,   description: 'Restores stamina' },
    29: { id: 29, name: 'Apple',          usable: true,  food: true, nutrition: 500  },
    30: { id: 30, name: 'Corn',           usable: true,  food: true, nutrition: 600  },
    31: { id: 31, name: 'Bread',          usable: true,  food: true, nutrition: 650  },
    32: { id: 32, name: 'Cheese',         usable: true,  food: true, nutrition: 820  },
    35: { id: 35, name: 'Drumstick',      usable: true,  food: true, nutrition: 990  },
    // ── Champion starting items (confirmed from Hall of Champions tiles) ────
    39: { id: 39, name: 'Moonstone',      usable: false, description: '+3 Mana, +1 Priest skill' },
    42: { id: 42, name: 'Magical Box',    usable: true,  description: 'Freeze Life spell (Blue)' },
    45: { id: 45, name: 'Rope',           usable: true,  description: 'Climb down pits' },
    46: { id: 46, name: "Rabbit's Foot",  usable: false, description: '+10 Luck' },
    48: { id: 48, name: 'Choker',         usable: false, description: 'Accessory' },
    // ── Food (game_db IDs) ────────────────────────────────────────────────
     3: { id:  3, name: 'Dragon Steak',   usable: true,  food: true, nutrition: 1500 },
     4: { id:  4, name: 'Drumstick',      usable: true,  food: true, nutrition: 990  },
     5: { id:  5, name: 'Corn',           usable: true,  food: true, nutrition: 600  },
     6: { id:  6, name: 'Bread',          usable: true,  food: true, nutrition: 650  },
     8: { id:  8, name: 'Apple',          usable: true,  food: true, nutrition: 500  },
     9: { id:  9, name: 'Cheese',         usable: true,  food: true, nutrition: 820  },
    // ── Keys ─────────────────────────────────────────────────────────────
    49: { id: 49, name: 'Key of B',       usable: true,  description: 'Opens specific locks' },
    50: { id: 50, name: 'Winged Key',     usable: true,  description: 'Opens specific locks' },
    51: { id: 51, name: 'Topaz Key',      usable: true,  description: 'Opens specific locks' },
    52: { id: 52, name: 'Cross of Neta',  usable: true,  description: 'Opens specific locks' },
    // ── Other items (IDs from game_db — may be inaccurate) ────────────────
     0: { id:  0, name: 'Compass',        usable: true,  description: 'Shows current direction' },
     2: { id:  2, name: 'Torch',          usable: true,  description: 'Provides light', luminous: true },
    16: { id: 16, name: 'Jewel Symal',    usable: false, description: '+15 Anti-Magic' },
    24: { id: 24, name: 'Ashes',          usable: false, description: 'Remains of a champion' },
    28: { id: 28, name: 'Bones',          usable: false, description: 'Remains of a fallen champion' },
    25: { id: 25, name: 'Magical Box',    usable: false, description: 'Quest item' },
    56: { id: 56, name: 'Chest of the North Wind', usable: false, description: 'Quest item' },
};

function byId<T extends { id: number }>(entries: T[]): Record<number, T> {
    return Object.fromEntries(entries.map((entry) => [entry.id, entry]));
}

function mergeById<T extends { id: number }>(primary: T[], fallback: Record<number, T>): T[] {
    const merged = new Map<number, T>();
    for (const value of Object.values(fallback)) merged.set(value.id, value);
    for (const value of primary) merged.set(value.id, value);
    return [...merged.values()].sort((a, b) => a.id - b.id);
}

function normalizeWeaponEntries(): WeaponDef[] {
    const catalog = weaponsCatalog as unknown as { weapons?: Array<Record<string, unknown>> };
    if (!catalog.weapons) return Object.values(LEGACY_WEAPON_TYPES);

    const normalized: WeaponDef[] = catalog.weapons.map((entry) => ({
        id: Number(entry.id ?? 0),
        name: String(entry.name ?? 'Unknown Weapon'),
        type: String(entry.type ?? 'Special') as WeaponDef['type'],
        damage: [
            Number(Array.isArray(entry.damage) ? entry.damage[0] ?? 0 : 0),
            Number(Array.isArray(entry.damage) ? entry.damage[1] ?? 0 : 0),
        ] as [number, number],
        weight: Number(entry.weight ?? 0),
        atkSpd: Number(entry.atkSpd ?? 0),
        twoHanded: Boolean(entry.twoHanded),
        ranged: entry.ranged === undefined ? undefined : Boolean(entry.ranged),
        thrown: entry.thrown === undefined ? undefined : Boolean(entry.thrown),
        luminous: entry.luminous === undefined ? undefined : Boolean(entry.luminous),
        poison: entry.poison === undefined ? undefined : Boolean(entry.poison),
    }));
    return mergeById(normalized, LEGACY_WEAPON_TYPES);
}

function normalizeArmorEntries(): ArmorDef[] {
    const catalog = armorCatalog as unknown as { armor?: ArmorDef[] };
    return catalog.armor ? mergeById(catalog.armor, LEGACY_ARMOR_TYPES) : Object.values(LEGACY_ARMOR_TYPES);
}

function normalizePotionEntries(): PotionDef[] {
    const catalog = potionsCatalog as unknown as { potions?: PotionDef[] };
    return catalog.potions ? mergeById(catalog.potions, LEGACY_POTION_TYPES) : Object.values(LEGACY_POTION_TYPES);
}

function normalizeMiscEntries(): MiscDef[] {
    const catalog = miscCatalog as unknown as { miscellaneousItems?: MiscDef[] };
    return catalog.miscellaneousItems ? mergeById(catalog.miscellaneousItems, LEGACY_MISC_TYPES) : Object.values(LEGACY_MISC_TYPES);
}

const weaponEntries = normalizeWeaponEntries();
const armorEntries = normalizeArmorEntries();
const potionEntries = normalizePotionEntries();
const miscEntries = normalizeMiscEntries();

export const WEAPON_TYPES: Record<number, WeaponDef> = byId(weaponEntries);
export const ARMOR_TYPES: Record<number, ArmorDef> = byId(armorEntries);
export const POTION_TYPES: Record<number, PotionDef> = byId(potionEntries);
export const MISC_TYPES: Record<number, MiscDef> = byId(miscEntries);

// Runtime-facing item definitions built from extracted original data,
// plus the minimal local metadata still needed by the remake.

import gameDbRaw from '../assets/data/game_db.json?raw';
import type { WeaponDef, ArmorDef, PotionDef, MiscDef } from '../types/items';

const PLACEHOLDER_NAME_RE = /^([A-Za-z]+_\d+|\(W\d+\))$/;

type RawI559Weapon = {
    index: number;
    weightKg: number;
    damage: number;
    kineticEnergy: number;
    shootDamage: number;
    rawClass: number;
};

type RawI559Cloth = {
    index: number;
    weightKg: number;
    protection: number;
    sharpDefense: number;
    isShield: boolean;
};

export type ExtractedAllowedSlots = {
    mouth: boolean;
    head: boolean;
    neck: boolean;
    torso: boolean;
    legs: boolean;
    feet: boolean;
    quiver1: boolean;
    quiver2: boolean;
    pouch: boolean;
    hands: boolean;
    chest: boolean;
};

type RawWeaponAttackReference = {
    weaponIndex: number;
    allowedSlotsMask: number;
    allowedSlots?: ExtractedAllowedSlots;
};

type RawGameDb = {
    weaponAttackReference?: RawWeaponAttackReference[];
    originalAtari?: {
        i559?: {
            weapons?: RawI559Weapon[];
            cloths?: RawI559Cloth[];
            miscWeightsKg?: number[];
            foodValues?: number[];
        };
    };
};

const gameDb = JSON.parse(gameDbRaw) as RawGameDb;
const originalI559 = gameDb.originalAtari?.i559;

const I559_WEAPONS_BY_INDEX = new Map<number, RawI559Weapon>(
    (originalI559?.weapons ?? []).map((entry) => [entry.index, entry]),
);

const I559_CLOTHS_BY_INDEX = new Map<number, RawI559Cloth>(
    (originalI559?.cloths ?? []).map((entry) => [entry.index, entry]),
);

const I559_MISC_WEIGHTS = originalI559?.miscWeightsKg ?? [];
const I559_FOOD_VALUES = originalI559?.foodValues ?? [];
const WEAPON_ATTACK_REFERENCE = gameDb.weaponAttackReference ?? [];
const WEAPON_ALLOWED_SLOT_MASK_BY_INDEX = new Map<number, number>(
    WEAPON_ATTACK_REFERENCE.map((entry) => [entry.weaponIndex, entry.allowedSlotsMask]),
);


const CANONICAL_WEAPON_NAMES: Record<number, string> = {
     0: 'Eye Of Time',
     1: 'Stormring',
     2: 'Torch',
     3: 'Flamitt',
     4: 'Staff Of Claws',
     5: 'Bolt Blade',
     6: 'Fury',
     7: 'The Firestaff',
     8: 'Dagger',
     9: 'Falchion',
    10: 'Sword',
    11: 'Rapier',
    12: 'Sabre',
    13: 'Samurai Sword',
    14: 'Delta',
    15: 'Diamond Edge',
    16: 'Vorpal Blade',
    17: 'The Inquisitor',
    18: 'Axe',
    19: 'Hardcleave',
    20: 'Mace',
    21: 'Mace Of Order',
    22: 'Morningstar',
    23: 'Club',
    25: 'Bow',
    26: 'Crossbow',
    27: 'Arrow',
    28: 'Slayer',
    29: 'Sling',
    30: 'Rock',
    31: 'Poison Dart',
    32: 'Throwing Star',
    34: 'Staff',
    35: 'Wand',
    36: 'Teowand',
    37: 'Yew Staff',
    38: 'Staff Of Manar',
     39: 'Snake Staff',
     40: 'The Conduit',
     41: 'Dragon Spit',
     42: 'Sceptre Of Lyf',
     43: 'Horn Of Fear',
     44: 'Speedbow',
     45: 'The Firestaff (Complete)',
     63: 'Master Key',
};

const CANONICAL_ARMOR_NAMES: Record<number, string> = {
     0: 'Cape',
     1: 'Cloak of Night',
     2: 'Elven Doublet',
     3: 'Leather Jerkin',
     4: 'Leather Boots',
     5: 'Robe of the Kite Lord',
     6: 'Robe',
     7: 'Fine Robe (Body)',
     8: 'Fine Robe (Legs)',
     9: 'Plate Mail',
    10: 'Tunic',
    11: 'Silk Shirt',
    12: 'Gunna',
    13: 'Elven Doublet',
    14: 'Elven Huke',
    15: 'Elven Boots',
    16: 'Leather Jerkin',
    17: 'Leather Pants',
    18: 'Suede Boots',
    19: 'Chain Mail Aketon',
    20: 'Tunic',
    21: 'Ghi',
    22: 'Ghi Trousers',
    23: 'Calista',
    24: 'Crown Of Nerra',
    25: 'Bezerker Helm',
    26: 'Helmet',
    27: 'Basinet',
    28: 'Buckler',
    29: 'Barbarian Hide',
    30: 'Wooden Shield',
    31: 'Small Shield',
    32: 'Mail Aketon',
    33: 'Leg Mail',
    34: 'Mithral Aketon',
    35: 'Mithral Mail',
    36: "Casque'n Coif",
    37: 'Hosen',
    38: 'Armet',
    39: 'Torso Plate',
    40: 'Leg Plate',
    41: 'Foot Plate',
    42: 'Large Shield',
    43: 'Helm Of Lyte',
    44: 'Plate Of Lyte',
    45: 'Poleyn Of Lyte',
    46: 'Greave Of Lyte',
    47: 'Shield Of Lyte',
    48: 'Helm Of Darc',
    49: 'Plate Of Darc',
    50: 'Poleyn Of Darc',
    51: 'Greave Of Darc',
    52: 'Shield Of Darc',
    54: 'Flamebain',
    56: 'Boots Of Speed',
    57: 'Halter',
};

const CANONICAL_MISC_NAMES: Record<number, string> = {
     0: 'Compass',
     1: 'Waterskin',
     2: 'Jewel Symal',
     3: 'Illumulet',
     4: 'Ashes',
     5: 'Bones',
     6: 'Copper Coin',
     7: 'Silver Coin',
     8: 'Gold Coin',
     9: 'Iron Key',
    10: 'Key Of B',
    11: 'Solid Key',
    12: 'Square Key',
    13: 'Tourquoise Key',
    14: 'Cross Key',
    15: 'Onyx Key',
    16: 'Skeleton Key',
    17: 'Gold Key',
    18: 'Winged Key',
    19: 'Topaz Key',
    20: 'Sapphire Key',
    21: 'Emerald Key',
    22: 'Ruby Key',
    23: 'Ra Key',
    24: 'Master Key',
    25: 'Boulder',
    26: 'Blue Gem',
    27: 'Orange Gem',
    28: 'Green Gem',
    29: 'Apple',
    30: 'Corn',
    31: 'Bread',
    32: 'Cheese',
    33: 'Screamer Slice',
    34: 'Worm Round',
    35: 'Drumstick',
    36: 'Dragon Steak',
    37: 'Gem Of Ages',
    38: 'Ekkhard Cross',
    39: 'Moonstone',
    40: 'The Hellion',
    41: 'Pendant Feral',
    42: 'Magical Box (Blue)',
    43: 'Magical Box (Green)',
    44: 'Mirror Of Dawn',
    45: 'Rope',
    46: "Rabbit's Foot",
    47: 'Corbamite',
    48: 'Choker',
    49: 'Lock Picks',
    50: 'Magnifier',
    51: 'Zokathra',
    56: 'Chest',
};

const CANONICAL_POTION_NAMES: Record<number, string> = {
     0: 'Mon Potion',
     1: 'Um Potion',
     2: 'Dee Potion',
     3: 'Zo Potion',
     4: 'Ful Potion',
     8: 'Health Potion',
     9: 'Stamina Potion',
    10: 'Mana Potion',
    11: 'Antidote',
    13: 'Strength Potion',
    14: 'Dexterity Potion',
    15: 'Wisdom Potion',
    16: 'Vitality Potion',
    17: 'Anti-Magic Potion',
    18: 'Anti-Fire Potion',
    24: 'Waterskin (water)',
};

// ─── Weapons ──────────────────────────────────────────────────────────────────

const OFFICIAL_WEAPON_TYPES: Record<number, WeaponDef> = {
     0: { id:  0, name: 'Eye Of Time',              type: 'Wand',    damage: [  2,   2], weight: 0.1, atkSpd: 18, twoHanded: false },
     1: { id:  1, name: 'Stormring',                type: 'Wand',    damage: [  2,   2], weight: 0.1, atkSpd: 18, twoHanded: false },
     2: { id:  2, name: 'Torch',                    type: 'Torch',   damage: [  8,   8], weight: 1.1, atkSpd: 20, twoHanded: false, luminous: true },
     3: { id:  3, name: 'Flamitt',                  type: 'Wand',    damage: [ 10,  10], weight: 1.2, atkSpd: 18, twoHanded: false },
     4: { id:  4, name: 'Staff Of Claws',           type: 'Staff',   damage: [ 16,  16], weight: 0.9, atkSpd: 24, twoHanded: false },
     5: { id:  5, name: 'Bolt Blade',               type: 'Sword',   damage: [ 49,  49], weight: 3.0, atkSpd: 20, twoHanded: false },
     6: { id:  6, name: 'Fury',                     type: 'Sword',   damage: [ 55,  55], weight: 4.7, atkSpd: 20, twoHanded: false },
     7: { id:  7, name: 'The Firestaff',            type: 'Staff',   damage: [ 25,  25], weight: 2.4, atkSpd: 24, twoHanded: false, luminous: true },
     8: { id:  8, name: 'Dagger',                   type: 'Dagger',  damage: [ 10,  10], weight: 0.5, atkSpd: 14, twoHanded: false },
     9: { id:  9, name: 'Falchion',                 type: 'Sword',   damage: [ 30,  30], weight: 3.3, atkSpd: 20, twoHanded: false },
    10: { id: 10, name: 'Sword',                    type: 'Sword',   damage: [ 34,  34], weight: 3.2, atkSpd: 22, twoHanded: false },
    11: { id: 11, name: 'Rapier',                   type: 'Sword',   damage: [ 38,  38], weight: 2.6, atkSpd: 16, twoHanded: false },
    12: { id: 12, name: 'Sabre',                    type: 'Sword',   damage: [ 42,  42], weight: 3.5, atkSpd: 20, twoHanded: false },
    13: { id: 13, name: 'Samurai Sword',            type: 'Sword',   damage: [ 46,  46], weight: 3.6, atkSpd: 20, twoHanded: false },
    14: { id: 14, name: 'Delta',                    type: 'Sword',   damage: [ 50,  50], weight: 3.3, atkSpd: 20, twoHanded: false },
    15: { id: 15, name: 'Diamond Edge',             type: 'Sword',   damage: [ 62,  62], weight: 3.7, atkSpd: 20, twoHanded: false },
    16: { id: 16, name: 'Vorpal Blade',             type: 'Sword',   damage: [ 48,  48], weight: 3.0, atkSpd: 20, twoHanded: false },
    17: { id: 17, name: 'The Inquisitor',           type: 'Sword',   damage: [ 58,  58], weight: 3.9, atkSpd: 20, twoHanded: false },
    18: { id: 18, name: 'Axe',                      type: 'Axe',     damage: [ 49,  49], weight: 4.3, atkSpd: 28, twoHanded: false },
    19: { id: 19, name: 'Hardcleave',               type: 'Axe',     damage: [ 70,  70], weight: 6.5, atkSpd: 30, twoHanded: false },
    20: { id: 20, name: 'Mace',                     type: 'Staff',   damage: [ 32,  32], weight: 3.1, atkSpd: 22, twoHanded: false },
    21: { id: 21, name: 'Mace Of Order',            type: 'Staff',   damage: [ 42,  42], weight: 4.1, atkSpd: 22, twoHanded: false },
    22: { id: 22, name: 'Morningstar',              type: 'Staff',   damage: [ 60,  60], weight: 5.0, atkSpd: 22, twoHanded: false },
    23: { id: 23, name: 'Club',                     type: 'Staff',   damage: [ 19,  19], weight: 3.6, atkSpd: 22, twoHanded: false },
    24: { id: 24, name: 'Stone Club',               type: 'Staff',   damage: [ 44,  44], weight: 11.0, atkSpd: 24, twoHanded: false },
    25: { id: 25, name: 'Bow',                      type: 'Bow',     damage: [  1,   1], weight: 1.0, atkSpd:  0, twoHanded: true,  ranged: true },
    26: { id: 26, name: 'Crossbow',                 type: 'Bow',     damage: [  1,   1], weight: 2.8, atkSpd:  0, twoHanded: true,  ranged: true },
    27: { id: 27, name: 'Arrow',                    type: 'Ammo',    damage: [  2,   2], weight: 0.2, atkSpd:  0, twoHanded: false },
    28: { id: 28, name: 'Slayer',                   type: 'Ammo',    damage: [  2,   2], weight: 0.2, atkSpd:  0, twoHanded: false },
    29: { id: 29, name: 'Sling',                    type: 'Bow',     damage: [  5,   5], weight: 1.9, atkSpd:  0, twoHanded: true,  ranged: true },
    30: { id: 30, name: 'Rock',                     type: 'Thrown',  damage: [  6,   6], weight: 1.0, atkSpd:  0, twoHanded: false, thrown: true },
    31: { id: 31, name: 'Poison Dart',              type: 'Thrown',  damage: [  7,   7], weight: 0.3, atkSpd:  0, twoHanded: false, thrown: true, poison: true },
    32: { id: 32, name: 'Throwing Star',            type: 'Thrown',  damage: [  3,   3], weight: 0.1, atkSpd:  0, twoHanded: false, thrown: true },
    33: { id: 33, name: 'Stick',                    type: 'Staff',   damage: [  4,   4], weight: 0.8, atkSpd: 22, twoHanded: false },
    34: { id: 34, name: 'Staff',                    type: 'Staff',   damage: [ 12,  12], weight: 2.6, atkSpd: 22, twoHanded: false },
    35: { id: 35, name: 'Wand',                     type: 'Wand',    damage: [  0,   0], weight: 0.1, atkSpd: 18, twoHanded: false },
    36: { id: 36, name: 'Teowand',                  type: 'Wand',    damage: [  1,   1], weight: 0.2, atkSpd: 18, twoHanded: false },
    37: { id: 37, name: 'Yew Staff',                type: 'Staff',   damage: [ 18,  18], weight: 3.5, atkSpd: 24, twoHanded: false },
    38: { id: 38, name: 'Staff Of Manar',           type: 'Staff',   damage: [  0,   0], weight: 2.9, atkSpd: 24, twoHanded: false },
    39: { id: 39, name: 'Snake Staff',              type: 'Staff',   damage: [  0,   0], weight: 2.1, atkSpd: 24, twoHanded: false },
    40: { id: 40, name: 'The Conduit',              type: 'Staff',   damage: [  0,   0], weight: 3.3, atkSpd: 24, twoHanded: false },
    41: { id: 41, name: 'Dragon Spit',              type: 'Wand',    damage: [  3,   3], weight: 0.8, atkSpd: 18, twoHanded: false },
    42: { id: 42, name: 'Sceptre Of Lyf',           type: 'Wand',    damage: [  9,   9], weight: 1.8, atkSpd: 18, twoHanded: false },
    43: { id: 43, name: 'Horn Of Fear',             type: 'Special', damage: [  1,   1], weight: 0.8, atkSpd: 18, twoHanded: false },
    44: { id: 44, name: 'Speedbow',                 type: 'Bow',     damage: [  1,   1], weight: 3.0, atkSpd:  0, twoHanded: true,  ranged: true },
    45: { id: 45, name: 'The Firestaff (Complete)', type: 'Staff',   damage: [100, 100], weight: 3.6, atkSpd: 24, twoHanded: false, luminous: true },
    63: { id: 63, name: 'Master Key',               type: 'Key',     damage: [  0,   0], weight: 0.1, atkSpd:  0, twoHanded: false },
};

// ─── Armor ────────────────────────────────────────────────────────────────────

const OFFICIAL_ARMOR_TYPES: Record<number, ArmorDef> = {
     0: { id:  0, name: 'Cape',               slot: 'torso', armor:   5, weight: 0.3 },
     1: { id:  1, name: 'Cloak Of Night',     slot: 'torso', armor:  10, weight: 0.4 },
     4: { id:  4, name: 'Leather Boots',      slot: 'feet',  armor:  25, weight: 1.6 },
     5: { id:  5, name: 'Robe Of The Kite Lord', slot: 'torso', armor: 25, weight: 8.0 },
     6: { id:  6, name: 'Robe',               slot: 'torso', armor:   5, weight: 0.4 },
     7: { id:  7, name: 'Fine Robe (Body)',   slot: 'torso', armor:   7, weight: 0.3 },
     8: { id:  8, name: 'Fine Robe (Legs)',   slot: 'legs',  armor:   7, weight: 0.3 },
     9: { id:  9, name: 'Plate Mail',         slot: 'torso', armor:  35, weight: 25.0 },
    10: { id: 10, name: 'Tunic',              slot: 'torso', armor:   9, weight: 0.5 },
    11: { id: 11, name: 'Silk Shirt',         slot: 'torso', armor:   4, weight: 0.2 },
    12: { id: 12, name: 'Gunna',              slot: 'torso', armor:   7, weight: 0.5 },
    13: { id: 13, name: 'Elven Doublet',      slot: 'torso', armor:  11, weight: 0.3 },
    14: { id: 14, name: 'Elven Huke',         slot: 'torso', armor:  13, weight: 0.3 },
    15: { id: 15, name: 'Elven Boots',        slot: 'feet',  armor:  13, weight: 0.4 },
    16: { id: 16, name: 'Leather Jerkin',     slot: 'torso', armor:  17, weight: 0.6 },
    17: { id: 17, name: 'Leather Pants',      slot: 'legs',  armor:  20, weight: 0.8 },
    18: { id: 18, name: 'Suede Boots',        slot: 'feet',  armor:  20, weight: 1.4 },
    19: { id: 19, name: 'Chain Mail Aketon',  slot: 'torso', armor:  20, weight: 15.0 },
    20: { id: 20, name: 'Tunic',              slot: 'torso', armor:   9, weight: 0.5 },
    21: { id: 21, name: 'Ghi',                slot: 'torso', armor:   8, weight: 0.5 },
    22: { id: 22, name: 'Ghi Trousers',       slot: 'legs',  armor:   9, weight: 0.5 },
    23: { id: 23, name: 'Calista',            slot: 'head',  armor:   1, weight: 0.4 },
    24: { id: 24, name: 'Crown Of Nerra',     slot: 'head',  armor:   5, weight: 0.6 },
    25: { id: 25, name: 'Bezerker Helm',      slot: 'head',  armor:  12, weight: 1.1 },
    26: { id: 26, name: 'Helmet',             slot: 'head',  armor:  17, weight: 1.4 },
    27: { id: 27, name: 'Basinet',            slot: 'head',  armor:  20, weight: 1.5 },
    28: { id: 28, name: 'Buckler',            slot: 'hands', armor:  22, weight: 1.1 },
    29: { id: 29, name: 'Barbarian Hide',     slot: 'torso', armor:   4, weight: 0.3 },
    30: { id: 30, name: 'Wooden Shield',      slot: 'hands', armor:  20, weight: 1.4 },
    31: { id: 31, name: 'Small Shield',       slot: 'hands', armor:  35, weight: 2.1 },
    32: { id: 32, name: 'Mail Aketon',        slot: 'torso', armor:  35, weight: 6.5 },
    33: { id: 33, name: 'Leg Mail',           slot: 'legs',  armor:  35, weight: 5.3 },
    34: { id: 34, name: 'Mithral Aketon',     slot: 'torso', armor:  70, weight: 5.2 },
    35: { id: 35, name: 'Mithral Mail',       slot: 'torso', armor:  55, weight: 4.1 },
    36: { id: 36, name: "Casque'n Coif",      slot: 'head',  armor:  25, weight: 1.6 },
    37: { id: 37, name: 'Hosen',              slot: 'legs',  armor:  30, weight: 1.6 },
    38: { id: 38, name: 'Armet',              slot: 'head',  armor:  40, weight: 1.9 },
    39: { id: 39, name: 'Torso Plate',        slot: 'torso', armor:  65, weight: 12.0 },
    40: { id: 40, name: 'Leg Plate',          slot: 'legs',  armor:  56, weight: 8.0 },
    41: { id: 41, name: 'Foot Plate',         slot: 'feet',  armor:  37, weight: 2.8 },
    42: { id: 42, name: 'Large Shield',       slot: 'hands', armor:  56, weight: 3.4 },
    43: { id: 43, name: 'Helm Of Lyte',       slot: 'head',  armor:  62, weight: 1.7 },
    44: { id: 44, name: 'Plate Of Lyte',      slot: 'torso', armor: 125, weight: 10.8 },
    45: { id: 45, name: 'Poleyn Of Lyte',     slot: 'legs',  armor:  90, weight: 7.2 },
    46: { id: 46, name: 'Greave Of Lyte',     slot: 'feet',  armor:  50, weight: 2.4 },
    47: { id: 47, name: 'Shield Of Lyte',     slot: 'hands', armor:  85, weight: 3.0 },
    48: { id: 48, name: 'Helm Of Darc',       slot: 'head',  armor:  76, weight: 3.5 },
    49: { id: 49, name: 'Plate Of Darc',      slot: 'torso', armor: 160, weight: 14.1 },
    50: { id: 50, name: 'Poleyn Of Darc',     slot: 'legs',  armor: 101, weight: 9.0 },
    51: { id: 51, name: 'Greave Of Darc',     slot: 'feet',  armor:  60, weight: 3.1 },
    52: { id: 52, name: 'Shield Of Darc',     slot: 'hands', armor: 100, weight: 4.0 },
    54: { id: 54, name: 'Flamebain',          slot: 'torso', armor:  60, weight: 5.7 },
    56: { id: 56, name: 'Boots Of Speed',     slot: 'feet',  armor:  16, weight: 0.3 },
    57: { id: 57, name: 'Halter',             slot: 'torso', armor:   3, weight: 0.2 },
};

const STARTER_ARMOR_NAME_OVERRIDES: Record<string, ArmorDef> = {
    'robe (body)':      { id: -1, name: 'Robe (Body)',      slot: 'torso', armor:  5, weight: 0.4 },
    'robe (legs)':      { id: -2, name: 'Robe (Legs)',      slot: 'legs',  armor:  5, weight: 0.4 },
    'fine robe (body)': { id:  7, name: 'Fine Robe (Body)', slot: 'torso', armor:  7, weight: 0.3 },
    'fine robe (legs)': { id:  8, name: 'Fine Robe (Legs)', slot: 'legs',  armor:  7, weight: 0.3 },
    kirtle:             { id: -3, name: 'Kirtle',           slot: 'torso', armor:  6, weight: 0.4 },
    tabard:             { id: -4, name: 'Tabard',           slot: 'torso', armor:  5, weight: 0.4 },
    'blue pants':       { id: -5, name: 'Blue Pants',       slot: 'legs',  armor: 12, weight: 0.6 },
    sandals:            { id: -6, name: 'Sandals',          slot: 'feet',  armor:  5, weight: 0.6 },
    'hide shield':      { id: -7, name: 'Hide Shield',      slot: 'hands', armor: 16, weight: 1.0 },
};

// ─── Potions ──────────────────────────────────────────────────────────────────

const OFFICIAL_POTION_TYPES: Record<number, PotionDef> = {
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

const OFFICIAL_MISC_TYPES: Record<number, MiscDef> = {
     0: { id:  0, name: 'Compass',            usable: false, description: 'Shows current direction' },
     1: { id:  1, name: 'Waterskin',          usable: true,  description: 'Restores stamina when filled' },
     2: { id:  2, name: 'Jewel Symal',        usable: false, description: '+15 Anti-Magic' },
     3: { id:  3, name: 'Illumulet',          usable: false, luminous: true, description: 'Produces light when lit' },
     4: { id:  4, name: 'Ashes',              usable: false, description: 'Remains of a champion' },
     5: { id:  5, name: 'Bones',              usable: false, description: 'Can be resurrected at a Vi altar' },
     6: { id:  6, name: 'Copper Coin',        usable: true,  description: 'Coin' },
     7: { id:  7, name: 'Silver Coin',        usable: true,  description: 'Coin' },
     8: { id:  8, name: 'Gold Coin',          usable: true,  description: 'Coin' },
     9: { id:  9, name: 'Iron Key',           usable: true,  key: true, description: 'Opens specific locks' },
    10: { id: 10, name: 'Key Of B',           usable: true,  key: true, description: 'Opens specific locks' },
    11: { id: 11, name: 'Solid Key',          usable: true,  key: true, description: 'Opens specific locks' },
    12: { id: 12, name: 'Square Key',         usable: true,  key: true, description: 'Opens specific locks' },
    13: { id: 13, name: 'Tourquoise Key',     usable: true,  key: true, description: 'Opens specific locks' },
    14: { id: 14, name: 'Cross Key',          usable: true,  key: true, description: 'Opens specific locks' },
    15: { id: 15, name: 'Onyx Key',           usable: true,  key: true, description: 'Hack-only key' },
    16: { id: 16, name: 'Skeleton Key',       usable: true,  key: true, description: 'Opens specific locks' },
    17: { id: 17, name: 'Gold Key',           usable: true,  key: true, description: 'Opens specific locks' },
    18: { id: 18, name: 'Winged Key',         usable: true,  key: true, description: 'Opens specific locks' },
    19: { id: 19, name: 'Topaz Key',          usable: true,  key: true, description: 'Opens specific locks' },
    20: { id: 20, name: 'Sapphire Key',       usable: true,  key: true, description: 'Hack-only key' },
    21: { id: 21, name: 'Emerald Key',        usable: true,  key: true, description: 'Opens specific locks' },
    22: { id: 22, name: 'Ruby Key',           usable: true,  key: true, description: 'Opens specific locks' },
    23: { id: 23, name: 'Ra Key',             usable: true,  key: true, description: 'Opens specific locks' },
    24: { id: 24, name: 'Master Key',         usable: true,  key: true, description: 'Master key' },
    25: { id: 25, name: 'Boulder',            usable: false, description: 'Heavy throwable object' },
    26: { id: 26, name: 'Blue Gem',           usable: false, description: 'Quest gem' },
    27: { id: 27, name: 'Orange Gem',         usable: false, description: 'Quest gem' },
    28: { id: 28, name: 'Green Gem',          usable: false, description: 'Quest gem' },
    29: { id: 29, name: 'Apple',              usable: true,  food: true, nutrition: 0 },
    30: { id: 30, name: 'Corn',               usable: true,  food: true, nutrition: 0 },
    31: { id: 31, name: 'Bread',              usable: true,  food: true, nutrition: 0 },
    32: { id: 32, name: 'Cheese',             usable: true,  food: true, nutrition: 0 },
    33: { id: 33, name: 'Screamer Slice',     usable: true,  food: true, nutrition: 0 },
    34: { id: 34, name: 'Worm Round',         usable: true,  food: true, nutrition: 0 },
    35: { id: 35, name: 'Drumstick',          usable: true,  food: true, nutrition: 0 },
    36: { id: 36, name: 'Dragon Steak',       usable: true,  food: true, nutrition: 0 },
    37: { id: 37, name: 'Gem Of Ages',        usable: false, description: '+1 hidden priest skill' },
    38: { id: 38, name: 'Ekkhard Cross',      usable: false, description: 'Faster health regeneration' },
    39: { id: 39, name: 'Moonstone',          usable: false, description: '+3 Mana, +1 hidden priest skill' },
    40: { id: 40, name: 'The Hellion',        usable: false, description: 'Quest item' },
    41: { id: 41, name: 'Pendant Feral',      usable: false, description: '+1 Wizard skill' },
    42: { id: 42, name: 'Magical Box (Blue)', usable: true,  description: 'Freeze Life item' },
    43: { id: 43, name: 'Magical Box (Green)', usable: true, description: 'Freeze Life item (stronger)' },
    44: { id: 44, name: 'Mirror Of Dawn',     usable: false, description: 'Quest item' },
    45: { id: 45, name: 'Rope',               usable: true,  description: 'Climb down pits' },
    46: { id: 46, name: "Rabbit's Foot",      usable: false, description: '+10 Luck' },
    47: { id: 47, name: 'Corbamite',          usable: false, description: 'Quest item' },
    48: { id: 48, name: 'Choker',             usable: false, description: 'Neck item' },
    49: { id: 49, name: 'Lock Picks',         usable: true,  description: 'Hack-only item' },
    50: { id: 50, name: 'Magnifier',          usable: false, description: 'Quest item' },
    51: { id: 51, name: 'Zokathra',           usable: false, description: 'Created by the Zokathra spell' },
    56: { id: 56, name: 'Chest',              usable: false, description: 'Container' },
};

function byId<T extends { id: number }>(entries: T[]): Record<number, T> {
    return Object.fromEntries(entries.map((entry) => [entry.id, entry]));
}

function getCanonicalName(category: 'Weapon' | 'Armor' | 'Potion' | 'Misc', typeId: number): string | undefined {
    switch (category) {
        case 'Weapon': return CANONICAL_WEAPON_NAMES[typeId];
        case 'Armor': return CANONICAL_ARMOR_NAMES[typeId];
        case 'Potion': return CANONICAL_POTION_NAMES[typeId];
        case 'Misc': return CANONICAL_MISC_NAMES[typeId];
        default: return undefined;
    }
}

export function resolveItemName(
    category: 'Weapon' | 'Armor' | 'Potion' | 'Misc' | 'Scroll' | 'Container',
    typeId: number,
    rawName?: string,
): string {
    if (category === 'Scroll') return rawName && !PLACEHOLDER_NAME_RE.test(rawName) ? rawName : 'Scroll';
    if (category === 'Container') return rawName && !PLACEHOLDER_NAME_RE.test(rawName) ? rawName : 'Chest';

    const canonical = getCanonicalName(category, typeId);
    if (canonical) return canonical;
    if (rawName && !PLACEHOLDER_NAME_RE.test(rawName)) return rawName;
    return `${category} #${typeId}`;
}

const SCROLL_TEXT_FIXUPS: Record<string, string> = {
    'SE PIT\nLEAVE A\nVALUABLE\nON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
    'PIT\nLEAVE A\nVALUABLE\nON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
    'LEAVE A\nVALUABLE\nON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
    'LE\nON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
    'UABLE\nON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
    'ON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
    'FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
    'S FOUNTAIN\nACCEPTS ONE\nWISH.': 'THIS FOUNTAIN\nACCEPTS ONE\nWISH.',
    'OUNTAIN\nACCEPTS ONE\nWISH.': 'THIS FOUNTAIN\nACCEPTS ONE\nWISH.',
    'N\nACCEPTS ONE\nWISH.': 'THIS FOUNTAIN\nACCEPTS ONE\nWISH.',
    'E\nWISH.': 'THIS FOUNTAIN\nACCEPTS ONE\nWISH.',
    'L\nFOR A MAGIC\nTORCH': 'INVOKE FUL\nFOR A MAGIC\nTORCH',
    'OR A MAGIC\nTORCH': 'INVOKE FUL\nFOR A MAGIC\nTORCH',
    'AGIC\nTORCH': 'INVOKE FUL\nFOR A MAGIC\nTORCH',
    'C\nTORCH': 'INVOKE FUL\nFOR A MAGIC\nTORCH',
    'ORCH': 'INVOKE FUL\nFOR A MAGIC\nTORCH',
    RTCUT: 'SHORTCUT',
    ACK: 'TURN BACK',
    'BRAVE\nADVENTURERS.': 'COME BACK\nBRAVE\nADVENTURERS.',
    'AVE\nADVENTURERS.': 'COME BACK\nBRAVE\nADVENTURERS.',
    'ADVENTURERS.': 'COME BACK\nBRAVE\nADVENTURERS.',
};

export function normalizeScrollText(rawText?: string): string | undefined {
    if (!rawText) return rawText;
    return SCROLL_TEXT_FIXUPS[rawText] ?? rawText;
}

function normalizeWeaponEntries(): WeaponDef[] {
    return Object.values(OFFICIAL_WEAPON_TYPES)
        .sort((a, b) => a.id - b.id)
        .map((entry) => ({
            ...entry,
            weight: I559_WEAPONS_BY_INDEX.get(entry.id)?.weightKg ?? entry.weight,
            damage: (() => {
                const raw = I559_WEAPONS_BY_INDEX.get(entry.id);
                return raw ? [raw.damage, raw.damage] as [number, number] : entry.damage;
            })(),
            name: resolveItemName('Weapon', entry.id, entry.name),
        }));
}

function normalizeArmorEntries(): ArmorDef[] {
    return Object.values(OFFICIAL_ARMOR_TYPES).map((entry) => ({
        ...entry,
        weight: I559_CLOTHS_BY_INDEX.get(entry.id)?.weightKg ?? entry.weight,
        armor: I559_CLOTHS_BY_INDEX.get(entry.id)?.protection ?? entry.armor,
        name: resolveItemName('Armor', entry.id, entry.name),
    }));
}

function normalizePotionEntries(): PotionDef[] {
    return Object.values(OFFICIAL_POTION_TYPES).map((entry) => ({
        ...entry,
        name: resolveItemName('Potion', entry.id, entry.name),
    }));
}

function normalizeMiscEntries(): MiscDef[] {
    return Object.values(OFFICIAL_MISC_TYPES).map((entry) => ({
        ...entry,
        weight: I559_MISC_WEIGHTS[entry.id] ?? entry.weight,
        nutrition: (() => {
            if (!entry.food) return entry.nutrition;
            switch (entry.id) {
                case 29: return I559_FOOD_VALUES[0] ?? entry.nutrition;
                case 30: return I559_FOOD_VALUES[1] ?? entry.nutrition;
                case 31: return I559_FOOD_VALUES[2] ?? entry.nutrition;
                case 32: return I559_FOOD_VALUES[3] ?? entry.nutrition;
                case 33: return I559_FOOD_VALUES[4] ?? entry.nutrition;
                case 34: return I559_FOOD_VALUES[5] ?? entry.nutrition;
                case 35: return I559_FOOD_VALUES[6] ?? entry.nutrition;
                case 36: return I559_FOOD_VALUES[7] ?? entry.nutrition;
                default: return entry.nutrition;
            }
        })(),
        name: resolveItemName('Misc', entry.id, entry.name),
    }));
}

const weaponEntries = normalizeWeaponEntries();
const armorEntries = normalizeArmorEntries();
const potionEntries = normalizePotionEntries();
const miscEntries = normalizeMiscEntries();

export const WEAPON_TYPES: Record<number, WeaponDef> = byId(weaponEntries);
export const ARMOR_TYPES: Record<number, ArmorDef> = byId(armorEntries);
export const POTION_TYPES: Record<number, PotionDef> = byId(potionEntries);
export const MISC_TYPES: Record<number, MiscDef> = byId(miscEntries);

export function getWeaponAllowedSlotsMask(typeId: number): number | undefined {
    return WEAPON_ALLOWED_SLOT_MASK_BY_INDEX.get(typeId);
}

const ARMOR_NAME_LOOKUP: Record<string, ArmorDef> = Object.fromEntries(
    armorEntries.map((entry) => [entry.name.trim().toLowerCase(), entry]),
);

export function getArmorDef(typeId: number, rawName?: string): ArmorDef | undefined {
    const normalizedName = rawName?.trim().toLowerCase();
    if (normalizedName) {
        const exact = ARMOR_NAME_LOOKUP[normalizedName];
        if (exact) return exact;
        const starter = STARTER_ARMOR_NAME_OVERRIDES[normalizedName];
        if (starter) return starter;
    }
    return ARMOR_TYPES[typeId];
}

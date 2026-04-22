// Runtime-facing item definitions built from extracted original data,
// plus the minimal local metadata still needed by the remake.

import type { WeaponDef, ArmorDef, PotionDef, MiscDef } from '../types/items';
import packagedGameDbItems from '../assets/runtime/db/game_db_items.json';
import { getGameDbItemsRawSync } from './gameDbData';
import { POTION_NAME_TO_RUNTIME_TYPE_ID } from './itemRuntimeCompatibility';
import { getOriginalEquipmentBonusDescription } from './originalEquipmentBonuses';

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

type RawObjectInfo = {
    index: number;
    allowedSlotsMask: number;
    allowedSlots?: ExtractedAllowedSlots;
    attackClass?: number;
};

type RawWeaponAttackReference = {
    weaponIndex: number;
    allowedSlotsMask: number;
    allowedSlots?: ExtractedAllowedSlots;
};

type RawGameDb = {
    itemTypeNames?: {
        weapons?: Record<string, string>;
        armor?: Record<string, string>;
        potions?: Record<string, string>;
        misc?: Record<string, string>;
        containers?: Record<string, string>;
    };
    weaponAttackReference?: RawWeaponAttackReference[];
    originalAtari?: {
        weaponAttackReference?: RawWeaponAttackReference[];
        i559?: {
            weapons?: RawI559Weapon[];
            cloths?: RawI559Cloth[];
            miscWeightsKg?: number[];
            foodValues?: number[];
            objectInfo?: RawObjectInfo[];
        };
        i562?: {
            woundDefenseFactors?: number[];
            dropOrder?: number[];
            underscoreCharacterString?: number[];
            renameChampionInputCharacterString?: number[];
            reincarnateSpecialCharacters?: number[];
        };
    };
};

type RawItemTypeNames = NonNullable<RawGameDb['itemTypeNames']>;

type ItemsDerivedData = {
    i559WeaponsByIndex: Map<number, RawI559Weapon>;
    i559ClothsByIndex: Map<number, RawI559Cloth>;
    i559ObjectInfo: RawObjectInfo[];
    i559MiscWeights: number[];
    i559FoodValues: number[];
    i562WoundDefenseFactorsRaw: number[];
    i562DropOrderRaw: number[];
    i562UnderscoreCharacterStringRaw: number[];
    i562RenameChampionInputCharacterStringRaw: number[];
    i562ReincarnateSpecialCharactersRaw: number[];
    itemTypeNames: RawItemTypeNames;
    weaponAllowedSlotMaskByIndex: Map<number, number>;
    weaponEntries: WeaponDef[];
    armorEntries: ArmorDef[];
    potionEntries: PotionDef[];
    miscEntries: MiscDef[];
    weaponTypes: Record<number, WeaponDef>;
    armorTypes: Record<number, ArmorDef>;
    potionTypes: Record<number, PotionDef>;
    miscTypes: Record<number, MiscDef>;
    armorNameLookup: Record<string, ArmorDef>;
};

const EMPTY_ITEM_TYPE_NAMES: RawItemTypeNames = {};
const PACKAGED_GAME_DB_ITEMS = packagedGameDbItems as unknown as RawGameDb;
const PACKAGED_WOUND_DEFENSE_FACTORS =
    PACKAGED_GAME_DB_ITEMS.originalAtari?.i562?.woundDefenseFactors?.slice(0, 6) ?? [];

let itemsDerivedDataCache: ItemsDerivedData | null = null;
let itemsSourceDataHydrated = false;

const weaponTypesTarget: Record<number, WeaponDef> = {};
const armorTypesTarget: Record<number, ArmorDef> = {};
const potionTypesTarget: Record<number, PotionDef> = {};
const miscTypesTarget: Record<number, MiscDef> = {};
const woundDefenseFactorsTarget: number[] = [...PACKAGED_WOUND_DEFENSE_FACTORS];
const dropOrderTarget: number[] = [];
const underscoreCharacterStringTarget: number[] = [];
const renameChampionInputCharacterStringTarget: number[] = [];
const reincarnateSpecialCharactersTarget: number[] = [];

function replaceNumberRecord<T>(target: Record<number, T>, source: Record<number, T>): void {
    for (const key of Object.keys(target)) {
        delete target[Number(key)];
    }
    Object.assign(target, source);
}

function replaceArray(target: number[], source: number[]): void {
    target.splice(0, target.length, ...source);
}

function syncExportedItemTargets(derived: ItemsDerivedData): void {
    replaceNumberRecord(weaponTypesTarget, derived.weaponTypes);
    replaceNumberRecord(armorTypesTarget, derived.armorTypes);
    replaceNumberRecord(potionTypesTarget, derived.potionTypes);
    replaceNumberRecord(miscTypesTarget, derived.miscTypes);
    replaceArray(
        woundDefenseFactorsTarget,
        Array.from({ length: 6 }, (_, index) => derived.i562WoundDefenseFactorsRaw[index] ?? PACKAGED_WOUND_DEFENSE_FACTORS[index] ?? 0),
    );
    replaceArray(dropOrderTarget, derived.i562DropOrderRaw);
    replaceArray(underscoreCharacterStringTarget, derived.i562UnderscoreCharacterStringRaw);
    replaceArray(renameChampionInputCharacterStringTarget, derived.i562RenameChampionInputCharacterStringRaw);
    replaceArray(reincarnateSpecialCharactersTarget, derived.i562ReincarnateSpecialCharactersRaw);
}

function createHydratingRecordProxy<T extends Record<number, unknown>>(target: T): T {
    return new Proxy(target, {
        get(currentTarget, prop, receiver) {
            getItemsDerivedData();
            return Reflect.get(currentTarget, prop, receiver);
        },
        has(currentTarget, prop) {
            getItemsDerivedData();
            return Reflect.has(currentTarget, prop);
        },
        ownKeys(currentTarget) {
            getItemsDerivedData();
            return Reflect.ownKeys(currentTarget);
        },
        getOwnPropertyDescriptor(currentTarget, prop) {
            getItemsDerivedData();
            return Reflect.getOwnPropertyDescriptor(currentTarget, prop);
        },
    });
}

function createHydratingArrayProxy(target: number[]): number[] {
    return new Proxy(target, {
        get(currentTarget, prop, receiver) {
            getItemsDerivedData();
            return Reflect.get(currentTarget, prop, receiver);
        },
        has(currentTarget, prop) {
            getItemsDerivedData();
            return Reflect.has(currentTarget, prop);
        },
        ownKeys(currentTarget) {
            getItemsDerivedData();
            return Reflect.ownKeys(currentTarget);
        },
        getOwnPropertyDescriptor(currentTarget, prop) {
            getItemsDerivedData();
            return Reflect.getOwnPropertyDescriptor(currentTarget, prop);
        },
    });
}

function tryReadGameDbItems(): RawGameDb {
    try {
        return JSON.parse(getGameDbItemsRawSync()) as RawGameDb;
    } catch {
        return packagedGameDbItems as unknown as RawGameDb;
    }
}

const SOURCE_ITEM_OBJECT_INDEX_OFFSETS = {
    Scroll: 0,
    Container: 1,
    Potion: 2,
    Weapon: 23,
    Armor: 69,
    Misc: 127,
} as const;

function getExtractedItemName(
    collection: Record<string, string> | undefined,
    typeId: number,
): string | undefined {
    return collection?.[String(typeId)];
}

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
     2: 'Barbarian Hide',
     3: 'Sandals',
     4: 'Leather Boots',
     5: 'Robe (Body)',
     6: 'Robe (Legs)',
     7: 'Fine Robe (Body)',
     8: 'Fine Robe (Legs)',
     9: 'Kirtle',
    10: 'Silk Shirt',
    11: 'Tabard',
    12: 'Gunna',
    13: 'Elven Doublet',
    14: 'Elven Huke',
    15: 'Elven Boots',
    16: 'Leather Jerkin',
    17: 'Leather Pants',
    18: 'Suede Boots',
    19: 'Blue Pants',
    20: 'Tunic',
    21: 'Ghi',
    22: 'Ghi Trousers',
    23: 'Calista',
    24: 'Crown Of Nerra',
    25: 'Bezerker Helm',
    26: 'Helmet',
    27: 'Basinet',
    28: 'Buckler',
    29: 'Hide Shield',
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
    53: 'Dexhelm',
    54: 'Flamebain',
    55: 'Powertowers',
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

const ORIGINAL_MISC_EQUIPMENT_BONUS_DESCRIPTIONS = {
     2: getOriginalEquipmentBonusDescription('Misc', 2),
    37: getOriginalEquipmentBonusDescription('Misc', 37),
    38: getOriginalEquipmentBonusDescription('Misc', 38),
    39: getOriginalEquipmentBonusDescription('Misc', 39),
    41: getOriginalEquipmentBonusDescription('Misc', 41),
    46: getOriginalEquipmentBonusDescription('Misc', 46),
} as const;

const CANONICAL_POTION_NAMES: Record<number, string> = {
     3: 'Ven Potion',
     6: 'Ros Potion',
     7: 'Ku Potion',
     8: 'Dane Potion',
     9: 'Neta Potion',
    10: 'Antivenin',
    11: 'Mon Potion',
    12: 'Ya Potion',
    13: 'Ee Potion',
    14: 'Vi Potion',
    15: 'Water Flask',
    19: 'Ful Bomb',
    20: 'Empty Flask',
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
     2: { id:  2, name: 'Barbarian Hide',     slot: 'legs',  armor:   2, weight: 0.3 },
     3: { id:  3, name: 'Sandals',            slot: 'feet',  armor:   2, weight: 0.2 },
     4: { id:  4, name: 'Leather Boots',      slot: 'feet',  armor:  25, weight: 1.6 },
     5: { id:  5, name: 'Robe (Body)',        slot: 'torso', armor:   5, weight: 0.4 },
     6: { id:  6, name: 'Robe (Legs)',        slot: 'legs',  armor:   5, weight: 0.4 },
     7: { id:  7, name: 'Fine Robe (Body)',   slot: 'torso', armor:   7, weight: 0.3 },
     8: { id:  8, name: 'Fine Robe (Legs)',   slot: 'legs',  armor:   7, weight: 0.3 },
     9: { id:  9, name: 'Kirtle',             slot: 'torso', armor:  35, weight: 25.0 },
    10: { id: 10, name: 'Silk Shirt',         slot: 'torso', armor:   9, weight: 0.5 },
    11: { id: 11, name: 'Tabard',             slot: 'legs',  armor:   4, weight: 0.2 },
    12: { id: 12, name: 'Gunna',              slot: 'legs',  armor:   7, weight: 0.5 },
    13: { id: 13, name: 'Elven Doublet',      slot: 'torso', armor:  11, weight: 0.3 },
    14: { id: 14, name: 'Elven Huke',         slot: 'legs',  armor:  13, weight: 0.3 },
    15: { id: 15, name: 'Elven Boots',        slot: 'feet',  armor:  13, weight: 0.4 },
    16: { id: 16, name: 'Leather Jerkin',     slot: 'torso', armor:  17, weight: 0.6 },
    17: { id: 17, name: 'Leather Pants',      slot: 'legs',  armor:  20, weight: 0.8 },
    18: { id: 18, name: 'Suede Boots',        slot: 'feet',  armor:  20, weight: 1.4 },
    19: { id: 19, name: 'Blue Pants',         slot: 'legs',  armor:  20, weight: 15.0 },
    20: { id: 20, name: 'Tunic',              slot: 'torso', armor:   9, weight: 0.5 },
    21: { id: 21, name: 'Ghi',                slot: 'torso', armor:   8, weight: 0.5 },
    22: { id: 22, name: 'Ghi Trousers',       slot: 'legs',  armor:   9, weight: 0.5 },
    23: { id: 23, name: 'Calista',            slot: 'head',  armor:   1, weight: 0.4 },
    24: { id: 24, name: 'Crown Of Nerra',     slot: 'head',  armor:   5, weight: 0.6 },
    25: { id: 25, name: 'Bezerker Helm',      slot: 'head',  armor:  12, weight: 1.1 },
    26: { id: 26, name: 'Helmet',             slot: 'head',  armor:  17, weight: 1.4 },
    27: { id: 27, name: 'Basinet',            slot: 'head',  armor:  20, weight: 1.5 },
    28: { id: 28, name: 'Buckler',            slot: 'hands', armor:  22, weight: 1.1 },
    29: { id: 29, name: 'Hide Shield',        slot: 'hands', armor:   4, weight: 0.3, isShield: true },
    30: { id: 30, name: 'Wooden Shield',      slot: 'hands', armor:  20, weight: 1.4 },
    31: { id: 31, name: 'Small Shield',       slot: 'hands', armor:  35, weight: 2.1 },
    32: { id: 32, name: 'Mail Aketon',        slot: 'torso', armor:  35, weight: 6.5 },
    33: { id: 33, name: 'Leg Mail',           slot: 'legs',  armor:  35, weight: 5.3 },
    34: { id: 34, name: 'Mithral Aketon',     slot: 'torso', armor:  70, weight: 5.2 },
    35: { id: 35, name: 'Mithral Mail',       slot: 'legs',  armor:  55, weight: 4.1 },
    36: { id: 36, name: "Casque'n Coif",      slot: 'head',  armor:  25, weight: 1.6 },
    37: { id: 37, name: 'Hosen',              slot: 'feet',  armor:  30, weight: 1.6 },
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
    53: { id: 53, name: 'Dexhelm',            slot: 'head',  armor:  48, weight: 1.8 },
    54: { id: 54, name: 'Flamebain',          slot: 'torso', armor:  60, weight: 5.7 },
    55: { id: 55, name: 'Powertowers',        slot: 'legs',  armor:  18, weight: 1.8 },
    56: { id: 56, name: 'Boots Of Speed',     slot: 'feet',  armor:  16, weight: 0.3 },
    57: { id: 57, name: 'Halter',             slot: 'torso', armor:   3, weight: 0.2 },
};

// ─── Potions ──────────────────────────────────────────────────────────────────

const OFFICIAL_POTION_TYPES: Record<number, PotionDef> = {
     3: { id:  3, name: 'Ven Potion',  effect: 'poisonCloud', drinkable: false, throwable: true },
     6: { id:  6, name: 'Ros Potion',  effect: 'dexterity',   drinkable: true },
     7: { id:  7, name: 'Ku Potion',   effect: 'strength',    drinkable: true },
     8: { id:  8, name: 'Dane Potion', effect: 'wisdom',      drinkable: true },
     9: { id:  9, name: 'Neta Potion', effect: 'vitality',    drinkable: true },
    10: { id: 10, name: 'Antivenin',   effect: 'antivenin',   drinkable: true },
    11: { id: 11, name: 'Mon Potion',  effect: 'stamina',     drinkable: true },
    12: { id: 12, name: 'Ya Potion',   effect: 'shield',      drinkable: true },
    13: { id: 13, name: 'Ee Potion',   effect: 'mana',        drinkable: true },
    14: { id: 14, name: 'Vi Potion',   effect: 'health',      drinkable: true },
    15: { id: 15, name: 'Water Flask', effect: 'water',       drinkable: true },
    19: { id: 19, name: 'Ful Bomb',    effect: 'firebomb',    drinkable: false, throwable: true },
    20: { id: 20, name: 'Empty Flask', effect: 'empty',       drinkable: false },
};

// ─── Misc ─────────────────────────────────────────────────────────────────────

const OFFICIAL_MISC_TYPES: Record<number, MiscDef> = {
     0: { id:  0, name: 'Compass',            usable: false, description: 'Shows current direction' },
     1: { id:  1, name: 'Waterskin',          usable: true,  description: 'Restores stamina when filled' },
     2: { id:  2, name: 'Jewel Symal',        usable: false, description: ORIGINAL_MISC_EQUIPMENT_BONUS_DESCRIPTIONS[2] ?? '+15 Anti-Magic' },
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
    37: { id: 37, name: 'Gem Of Ages',        usable: false, description: ORIGINAL_MISC_EQUIPMENT_BONUS_DESCRIPTIONS[37] ?? '+1 hidden priest heal skill' },
    38: { id: 38, name: 'Ekkhard Cross',      usable: false, description: ORIGINAL_MISC_EQUIPMENT_BONUS_DESCRIPTIONS[38] ?? '+1 hidden priest defend skill' },
    39: { id: 39, name: 'Moonstone',          usable: false, description: ORIGINAL_MISC_EQUIPMENT_BONUS_DESCRIPTIONS[39] ?? '+3 Mana, +1 hidden priest influence skill' },
    40: { id: 40, name: 'The Hellion',        usable: false, description: 'Quest item' },
    41: { id: 41, name: 'Pendant Feral',      usable: false, description: ORIGINAL_MISC_EQUIPMENT_BONUS_DESCRIPTIONS[41] ?? '+1 Wizard skill' },
    42: { id: 42, name: 'Magical Box (Blue)', usable: true,  description: 'Freeze Life item' },
    43: { id: 43, name: 'Magical Box (Green)', usable: true, description: 'Freeze Life item (stronger)' },
    44: { id: 44, name: 'Mirror Of Dawn',     usable: false, description: 'Quest item' },
    45: { id: 45, name: 'Rope',               usable: true,  description: 'Climb down pits' },
    46: { id: 46, name: "Rabbit's Foot",      usable: false, description: ORIGINAL_MISC_EQUIPMENT_BONUS_DESCRIPTIONS[46] ?? '+10 Luck' },
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

function getCanonicalNameFromDerived(
    derived: Pick<ItemsDerivedData, 'itemTypeNames'>,
    category: 'Weapon' | 'Armor' | 'Potion' | 'Misc',
    typeId: number,
): string | undefined {
    switch (category) {
        case 'Weapon':
            return getExtractedItemName(derived.itemTypeNames.weapons, typeId) ?? CANONICAL_WEAPON_NAMES[typeId];
        case 'Armor':
            return getExtractedItemName(derived.itemTypeNames.armor, typeId) ?? CANONICAL_ARMOR_NAMES[typeId];
        case 'Potion':
            return CANONICAL_POTION_NAMES[typeId] ?? getExtractedItemName(derived.itemTypeNames.potions, typeId);
        case 'Misc':
            return getExtractedItemName(derived.itemTypeNames.misc, typeId) ?? CANONICAL_MISC_NAMES[typeId];
        default: return undefined;
    }
}

export function resolveItemName(
    category: 'Weapon' | 'Armor' | 'Potion' | 'Misc' | 'Scroll' | 'Container',
    typeId: number,
    rawName?: string,
): string {
    const derived = getItemsDerivedData();
    return resolveItemNameFromDerived(derived, category, typeId, rawName);
}

function resolveItemNameFromDerived(
    derived: Pick<ItemsDerivedData, 'itemTypeNames'>,
    category: 'Weapon' | 'Armor' | 'Potion' | 'Misc' | 'Scroll' | 'Container',
    typeId: number,
    rawName?: string,
): string {
    if (category === 'Scroll') return rawName && !PLACEHOLDER_NAME_RE.test(rawName) ? rawName : 'Scroll';
    if (category === 'Container') {
        return (
            getExtractedItemName(derived.itemTypeNames.containers, typeId)
            ?? (rawName && !PLACEHOLDER_NAME_RE.test(rawName) ? rawName : 'Chest')
        );
    }
    if (category === 'Potion' && rawName && !PLACEHOLDER_NAME_RE.test(rawName)) {
        return rawName;
    }

    const canonical = getCanonicalNameFromDerived(derived, category, typeId);
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
    'WELCOME BACK\nBRAVE\nADVENTURERS.': 'WELCOME\nBRAVE\nADVENTURERS.',
    'COME BACK\nBRAVE\nADVENTURERS.': 'WELCOME\nBRAVE\nADVENTURERS.',
    'BRAVE\nADVENTURERS.': 'WELCOME\nBRAVE\nADVENTURERS.',
    'AVE\nADVENTURERS.': 'WELCOME\nBRAVE\nADVENTURERS.',
    'ADVENTURERS.': 'WELCOME\nBRAVE\nADVENTURERS.',
};

export function normalizeScrollText(rawText?: string): string | undefined {
    if (!rawText) return rawText;
    return SCROLL_TEXT_FIXUPS[rawText] ?? rawText;
}

function buildItemsDerivedData(gameDb: RawGameDb): ItemsDerivedData {
    const originalI559 = gameDb.originalAtari?.i559;
    const weaponAttackReference = gameDb.originalAtari?.weaponAttackReference ?? gameDb.weaponAttackReference ?? [];
    const itemTypeNames = gameDb.itemTypeNames ?? EMPTY_ITEM_TYPE_NAMES;
    const i559WeaponsByIndex = new Map<number, RawI559Weapon>(
        (originalI559?.weapons ?? []).map((entry) => [entry.index, entry]),
    );
    const i559ClothsByIndex = new Map<number, RawI559Cloth>(
        (originalI559?.cloths ?? []).map((entry) => [entry.index, entry]),
    );

    const derivedBase = {
        itemTypeNames,
        i559WeaponsByIndex,
        i559ClothsByIndex,
        i559ObjectInfo: originalI559?.objectInfo ?? [],
        i559MiscWeights: originalI559?.miscWeightsKg ?? [],
        i559FoodValues: originalI559?.foodValues ?? [],
        i562WoundDefenseFactorsRaw: gameDb.originalAtari?.i562?.woundDefenseFactors ?? [],
        i562DropOrderRaw: gameDb.originalAtari?.i562?.dropOrder ?? [],
        i562UnderscoreCharacterStringRaw: gameDb.originalAtari?.i562?.underscoreCharacterString ?? [],
        i562RenameChampionInputCharacterStringRaw: gameDb.originalAtari?.i562?.renameChampionInputCharacterString ?? [],
        i562ReincarnateSpecialCharactersRaw: gameDb.originalAtari?.i562?.reincarnateSpecialCharacters ?? [],
        weaponAllowedSlotMaskByIndex: new Map<number, number>(
            weaponAttackReference.map((entry) => [entry.weaponIndex, entry.allowedSlotsMask]),
        ),
    };

    const resolveFromBase = (
        category: 'Weapon' | 'Armor' | 'Potion' | 'Misc' | 'Scroll' | 'Container',
        typeId: number,
        rawName?: string,
    ) => resolveItemNameFromDerived(derivedBase, category, typeId, rawName);

    const weaponEntries = Object.values(OFFICIAL_WEAPON_TYPES)
        .sort((a, b) => a.id - b.id)
        .map((entry) => ({
            ...entry,
            weight: i559WeaponsByIndex.get(entry.id)?.weightKg ?? entry.weight,
            damage: (() => {
                const raw = i559WeaponsByIndex.get(entry.id);
                return raw ? [raw.damage, raw.damage] as [number, number] : entry.damage;
            })(),
            name: resolveFromBase('Weapon', entry.id, entry.name),
        }));

    const armorEntries = Object.values(OFFICIAL_ARMOR_TYPES).map((entry) => ({
        ...entry,
        weight: i559ClothsByIndex.get(entry.id)?.weightKg ?? entry.weight,
        armor: i559ClothsByIndex.get(entry.id)?.protection ?? entry.armor,
        sharpDefense: i559ClothsByIndex.get(entry.id)?.sharpDefense ?? entry.sharpDefense ?? 0,
        isShield: i559ClothsByIndex.get(entry.id)?.isShield ?? entry.isShield ?? false,
        name: resolveFromBase('Armor', entry.id, entry.name),
    }));

    const potionEntries = Object.values(OFFICIAL_POTION_TYPES).map((entry) => ({
        ...entry,
        name: resolveFromBase('Potion', entry.id, entry.name),
    }));

    const miscEntries = Object.values(OFFICIAL_MISC_TYPES).map((entry) => ({
        ...entry,
        weight: derivedBase.i559MiscWeights[entry.id] ?? entry.weight,
        nutrition: (() => {
            if (!entry.food) return entry.nutrition;
            switch (entry.id) {
                case 29: return derivedBase.i559FoodValues[0] ?? entry.nutrition;
                case 30: return derivedBase.i559FoodValues[1] ?? entry.nutrition;
                case 31: return derivedBase.i559FoodValues[2] ?? entry.nutrition;
                case 32: return derivedBase.i559FoodValues[3] ?? entry.nutrition;
                case 33: return derivedBase.i559FoodValues[4] ?? entry.nutrition;
                case 34: return derivedBase.i559FoodValues[5] ?? entry.nutrition;
                case 35: return derivedBase.i559FoodValues[6] ?? entry.nutrition;
                case 36: return derivedBase.i559FoodValues[7] ?? entry.nutrition;
                default: return entry.nutrition;
            }
        })(),
        name: resolveFromBase('Misc', entry.id, entry.name),
    }));

    return {
        ...derivedBase,
        weaponEntries,
        armorEntries,
        potionEntries,
        miscEntries,
        weaponTypes: byId(weaponEntries),
        armorTypes: byId(armorEntries),
        potionTypes: byId(potionEntries),
        miscTypes: byId(miscEntries),
        armorNameLookup: Object.fromEntries(
            armorEntries.map((entry) => [entry.name.trim().toLowerCase(), entry]),
        ),
    };
}

function getItemsDerivedData(): ItemsDerivedData {
    if (!itemsSourceDataHydrated) {
        const loaded = tryReadGameDbItems();
        itemsDerivedDataCache = buildItemsDerivedData(loaded);
        itemsSourceDataHydrated = true;
        syncExportedItemTargets(itemsDerivedDataCache);
        return itemsDerivedDataCache;
    }

    if (!itemsDerivedDataCache) {
        itemsDerivedDataCache = buildItemsDerivedData({});
        syncExportedItemTargets(itemsDerivedDataCache);
    }

    return itemsDerivedDataCache;
}

export const WEAPON_TYPES: Record<number, WeaponDef> = createHydratingRecordProxy(weaponTypesTarget);
export const ARMOR_TYPES: Record<number, ArmorDef> = createHydratingRecordProxy(armorTypesTarget);
export const POTION_TYPES: Record<number, PotionDef> = createHydratingRecordProxy(potionTypesTarget);
export const MISC_TYPES: Record<number, MiscDef> = createHydratingRecordProxy(miscTypesTarget);
export const I562_WOUND_DEFENSE_FACTORS = createHydratingArrayProxy(woundDefenseFactorsTarget);
export const I562_DROP_ORDER = createHydratingArrayProxy(dropOrderTarget);
export const I562_UNDERSCORE_CHARACTER_STRING = createHydratingArrayProxy(underscoreCharacterStringTarget);
export const I562_RENAME_CHAMPION_INPUT_CHARACTER_STRING = createHydratingArrayProxy(renameChampionInputCharacterStringTarget);
export const I562_REINCARNATE_SPECIAL_CHARACTERS = createHydratingArrayProxy(reincarnateSpecialCharactersTarget);

export function normalizeLookupName(value: string | undefined): string | null {
    if (!value) return null;
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getItemTypeIdByName(
    category: 'Weapon' | 'Armor' | 'Potion' | 'Misc',
    rawName: string | undefined,
): number | undefined {
    const derived = getItemsDerivedData();
    const normalizedName = normalizeLookupName(rawName);
    if (!normalizedName) return undefined;

    switch (category) {
        case 'Weapon':
            return derived.weaponEntries.find((entry) => normalizeLookupName(entry.name) === normalizedName)?.id;
        case 'Armor':
            return derived.armorEntries.find((entry) => normalizeLookupName(entry.name) === normalizedName)?.id;
        case 'Potion': {
            const runtimeTypeId = POTION_NAME_TO_RUNTIME_TYPE_ID[normalizedName];
            if (runtimeTypeId !== undefined) return runtimeTypeId;
            return derived.potionEntries.find((entry) => normalizeLookupName(entry.name) === normalizedName)?.id;
        }
        case 'Misc':
            return derived.miscEntries.find((entry) => normalizeLookupName(entry.name) === normalizedName)?.id;
        default:
            return undefined;
    }
}

export function getPotionDef(typeId: number, rawName?: string): PotionDef | undefined {
    const runtimeTypeId = getItemTypeIdByName('Potion', rawName);
    if (runtimeTypeId !== undefined) return POTION_TYPES[runtimeTypeId];
    return POTION_TYPES[typeId];
}

export function getWeaponAllowedSlotsMask(typeId: number): number | undefined {
    if (typeId < 0) return undefined;
    return getItemsDerivedData().weaponAllowedSlotMaskByIndex.get(typeId);
}

export function getSourceItemAllowedSlotsMask(
    category: 'Weapon' | 'Armor' | 'Potion' | 'Misc' | 'Scroll' | 'Container',
    typeId: number,
    _rawName?: string,
): number | undefined {
    void _rawName;
    if (typeId < 0) return undefined;
    const offset = SOURCE_ITEM_OBJECT_INDEX_OFFSETS[category];
    return getItemsDerivedData().i559ObjectInfo[offset + typeId]?.allowedSlotsMask;
}

export function getSourceItemAttackClass(
    category: 'Weapon' | 'Armor' | 'Potion' | 'Misc' | 'Scroll' | 'Container',
    typeId: number,
    _rawName?: string,
): number | undefined {
    void _rawName;
    if (typeId < 0) return undefined;
    const offset = SOURCE_ITEM_OBJECT_INDEX_OFFSETS[category];
    return getItemsDerivedData().i559ObjectInfo[offset + typeId]?.attackClass;
}

export function getArmorDef(typeId: number, rawName?: string): ArmorDef | undefined {
    if (typeId < 0) return undefined;
    const derived = getItemsDerivedData();
    const normalizedName = normalizeLookupName(rawName);
    if (normalizedName) {
        const exact = derived.armorNameLookup[normalizedName];
        if (exact) return exact;
    }
    return ARMOR_TYPES[typeId];
}


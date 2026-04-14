// Item definition types derived from the extracted game data.

// Weapons
export type WeaponCategory =
    | 'Sword'
    | 'Axe'
    | 'Dagger'
    | 'Staff'
    | 'Wand'
    | 'Bow'
    | 'Thrown'
    | 'Ammo'
    | 'Torch'
    | 'Key'
    | 'Special';

export interface WeaponDef {
    id: number;
    name: string;
    type: WeaponCategory;
    damage: [number, number];
    weight: number;
    atkSpd: number;
    twoHanded: boolean;
    ranged?: boolean;
    thrown?: boolean;
    luminous?: boolean;
    poison?: boolean;
}

// Armor
export type ArmorSlot = 'head' | 'neck' | 'torso' | 'legs' | 'feet' | 'hands' | 'belt';

export interface ArmorDef {
    id: number;
    name: string;
    slot: ArmorSlot;
    armor: number;
    weight: number;
    sharpDefense?: number;
    isShield?: boolean;
}

// Potions
export type PotionEffect =
    | 'strength'
    | 'dexterity'
    | 'wisdom'
    | 'vitality'
    | 'antivenin'
    | 'stamina'
    | 'shield'
    | 'mana'
    | 'health'
    | 'water'
    | 'poisonCloud'
    | 'firebomb'
    | 'empty';

export interface PotionDef {
    id: number;
    name: string;
    effect: PotionEffect;
    drinkable?: boolean;
    throwable?: boolean;
}

// Misc
export interface MiscDef {
    id: number;
    name: string;
    usable: boolean;
    weight?: number;
    description?: string;
    luminous?: boolean;
    food?: boolean;
    nutrition?: number;
    key?: boolean;
}

// Union
export type AnyItemDef = WeaponDef | ArmorDef | PotionDef | MiscDef;

export type ItemCategory = 'Weapon' | 'Armor' | 'Potion' | 'Misc' | 'Scroll' | 'Container';

// Equipment slots
export type EquipSlotKey =
    | 'head'
    | 'neck'
    | 'torso'
    | 'rightHand'
    | 'leftHand'
    | 'legs'
    | 'feet'
    | 'hands'
    | 'belt'
    | 'quiver1'
    | 'quiver2'
    | 'quiver3'
    | 'quiver4'
    | 'pocket1'
    | 'pocket2';

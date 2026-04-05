// Item definition types — derived from Old_data/game_db.json

// ─── Weapons ───────────────────────────────────────────────────────────────────

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
    damage: [number, number];   // [min, max]
    weight: number;
    atkSpd: number;
    twoHanded: boolean;
    ranged?: boolean;
    thrown?: boolean;
    luminous?: boolean;
    poison?: boolean;
}

// ─── Armor ─────────────────────────────────────────────────────────────────────

export type ArmorSlot = 'head' | 'neck' | 'torso' | 'legs' | 'feet' | 'hands' | 'belt';

export interface ArmorDef {
    id: number;
    name: string;
    slot: ArmorSlot;
    armor: number;
    weight: number;
}

// ─── Potions ───────────────────────────────────────────────────────────────────

export type PotionEffect =
    | 'spellPower'
    | 'health'
    | 'stamina'
    | 'mana'
    | 'poison'
    | 'strength'
    | 'dexterity'
    | 'wisdom'
    | 'vitality'
    | 'antiMagic'
    | 'antiFire';

export interface PotionDef {
    id: number;
    name: string;
    effect: PotionEffect;
    level?: number;     // for spellPower potions (1–5)
    restore?: number;   // flat restore amount
    boost?: number;     // temporary stat boost
    duration?: number;  // boost duration in ticks
}

// ─── Misc ──────────────────────────────────────────────────────────────────────

export interface MiscDef {
    id: number;
    name: string;
    usable: boolean;
    description?: string;
    luminous?: boolean;
    food?: boolean;
    nutrition?: number;
    key?: boolean;
}

// ─── Union ─────────────────────────────────────────────────────────────────────

export type AnyItemDef = WeaponDef | ArmorDef | PotionDef | MiscDef;

export type ItemCategory = 'Weapon' | 'Armor' | 'Potion' | 'Misc' | 'Scroll' | 'Container';

// ─── Equipment slots ───────────────────────────────────────────────────────────

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

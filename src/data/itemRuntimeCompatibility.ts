import type { ArmorDef } from '../types/items';

// Compatibility bridge kept on purpose while starter loadouts still reference
// a few synthetic armor pieces that do not exist as source-backed runtime ids.
export const STARTER_ARMOR_OVERRIDES: Record<string, ArmorDef> = {
    'robe (body)':      { id: -1, name: 'Robe (Body)',      slot: 'torso', armor:  5, weight: 0.4 },
    'robe (legs)':      { id: -2, name: 'Robe (Legs)',      slot: 'legs',  armor:  5, weight: 0.4 },
    'fine robe (body)': { id:  7, name: 'Fine Robe (Body)', slot: 'torso', armor:  7, weight: 0.3 },
    'fine robe (legs)': { id:  8, name: 'Fine Robe (Legs)', slot: 'legs',  armor:  7, weight: 0.3 },
    kirtle:             { id: -3, name: 'Kirtle',           slot: 'torso', armor:  6, weight: 0.4 },
    tabard:             { id: -4, name: 'Tabard',           slot: 'legs',  armor:  5, weight: 0.4 },
    'blue pants':       { id: -5, name: 'Blue Pants',       slot: 'legs',  armor: 12, weight: 0.6 },
    sandals:            { id: -6, name: 'Sandals',          slot: 'feet',  armor:  5, weight: 0.6 },
    'hide shield':      { id: -7, name: 'Hide Shield',      slot: 'hands', armor: 16, weight: 1.0 },
};

export const STARTER_ARMOR_SLOT_BY_NAME: Record<string, ArmorDef['slot']> = Object.fromEntries(
    Object.entries(STARTER_ARMOR_OVERRIDES).map(([name, def]) => [name, def.slot]),
);

// Potion aliases remain necessary because the live UI/runtime still uses both
// canonical DM names and more player-friendly labels interchangeably.
export const POTION_NAME_TO_RUNTIME_TYPE_ID: Record<string, number> = {
    'ven potion': 3,
    'ros potion': 6,
    'dexterity potion': 6,
    'ku potion': 7,
    'strength potion': 7,
    'dane potion': 8,
    'wisdom potion': 8,
    'neta potion': 9,
    'vitality potion': 9,
    antivenin: 10,
    antidote: 10,
    'bro potion': 10,
    'mon potion': 11,
    'stamina potion': 11,
    'ya potion': 12,
    'shield potion': 12,
    'ee potion': 13,
    'mana potion': 13,
    'vi potion': 14,
    'health potion': 14,
    'water flask': 15,
    'ful bomb': 19,
    'empty flask': 20,
};

// Safe fallback kept until the original wound-defense table is guaranteed to be
// available at every bootstrap point.
export const FALLBACK_WOUND_DEFENSE_FACTORS = [16, 32, 48, 64, 80, 96];

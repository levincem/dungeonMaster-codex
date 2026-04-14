// Legacy spell reference table sourced from the canonical extracted game DB.
//
// Important:
// - the current runtime spell-casting pipeline uses `src/data/runes.ts`
// - this file is kept as a parallel reference and should not be treated as the
//   live source of truth for gameplay behavior until the two models are merged

import type { RuneSymbol, Spell, SpellCastingRules } from '../types/spells';

// --- Rune symbols -------------------------------------------------------------
// uiPos: [panelRow, panelCol]  (0-indexed)

export const RUNE_SYMBOLS: RuneSymbol[] = [
    // Row 0 - Power (set spell strength, carry manaFactor)
    { id: 0, symbol: 'LO', row: 'power', manaFactor: 8, uiPos: [0, 0] },
    { id: 1, symbol: 'UM', row: 'power', manaFactor: 12, uiPos: [0, 1] },
    { id: 2, symbol: 'ON', row: 'power', manaFactor: 16, uiPos: [0, 2] },
    { id: 3, symbol: 'EE', row: 'power', manaFactor: 20, uiPos: [0, 3] },
    { id: 4, symbol: 'PAL', row: 'power', manaFactor: 24, uiPos: [0, 4] },
    { id: 5, symbol: 'MON', row: 'power', manaFactor: 28, uiPos: [0, 5] },
    // Row 1 after power
    { id: 6, symbol: 'YA', row: 'element1', uiPos: [1, 0] },
    { id: 7, symbol: 'VI', row: 'element1', uiPos: [1, 1] },
    { id: 8, symbol: 'OH', row: 'element1', uiPos: [1, 2] },
    { id: 9, symbol: 'FUL', row: 'element1', uiPos: [1, 3] },
    { id: 10, symbol: 'DES', row: 'element1', uiPos: [1, 4] },
    { id: 11, symbol: 'ZO', row: 'element1', uiPos: [1, 5] },
    // Row 2 after power
    { id: 12, symbol: 'VEN', row: 'form', uiPos: [2, 0] },
    { id: 13, symbol: 'EW', row: 'form', uiPos: [2, 1] },
    { id: 14, symbol: 'KATH', row: 'form', uiPos: [2, 2] },
    { id: 15, symbol: 'IR', row: 'form', uiPos: [2, 3] },
    { id: 16, symbol: 'BRO', row: 'form', uiPos: [2, 4] },
    { id: 17, symbol: 'GOR', row: 'form', uiPos: [2, 5] },
    // Row 3 after power
    { id: 18, symbol: 'KU', row: 'alignment', uiPos: [3, 0] },
    { id: 19, symbol: 'ROS', row: 'alignment', uiPos: [3, 1] },
    { id: 20, symbol: 'DAIN', row: 'alignment', uiPos: [3, 2] },
    { id: 21, symbol: 'NETA', row: 'alignment', uiPos: [3, 3] },
    { id: 22, symbol: 'RA', row: 'alignment', uiPos: [3, 4] },
    { id: 23, symbol: 'SAR', row: 'alignment', uiPos: [3, 5] },
];

// Fast lookup by id
export const RUNE_BY_ID: Record<number, RuneSymbol> = Object.fromEntries(
    RUNE_SYMBOLS.map((r) => [r.id, r]),
);

// Fast lookup by symbol string
export const RUNE_BY_SYMBOL: Record<string, RuneSymbol> = Object.fromEntries(
    RUNE_SYMBOLS.map((r) => [r.symbol, r]),
);

// --- Spells -------------------------------------------------------------------

export const SPELLS: Spell[] = [
    // Wizard spells
    { name: 'Torch', runes: [9], runeStr: 'FUL', effect: 'Creates a magic torch in hand', skill: 'Wizard', manaBase: 1, note: 'INVOKE FUL FOR A MAGIC TORCH' },
    { name: 'Darkness', runes: [10, 15, 23], runeStr: 'DES IR SAR', effect: 'Extinguishes all light sources nearby', skill: 'Priest', manaBase: 1 },
    { name: 'Light', runes: [8, 15, 22], runeStr: 'OH IR RA', effect: 'Creates a powerful sustained light', skill: 'Wizard', manaBase: 4, note: 'LIGHT / OH IR RA' },
    { name: 'See Through Walls', runes: [8, 13, 22], runeStr: 'OH EW RA', effect: 'Lets the party see through walls while keeping them solid', skill: 'Wizard', manaBase: 3, note: 'OH EW RA / SEE THROUGH WALLS' },
    { name: 'Invisibility', runes: [8, 13, 23], runeStr: 'OH EW SAR', effect: 'Makes the party invisible to monsters', skill: 'Wizard', manaBase: 3, note: 'INVISIBILITY / OH EW SAR' },
    { name: 'Fireball', runes: [9, 15], runeStr: 'FUL IR', effect: 'Launches a fireball projectile', skill: 'Wizard', manaBase: 3, note: 'FIREBALL / FUL IR' },
    { name: 'Fire Shield', runes: [9, 16, 21], runeStr: 'FUL BRO NETA', effect: 'Surrounds the party with a protective fire shield', skill: 'Priest', manaBase: 4, note: 'FIRE SHIELD / FUL BRO NETA' },
    { name: 'Lightning Bolt', runes: [8, 14, 22], runeStr: 'OH KATH RA', effect: 'Launches a lightning bolt', skill: 'Wizard', manaBase: 4, note: 'LIGHTNING BOLT / OH KATH RA' },
    { name: 'Poison Cloud', runes: [8, 12], runeStr: 'OH VEN', effect: 'Casts a cloud of poison in front of party', skill: 'Wizard', manaBase: 3, note: 'OH VEN CAST A CLOUD OF POISON' },
    { name: 'Poison Bolt', runes: [10, 12], runeStr: 'DES VEN', effect: 'Conjures a poison bolt projectile', skill: 'Wizard', manaBase: 1, note: 'DES VEN WILL CONJURE A POISON SPELL' },
    { name: 'Weaken Nonmaterial Beings', runes: [10, 13], runeStr: 'DES EW', effect: 'Launches a magical projectile effective against nonmaterial beings', skill: 'Wizard', manaBase: 1 },
    { name: 'Zokathra', runes: [11, 14, 22], runeStr: 'ZO KATH RA', effect: 'Creates a plasma bolt that can melt certain magical barriers', skill: 'Wizard', manaBase: 0, note: 'ZOKATHRA MIGHT CREATE A PLASMA THAT COULD BURN THROUGH THE AMALGAM' },
    // Priest spells
    { name: 'Magic Footprints', runes: [6, 16, 19], runeStr: 'YA BRO ROS', effect: 'Creates glowing footprints to mark your path', skill: 'Wizard', manaBase: 1, note: 'YA BRO ROS LEAVES A TRAIL OF MAGIC FOOTPRINTS' },
    { name: 'Open Door', runes: [11], runeStr: 'ZO', effect: 'Opens certain locked doors', skill: 'Wizard', manaBase: 1, note: 'SOME DOORS CAN BE OPENED WITH A ZO SPELL' },
    { name: 'Vi Potion', runes: [7], runeStr: 'VI', effect: 'Creates a Vi potion (cast into empty flask)', skill: 'Priest', manaBase: 1 },
    { name: 'Antivenin', runes: [7, 16], runeStr: 'VI BRO', effect: 'Creates an antivenin potion (cast into empty flask)', skill: 'Priest', manaBase: 1 },
    { name: 'Ya Potion', runes: [6], runeStr: 'YA', effect: 'Creates a Ya potion (cast into empty flask)', skill: 'Priest', manaBase: 2 },
    { name: 'Mon Potion', runes: [6, 16], runeStr: 'YA BRO', effect: 'Creates a Mon potion (cast into empty flask)', skill: 'Priest', manaBase: 2, note: 'SHIELD POTION / YA BRO' },
    { name: 'Ku Potion', runes: [9, 16, 18], runeStr: 'FUL BRO KU', effect: 'Creates a Ku potion (cast into empty flask)', skill: 'Priest', manaBase: 4 },
    { name: 'Ros Potion', runes: [8, 16, 19], runeStr: 'OH BRO ROS', effect: 'Creates a Ros potion (cast into empty flask)', skill: 'Priest', manaBase: 4 },
    { name: 'Dane Potion', runes: [6, 16, 20], runeStr: 'YA BRO DAIN', effect: 'Creates a Dane potion (cast into empty flask)', skill: 'Priest', manaBase: 4 },
    { name: 'Neta Potion', runes: [6, 16, 21], runeStr: 'YA BRO NETA', effect: 'Creates a Neta potion (cast into empty flask)', skill: 'Priest', manaBase: 4 },
    { name: 'Ee Potion', runes: [11, 16, 22], runeStr: 'ZO BRO RA', effect: 'Creates an Ee potion (cast into empty flask)', skill: 'Priest', manaBase: 3 },
    { name: 'Ven Potion', runes: [11, 12], runeStr: 'ZO VEN', effect: 'Creates a Ven potion (cast into empty flask)', skill: 'Wizard', manaBase: 2 },
    // Fighter spells
    { name: 'Party Shield', runes: [6, 15], runeStr: 'YA IR', effect: 'Creates a magical shield around the party', skill: 'Priest', manaBase: 2, note: 'MAGIC SHIELD / YA IR' },
];

// Build a lookup map from sorted rune ID sequence -> Spell
export const SPELL_BY_RUNES: Map<string, Spell> = new Map(
    SPELLS.map((s) => [s.runes.join(','), s]),
);

/** Find a spell matching the provided rune sequence (order-sensitive). */
export function findSpell(runeIds: number[]): Spell | undefined {
    return SPELL_BY_RUNES.get(runeIds.join(','));
}

// --- Casting rules ------------------------------------------------------------

export const SPELL_CASTING_RULES: SpellCastingRules = {
    castingOrder: 'Power rune first, then 1-3 additional runes in the exact spell order',
    maxRunes: 4,
    failureIfNoMana: true,
    skillEffect: 'Higher skill level increases damage/duration/effect and reduces mana waste',
    classBonus: {
        Fighter: 'Bonus to YA-based spells and physical enhancement potions',
        Ninja: 'Bonus to thrown-projectile spells and stealth magic',
        Priest: 'Bonus to OH-based healing, VI potions, and ZO utility',
        Wizard: 'Bonus to FUL fire, DES darkness, and complex multi-rune spells',
    },
};

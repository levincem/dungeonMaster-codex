// Rune and spell types — derived from the canonical extracted game DB

export type RuneRow = 'power' | 'element1' | 'form' | 'alignment';

export type SpellSkill = 'Fighter' | 'Ninja' | 'Priest' | 'Wizard';

export interface RuneSymbol {
    id: number;
    symbol: string;
    row: RuneRow;
    manaFactor?: number;    // only present on power runes (row = 'power')
    uiPos: [number, number]; // [row, col] position in the rune panel UI
}

export interface Spell {
    name: string;
    runes: number[];        // ordered rune IDs
    runeStr: string;        // human-readable (e.g. "FUL IR")
    effect: string;
    skill: SpellSkill;
    manaBase: number;
    note?: string;
}

export interface SpellCastingRules {
    castingOrder: string;
    maxRunes: number;
    failureIfNoMana: boolean;
    skillEffect: string;
    classBonus: Record<SpellSkill, string>;
}

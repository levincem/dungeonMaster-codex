// --- DM1 Rune system ----------------------------------------------------------
// 4 panel rows x 6 runes = 24 runes total.
// Source of truth: canonical runtime data derived from
// `src/assets/runtime/db/game_db.json`
//
// Important:
// - the rune ordinals must match the original Atari spell IDs
// - after the power row, the visible panel rows are NOT grouped by semantic family
// - the internal family buckets below are therefore used as row/stage groupings for the UI
//
// Casting rule: power rune FIRST, then 1-3 additional runes.
// mana cost = floor(manaBase x manaFactor / 8)
// manaFactor per power rune: LO=8, UM=12, ON=16, EE=20, PAL=24, MON=28
import { getTranslations, type Translations } from '../i18n';
import { getOriginalCastSkillForRunes, getOriginalSpellDescriptorForRunes } from './originalSpells';
import { mapOriginalSkillNumberToSkillKey, type SkillKey } from './skillProgression';

export type RuneFamily = 'power' | 'element' | 'form' | 'alignment';
export type CastSkill = 'fighter' | 'ninja' | 'priest' | 'wizard';

type SpellTranslationKey = keyof Translations['spells'];
const spellText = getTranslations().spells;

export interface RuneDef {
    id: string;
    name: string;
    family: RuneFamily;
    level: number;
    manaFactor?: number;
    hasImage: boolean;
}

export const RUNES: RuneDef[] = [
    { id: 'lo', name: 'Lo', family: 'power', level: 1, manaFactor: 8, hasImage: true },
    { id: 'um', name: 'Um', family: 'power', level: 2, manaFactor: 12, hasImage: true },
    { id: 'on', name: 'On', family: 'power', level: 3, manaFactor: 16, hasImage: true },
    { id: 'ee', name: 'Ee', family: 'power', level: 4, manaFactor: 20, hasImage: true },
    { id: 'pal', name: 'Pal', family: 'power', level: 5, manaFactor: 24, hasImage: true },
    { id: 'mon', name: 'Mon', family: 'power', level: 6, manaFactor: 28, hasImage: true },
    { id: 'ya', name: 'Ya', family: 'element', level: 1, hasImage: true },
    { id: 'vi', name: 'Vi', family: 'element', level: 2, hasImage: true },
    { id: 'oh', name: 'Oh', family: 'element', level: 3, hasImage: true },
    { id: 'ful', name: 'Ful', family: 'element', level: 4, hasImage: true },
    { id: 'des', name: 'Des', family: 'element', level: 5, hasImage: true },
    { id: 'zo', name: 'Zo', family: 'element', level: 6, hasImage: true },
    { id: 'ven', name: 'Ven', family: 'form', level: 1, hasImage: true },
    { id: 'ew', name: 'Ew', family: 'form', level: 2, hasImage: true },
    { id: 'kath', name: 'Kath', family: 'form', level: 3, hasImage: true },
    { id: 'ir', name: 'Ir', family: 'form', level: 4, hasImage: true },
    { id: 'bro', name: 'Bro', family: 'form', level: 5, hasImage: true },
    { id: 'gor', name: 'Gor', family: 'form', level: 6, hasImage: true },
    { id: 'ku', name: 'Ku', family: 'alignment', level: 1, hasImage: true },
    { id: 'ros', name: 'Ros', family: 'alignment', level: 2, hasImage: true },
    { id: 'dain', name: 'Dain', family: 'alignment', level: 3, hasImage: true },
    { id: 'neta', name: 'Neta', family: 'alignment', level: 4, hasImage: true },
    { id: 'ra', name: 'Ra', family: 'alignment', level: 5, hasImage: true },
    { id: 'sar', name: 'Sar', family: 'alignment', level: 6, hasImage: true },
];

export const RUNES_BY_ID: Record<string, RuneDef> =
    Object.fromEntries(RUNES.map((rune) => [rune.id, rune]));

export const RUNES_BY_FAMILY: Record<RuneFamily, RuneDef[]> = {
    power: RUNES.filter((rune) => rune.family === 'power'),
    element: RUNES.filter((rune) => rune.family === 'element'),
    form: RUNES.filter((rune) => rune.family === 'form'),
    alignment: RUNES.filter((rune) => rune.family === 'alignment'),
};

export type SpellEffect =
    | 'light' | 'heal' | 'fireball' | 'lightning'
    | 'poison_bolt' | 'poison_cloud' | 'shield' | 'fire_shield' | 'open'
    | 'darkness' | 'invisibility' | 'see_through_walls' | 'plasma'
    | 'reveal_hidden' | 'disrupt_nonmaterial'
    | 'potion' | 'footprints' | 'unknown';

export interface SpellDef {
    runes: string[];
    name: string;
    effect: SpellEffect;
    manaCost: number;
    manaBase: number;
    castSkill: CastSkill;
    progressionSkill?: SkillKey;
    sourceSkillIndex?: number;
    sourceBaseDifficulty?: number;
    sourceDisableTimeTicks?: number;
    description: string;
    confirmed?: boolean;
}

const POWERS = ['lo', 'um', 'on', 'ee', 'pal', 'mon'] as const;
const MANA_FACTORS = [8, 12, 16, 20, 24, 28] as const;

function variants(
    spellKey: SpellTranslationKey,
    manaBase: number,
    castSkill: CastSkill,
    spellRunes: string[],
    effect: SpellEffect,
    confirmed = false,
): SpellDef[] {
    const localized = spellText[spellKey];
    return POWERS.map((power, index) => ({
        runes: [power, ...spellRunes],
        name: localized.names[index],
        effect,
        manaCost: Math.floor(manaBase * MANA_FACTORS[index] / 8),
        manaBase,
        castSkill,
        description: localized.descriptions[index],
        confirmed,
    }));
}

const RAW_SPELLS: SpellDef[] = [
    ...variants('torch', 1, 'wizard', ['ful'], 'light', true),
    ...variants('light', 3, 'wizard', ['oh', 'ir', 'ra'], 'light', true),
    ...variants('fireball', 4, 'wizard', ['ful', 'ir'], 'fireball', true),
    ...variants('fireShield', 3, 'wizard', ['ful', 'bro', 'neta'], 'fire_shield', true),
    ...variants('lightningBolt', 5, 'wizard', ['oh', 'kath', 'ra'], 'lightning', true),
    ...variants('poisonCloud', 3, 'wizard', ['oh', 'ven'], 'poison_cloud', true),
    ...variants('poisonBolt', 3, 'wizard', ['des', 'ven'], 'poison_bolt', true),
    ...variants('weakenNonmaterial', 2, 'wizard', ['des', 'ew'], 'disrupt_nonmaterial', true),
    ...variants('magicShield', 3, 'fighter', ['ya', 'ir'], 'shield', true),
    ...variants('darkness', 2, 'wizard', ['des', 'ir', 'sar'], 'darkness', true),
    ...variants('invisibility', 5, 'wizard', ['oh', 'ew', 'sar'], 'invisibility', true),
    ...variants('magicVision', 4, 'wizard', ['oh', 'ew', 'ra'], 'see_through_walls', true),
    ...variants('openDoor', 2, 'priest', ['zo'], 'open', true),
    ...variants('healthPotion', 4, 'priest', ['vi'], 'potion', true),
    ...variants('antidote', 3, 'priest', ['vi', 'bro'], 'potion', true),
    ...variants('staminaPotion', 2, 'fighter', ['ya'], 'potion', true),
    ...variants('shieldPotion', 3, 'fighter', ['ya', 'bro'], 'potion', true),
    ...variants('manaPotion', 4, 'wizard', ['zo', 'bro', 'ra'], 'potion', true),
    ...variants('venPotion', 3, 'wizard', ['zo', 'ven'], 'potion', true),
    ...variants('strengthPotion', 4, 'fighter', ['ful', 'bro', 'ku'], 'potion', true),
    ...variants('dexterityPotion', 4, 'priest', ['oh', 'bro', 'ros'], 'potion', true),
    ...variants('wisdomPotion', 4, 'ninja', ['ya', 'bro', 'dain'], 'potion', true),
    ...variants('vitalityPotion', 4, 'wizard', ['ya', 'bro', 'neta'], 'potion', true),
    ...variants('magicFootprints', 2, 'priest', ['ya', 'bro', 'ros'], 'footprints', true),
    ...variants('zokathra', 6, 'wizard', ['zo', 'kath', 'ra'], 'plasma', true),
];

export const SPELLS: SpellDef[] = RAW_SPELLS.map((spell) => {
    const source = getOriginalSpellDescriptorForRunes(spell.runes);
    const sourceCastSkill = getOriginalCastSkillForRunes(spell.runes);
    if (!source || !sourceCastSkill) return spell;
    const powerFactor = RUNES_BY_ID[spell.runes[0]]?.manaFactor ?? 8;
    const manaBase = source.baseDifficulty;
    return {
        ...spell,
        name: source.name,
        manaBase,
        manaCost: Math.floor(manaBase * powerFactor / 8),
        castSkill: sourceCastSkill,
        progressionSkill: mapOriginalSkillNumberToSkillKey(source.skillIndex),
        sourceSkillIndex: source.skillIndex,
        sourceBaseDifficulty: source.baseDifficulty,
        sourceDisableTimeTicks: source.disableTimeTicks,
    };
});

const SPELL_MAP: Map<string, SpellDef> = new Map(
    SPELLS.map((spell) => [spell.runes.join(','), spell]),
);

export function findSpell(runeIds: string[]): SpellDef | null {
    return SPELL_MAP.get(runeIds.join(',')) ?? null;
}

export function getSkillLevel(
    skills: Record<CastSkill, [number, number, number, number]>,
    skill: CastSkill,
): number {
    const skillState = skills[skill];
    return Math.max(skillState[0], skillState[2]);
}

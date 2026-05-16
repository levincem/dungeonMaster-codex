import { originalTimerTicksToMs } from '../engine/time';
import { getOriginalNormalizedLuminanceForPower } from './originalUiSupport';

export type BasicCastSkill = 'fighter' | 'ninja' | 'priest' | 'wizard';

export interface OriginalSpellDescriptor {
    signature: string;
    name: string;
    spellIdHex: string;
    baseDifficulty: number;
    skillIndex: number;
    skillName: string;
    basicSkill: BasicCastSkill;
    spellType: 1 | 2 | 3;
    spellTypeName: 'potion' | 'missile' | 'other';
    subtype: number;
    subtypeName: string;
    disableTimeTicks: number;
}

const POWER_RUNES = ['lo', 'um', 'on', 'ee', 'pal', 'mon'] as const;

const ORIGINAL_SKILL_NAMES: Record<number, string> = {
    0: 'Fighter',
    1: 'Ninja',
    2: 'Priest',
    3: 'Wizard',
    4: 'Swing',
    5: 'Thrust',
    6: 'Club',
    7: 'Parry',
    8: 'Steal',
    9: 'Fight',
    10: 'Throw',
    11: 'Shoot',
    12: 'Identify',
    13: 'Heal',
    14: 'Influence',
    15: 'Defend',
    16: 'Fire',
    17: 'Air',
    18: 'Earth',
    19: 'Water',
};

const MISSILE_SUBTYPE_NAMES: Record<number, string> = {
    0: 'fireball',
    1: 'poison_blob',
    2: 'lightning',
    3: 'dispell',
    4: 'open_door',
    6: 'poison_bolt',
    7: 'poison_cloud',
};

const POTION_SUBTYPE_NAMES: Record<number, string> = {
    3: 'poison_potion',
    6: 'dexterity_potion',
    7: 'strength_potion',
    8: 'wisdom_potion',
    9: 'vitality_potion',
    10: 'antivenin',
    11: 'stamina_potion',
    12: 'shield_potion',
    13: 'mana_potion',
    14: 'health_potion',
};

const OTHER_SUBTYPE_NAMES: Record<number, string> = {
    0: 'light',
    1: 'darkness',
    2: 'see_through_walls',
    3: 'invisibility_party',
    4: 'shield_party',
    5: 'torch',
    6: 'magic_footprints',
    7: 'zokathra',
    8: 'fire_shield',
};

function toBasicSkill(skillIndex: number): BasicCastSkill {
    if (skillIndex === 0 || (skillIndex >= 4 && skillIndex <= 7)) return 'fighter';
    if (skillIndex === 1 || (skillIndex >= 8 && skillIndex <= 11)) return 'ninja';
    if (skillIndex === 2 || (skillIndex >= 12 && skillIndex <= 15)) return 'priest';
    return 'wizard';
}

function spellTypeName(spellType: 1 | 2 | 3): 'potion' | 'missile' | 'other' {
    if (spellType === 1) return 'potion';
    if (spellType === 2) return 'missile';
    return 'other';
}

function subtypeName(spellType: 1 | 2 | 3, subtype: number): string {
    if (spellType === 1) return POTION_SUBTYPE_NAMES[subtype] ?? `potion_${subtype}`;
    if (spellType === 2) return MISSILE_SUBTYPE_NAMES[subtype] ?? `missile_${subtype}`;
    return OTHER_SUBTYPE_NAMES[subtype] ?? `other_${subtype}`;
}

function descriptor(
    signature: string,
    name: string,
    spellIdHex: string,
    baseDifficulty: number,
    skillIndex: number,
    spellType: 1 | 2 | 3,
    subtype: number,
    disableTimeTicks: number,
): OriginalSpellDescriptor {
    return {
        signature,
        name,
        spellIdHex,
        baseDifficulty,
        skillIndex,
        skillName: ORIGINAL_SKILL_NAMES[skillIndex] ?? `Skill ${skillIndex}`,
        basicSkill: toBasicSkill(skillIndex),
        spellType,
        spellTypeName: spellTypeName(spellType),
        subtype,
        subtypeName: subtypeName(spellType, subtype),
        disableTimeTicks,
    };
}

export const ORIGINAL_SPELLS: OriginalSpellDescriptor[] = [
    descriptor('ya,ir', 'Party Shield', '0x00666f00', 2, 15, 3, 4, 30),
    descriptor('ya,bro,ros', 'Magic Footprints', '0x00667073', 1, 18, 3, 6, 18),
    descriptor('oh,ew,sar', 'Invisibility', '0x00686d77', 3, 17, 3, 3, 45),
    descriptor('oh,ven', 'Poison Cloud', '0x00686c00', 3, 19, 2, 7, 27),
    descriptor('oh,ew,ra', 'See Through Walls', '0x00686d76', 3, 18, 3, 2, 33),
    descriptor('oh,kath,ra', 'Lightning Bolt', '0x00686e76', 4, 17, 2, 2, 30),
    descriptor('oh,ir,ra', 'Light', '0x00686f76', 4, 17, 3, 0, 22),
    descriptor('ful', 'Torch', '0x00690000', 1, 16, 3, 5, 15),
    descriptor('ful,ir', 'Fireball', '0x00696f00', 3, 16, 2, 0, 42),
    descriptor('ful,bro,ku', 'Ku Potion', '0x00697072', 4, 13, 1, 7, 15),
    descriptor('ful,bro,neta', 'Fire Shield', '0x00697075', 4, 15, 3, 8, 28),
    descriptor('des,ew', 'Weaken Nonmaterial Beings', '0x006a6d00', 1, 18, 2, 3, 20),
    descriptor('des,ven', 'Poison Bolt', '0x006a6c00', 1, 19, 2, 6, 16),
    descriptor('des,ir,sar', 'Darkness', '0x006a6f77', 1, 15, 3, 1, 12),
    descriptor('zo', 'Open Door', '0x006b0000', 1, 17, 2, 4, 15),
    descriptor('ya,bro', 'Mon Potion', '0x00667000', 2, 15, 1, 12, 25),
    descriptor('ya', 'Ya Potion', '0x00660000', 2, 13, 1, 11, 15),
    descriptor('ya,bro,dain', 'Dane Potion', '0x00667074', 4, 13, 1, 8, 15),
    descriptor('ya,bro,neta', 'Neta Potion', '0x00667075', 4, 13, 1, 9, 15),
    descriptor('vi', 'Vi Potion', '0x00670000', 1, 13, 1, 14, 32),
    descriptor('vi,bro', 'Antivenin', '0x00677000', 1, 13, 1, 10, 26),
    descriptor('oh,bro,ros', 'Ros Potion', '0x00687073', 4, 13, 1, 6, 15),
    descriptor('zo,bro,ra', 'Ee Potion', '0x006b7076', 3, 2, 1, 13, 63),
    descriptor('zo,ven', 'Ven Potion', '0x006b6c00', 2, 19, 1, 3, 30),
    descriptor('zo,kath,ra', 'Zokathra', '0x006b6e76', 0, 3, 3, 7, 15),
];

export const ORIGINAL_SPELLS_BY_SIGNATURE: Record<string, OriginalSpellDescriptor> =
    Object.fromEntries(ORIGINAL_SPELLS.map((spell) => [spell.signature, spell]));

export function getOriginalSpellDescriptorForRunes(runes: readonly string[]): OriginalSpellDescriptor | null {
    const signature = runes[0] && POWER_RUNES.includes(runes[0] as typeof POWER_RUNES[number])
        ? runes.slice(1).join(',')
        : runes.join(',');
    return ORIGINAL_SPELLS_BY_SIGNATURE[signature] ?? null;
}

export function getOriginalCastSkillForRunes(runes: readonly string[]): BasicCastSkill | null {
    return getOriginalSpellDescriptorForRunes(runes)?.basicSkill ?? null;
}

export function getOriginalSpellPowerLevel(runes: readonly string[]): number | null {
    const powerRune = runes[0];
    const index = POWER_RUNES.indexOf(powerRune as typeof POWER_RUNES[number]);
    return index >= 0 ? index + 1 : null;
}

export function getOriginalSpellManaCost(baseDifficulty: number, powerLevel: number): number {
    return Math.floor(baseDifficulty * ((powerLevel + 1) / 2));
}

export function getOriginalSpellManaCostForRunes(runes: readonly string[]): number | null {
    const descriptor = getOriginalSpellDescriptorForRunes(runes);
    const powerLevel = getOriginalSpellPowerLevel(runes);
    if (!descriptor || !powerLevel) return null;
    return getOriginalSpellManaCost(descriptor.baseDifficulty, powerLevel);
}

export function getOriginalSpellRequiredSkillLevel(runes: readonly string[]): number | null {
    const descriptor = getOriginalSpellDescriptorForRunes(runes);
    const powerLevel = getOriginalSpellPowerLevel(runes);
    if (!descriptor || !powerLevel) return null;
    return descriptor.baseDifficulty + powerLevel;
}

export function getOriginalSpellDisableTimeTicks(runes: readonly string[]): number | null {
    return getOriginalSpellDescriptorForRunes(runes)?.disableTimeTicks ?? null;
}

export function getOriginalSpellDurationMs(runes: readonly string[]): number | null {
    const descriptor = getOriginalSpellDescriptorForRunes(runes);
    const powerLevel = getOriginalSpellPowerLevel(runes);
    if (!descriptor || !powerLevel) return null;

    const d6 = 4 * (powerLevel + 1);
    switch (descriptor.spellTypeName) {
        case 'other':
            switch (descriptor.subtypeName) {
                case 'light':
                    return originalTimerTicksToMs(10000 + ((d6 - 8) * 512));
                case 'torch':
                    return originalTimerTicksToMs(4000 + (128 * (d6 - 3)));
                case 'darkness':
                    return originalTimerTicksToMs(98);
                case 'see_through_walls':
                    return originalTimerTicksToMs((d6 / 2) * (d6 / 2));
                case 'invisibility_party':
                case 'magic_footprints':
                case 'shield_party':
                    return originalTimerTicksToMs(d6 * d6);
                case 'fire_shield':
                    return originalTimerTicksToMs((d6 * d6) + 100);
                default:
                    return null;
            }
        default:
            return null;
    }
}

export function getOriginalSpellBrightnessSteps(runes: readonly string[]): number {
    const descriptor = getOriginalSpellDescriptorForRunes(runes);
    const powerLevel = getOriginalSpellPowerLevel(runes);
    if (!descriptor || !powerLevel || descriptor.spellTypeName !== 'other') return 0;

    const d6 = 4 * (powerLevel + 1);
    switch (descriptor.subtypeName) {
        case 'light':
            return Math.floor(d6 / 2) - 1;
        case 'torch':
            return Math.floor(d6 / 4) + 1;
        case 'darkness':
            return -(Math.floor(d6 / 4));
        default:
            return 0;
    }
}

export function getOriginalSpellLightContribution(runes: readonly string[]): number {
    const brightnessSteps = getOriginalSpellBrightnessSteps(runes);
    if (brightnessSteps === 0) return 0;
    const sign = brightnessSteps < 0 ? -1 : 1;
    return sign * getOriginalNormalizedLuminanceForPower(Math.abs(brightnessSteps));
}

export function getOriginalShieldStrength(runes: readonly string[]): number | null {
    const descriptor = getOriginalSpellDescriptorForRunes(runes);
    const powerLevel = getOriginalSpellPowerLevel(runes);
    if (!descriptor || !powerLevel || descriptor.spellTypeName !== 'other') return null;

    const d6 = 4 * (powerLevel + 1);
    switch (descriptor.subtypeName) {
        case 'shield_party':
            return d6;
        case 'fire_shield':
            return Math.floor(((d6 * d6) + 100) / 32);
        default:
            return null;
    }
}

export function getOriginalPotionStrengthRange(runes: readonly string[]): { min: number; max: number } | null {
    const descriptor = getOriginalSpellDescriptorForRunes(runes);
    const powerLevel = getOriginalSpellPowerLevel(runes);
    if (!descriptor || !powerLevel || descriptor.spellTypeName !== 'potion') return null;
    return {
        min: 40 * powerLevel,
        max: Math.min(255, (40 * powerLevel) + 15),
    };
}

export function getOriginalSpellCastXpRange(runes: readonly string[]): { min: number; max: number } | null {
    const descriptor = getOriginalSpellDescriptorForRunes(runes);
    const powerLevel = getOriginalSpellPowerLevel(runes);
    const requiredSkillLevel = getOriginalSpellRequiredSkillLevel(runes);
    if (!descriptor || !powerLevel || !requiredSkillLevel) return null;

    const d4 = requiredSkillLevel;
    const base = (16 * d4) + (8 * ((powerLevel - 1) * descriptor.baseDifficulty)) + (d4 * d4);
    return {
        min: base,
        max: base + 7,
    };
}

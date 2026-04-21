import {
    buildChampionInitialXP,
    createEmptyChampionXP,
    isHiddenSkill,
    normalizeChampionXP,
    type ChampionXP,
    type SkillKey,
} from '../../data/skillProgression';
import { ORIGINAL_CHAMPION_LEVEL_THRESHOLDS } from '../../data/originalChampionProgression';
import type { Champion } from '../../types/champion';
import type { ChampionVitals } from '../runtimeTypes';

export function createChampionCurrentStats(champion: Champion): ChampionVitals['currentStats'] {
    return {
        luck: champion.luck,
        strength: champion.strength,
        dexterity: champion.dexterity,
        wisdom: champion.wisdom,
        vitality: champion.vitality,
        antiMagic: champion.antiMagic,
        antiFire: champion.antiFire,
    };
}

export function normalizeChampionCurrentStats(
    champion: Champion,
    currentStats: Partial<ChampionVitals['currentStats']> | undefined,
): ChampionVitals['currentStats'] {
    const fallback = createChampionCurrentStats(champion);
    return {
        luck: currentStats?.luck ?? fallback.luck,
        strength: currentStats?.strength ?? fallback.strength,
        dexterity: currentStats?.dexterity ?? fallback.dexterity,
        wisdom: currentStats?.wisdom ?? fallback.wisdom,
        vitality: currentStats?.vitality ?? fallback.vitality,
        antiMagic: currentStats?.antiMagic ?? fallback.antiMagic,
        antiFire: currentStats?.antiFire ?? fallback.antiFire,
    };
}

export function normalizeChampionVitalsForChampion(champion: Champion, vitals: ChampionVitals): ChampionVitals {
    const normalizedStats = normalizeChampionCurrentStats(champion, vitals.currentStats);
    if (
        vitals.currentStats &&
        vitals.currentStats.luck === normalizedStats.luck &&
        vitals.currentStats.strength === normalizedStats.strength &&
        vitals.currentStats.dexterity === normalizedStats.dexterity &&
        vitals.currentStats.wisdom === normalizedStats.wisdom &&
        vitals.currentStats.vitality === normalizedStats.vitality &&
        vitals.currentStats.antiMagic === normalizedStats.antiMagic &&
        vitals.currentStats.antiFire === normalizedStats.antiFire
    ) {
        return vitals;
    }
    return {
        ...vitals,
        currentStats: normalizedStats,
    };
}

export function buildInitialChampionXP(champion: Champion): ChampionXP {
    return buildChampionInitialXP(champion.skills);
}

export function isLegacyChampionXPForChampion(champion: Champion, xp: ChampionXP | undefined): boolean {
    const normalized = normalizeChampionXP(xp);
    const hasAnyHiddenXP = Object.keys(normalized)
        .some((key) => isHiddenSkill(key as SkillKey) && normalized[key as SkillKey] > 0);
    if (hasAnyHiddenXP) return false;

    const legacyInitial = createEmptyChampionXP();
    const lvlXP = (skills: [number, number, number, number]) =>
        Math.pow(Math.max(skills[0], skills[2]), 2) * ORIGINAL_CHAMPION_LEVEL_THRESHOLDS.baseExperienceStep;
    legacyInitial.fighter = lvlXP(champion.skills.fighter);
    legacyInitial.ninja = lvlXP(champion.skills.ninja);
    legacyInitial.priest = lvlXP(champion.skills.priest);
    legacyInitial.wizard = lvlXP(champion.skills.wizard);

    return (
        normalized.fighter === legacyInitial.fighter &&
        normalized.ninja === legacyInitial.ninja &&
        normalized.priest === legacyInitial.priest &&
        normalized.wizard === legacyInitial.wizard
    );
}

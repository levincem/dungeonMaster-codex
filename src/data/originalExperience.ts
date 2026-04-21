import originalExperienceRuntime from '../assets/runtime/reference/original_experience_runtime.json';
import type { SkillKey } from './skillProgression';

type OriginalExperienceRuntime = {
    dungeonMasterLevelMultipliers: Record<string, number>;
    chaosStrikesBackLevelMultipliers: Record<string, number>;
    rules: {
        halveHiddenFighterOrNinjaExperienceWithoutRecentThreat: string;
        staleThreatHiddenSkills: SkillKey[];
        staleThreatTicks: number;
        applyLevelMultiplierWhenNonZero: string;
        doubleHiddenSkillExperienceAfterRecentThreat: string;
        recentThreatTicks: number;
        hiddenSkillAlsoFeedsParentBasicSkill: boolean;
    };
};

const ORIGINAL_EXPERIENCE = originalExperienceRuntime as OriginalExperienceRuntime;

export const ORIGINAL_EXPERIENCE_LEVEL_MULTIPLIERS = ORIGINAL_EXPERIENCE.dungeonMasterLevelMultipliers;
export const ORIGINAL_CSB_LEVEL_MULTIPLIERS = ORIGINAL_EXPERIENCE.chaosStrikesBackLevelMultipliers;
export const ORIGINAL_EXPERIENCE_RULES = ORIGINAL_EXPERIENCE.rules;
export const ORIGINAL_STALE_THREAT_HIDDEN_SKILLS = new Set<SkillKey>(ORIGINAL_EXPERIENCE.rules.staleThreatHiddenSkills);
export const ORIGINAL_STALE_THREAT_TICKS = ORIGINAL_EXPERIENCE.rules.staleThreatTicks;
export const ORIGINAL_RECENT_THREAT_TICKS = ORIGINAL_EXPERIENCE.rules.recentThreatTicks;

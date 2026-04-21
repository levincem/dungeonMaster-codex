import type { BasicSkillKey } from './skillProgression';
import originalChampionProgressionRuntime from '../assets/runtime/reference/original_champion_progression_runtime.json';

type IncreaseKind = 'minor' | 'major';
type StaminaMode = 'shift_right' | 'divide';
type HealthFactorMode = 'identity' | 'multiply' | 'plus_half_rounded_up';
type BaseManaMode = 'none' | 'wizard' | 'priest';
type BranchPrimaryStat = 'strength' | 'dexterity' | 'wisdom';

type OriginalChampionProgressionRuntime = {
    temporaryExperience: {
        gainShiftRight: number;
        minimumGain: number;
        maximumGain: number;
        gainBlockedAtOrAbove: number;
    };
    levelThresholds: {
        baseExperienceStep: number;
        rule: string;
    };
    levelUp: {
        caps: {
            health: number;
            stamina: number;
            mana: number;
        };
        randomRolls: {
            minorStatisticIncreaseMaxExclusive: number;
            majorStatisticIncreaseMaxExclusive: number;
            vitalityIncreaseMaxExclusive: number;
            antiFireIncreaseMaxExclusive: number;
            antiMagicIncreaseMaxExclusive: number;
            extraManaIncreaseMaxExclusive: number;
        };
        healthBonusRule: {
            mode: string;
        };
        staminaBonusRule: {
            mode: string;
        };
        antiFireRule: {
            mode: string;
        };
        extraManaRule: {
            mode: string;
        };
        branches: Record<BasicSkillKey, {
            staminaMode: StaminaMode;
            staminaOperand: number;
            healthFactorMode: HealthFactorMode;
            healthFactorOperand: number;
            primaryStat: BranchPrimaryStat;
            primaryIncrease: IncreaseKind;
            secondaryStat?: 'strength' | 'dexterity';
            secondaryIncrease?: IncreaseKind;
            baseManaMode: BaseManaMode;
        }>;
    };
};

const ORIGINAL_CHAMPION_PROGRESSION = originalChampionProgressionRuntime as OriginalChampionProgressionRuntime;

export const ORIGINAL_CHAMPION_TEMPORARY_EXPERIENCE = ORIGINAL_CHAMPION_PROGRESSION.temporaryExperience;
export const ORIGINAL_CHAMPION_LEVEL_THRESHOLDS = ORIGINAL_CHAMPION_PROGRESSION.levelThresholds;
export const ORIGINAL_CHAMPION_LEVEL_UP = ORIGINAL_CHAMPION_PROGRESSION.levelUp;

export function getOriginalChampionLevelUpBranch(skill: BasicSkillKey) {
    return ORIGINAL_CHAMPION_LEVEL_UP.branches[skill];
}

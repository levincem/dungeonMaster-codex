import type { Champion } from '../types/champion';
import originalMirrorRecruitmentRuntime from '../assets/runtime/reference/original_mirror_recruitment_runtime.json';

type MirrorRecruitmentStatKey = keyof Pick<
Champion,
    'luck' | 'strength' | 'dexterity' | 'wisdom' | 'vitality' | 'antiMagic' | 'antiFire'
>;

type OriginalMirrorRecruitmentRuntime = {
    mirrorRecruitment: {
        resurrect: {
            preserveChampionRecord: boolean;
            preserveSkills: boolean;
            seedInitialChampionXP: boolean;
        };
        reincarnate: {
            resetSkills: boolean;
            preserveLuckBeforeBonusRolls: boolean;
            reducedStatFloor: number;
            reducedStats: MirrorRecruitmentStatKey[];
            reductionMode: string;
            poolHalving: {
                healthMin: number;
                staminaMin: number;
                manaMin: number;
            };
            bonusRolls: number;
            bonusStats: MirrorRecruitmentStatKey[];
        };
    };
    viAltarResurrection: {
        maximumHealthRule: {
            mode: string;
            floor: number;
        };
        revivedVitals: {
            healthMode: string;
            healthMin: number;
            stamina: number;
            mana: number;
            foodRatio: number;
            waterRatio: number;
        };
    };
};

const ORIGINAL_MIRROR_RECRUITMENT = originalMirrorRecruitmentRuntime as OriginalMirrorRecruitmentRuntime;

export const ORIGINAL_MIRROR_RECRUITMENT_RULES = ORIGINAL_MIRROR_RECRUITMENT.mirrorRecruitment;
export const ORIGINAL_VI_ALTAR_RESURRECTION_RULES = ORIGINAL_MIRROR_RECRUITMENT.viAltarResurrection;

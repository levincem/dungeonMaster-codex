import type { Champion } from '../../types/champion';
import {
    awardChampionXP,
    getChampionSkillLevel,
    getParentBasicSkill,
    isHiddenSkill,
    normalizeChampionTemporaryXP,
    normalizeChampionXP,
    type BasicSkillKey,
    type ChampionTemporaryXP,
    type ChampionXP,
    type SkillKey,
} from '../../data/skillProgression';
import {
    ORIGINAL_CHAMPION_LEVEL_UP,
    ORIGINAL_CHAMPION_TEMPORARY_EXPERIENCE,
    getOriginalChampionLevelUpBranch,
} from '../../data/originalChampionProgression';
import {
    ORIGINAL_RECENT_THREAT_TICKS,
    ORIGINAL_STALE_THREAT_HIDDEN_SKILLS,
    ORIGINAL_STALE_THREAT_TICKS,
} from '../../data/originalExperience';

function clampToRange(min: number, value: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function cloneChampionWithUpdatedMaximum(
    champion: Champion,
    updates: Partial<Pick<Champion, 'health' | 'stamina' | 'mana' | 'strength' | 'dexterity' | 'wisdom' | 'vitality' | 'antiMagic' | 'antiFire'>>,
): Champion {
    return {
        ...champion,
        ...updates,
    };
}

export function buildOriginalLevelUpChampionUpdate(
    champion: Champion,
    baseSkill: BasicSkillKey,
    baseSkillLevelAfter: number,
    randomInt: (maxExclusive: number) => number,
): Champion {
    const branch = getOriginalChampionLevelUpBranch(baseSkill);
    const rolls = ORIGINAL_CHAMPION_LEVEL_UP.randomRolls;
    const minorStatisticIncrease = randomInt(rolls.minorStatisticIncreaseMaxExclusive);
    const majorStatisticIncrease = 1 + randomInt(rolls.majorStatisticIncreaseMaxExclusive);
    let vitalityAmount = randomInt(rolls.vitalityIncreaseMaxExclusive);

    if (baseSkill !== 'priest') {
        vitalityAmount &= baseSkillLevelAfter;
    }

    const nextVitality = champion.vitality + vitalityAmount;
    const nextAntiFire = champion.antiFire + (randomInt(rolls.antiFireIncreaseMaxExclusive) & ~baseSkillLevelAfter);
    let nextStrength = champion.strength;
    let nextDexterity = champion.dexterity;
    let nextWisdom = champion.wisdom;
    let nextAntiMagic = champion.antiMagic;
    let nextHealth = champion.health;
    let nextStamina = champion.stamina;
    let nextMana = champion.mana;

    let healthLevelFactor = baseSkillLevelAfter;
    let staminaAmount = champion.stamina;

    if (branch.staminaMode === 'shift_right') {
        staminaAmount >>= branch.staminaOperand;
    } else {
        staminaAmount = Math.floor(staminaAmount / branch.staminaOperand);
    }

    if (branch.healthFactorMode === 'multiply') {
        healthLevelFactor *= branch.healthFactorOperand;
    } else if (branch.healthFactorMode === 'plus_half_rounded_up') {
        healthLevelFactor += (healthLevelFactor + 1) >> 1;
    }

    const applyIncrease = (kind: 'minor' | 'major') => (kind === 'major' ? majorStatisticIncrease : minorStatisticIncrease);
    if (branch.primaryStat === 'strength') nextStrength += applyIncrease(branch.primaryIncrease);
    if (branch.primaryStat === 'dexterity') nextDexterity += applyIncrease(branch.primaryIncrease);
    if (branch.primaryStat === 'wisdom') nextWisdom += applyIncrease(branch.primaryIncrease);
    if (branch.secondaryStat === 'strength' && branch.secondaryIncrease) nextStrength += applyIncrease(branch.secondaryIncrease);
    if (branch.secondaryStat === 'dexterity' && branch.secondaryIncrease) nextDexterity += applyIncrease(branch.secondaryIncrease);

    if (branch.baseManaMode === 'wizard') {
        nextMana += baseSkillLevelAfter + (baseSkillLevelAfter >> 1);
        nextMana += Math.min(
            randomInt(rolls.extraManaIncreaseMaxExclusive),
            Math.max(0, baseSkillLevelAfter - 1),
        );
        nextAntiMagic += randomInt(rolls.antiMagicIncreaseMaxExclusive);
    } else if (branch.baseManaMode === 'priest') {
        nextMana += baseSkillLevelAfter;
        nextMana += Math.min(
            randomInt(rolls.extraManaIncreaseMaxExclusive),
            Math.max(0, baseSkillLevelAfter - 1),
        );
        nextAntiMagic += randomInt(rolls.antiMagicIncreaseMaxExclusive);
    }

    nextMana = Math.min(ORIGINAL_CHAMPION_LEVEL_UP.caps.mana, nextMana);
    nextHealth = Math.min(
        ORIGINAL_CHAMPION_LEVEL_UP.caps.health,
        nextHealth + healthLevelFactor + randomInt((healthLevelFactor >> 1) + 1),
    );
    nextStamina = Math.min(
        ORIGINAL_CHAMPION_LEVEL_UP.caps.stamina,
        nextStamina + staminaAmount + randomInt((staminaAmount >> 1) + 1),
    );

    return cloneChampionWithUpdatedMaximum(champion, {
        health: nextHealth,
        stamina: nextStamina,
        mana: nextMana,
        strength: nextStrength,
        dexterity: nextDexterity,
        wisdom: nextWisdom,
        vitality: nextVitality,
        antiMagic: nextAntiMagic,
        antiFire: nextAntiFire,
    });
}

export function applyOriginalChampionSkillExperience(
    champion: Champion,
    currentChampionXP: ChampionXP | undefined,
    currentTemporaryChampionXP: ChampionTemporaryXP | undefined,
    skill: SkillKey,
    amount: number,
    context: {
        mapDifficulty: number;
        elapsedGameTimeTicks: number;
        lastCreatureAttackGameTick: number;
    },
    randomInt: (maxExclusive: number) => number,
): {
    adjustedExperience: number;
    championXP: ChampionXP;
    championTemporaryXP: ChampionTemporaryXP;
    leveledChampion?: Champion;
} | null {
    if (amount <= 0) return null;

    const hiddenSkill = isHiddenSkill(skill);
    let adjustedExperience = amount;
    if (
        hiddenSkill &&
        ORIGINAL_STALE_THREAT_HIDDEN_SKILLS.has(skill) &&
        context.lastCreatureAttackGameTick <= (context.elapsedGameTimeTicks - ORIGINAL_STALE_THREAT_TICKS)
    ) {
        adjustedExperience >>= 1;
    }

    if (adjustedExperience > 0 && context.mapDifficulty > 0) {
        adjustedExperience *= context.mapDifficulty;
    }

    if (hiddenSkill && context.lastCreatureAttackGameTick > (context.elapsedGameTimeTicks - ORIGINAL_RECENT_THREAT_TICKS)) {
        adjustedExperience <<= 1;
    }

    if (adjustedExperience <= 0) return null;

    const baseSkill = getParentBasicSkill(skill);
    const normalizedChampionXP = normalizeChampionXP(currentChampionXP);
    const normalizedTemporaryChampionXP = normalizeChampionTemporaryXP(currentTemporaryChampionXP);
    const previousBaseSkillLevel = getChampionSkillLevel(
        normalizedChampionXP,
        normalizedTemporaryChampionXP,
        baseSkill,
        { ignoreTemporary: true },
    );

    const nextChampionXP = awardChampionXP(normalizedChampionXP, skill, adjustedExperience);
    const nextTemporaryChampionXP = normalizeChampionTemporaryXP(normalizedTemporaryChampionXP);
    if (nextTemporaryChampionXP[skill] < ORIGINAL_CHAMPION_TEMPORARY_EXPERIENCE.gainBlockedAtOrAbove) {
        nextTemporaryChampionXP[skill] += clampToRange(
            ORIGINAL_CHAMPION_TEMPORARY_EXPERIENCE.minimumGain,
            adjustedExperience >> ORIGINAL_CHAMPION_TEMPORARY_EXPERIENCE.gainShiftRight,
            ORIGINAL_CHAMPION_TEMPORARY_EXPERIENCE.maximumGain,
        );
    }

    const nextBaseSkillLevel = getChampionSkillLevel(
        nextChampionXP,
        normalizedTemporaryChampionXP,
        baseSkill,
        { ignoreTemporary: true },
    );

    return {
        adjustedExperience,
        championXP: nextChampionXP,
        championTemporaryXP: nextTemporaryChampionXP,
        ...(nextBaseSkillLevel > previousBaseSkillLevel
            ? {
                leveledChampion: buildOriginalLevelUpChampionUpdate(
                    champion,
                    baseSkill,
                    nextBaseSkillLevel,
                    randomInt,
                ),
            }
            : {}),
    };
}

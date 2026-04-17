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
    const minorStatisticIncrease = randomInt(2);
    const majorStatisticIncrease = 1 + randomInt(2);
    let vitalityAmount = randomInt(2);

    if (baseSkill !== 'priest') {
        vitalityAmount &= baseSkillLevelAfter;
    }

    const nextVitality = champion.vitality + vitalityAmount;
    const nextAntiFire = champion.antiFire + (randomInt(2) & ~baseSkillLevelAfter);
    let nextStrength = champion.strength;
    let nextDexterity = champion.dexterity;
    let nextWisdom = champion.wisdom;
    let nextAntiMagic = champion.antiMagic;
    let nextHealth = champion.health;
    let nextStamina = champion.stamina;
    let nextMana = champion.mana;

    let healthLevelFactor = baseSkillLevelAfter;
    let staminaAmount = champion.stamina;

    switch (baseSkill) {
        case 'fighter':
            staminaAmount >>= 4;
            healthLevelFactor *= 3;
            nextStrength += majorStatisticIncrease;
            nextDexterity += minorStatisticIncrease;
            break;
        case 'ninja':
            staminaAmount = Math.floor(staminaAmount / 21);
            healthLevelFactor <<= 1;
            nextStrength += minorStatisticIncrease;
            nextDexterity += majorStatisticIncrease;
            break;
        case 'wizard':
            staminaAmount >>= 5;
            nextMana += baseSkillLevelAfter + (baseSkillLevelAfter >> 1);
            nextWisdom += majorStatisticIncrease;
            nextMana += Math.min(randomInt(4), Math.max(0, baseSkillLevelAfter - 1));
            nextAntiMagic += randomInt(3);
            break;
        case 'priest':
            staminaAmount = Math.floor(staminaAmount / 25);
            nextMana += baseSkillLevelAfter;
            healthLevelFactor += (healthLevelFactor + 1) >> 1;
            nextWisdom += minorStatisticIncrease;
            nextMana += Math.min(randomInt(4), Math.max(0, baseSkillLevelAfter - 1));
            nextAntiMagic += randomInt(3);
            break;
    }

    nextMana = Math.min(900, nextMana);
    nextHealth = Math.min(999, nextHealth + healthLevelFactor + randomInt((healthLevelFactor >> 1) + 1));
    nextStamina = Math.min(9999, nextStamina + staminaAmount + randomInt((staminaAmount >> 1) + 1));

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
        (skill === 'swing' || skill === 'thrust' || skill === 'club' || skill === 'parry' || skill === 'steal' || skill === 'fight' || skill === 'throw' || skill === 'shoot') &&
        context.lastCreatureAttackGameTick < (context.elapsedGameTimeTicks - 150)
    ) {
        adjustedExperience >>= 1;
    }

    if (adjustedExperience > 0 && context.mapDifficulty > 0) {
        adjustedExperience *= context.mapDifficulty;
    }

    if (hiddenSkill && context.lastCreatureAttackGameTick > (context.elapsedGameTimeTicks - 25)) {
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
    if (nextTemporaryChampionXP[skill] < 32000) {
        nextTemporaryChampionXP[skill] += clampToRange(1, adjustedExperience >> 3, 100);
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

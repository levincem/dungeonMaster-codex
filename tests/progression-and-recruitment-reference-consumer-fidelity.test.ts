import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import {
    ORIGINAL_CHAMPION_LEVEL_UP,
    ORIGINAL_CHAMPION_LEVEL_THRESHOLDS,
    ORIGINAL_CHAMPION_TEMPORARY_EXPERIENCE,
    getOriginalChampionLevelUpBranch,
} from '../src/data/originalChampionProgression.js';
import { skillExperienceToLevel } from '../src/data/skillProgression.js';
import {
    ORIGINAL_MIRROR_RECRUITMENT_RULES,
    ORIGINAL_VI_ALTAR_RESURRECTION_RULES,
} from '../src/data/originalMirrorRecruitment.js';
import { buildOriginalLevelUpChampionUpdate } from '../src/engine/systems/originalChampionLeveling.js';
import { buildAddToPartyPatch } from '../src/engine/systems/storePartyRosterRuntime.js';
import { createReincarnatedChampion, createViAltarRevivedChampion } from '../src/engine/systems/resurrection.js';

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
        branches: Record<'fighter' | 'ninja' | 'priest' | 'wizard', {
            staminaMode: 'shift_right' | 'divide';
            staminaOperand: number;
            healthFactorMode: 'identity' | 'multiply' | 'plus_half_rounded_up';
            healthFactorOperand: number;
            primaryStat: 'strength' | 'dexterity' | 'wisdom';
            primaryIncrease: 'minor' | 'major';
            secondaryStat?: 'strength' | 'dexterity';
            secondaryIncrease?: 'minor' | 'major';
            baseManaMode: 'none' | 'wizard' | 'priest';
        }>;
    };
};

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
            reducedStats: Array<'strength' | 'dexterity' | 'wisdom' | 'vitality' | 'antiMagic' | 'antiFire'>;
            poolHalving: {
                healthMin: number;
                staminaMin: number;
                manaMin: number;
            };
            bonusRolls: number;
            bonusStats: Array<'luck' | 'strength' | 'dexterity' | 'wisdom' | 'vitality' | 'antiMagic' | 'antiFire'>;
        };
    };
    viAltarResurrection: {
        maximumHealthRule: {
            floor: number;
        };
    };
};

const ORIGINAL_CHAMPION_PROGRESSION_PATH = `${process.cwd()}\\src\\assets\\runtime\\reference\\original_champion_progression_runtime.json`;
const ORIGINAL_MIRROR_RECRUITMENT_PATH = `${process.cwd()}\\src\\assets\\runtime\\reference\\original_mirror_recruitment_runtime.json`;

function readChampionProgressionReference(): OriginalChampionProgressionRuntime {
    return JSON.parse(readFileSync(ORIGINAL_CHAMPION_PROGRESSION_PATH, 'utf8')) as OriginalChampionProgressionRuntime;
}

function readMirrorRecruitmentReference(): OriginalMirrorRecruitmentRuntime {
    return JSON.parse(readFileSync(ORIGINAL_MIRROR_RECRUITMENT_PATH, 'utf8')) as OriginalMirrorRecruitmentRuntime;
}

function createChampion(): Champion {
    return {
        id: 1,
        name: 'Halk',
        title: 'The Tested',
        gender: 'M',
        class: 'Fighter',
        health: 100,
        stamina: 80,
        mana: 20,
        luck: 10,
        strength: 20,
        dexterity: 16,
        wisdom: 8,
        vitality: 15,
        antiMagic: 6,
        antiFire: 4,
        skills: {
            fighter: [2, 1, 0, 0],
            ninja: [3, 2, 1, 0],
            priest: [4, 3, 2, 1],
            wizard: [5, 4, 3, 2],
        },
        color: '#fff',
        equipment: [],
        portrait: 'portrait.png',
    };
}

function expectedLevelUpFromReference(
    champion: Champion,
    baseSkill: 'fighter' | 'ninja' | 'priest' | 'wizard',
    baseSkillLevelAfter: number,
    randomValues: number[],
    reference: OriginalChampionProgressionRuntime,
): Champion {
    const branch = reference.levelUp.branches[baseSkill];
    const randomInt = (maxExclusive: number) => (randomValues.shift() ?? 0) % maxExclusive;
    const minor = randomInt(reference.levelUp.randomRolls.minorStatisticIncreaseMaxExclusive);
    const major = 1 + randomInt(reference.levelUp.randomRolls.majorStatisticIncreaseMaxExclusive);
    let vitalityAmount = randomInt(reference.levelUp.randomRolls.vitalityIncreaseMaxExclusive);
    if (baseSkill !== 'priest') {
        vitalityAmount &= baseSkillLevelAfter;
    }

    const next: Champion = {
        ...champion,
        vitality: champion.vitality + vitalityAmount,
        antiFire: champion.antiFire + (randomInt(reference.levelUp.randomRolls.antiFireIncreaseMaxExclusive) & ~baseSkillLevelAfter),
    };

    let staminaAmount = champion.stamina;
    if (branch.staminaMode === 'shift_right') {
        staminaAmount >>= branch.staminaOperand;
    } else {
        staminaAmount = Math.floor(staminaAmount / branch.staminaOperand);
    }

    let healthLevelFactor = baseSkillLevelAfter;
    if (branch.healthFactorMode === 'multiply') {
        healthLevelFactor *= branch.healthFactorOperand;
    } else if (branch.healthFactorMode === 'plus_half_rounded_up') {
        healthLevelFactor += (healthLevelFactor + 1) >> 1;
    }

    const increase = (kind: 'minor' | 'major') => (kind === 'major' ? major : minor);
    next[branch.primaryStat] += increase(branch.primaryIncrease);
    if (branch.secondaryStat && branch.secondaryIncrease) {
        next[branch.secondaryStat] += increase(branch.secondaryIncrease);
    }

    if (branch.baseManaMode === 'wizard') {
        next.mana += baseSkillLevelAfter + (baseSkillLevelAfter >> 1);
        next.mana += Math.min(
            randomInt(reference.levelUp.randomRolls.extraManaIncreaseMaxExclusive),
            Math.max(0, baseSkillLevelAfter - 1),
        );
        next.antiMagic += randomInt(reference.levelUp.randomRolls.antiMagicIncreaseMaxExclusive);
    } else if (branch.baseManaMode === 'priest') {
        next.mana += baseSkillLevelAfter;
        next.mana += Math.min(
            randomInt(reference.levelUp.randomRolls.extraManaIncreaseMaxExclusive),
            Math.max(0, baseSkillLevelAfter - 1),
        );
        next.antiMagic += randomInt(reference.levelUp.randomRolls.antiMagicIncreaseMaxExclusive);
    }

    next.mana = Math.min(reference.levelUp.caps.mana, next.mana);
    next.health = Math.min(
        reference.levelUp.caps.health,
        next.health + healthLevelFactor + randomInt((healthLevelFactor >> 1) + 1),
    );
    next.stamina = Math.min(
        reference.levelUp.caps.stamina,
        next.stamina + staminaAmount + randomInt((staminaAmount >> 1) + 1),
    );

    return next;
}

test('champion progression runtime reference module stays aligned with the packaged reference', () => {
    const reference = readChampionProgressionReference();
    assert.deepEqual(ORIGINAL_CHAMPION_TEMPORARY_EXPERIENCE, reference.temporaryExperience);
    assert.deepEqual(ORIGINAL_CHAMPION_LEVEL_THRESHOLDS, reference.levelThresholds);
    assert.deepEqual(ORIGINAL_CHAMPION_LEVEL_UP, reference.levelUp);
    assert.deepEqual(getOriginalChampionLevelUpBranch('fighter'), reference.levelUp.branches.fighter);
    assert.deepEqual(getOriginalChampionLevelUpBranch('ninja'), reference.levelUp.branches.ninja);
    assert.deepEqual(getOriginalChampionLevelUpBranch('priest'), reference.levelUp.branches.priest);
    assert.deepEqual(getOriginalChampionLevelUpBranch('wizard'), reference.levelUp.branches.wizard);
});

test('skill level thresholds use the documented base experience step', () => {
    const reference = readChampionProgressionReference();
    const step = reference.levelThresholds.baseExperienceStep;

    assert.equal(skillExperienceToLevel(step - 1), 1);
    assert.equal(skillExperienceToLevel(step), 2);
    assert.equal(skillExperienceToLevel(step * 2), 3);
    assert.equal(skillExperienceToLevel(step * 4), 4);
});

test('level-up runtime uses the documented branch rules for all four basic skills', () => {
    const champion = createChampion();
    const reference = readChampionProgressionReference();
    const scenarios: Array<{
        baseSkill: 'fighter' | 'ninja' | 'priest' | 'wizard';
        levelAfter: number;
        randomValues: number[];
    }> = [
        { baseSkill: 'fighter', levelAfter: 2, randomValues: [1, 1, 1, 0, 1, 2] },
        { baseSkill: 'ninja', levelAfter: 3, randomValues: [0, 1, 1, 1, 3] },
        { baseSkill: 'wizard', levelAfter: 4, randomValues: [1, 0, 1, 1, 2, 2, 7, 20] },
        { baseSkill: 'priest', levelAfter: 5, randomValues: [0, 1, 1, 1, 3, 2, 40] },
    ];

    for (const scenario of scenarios) {
        const actualRolls = [...scenario.randomValues];
        const expectedRolls = [...scenario.randomValues];
        const actual = buildOriginalLevelUpChampionUpdate(
            champion,
            scenario.baseSkill,
            scenario.levelAfter,
            (maxExclusive) => (actualRolls.shift() ?? 0) % maxExclusive,
        );
        const expected = expectedLevelUpFromReference(
            champion,
            scenario.baseSkill,
            scenario.levelAfter,
            expectedRolls,
            reference,
        );
        assert.deepEqual(actual, expected, `${scenario.baseSkill} level-up drifted from documented runtime reference`);
    }
});

test('mirror recruitment runtime reference module stays aligned with the packaged reference', () => {
    const reference = readMirrorRecruitmentReference();
    assert.deepEqual(ORIGINAL_MIRROR_RECRUITMENT_RULES, reference.mirrorRecruitment);
    assert.deepEqual(ORIGINAL_VI_ALTAR_RESURRECTION_RULES, reference.viAltarResurrection);
});

test('reincarnated champions follow the documented reduction and bonus-roll rules', () => {
    const champion = createChampion();
    const reference = readMirrorRecruitmentReference();
    const sequence = [0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4];
    let index = 0;
    const result = createReincarnatedChampion(champion, (max) => {
        const next = sequence[index] ?? 0;
        index += 1;
        return next % max;
    });

    for (const statKey of reference.mirrorRecruitment.reincarnate.reducedStats) {
        assert.equal(
            result[statKey] >= reference.mirrorRecruitment.reincarnate.reducedStatFloor,
            true,
            `${statKey} dropped below documented reincarnate floor`,
        );
    }

    assert.equal(result.health, Math.max(reference.mirrorRecruitment.reincarnate.poolHalving.healthMin, champion.health >> 1));
    assert.equal(result.stamina, Math.max(reference.mirrorRecruitment.reincarnate.poolHalving.staminaMin, champion.stamina >> 1));
    assert.equal(result.mana, Math.max(reference.mirrorRecruitment.reincarnate.poolHalving.manaMin, champion.mana >> 1));
    assert.deepEqual(result.skills, {
        fighter: [0, 0, 0, 0],
        ninja: [0, 0, 0, 0],
        priest: [0, 0, 0, 0],
        wizard: [0, 0, 0, 0],
    });
});

test('mirror add-to-party runtime keeps resurrect and reincarnate XP seeding distinct', () => {
    const champion = createChampion();
    const state = {
        party: [] as Champion[],
        championInventories: {},
        championEquipment: {},
        championVitals: {},
        championXP: {},
        championTemporaryXP: {},
        championCombat: {},
        torchBurnStart: {},
    };
    const starterEquipment = {} as ChampionEquipment;
    const starterInventory: FloorItem[] = [];

    const resurrectPatch = buildAddToPartyPatch(state, champion, 'resurrect', {
        maxPartySize: 4,
        createReincarnatedChampion: (entry) => ({ ...entry, name: `${entry.name} reincarnated` }),
        getChampionStarterLoadout: () => ({ equipment: starterEquipment, inventory: starterInventory }),
        seedTorchBurnStartFromEquipment: (_equipment, current) => current,
        createChampionVitals: () => ({}),
        createEmptyChampionXP: () => ({ mode: 'empty' }),
        buildInitialChampionXP: () => ({ mode: 'initial' }),
        createEmptyChampionTemporaryXP: () => ({}),
        createChampionCombatState: () => ({}),
    });

    const reincarnatePatch = buildAddToPartyPatch(state, champion, 'reincarnate', {
        maxPartySize: 4,
        createReincarnatedChampion: (entry) => ({ ...entry, name: `${entry.name} reincarnated` }),
        getChampionStarterLoadout: () => ({ equipment: starterEquipment, inventory: starterInventory }),
        seedTorchBurnStartFromEquipment: (_equipment, current) => current,
        createChampionVitals: () => ({}),
        createEmptyChampionXP: () => ({ mode: 'empty' }),
        buildInitialChampionXP: () => ({ mode: 'initial' }),
        createEmptyChampionTemporaryXP: () => ({}),
        createChampionCombatState: () => ({}),
    });

    assert.equal(ORIGINAL_MIRROR_RECRUITMENT_RULES.resurrect.seedInitialChampionXP, true);
    assert.deepEqual(resurrectPatch?.championXP, { [champion.id]: { mode: 'initial' } });
    assert.deepEqual(reincarnatePatch?.championXP, { [champion.id]: { mode: 'empty' } });
    assert.equal(reincarnatePatch?.party[0]?.name, `${champion.name} reincarnated`);
});

test('vi altar resurrection keeps the documented maximum-health floor', () => {
    const champion = { ...createChampion(), health: 20 };
    const result = createViAltarRevivedChampion(champion);
    assert.equal(result.health, ORIGINAL_VI_ALTAR_RESURRECTION_RULES.maximumHealthRule.floor);
});

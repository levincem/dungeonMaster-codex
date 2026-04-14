export type BasicSkillKey = 'fighter' | 'ninja' | 'priest' | 'wizard';

export type HiddenSkillKey =
    | 'swing' | 'thrust' | 'club' | 'parry'
    | 'steal' | 'fight' | 'throw' | 'shoot'
    | 'identify' | 'heal' | 'influence' | 'defend'
    | 'fire' | 'air' | 'earth' | 'water';

export type SkillKey = BasicSkillKey | HiddenSkillKey;

export type ChampionXP = Record<SkillKey, number>;
export type ChampionTemporaryXP = Record<SkillKey, number>;

export const BASIC_SKILL_KEYS: readonly BasicSkillKey[] = ['fighter', 'ninja', 'priest', 'wizard'];

export const HIDDEN_SKILL_KEYS: readonly HiddenSkillKey[] = [
    'swing', 'thrust', 'club', 'parry',
    'steal', 'fight', 'throw', 'shoot',
    'identify', 'heal', 'influence', 'defend',
    'fire', 'air', 'earth', 'water',
];

export const ALL_SKILL_KEYS: readonly SkillKey[] = [
    ...BASIC_SKILL_KEYS,
    ...HIDDEN_SKILL_KEYS,
];

const HIDDEN_SKILL_TO_PARENT: Record<HiddenSkillKey, BasicSkillKey> = {
    swing: 'fighter',
    thrust: 'fighter',
    club: 'fighter',
    parry: 'fighter',
    steal: 'ninja',
    fight: 'ninja',
    throw: 'ninja',
    shoot: 'ninja',
    identify: 'priest',
    heal: 'priest',
    influence: 'priest',
    defend: 'priest',
    fire: 'wizard',
    air: 'wizard',
    earth: 'wizard',
    water: 'wizard',
};

const ORIGINAL_SKILL_INDEX_TO_KEY: Record<number, SkillKey> = {
    0: 'fighter',
    1: 'ninja',
    2: 'priest',
    3: 'wizard',
    4: 'swing',
    5: 'thrust',
    6: 'club',
    7: 'parry',
    8: 'steal',
    9: 'fight',
    10: 'throw',
    11: 'shoot',
    12: 'identify',
    13: 'heal',
    14: 'influence',
    15: 'defend',
    16: 'fire',
    17: 'air',
    18: 'earth',
    19: 'water',
};

export function isHiddenSkill(skill: SkillKey): skill is HiddenSkillKey {
    return skill in HIDDEN_SKILL_TO_PARENT;
}

export function getParentBasicSkill(skill: SkillKey): BasicSkillKey {
    return isHiddenSkill(skill) ? HIDDEN_SKILL_TO_PARENT[skill] : skill;
}

export function mapOriginalSkillNumberToSkillKey(skillNumber: number): SkillKey {
    return ORIGINAL_SKILL_INDEX_TO_KEY[skillNumber] ?? 'fighter';
}

export function createEmptyChampionXP(): ChampionXP {
    return {
        fighter: 0,
        ninja: 0,
        priest: 0,
        wizard: 0,
        swing: 0,
        thrust: 0,
        club: 0,
        parry: 0,
        steal: 0,
        fight: 0,
        throw: 0,
        shoot: 0,
        identify: 0,
        heal: 0,
        influence: 0,
        defend: 0,
        fire: 0,
        air: 0,
        earth: 0,
        water: 0,
    };
}

export function createEmptyChampionTemporaryXP(): ChampionTemporaryXP {
    return createEmptyChampionXP();
}

export function normalizeChampionXP(source?: Partial<Record<string, number>> | null): ChampionXP {
    const normalized = createEmptyChampionXP();
    if (!source) return normalized;
    for (const key of ALL_SKILL_KEYS) {
        const value = source[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            normalized[key] = Math.max(0, value);
        }
    }
    return normalized;
}

export function normalizeChampionTemporaryXP(source?: Partial<Record<string, number>> | null): ChampionTemporaryXP {
    return normalizeChampionXP(source);
}

export function awardChampionXP(
    current: Partial<Record<string, number>> | null | undefined,
    skill: SkillKey,
    amount: number,
): ChampionXP {
    const next = normalizeChampionXP(current);
    if (amount <= 0) return next;

    next[skill] += amount;
    const parent = getParentBasicSkill(skill);
    if (parent !== skill) next[parent] += amount;
    return next;
}

export function skillExperienceToLevel(experience: number): number {
    let remaining = Math.max(0, Math.floor(experience));
    let level = 1;
    while (remaining >= 500) {
        remaining >>= 1;
        level += 1;
    }
    return level;
}

export function getChampionSkillLevel(
    permanentXp: Partial<Record<string, number>> | null | undefined,
    temporaryXp: Partial<Record<string, number>> | null | undefined,
    skill: SkillKey,
    options?: { ignoreTemporary?: boolean },
): number {
    const normalizedPermanent = normalizeChampionXP(permanentXp);
    const normalizedTemporary = normalizeChampionTemporaryXP(temporaryXp);
    const includeTemporary = !options?.ignoreTemporary;
    let totalExperience = normalizedPermanent[skill];

    if (includeTemporary) {
        totalExperience += normalizedTemporary[skill];
    }

    if (isHiddenSkill(skill)) {
        const parent = getParentBasicSkill(skill);
        totalExperience += normalizedPermanent[parent];
        if (includeTemporary) {
            totalExperience += normalizedTemporary[parent];
        }
        totalExperience >>= 1;
    }

    return skillExperienceToLevel(totalExperience);
}

type ChampionSkillSeed = {
    fighter: [number, number, number, number];
    ninja: [number, number, number, number];
    priest: [number, number, number, number];
    wizard: [number, number, number, number];
};

const BASIC_SKILL_TO_HIDDEN: Record<BasicSkillKey, readonly HiddenSkillKey[]> = {
    fighter: ['swing', 'thrust', 'club', 'parry'],
    ninja: ['steal', 'fight', 'throw', 'shoot'],
    priest: ['identify', 'heal', 'influence', 'defend'],
    wizard: ['fire', 'air', 'earth', 'water'],
};

export function buildChampionInitialXP(skills: ChampionSkillSeed): ChampionXP {
    const xp = createEmptyChampionXP();

    for (const basicSkill of BASIC_SKILL_KEYS) {
        const hiddenSkills = BASIC_SKILL_TO_HIDDEN[basicSkill];
        let basicExperience = 0;
        const values = skills[basicSkill];
        hiddenSkills.forEach((hiddenSkill, index) => {
            const encodedValue = values[index] ?? 0;
            const hiddenExperience = encodedValue > 0 ? (125 << encodedValue) : 0;
            xp[hiddenSkill] = hiddenExperience;
            basicExperience += hiddenExperience;
        });
        xp[basicSkill] = basicExperience;
    }

    return xp;
}

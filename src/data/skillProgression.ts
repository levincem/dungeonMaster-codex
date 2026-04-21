import { ORIGINAL_CHAMPION_LEVEL_THRESHOLDS } from './originalChampionProgression';
import originalSkillsRuntime from '../assets/runtime/reference/original_skills_runtime.json';

export type BasicSkillKey = 'fighter' | 'ninja' | 'priest' | 'wizard';

export type HiddenSkillKey =
    | 'swing' | 'thrust' | 'club' | 'parry'
    | 'steal' | 'fight' | 'throw' | 'shoot'
    | 'identify' | 'heal' | 'influence' | 'defend'
    | 'fire' | 'air' | 'earth' | 'water';

export type SkillKey = BasicSkillKey | HiddenSkillKey;

export type ChampionXP = Record<SkillKey, number>;
export type ChampionTemporaryXP = Record<SkillKey, number>;

type OriginalSkillsRuntime = {
    basicSkills: Array<{
        id: number;
        name: string;
    }>;
    hiddenSkills: Array<{
        id: number;
        name: string;
        parentSkill: string;
    }>;
};

const ORIGINAL_SKILLS = originalSkillsRuntime as OriginalSkillsRuntime;

function normalizeSkillKey(value: string): SkillKey {
    return value.toLowerCase() as SkillKey;
}

function normalizeBasicSkillKey(value: string): BasicSkillKey {
    return value.toLowerCase() as BasicSkillKey;
}

export const BASIC_SKILL_KEYS: readonly BasicSkillKey[] = ORIGINAL_SKILLS.basicSkills.map(
    (skill) => normalizeBasicSkillKey(skill.name),
);

export const HIDDEN_SKILL_KEYS: readonly HiddenSkillKey[] = ORIGINAL_SKILLS.hiddenSkills.map(
    (skill) => normalizeSkillKey(skill.name) as HiddenSkillKey,
);

export const ALL_SKILL_KEYS: readonly SkillKey[] = [
    ...BASIC_SKILL_KEYS,
    ...HIDDEN_SKILL_KEYS,
];

const HIDDEN_SKILL_TO_PARENT: Record<HiddenSkillKey, BasicSkillKey> = Object.fromEntries(
    ORIGINAL_SKILLS.hiddenSkills.map((skill) => [
        normalizeSkillKey(skill.name),
        normalizeBasicSkillKey(skill.parentSkill),
    ]),
) as Record<HiddenSkillKey, BasicSkillKey>;

const ORIGINAL_SKILL_INDEX_TO_KEY: Record<number, SkillKey> = Object.fromEntries(
    [...ORIGINAL_SKILLS.basicSkills, ...ORIGINAL_SKILLS.hiddenSkills].map((skill) => [
        skill.id,
        normalizeSkillKey(skill.name),
    ]),
) as Record<number, SkillKey>;

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
    return Object.fromEntries(
        ALL_SKILL_KEYS.map((key) => [key, 0]),
    ) as ChampionXP;
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
    while (remaining >= ORIGINAL_CHAMPION_LEVEL_THRESHOLDS.baseExperienceStep) {
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

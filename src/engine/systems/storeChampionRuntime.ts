import {
    getChampionSkillLevel,
    normalizeChampionTemporaryXP,
    normalizeChampionXP,
    type ChampionTemporaryXP,
    type ChampionXP,
    type SkillKey,
} from '../../data/skillProgression';
import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { ActivePotionBoost, ChampionVitals } from '../runtimeTypes';
import { createChampionCurrentStats } from './championState';

export const MAX_FOOD = 2048;
export const MAX_WATER = 2048;
export const LOW_FOOD_THRESHOLD = 1024;
export const CRITICAL_FOOD_THRESHOLD = 512;
export const LOW_WATER_THRESHOLD = 1024;
export const CRITICAL_WATER_THRESHOLD = 512;

const MIN_FOOD_WATER = -1024;
const EMPTY_WOUNDS: ChampionVitals['wounds'] = {
    head: false,
    torso: false,
    leftHand: false,
    rightHand: false,
    legs: false,
    feet: false,
};

export function clampVital(value: number, max: number): number {
    return Math.max(0, Math.min(max, value));
}

export function clampFoodWater(value: number, max: number): number {
    return Math.max(MIN_FOOD_WATER, Math.min(max, value));
}

export function getChampionSkillLevelFromXP(
    xp: ChampionXP | undefined,
    temporaryXp: ChampionTemporaryXP | undefined,
    skill: SkillKey,
    options?: { ignoreTemporary?: boolean; bonusLevels?: number },
): number {
    return getChampionSkillLevel(
        normalizeChampionXP(xp),
        normalizeChampionTemporaryXP(temporaryXp),
        skill,
        options,
    ) + (options?.bonusLevels ?? 0);
}

export function getEquipmentSkillLevelModifier(
    skill: SkillKey,
    equipment: ChampionEquipment | undefined,
): number {
    const actionHand = equipment?.rightHand;
    const neck = equipment?.neck;
    let modifier = 0;

    if (actionHand?.category === 'Weapon') {
        if (actionHand.typeId === 7) {
            modifier += 1;
        } else if (actionHand.typeId === 45) {
            modifier += 2;
        }
    }

    if (skill === 'wizard' && neck?.category === 'Misc' && neck.typeId === 41) {
        modifier += 1;
    }

    if (skill === 'defend' && neck?.category === 'Misc' && neck.typeId === 38) {
        modifier += 1;
    }

    if (skill === 'heal') {
        const hasGemOfAges = neck?.category === 'Misc' && neck.typeId === 37;
        const hasSceptreOfLyf = actionHand?.category === 'Weapon' && actionHand.typeId === 42;
        if (hasGemOfAges || hasSceptreOfLyf) {
            modifier += 1;
        }
    }

    if (skill === 'influence' && neck?.category === 'Misc' && neck.typeId === 39) {
        modifier += 1;
    }

    return modifier;
}

export function createChampionVitals(
    champion: Champion,
    hp: number,
    stamina: number,
    mana: number,
    food = 1500 + Math.floor(Math.random() * 256),
    water = 1500 + Math.floor(Math.random() * 256),
): ChampionVitals {
    return {
        hp,
        stamina,
        mana,
        food,
        water,
        currentStats: createChampionCurrentStats(champion),
        wounds: { ...EMPTY_WOUNDS },
        poisonEntries: [],
    };
}

export function adjustOriginalStatisticCurrentValue(
    currentValue: number,
    delta: number,
): number {
    if (delta < 0) return Math.max(0, currentValue + delta);
    let adjustedDelta = delta;
    if (currentValue > 120) {
        adjustedDelta >>= 1;
        if (currentValue > 150) {
            adjustedDelta >>= 1;
        }
        adjustedDelta += 1;
    }
    return Math.min(170, currentValue + adjustedDelta);
}

export function getChampionStatRelaxTargets(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    activePotionBoosts: ActivePotionBoost[],
    deps: {
        getChampionPotionBonuses: (
            activePotionBoosts: ActivePotionBoost[],
            championId: number,
            now?: number,
        ) => Partial<ChampionVitals['currentStats']>;
        getEffectiveChampionStatsWithBonuses: (
            champion: Champion,
            equip: ChampionEquipment | undefined,
            bonuses: Partial<ChampionVitals['currentStats']> | undefined,
        ) => ChampionVitals['currentStats'] & { health: number; stamina: number; mana: number };
    },
    now = Date.now(),
): ChampionVitals['currentStats'] {
    const timedBonuses = deps.getChampionPotionBonuses(activePotionBoosts, champion.id, now);
    const effective = deps.getEffectiveChampionStatsWithBonuses(champion, equip, timedBonuses);
    return {
        luck: effective.luck,
        strength: effective.strength,
        dexterity: effective.dexterity,
        wisdom: effective.wisdom,
        vitality: effective.vitality,
        antiMagic: effective.antiMagic,
        antiFire: effective.antiFire,
    };
}

export function relaxChampionCurrentStatsTowardMaximum(
    currentStats: ChampionVitals['currentStats'],
    targetStats: ChampionVitals['currentStats'],
): ChampionVitals['currentStats'] {
    const next = { ...currentStats };
    for (const key of Object.keys(targetStats) as Array<keyof ChampionVitals['currentStats']>) {
        const maxValue = Math.max(1, targetStats[key]);
        const currentValue = next[key];
        if (currentValue < maxValue) {
            next[key] = currentValue + 1;
        } else if (currentValue > maxValue) {
            next[key] = Math.max(maxValue, currentValue - Math.max(1, Math.floor(currentValue / maxValue)));
        }
    }
    return next;
}

export function buildEmptyFlaskReplacement(item: FloorItem, resolveItemName: (category: FloorItem['category'], typeId: number, rawName?: string) => string): FloorItem {
    return {
        ...item,
        category: 'Potion',
        typeId: 20,
        rawName: resolveItemName('Potion', 20),
        waterCharges: 0,
        waterMaxCharges: 1,
    };
}

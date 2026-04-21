import originalEquipmentBonusesRuntime from '../assets/runtime/reference/original_equipment_bonuses_runtime.json';
import type { ChampionEquipment, FloorItem } from '../types/game';
import type { EquipSlotKey } from '../types/items';
import type { SkillKey } from './skillProgression';

type BonusStatKey =
    | 'mana'
    | 'strength'
    | 'dexterity'
    | 'wisdom'
    | 'vitality'
    | 'antiMagic'
    | 'antiFire'
    | 'luck';

export type OriginalEquipmentStatBonuses = Record<BonusStatKey, number>;

type ItemRule = {
    category: FloorItem['category'];
    typeId: number;
    runtimeName: string;
    slot: EquipSlotKey | 'any';
    sourceSymbol: string;
};

type MasteryRule = ItemRule & {
    appliesTo: 'all' | SkillKey[];
    bonusLevels: number;
};

type StatRule = ItemRule & {
    stat: BonusStatKey;
    amount: number;
};

type CursedLuckPenaltyRule = {
    categories: Array<'Weapon' | 'Armor'>;
    slot: 'any';
    stat: 'luck';
    amount: number;
    sourceSymbol: string;
};

type OriginalEquipmentBonusesRuntime = {
    masteryBonuses: MasteryRule[];
    statBonuses: StatRule[];
    cursedLuckPenalty: CursedLuckPenaltyRule;
};

const ORIGINAL_EQUIPMENT_BONUSES = originalEquipmentBonusesRuntime as OriginalEquipmentBonusesRuntime;

export const ORIGINAL_EQUIPMENT_MASTERY_BONUSES = ORIGINAL_EQUIPMENT_BONUSES.masteryBonuses;
export const ORIGINAL_EQUIPMENT_STAT_BONUSES = ORIGINAL_EQUIPMENT_BONUSES.statBonuses;
export const ORIGINAL_CURSED_LUCK_PENALTY = ORIGINAL_EQUIPMENT_BONUSES.cursedLuckPenalty;

const ORIGINAL_EQUIPMENT_STAT_LABELS: Record<BonusStatKey, string> = {
    mana: 'Mana',
    strength: 'Strength',
    dexterity: 'Dexterity',
    wisdom: 'Wisdom',
    vitality: 'Vitality',
    antiMagic: 'Anti-Magic',
    antiFire: 'Anti-Fire',
    luck: 'Luck',
};

const ORIGINAL_EQUIPMENT_SKILL_DESCRIPTION_LABELS: Record<SkillKey, string> = {
    fighter: 'Fighter skill',
    ninja: 'Ninja skill',
    priest: 'Priest skill',
    wizard: 'Wizard skill',
    swing: 'hidden fighter swing skill',
    thrust: 'hidden fighter thrust skill',
    club: 'hidden fighter club skill',
    parry: 'hidden fighter parry skill',
    steal: 'hidden ninja steal skill',
    shoot: 'hidden ninja shoot skill',
    throw: 'hidden ninja throw skill',
    fight: 'hidden ninja fight skill',
    identify: 'hidden priest identify skill',
    heal: 'hidden priest heal skill',
    influence: 'hidden priest influence skill',
    defend: 'hidden priest defend skill',
    fire: 'hidden wizard fire skill',
    air: 'hidden wizard air skill',
    earth: 'hidden wizard earth skill',
    water: 'hidden wizard water skill',
};

export function createEmptyOriginalEquipmentStatBonuses(): OriginalEquipmentStatBonuses {
    return {
        mana: 0,
        strength: 0,
        dexterity: 0,
        wisdom: 0,
        vitality: 0,
        antiMagic: 0,
        antiFire: 0,
        luck: 0,
    };
}

function matchesRuleItem(item: FloorItem | undefined, rule: ItemRule): boolean {
    return item?.category === rule.category && item.typeId === rule.typeId;
}

function matchesRuleSlot(slot: EquipSlotKey, rule: ItemRule): boolean {
    return rule.slot === 'any' || rule.slot === slot;
}

export function getOriginalEquipmentSkillLevelModifier(
    skill: SkillKey,
    equipment: ChampionEquipment | undefined,
): number {
    if (!equipment) return 0;

    let modifier = 0;
    for (const [slot, item] of Object.entries(equipment) as Array<[EquipSlotKey, FloorItem | undefined]>) {
        if (!item) continue;
        for (const rule of ORIGINAL_EQUIPMENT_MASTERY_BONUSES) {
            if (!matchesRuleSlot(slot, rule) || !matchesRuleItem(item, rule)) continue;
            if (rule.appliesTo !== 'all' && !rule.appliesTo.includes(skill)) continue;
            modifier += rule.bonusLevels;
        }
    }

    return modifier;
}

export function getOriginalEquipmentStatBonuses(
    equipment: ChampionEquipment | undefined,
): OriginalEquipmentStatBonuses {
    const bonuses = createEmptyOriginalEquipmentStatBonuses();
    if (!equipment) return bonuses;

    for (const [slot, item] of Object.entries(equipment) as Array<[EquipSlotKey, FloorItem | undefined]>) {
        if (!item) continue;

        if (
            item.cursed &&
            ORIGINAL_CURSED_LUCK_PENALTY.categories.includes(item.category as 'Weapon' | 'Armor')
        ) {
            bonuses[ORIGINAL_CURSED_LUCK_PENALTY.stat] += ORIGINAL_CURSED_LUCK_PENALTY.amount;
        }

        for (const rule of ORIGINAL_EQUIPMENT_STAT_BONUSES) {
            if (!matchesRuleSlot(slot, rule) || !matchesRuleItem(item, rule)) continue;
            bonuses[rule.stat] += rule.amount;
        }
    }

    return bonuses;
}

function formatOriginalStatRuleDescription(rule: StatRule): string {
    const statLabel = ORIGINAL_EQUIPMENT_STAT_LABELS[rule.stat];
    return `${rule.amount >= 0 ? '+' : ''}${rule.amount} ${statLabel}`;
}

function formatOriginalMasteryRuleDescription(rule: MasteryRule): string {
    if (rule.appliesTo === 'all') {
        return `${rule.bonusLevels >= 0 ? '+' : ''}${rule.bonusLevels} all skills`;
    }

    const labels = rule.appliesTo.map((skill) => ORIGINAL_EQUIPMENT_SKILL_DESCRIPTION_LABELS[skill]);
    if (labels.length === 1) {
        return `${rule.bonusLevels >= 0 ? '+' : ''}${rule.bonusLevels} ${labels[0]}`;
    }
    return `${rule.bonusLevels >= 0 ? '+' : ''}${rule.bonusLevels} ${labels.join(', ')}`;
}

export function getOriginalEquipmentBonusDescription(
    category: FloorItem['category'],
    typeId: number,
): string | undefined {
    const parts: string[] = [];

    for (const rule of ORIGINAL_EQUIPMENT_STAT_BONUSES) {
        if (rule.category !== category || rule.typeId !== typeId) continue;
        parts.push(formatOriginalStatRuleDescription(rule));
    }

    for (const rule of ORIGINAL_EQUIPMENT_MASTERY_BONUSES) {
        if (rule.category !== category || rule.typeId !== typeId) continue;
        parts.push(formatOriginalMasteryRuleDescription(rule));
    }

    return parts.length > 0 ? parts.join(', ') : undefined;
}

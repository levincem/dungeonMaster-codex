import type { EquipmentStatBonuses } from '../../data/equipment';
import type { Champion } from '../../types/champion';
import type { ActivePotionBoost, ChampionVitals } from '../runtimeTypes';

export function createEmptyStatBonuses(): EquipmentStatBonuses {
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

export function getChampionPotionBonuses(
    activePotionBoosts: ActivePotionBoost[],
    championId: number,
    now = Date.now(),
): EquipmentStatBonuses {
    const bonuses = createEmptyStatBonuses();
    for (const boost of activePotionBoosts) {
        if (boost.championId !== championId || boost.expiresAt <= now) continue;
        bonuses[boost.stat] += boost.amount;
    }
    return bonuses;
}

export function getChampionCurrentStatBonuses(
    champion: Champion,
    vitals: ChampionVitals | undefined,
): EquipmentStatBonuses {
    if (!vitals) return createEmptyStatBonuses();
    const currentStats = vitals.currentStats;
    return {
        mana: 0,
        strength: currentStats.strength - champion.strength,
        dexterity: currentStats.dexterity - champion.dexterity,
        wisdom: currentStats.wisdom - champion.wisdom,
        vitality: currentStats.vitality - champion.vitality,
        antiMagic: currentStats.antiMagic - champion.antiMagic,
        antiFire: currentStats.antiFire - champion.antiFire,
        luck: currentStats.luck - champion.luck,
    };
}

export function getChampionRuntimeBonuses(
    champion: Champion,
    vitals: ChampionVitals | undefined,
    activePotionBoosts: ActivePotionBoost[],
    now = Date.now(),
): EquipmentStatBonuses {
    const timedBonuses = getChampionPotionBonuses(activePotionBoosts, champion.id, now);
    const currentStatBonuses = getChampionCurrentStatBonuses(champion, vitals);
    return {
        mana: (timedBonuses.mana ?? 0) + (currentStatBonuses.mana ?? 0),
        strength: (timedBonuses.strength ?? 0) + (currentStatBonuses.strength ?? 0),
        dexterity: (timedBonuses.dexterity ?? 0) + (currentStatBonuses.dexterity ?? 0),
        wisdom: (timedBonuses.wisdom ?? 0) + (currentStatBonuses.wisdom ?? 0),
        vitality: (timedBonuses.vitality ?? 0) + (currentStatBonuses.vitality ?? 0),
        antiMagic: (timedBonuses.antiMagic ?? 0) + (currentStatBonuses.antiMagic ?? 0),
        antiFire: (timedBonuses.antiFire ?? 0) + (currentStatBonuses.antiFire ?? 0),
        luck: (timedBonuses.luck ?? 0) + (currentStatBonuses.luck ?? 0),
    };
}

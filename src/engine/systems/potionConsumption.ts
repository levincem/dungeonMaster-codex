import type { ChampionVitals, PartyShield } from '../runtimeTypes';
import type { FloorItem } from '../../types/game';
import type { PotionEffect } from '../../types/items';

type EffectivePotionCaps = {
    stamina: number;
    mana: number;
    health: number;
};

type PotionConsumptionDeps = {
    adjustStatisticCurrentValue: (currentValue: number, delta: number) => number;
    buildEmptyFlaskReplacement: (item: FloorItem) => FloorItem;
    getPartyShieldKind: (shield: PartyShield) => 'physical' | 'magic' | 'fire';
    quantizeDurationMs: (durationMs: number) => number;
    healChampionWounds: (vitals: ChampionVitals, healAmount: number) => Partial<ChampionVitals>;
    timerTickMs: number;
};

export type PotionConsumptionResult = {
    nextVitals: ChampionVitals;
    replacementItem: FloorItem;
    activeShields?: PartyShield[];
};

type ResolvePotionConsumptionArgs = {
    effect: PotionEffect;
    item: FloorItem;
    championId: number;
    vitals: ChampionVitals;
    effective: EffectivePotionCaps;
    normalizedStats: ChampionVitals['currentStats'];
    activeShields: PartyShield[];
    now: number;
};

export function resolvePotionConsumption(
    {
        effect,
        item,
        championId,
        vitals,
        effective,
        normalizedStats,
        activeShields,
        now,
    }: ResolvePotionConsumptionArgs,
    deps: PotionConsumptionDeps,
): PotionConsumptionResult | null {
    const potionPower = Math.max(40, Math.min(255, item.potionPower ?? 40));
    const rawCounter = Math.floor((511 - potionPower) / (32 + Math.floor((potionPower + 1) / 8)));
    const counter = Math.max(1, rawCounter >> 1);
    const adjustedPotionPower = Math.floor(potionPower / 25) + 8;

    const nextStats = { ...normalizedStats };
    let nextVitals: ChampionVitals = {
        ...vitals,
        currentStats: nextStats,
    };
    let activeShieldsPatch: PartyShield[] | undefined;

    switch (effect) {
        case 'dexterity':
            nextStats.dexterity = deps.adjustStatisticCurrentValue(nextStats.dexterity, adjustedPotionPower);
            break;
        case 'strength':
            nextStats.strength = deps.adjustStatisticCurrentValue(nextStats.strength, Math.floor(potionPower / 35) + 5);
            break;
        case 'wisdom':
            nextStats.wisdom = deps.adjustStatisticCurrentValue(nextStats.wisdom, adjustedPotionPower);
            break;
        case 'vitality':
            nextStats.vitality = deps.adjustStatisticCurrentValue(nextStats.vitality, adjustedPotionPower);
            break;
        case 'antivenin':
            nextVitals = { ...nextVitals, poisonEntries: [] };
            break;
        case 'stamina': {
            const staminaGain = Math.min(
                Math.max(0, effective.stamina - vitals.stamina),
                Math.floor(effective.stamina / counter),
            );
            nextVitals = {
                ...nextVitals,
                stamina: Math.min(effective.stamina, vitals.stamina + staminaGain),
            };
            break;
        }
        case 'shield': {
            let shieldPower = adjustedPotionPower + (adjustedPotionPower >> 1);
            const existingChampionShield = activeShields
                .filter((shield) => shield.championId === championId && deps.getPartyShieldKind(shield) === 'physical' && shield.expiresAt > now)
                .reduce((max, shield) => Math.max(max, shield.defense ?? 0), 0);
            if (existingChampionShield > 50) {
                shieldPower >>= 2;
            }
            const shield: PartyShield = {
                id: `champion_shield_${item.id}`,
                championId,
                expiresAt: now + deps.quantizeDurationMs((shieldPower * shieldPower) * deps.timerTickMs),
                defense: shieldPower,
                kind: 'physical',
            };
            activeShieldsPatch = [
                ...activeShields.filter((activeShield) => !(activeShield.championId === championId && deps.getPartyShieldKind(activeShield) === 'physical')),
                shield,
            ];
            break;
        }
        case 'mana': {
            let mana = Math.min(900, vitals.mana + adjustedPotionPower + (adjustedPotionPower - 8));
            if (mana > effective.mana) {
                mana -= (mana - Math.max(vitals.mana, effective.mana)) >> 1;
            }
            nextVitals = { ...nextVitals, mana };
            break;
        }
        case 'health': {
            nextVitals = {
                ...nextVitals,
                hp: Math.min(effective.health, vitals.hp + Math.floor(effective.health / counter)),
            };
            Object.assign(nextVitals, deps.healChampionWounds(nextVitals, Math.max(1, Math.floor(potionPower / 42))));
            break;
        }
        case 'water':
            break;
        default:
            return null;
    }

    return {
        nextVitals,
        replacementItem: deps.buildEmptyFlaskReplacement(item),
        ...(activeShieldsPatch ? { activeShields: activeShieldsPatch } : {}),
    };
}

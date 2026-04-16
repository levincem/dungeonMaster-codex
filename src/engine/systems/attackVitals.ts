import type { Champion } from '../../types/champion';
import type { ChampionEquipment } from '../../types/game';
import type { WeaponAttackOption } from '../../data/weaponAttacks';
import type { ActivePotionBoost, ChampionVitals } from '../runtimeTypes';

type EffectiveChampionStats = {
    stamina: number;
};

type AttackVitalsDeps = {
    getEffectiveChampionStatsRuntime: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        activePotionBoosts: ActivePotionBoost[],
        currentVitals?: ChampionVitals,
    ) => EffectiveChampionStats;
    randomInt: (max: number) => number;
    clampVital: (value: number, maxValue: number) => number;
};

export function applyChampionAttackVitals(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    activePotionBoosts: ActivePotionBoost[],
    currentVitals: ChampionVitals | undefined,
    option: WeaponAttackOption | null,
    deps: AttackVitalsDeps,
) {
    if (!currentVitals) return null;

    const effective = deps.getEffectiveChampionStatsRuntime(
        champion,
        equip,
        activePotionBoosts,
        currentVitals,
    );
    const staminaCost = option ? option.attack.staminaCost + deps.randomInt(2) : 0;
    const nextVitals = {
        ...currentVitals,
        stamina: deps.clampVital(currentVitals.stamina - staminaCost, effective.stamina),
    };
    return { current: currentVitals, nextVitals, effective };
}

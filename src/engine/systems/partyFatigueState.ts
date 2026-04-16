import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { ActivePotionBoost, ChampionVitals } from '../runtimeTypes';
import type { EquipmentStatBonuses } from '../../data/equipment';

type PartyFatigueState = {
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championEquipment: Record<number, ChampionEquipment>;
    championInventories: Record<number, FloorItem[]>;
    activePotionBoosts: ActivePotionBoost[];
};

type FatigueDeps = {
    getEffectiveChampionStatsRuntime: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        activePotionBoosts: ActivePotionBoost[],
        currentVitals: ChampionVitals | undefined,
    ) => { stamina: number };
    getTotalWeight: (equip: ChampionEquipment, inventory: FloorItem[]) => number;
    getChampionMaxLoad: (
        champion: Champion,
        equip: ChampionEquipment,
        stamina: number,
        wounds: ChampionVitals['wounds'],
        extraBonuses?: Partial<EquipmentStatBonuses>,
    ) => number;
    getChampionRuntimeBonuses: (
        champion: Champion,
        vitals: ChampionVitals | undefined,
        activePotionBoosts: ActivePotionBoost[],
        now?: number,
    ) => Partial<EquipmentStatBonuses>;
    applyChampionStaminaDeltaOriginal: (
        vitals: ChampionVitals,
        maxStamina: number,
        delta: number,
    ) => ChampionVitals;
};

export function applyPartyLoadBasedFatigueState(
    state: PartyFatigueState,
    loadFactor: number,
    deps: FatigueDeps,
): Record<number, ChampionVitals> | null {
    let changed = false;
    const nextVitals: Record<number, ChampionVitals> = { ...state.championVitals };

    for (const champ of state.party) {
        const current = state.championVitals[champ.id];
        if (!current || current.hp <= 0) continue;

        const equip = state.championEquipment[champ.id] ?? {};
        const inventory = state.championInventories[champ.id] ?? [];
        const effective = deps.getEffectiveChampionStatsRuntime(champ, equip, state.activePotionBoosts, current);
        const load = deps.getTotalWeight(equip, inventory);
        const maxLoad = Math.max(
            1,
            deps.getChampionMaxLoad(
                champ,
                equip,
                current.stamina,
                current.wounds,
                deps.getChampionRuntimeBonuses(champ, current, state.activePotionBoosts),
            ),
        );
        const staminaCost = Math.floor((load * loadFactor) / maxLoad) + 1;
        const next = deps.applyChampionStaminaDeltaOriginal(current, effective.stamina, -staminaCost);

        if (next !== current && (next.hp !== current.hp || next.stamina !== current.stamina)) {
            nextVitals[champ.id] = next;
            changed = true;
        }
    }

    return changed ? nextVitals : null;
}

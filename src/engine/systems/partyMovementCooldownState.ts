import type { EquipmentStatBonuses, ChampionWounds } from '../../data/equipment';
import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { ActivePotionBoost, ChampionVitals } from '../runtimeTypes';

type PartyMovementCooldownState = {
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championEquipment: Record<number, ChampionEquipment>;
    championInventories: Record<number, FloorItem[]>;
    activePotionBoosts: ActivePotionBoost[];
};

type PartyMovementCooldownDeps = {
    getTotalWeight: (equip: ChampionEquipment, inventory: FloorItem[]) => number;
    getChampionMaxLoad: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        stamina: number,
        wounds: ChampionWounds,
        extraBonuses?: Partial<EquipmentStatBonuses>,
    ) => number;
    getChampionRuntimeBonuses: (
        champion: Champion,
        vitals: ChampionVitals | undefined,
        activePotionBoosts: ActivePotionBoost[],
        now?: number,
    ) => Partial<EquipmentStatBonuses>;
};

export function computeChampionMovementTicks(
    champion: Champion,
    vitals: ChampionVitals | undefined,
    equip: ChampionEquipment | undefined,
    inventory: FloorItem[] | undefined,
    extraBonuses?: Partial<EquipmentStatBonuses>,
    deps?: Pick<PartyMovementCooldownDeps, 'getTotalWeight' | 'getChampionMaxLoad'>,
): number {
    if (!vitals || vitals.hp <= 0) return 1;
    if (!deps) {
        throw new Error('computeChampionMovementTicks requires injected load dependencies.');
    }
    const load = deps.getTotalWeight(equip ?? {}, inventory ?? []);
    const maxLoad = Math.max(1, deps.getChampionMaxLoad(champion, equip, vitals.stamina, vitals.wounds, extraBonuses));

    let ticks: number;
    let woundTicks: number;

    if (maxLoad > load) {
        ticks = 2;
        if ((load << 3) > (maxLoad * 5)) ticks += 1;
        woundTicks = 1;
    } else {
        ticks = 4 + Math.floor((((load - maxLoad) << 2) / maxLoad));
        woundTicks = 2;
    }

    if (vitals.wounds.feet) {
        ticks += woundTicks;
    }

    const feetName = equip?.feet?.rawName ?? '';
    if (/boots of speed/i.test(feetName)) {
        ticks -= 1;
    }

    return Math.max(1, ticks);
}

export function computePartyMovementCooldownSeconds(
    state: PartyMovementCooldownState,
    deps: PartyMovementCooldownDeps,
): number {
    let ticks = 1;
    for (const champion of state.party) {
        ticks = Math.max(
            ticks,
            computeChampionMovementTicks(
                champion,
                state.championVitals[champion.id],
                state.championEquipment[champion.id] ?? {},
                state.championInventories[champion.id] ?? [],
                deps.getChampionRuntimeBonuses(
                    champion,
                    state.championVitals[champion.id],
                    state.activePotionBoosts,
                ),
                {
                    getTotalWeight: deps.getTotalWeight,
                    getChampionMaxLoad: deps.getChampionMaxLoad,
                },
            ),
        );
    }

    const cooldown = (ticks / 6) * 0.85;
    return Number.isFinite(cooldown) && cooldown > 0 ? cooldown : 0;
}

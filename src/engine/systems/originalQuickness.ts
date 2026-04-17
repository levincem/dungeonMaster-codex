import type { Champion } from '../../types/champion';
import type { ChampionWounds, EquipmentStatBonuses } from '../../data/equipment';
import type { ChampionEquipment, FloorItem } from '../../types/game';

function applyLimits(min: number, value: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function computeOriginalQuickness(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    inventory: FloorItem[] | undefined,
    currentStamina: number | undefined,
    wounds: ChampionWounds | undefined,
    extraBonuses: Partial<EquipmentStatBonuses> | undefined,
    isPartySleeping: boolean,
    randomInt: (maxExclusive: number) => number,
    deps: {
        getEffectiveChampionStatsWithBonuses: (
            champion: Champion,
            equip: ChampionEquipment | undefined,
            extraBonuses: Partial<EquipmentStatBonuses> | undefined,
        ) => { dexterity: number };
        getTotalWeight: (equip: ChampionEquipment, inventory: FloorItem[]) => number;
        getChampionMaxLoad: (
            champion: Champion,
            equip: ChampionEquipment | undefined,
            currentStamina?: number,
            wounds?: ChampionWounds,
            extraBonuses?: Partial<EquipmentStatBonuses>,
        ) => number;
    },
): number {
    const effective = deps.getEffectiveChampionStatsWithBonuses(champion, equip ?? {}, extraBonuses);
    let quickness = effective.dexterity + randomInt(8);
    const load = deps.getTotalWeight(equip ?? {}, inventory ?? []);
    const maxLoad = Math.max(
        1,
        deps.getChampionMaxLoad(champion, equip, currentStamina, wounds, extraBonuses),
    );
    quickness -= Math.floor(((quickness / 2) * load) / maxLoad);
    if (isPartySleeping) {
        quickness = Math.floor(quickness / 2);
    }
    quickness = Math.floor(quickness / 2);
    const lowLimit = randomInt(8) + 1;
    const highLimit = 100 - randomInt(8);
    return applyLimits(lowLimit, quickness, highLimit);
}

import type { Champion } from '../../types/champion';
import type { ChampionEquipment } from '../../types/game';
import type { ChampionVitals } from '../runtimeTypes';
import type { ChampionWoundSlot, EquipmentStatBonuses } from '../../data/equipment';

type ArmorDefLike = {
    armor: number;
    sharpDefense?: number;
    isShield?: boolean;
    weight?: number;
};

type EffectiveWoundDefenseStats = {
    strength: number;
    stamina: number;
    vitality: number;
};

type OriginalWoundDefenseDeps = {
    getArmorDef: (typeId: number, rawName?: string) => ArmorDefLike | undefined;
    getEffectiveChampionStatsWithBonuses: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        extraBonuses?: Partial<EquipmentStatBonuses>,
    ) => EffectiveWoundDefenseStats;
    getChampionMaxLoad: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        currentStamina?: number,
        wounds?: ChampionVitals['wounds'],
        extraBonuses?: Partial<EquipmentStatBonuses>,
    ) => number;
};

type ComputeOriginalChampionWoundDefenseArgs = {
    champion: Champion;
    equip: ChampionEquipment | undefined;
    currentVitals: ChampionVitals | undefined;
    woundSlot: ChampionWoundSlot;
    useSharpDefense: boolean;
    defenseModifier: number;
    runtimeBonuses?: Partial<EquipmentStatBonuses>;
    woundDefenseFactors: readonly number[];
};

function clampToRange(min: number, value: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function getOriginalArmorDefense(
    typeId: number,
    rawName: string | undefined,
    useSharpDefense: boolean,
    deps: Pick<OriginalWoundDefenseDeps, 'getArmorDef'>,
): number {
    const armorDef = deps.getArmorDef(typeId, rawName);
    if (!armorDef) return 0;
    if (!useSharpDefense) return armorDef.armor;
    return Math.floor((armorDef.armor * ((armorDef.sharpDefense ?? 0) + 4)) / 8);
}

export function getOriginalWoundSlotFactor(
    slot: ChampionWoundSlot,
    woundDefenseFactors: readonly number[],
): number {
    switch (slot) {
        case 'rightHand':
            return woundDefenseFactors[0] ?? 0;
        case 'leftHand':
            return woundDefenseFactors[1] ?? 0;
        case 'head':
            return woundDefenseFactors[2] ?? 0;
        case 'torso':
            return woundDefenseFactors[3] ?? 0;
        case 'legs':
            return woundDefenseFactors[4] ?? 0;
        case 'feet':
            return woundDefenseFactors[5] ?? 0;
    }
}

export function computeOriginalChampionHandStrength(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    currentVitals: ChampionVitals | undefined,
    slot: 'rightHand' | 'leftHand',
    extraBonuses: Partial<EquipmentStatBonuses> | undefined,
    randomInt: (maxExclusive: number) => number,
    deps: OriginalWoundDefenseDeps,
): number {
    const effective = deps.getEffectiveChampionStatsWithBonuses(champion, equip ?? {}, extraBonuses);
    let value = randomInt(16) + effective.strength;
    const item = equip?.[slot];
    const itemWeight = item?.category === 'Armor'
        ? (deps.getArmorDef(item.typeId, item.rawName)?.weight ?? 0)
        : 0;
    const maxLoadThreshold = deps.getChampionMaxLoad(
        champion,
        equip,
        currentVitals?.stamina,
        currentVitals?.wounds,
        extraBonuses,
    ) / 16;

    if (itemWeight <= maxLoadThreshold) {
        value += itemWeight - 12;
    } else {
        const upperThreshold = ((maxLoadThreshold - 12) / 2) + maxLoadThreshold;
        if (itemWeight <= upperThreshold) {
            value += (itemWeight - maxLoadThreshold) / 2;
        } else {
            value -= 2 * (itemWeight - upperThreshold);
        }
    }

    const maxStamina = Math.max(1, effective.stamina);
    const stamina = Math.max(0, currentVitals?.stamina ?? maxStamina);
    value *= stamina / maxStamina;
    if (currentVitals?.wounds[slot]) {
        value /= 2;
    }
    return clampToRange(0, Math.floor(value / 2), 100);
}

export function computeOriginalChampionWoundDefense(
    args: ComputeOriginalChampionWoundDefenseArgs,
    randomInt: (maxExclusive: number) => number,
    deps: OriginalWoundDefenseDeps,
): number {
    const effective = deps.getEffectiveChampionStatsWithBonuses(
        args.champion,
        args.equip ?? {},
        args.runtimeBonuses,
    );
    let woundDefense = randomInt((Math.max(0, effective.vitality) >> 3) + 1);
    if (args.useSharpDefense) {
        woundDefense = Math.floor(woundDefense / 2);
    }
    woundDefense += args.defenseModifier;

    if (args.woundSlot !== 'rightHand' && args.woundSlot !== 'leftHand') {
        const slotItem = args.equip?.[args.woundSlot];
        if (slotItem?.category === 'Armor') {
            woundDefense += getOriginalArmorDefense(
                slotItem.typeId,
                slotItem.rawName,
                args.useSharpDefense,
                deps,
            );
        }
    }

    for (const handSlot of ['rightHand', 'leftHand'] as const) {
        const item = args.equip?.[handSlot];
        if (!item || item.category !== 'Armor') continue;
        const armorDef = deps.getArmorDef(item.typeId, item.rawName);
        if (!armorDef?.isShield) continue;

        const shieldStrength = computeOriginalChampionHandStrength(
            args.champion,
            args.equip,
            args.currentVitals,
            handSlot,
            args.runtimeBonuses,
            randomInt,
            deps,
        );
        const shieldArmorDefense = getOriginalArmorDefense(
            item.typeId,
            item.rawName,
            args.useSharpDefense,
            deps,
        );
        const factor = getOriginalWoundSlotFactor(args.woundSlot, args.woundDefenseFactors);
        const shift = handSlot === args.woundSlot ? 4 : 5;
        woundDefense += Math.floor(((shieldStrength + shieldArmorDefense) * factor) / (1 << shift));
    }

    if (args.currentVitals?.wounds[args.woundSlot]) {
        woundDefense -= 8 + randomInt(4);
    }

    return clampToRange(0, Math.floor(woundDefense / 2), 100);
}

import type { Champion } from './champions';
import { ARMOR_TYPES, MISC_TYPES, WEAPON_TYPES } from './items';
import type { ChampionEquipment, FloorItem } from '../types/game';
import type { ArmorSlot, EquipSlotKey } from '../types/items';

export interface EquipmentStatBonuses {
    mana: number;
    strength: number;
    dexterity: number;
    wisdom: number;
    vitality: number;
    antiMagic: number;
    antiFire: number;
    luck: number;
}

export interface EffectiveChampionStats {
    health: number;
    stamina: number;
    mana: number;
    strength: number;
    dexterity: number;
    wisdom: number;
    vitality: number;
    antiMagic: number;
    antiFire: number;
    luck: number;
}

const ARMOR_SLOT_TO_EQUIP_SLOT: Record<ArmorSlot, EquipSlotKey> = {
    head: 'head',
    neck: 'neck',
    torso: 'torso',
    legs: 'legs',
    feet: 'feet',
    hands: 'hands',
    belt: 'belt',
};

const ZERO_BONUSES: EquipmentStatBonuses = {
    mana: 0,
    strength: 0,
    dexterity: 0,
    wisdom: 0,
    vitality: 0,
    antiMagic: 0,
    antiFire: 0,
    luck: 0,
};

export function getItemWeight(item: FloorItem): number {
    if (item.category === 'Weapon') return WEAPON_TYPES[item.typeId]?.weight ?? 0;
    if (item.category === 'Armor') return ARMOR_TYPES[item.typeId]?.weight ?? 0;
    return 0;
}

export function getEquippableSlots(item: FloorItem): EquipSlotKey[] {
    switch (item.category) {
        case 'Weapon': {
            const def = WEAPON_TYPES[item.typeId];
            if (def?.type === 'Ammo' || def?.thrown) return ['quiver1', 'quiver2', 'quiver3', 'quiver4'];
            return ['rightHand', 'leftHand'];
        }
        case 'Armor': {
            const def = ARMOR_TYPES[item.typeId];
            if (!def) return [];
            return [ARMOR_SLOT_TO_EQUIP_SLOT[def.slot]];
        }
        case 'Misc':
        case 'Potion':
        case 'Scroll':
            return ['pocket1', 'pocket2', 'rightHand', 'leftHand'];
        default:
            return [];
    }
}

export function canEquipItemInSlot(item: FloorItem, slotKey: EquipSlotKey): boolean {
    return getEquippableSlots(item).includes(slotKey);
}

export function getTotalWeight(equip: ChampionEquipment, inv: FloorItem[]): number {
    return [...Object.values(equip).filter(Boolean) as FloorItem[], ...inv]
        .reduce((sum, item) => sum + getItemWeight(item), 0);
}

export function getEquipmentStatBonuses(equip: ChampionEquipment | undefined): EquipmentStatBonuses {
    if (!equip) return ZERO_BONUSES;

    const bonuses: EquipmentStatBonuses = { ...ZERO_BONUSES };
    for (const item of Object.values(equip)) {
        if (!item) continue;

        if (item.category === 'Misc') {
            const def = MISC_TYPES[item.typeId];
            const name = def?.name ?? item.rawName ?? '';
            if (item.typeId === 16 || /Jewel Symal/i.test(name)) bonuses.antiMagic += 15;
            if (item.typeId === 39 || /Moonstone/i.test(name)) bonuses.mana += 3;
            if (item.typeId === 46 || /Rabbit/i.test(name)) bonuses.luck += 10;
        }
    }

    return bonuses;
}

export function getEffectiveChampionStats(champion: Champion, equip: ChampionEquipment | undefined): EffectiveChampionStats {
    const bonuses = getEquipmentStatBonuses(equip);
    return {
        health: champion.health,
        stamina: champion.stamina,
        mana: champion.mana + bonuses.mana,
        strength: champion.strength + bonuses.strength,
        dexterity: champion.dexterity + bonuses.dexterity,
        wisdom: champion.wisdom + bonuses.wisdom,
        vitality: champion.vitality + bonuses.vitality,
        antiMagic: champion.antiMagic + bonuses.antiMagic,
        antiFire: champion.antiFire + bonuses.antiFire,
        luck: champion.luck + bonuses.luck,
    };
}

export function getChampionMaxLoad(champion: Champion, equip: ChampionEquipment | undefined, currentStamina?: number): number {
    const effective = getEffectiveChampionStats(champion, equip);
    let baseMaxLoadTenths = (8 * effective.strength) + 100;
    const stamina = currentStamina ?? champion.stamina;
    const maxStamina = champion.stamina;
    if (maxStamina > 0 && stamina < maxStamina / 2) {
        const halfBase = Math.floor(baseMaxLoadTenths / 2);
        baseMaxLoadTenths = halfBase + Math.floor((halfBase * Math.max(0, stamina)) / Math.max(1, Math.floor(maxStamina / 2)));
    }

    const feet = equip?.feet;
    if (feet?.category === 'Armor' && feet.typeId === 20) {
        baseMaxLoadTenths += Math.floor(baseMaxLoadTenths / 16);
    }

    return Math.ceil(baseMaxLoadTenths / 10);
}

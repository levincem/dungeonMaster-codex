import type { Champion } from '../types/champion';
import { getArmorDef, getSourceItemAllowedSlotsMask, getWeaponAllowedSlotsMask, MISC_TYPES, WEAPON_TYPES } from './items';
import type { ChampionEquipment, FloorItem } from '../types/game';
import type { ArmorSlot, EquipSlotKey } from '../types/items';
import type { WeaponAttackOption } from './weaponAttacks';
import { getOriginalEquipmentStatBonuses } from './originalEquipmentBonuses';
import { getOriginalCarryRuntimeSlots, hasOriginalCarryLocation } from './originalItemRules';

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

export type ChampionWoundSlot = 'rightHand' | 'leftHand' | 'head' | 'torso' | 'legs' | 'feet';

export interface ChampionWounds {
    rightHand: boolean;
    leftHand: boolean;
    head: boolean;
    torso: boolean;
    legs: boolean;
    feet: boolean;
}

export const EMPTY_CHAMPION_WOUNDS: ChampionWounds = {
    rightHand: false,
    leftHand: false,
    head: false,
    torso: false,
    legs: false,
    feet: false,
};

export const QUIVER_SLOT_KEYS: EquipSlotKey[] = ['quiver1', 'quiver2', 'quiver3', 'quiver4'];
export const EXPLICIT_ZERO_SLOT_ITEM_FALLBACKS = {
    Misc: {
        51: {
            rawName: 'Zokathra',
            equippableSlots: ['rightHand', 'leftHand'] as EquipSlotKey[],
            starterAutoEquipSlots: ['rightHand', 'leftHand'] as EquipSlotKey[],
        },
    },
} as const;

function pushUniqueSlots(target: EquipSlotKey[], ...entries: EquipSlotKey[]): void {
    for (const entry of entries) {
        if (!target.includes(entry)) target.push(entry);
    }
}

function addHandCarrySlots(target: EquipSlotKey[], allowedMask: number): void {
    if (allowedMask === 0) return;
    pushUniqueSlots(target, 'rightHand', 'leftHand');
}

function addSourceStorageSlots(target: EquipSlotKey[], allowedMask: number): void {
    const runtimeSlots = getOriginalCarryRuntimeSlots(allowedMask);
    for (const slot of ['quiver1', 'quiver2', 'quiver3', 'quiver4', 'pocket1', 'pocket2'] as const) {
        if (runtimeSlots.includes(slot)) pushUniqueSlots(target, slot);
    }
}

function mapArmorWearSlots(slot: ArmorSlot): EquipSlotKey[] {
    switch (slot) {
        case 'head':
            return ['head'];
        case 'neck':
            return ['neck'];
        case 'torso':
            return ['torso'];
        case 'legs':
            return ['legs'];
        case 'feet':
            return ['feet'];
        case 'hands':
            return ['rightHand', 'leftHand'];
        case 'belt':
            return [];
        default:
            return [];
    }
}

function addSourceWearSlots(target: EquipSlotKey[], allowedMask: number): void {
    if (hasOriginalCarryLocation(allowedMask, 'Head')) pushUniqueSlots(target, 'head');
    if (hasOriginalCarryLocation(allowedMask, 'Neck')) pushUniqueSlots(target, 'neck');
    if (hasOriginalCarryLocation(allowedMask, 'Torso')) pushUniqueSlots(target, 'torso');
    if (hasOriginalCarryLocation(allowedMask, 'Legs')) pushUniqueSlots(target, 'legs');
    if (hasOriginalCarryLocation(allowedMask, 'Feet')) pushUniqueSlots(target, 'feet');
}

function mapExtractedWeaponSlots(typeId: number): EquipSlotKey[] {
    const allowedMask = getWeaponAllowedSlotsMask(typeId);
    if (allowedMask == null || allowedMask === 0) return [];

    const slots: EquipSlotKey[] = [];
    const def = WEAPON_TYPES[typeId];
    const preferStorageFirst = def?.type === 'Ammo' || def?.thrown === true;

    if (preferStorageFirst) {
        addSourceStorageSlots(slots, allowedMask);
        addHandCarrySlots(slots, allowedMask);
        return slots;
    }

    addHandCarrySlots(slots, allowedMask);
    addSourceStorageSlots(slots, allowedMask);
    return slots;
}

function mapExtractedArmorSlots(item: FloorItem): EquipSlotKey[] {
    const allowedMask = getSourceItemAllowedSlotsMask('Armor', item.typeId, item.rawName);
    const def = getArmorDef(item.typeId, item.rawName);
    const slots: EquipSlotKey[] = [];

    if (def) {
        pushUniqueSlots(slots, ...mapArmorWearSlots(def.slot));
    }

    if (allowedMask == null || allowedMask === 0) return slots;

    addSourceWearSlots(slots, allowedMask);
    addHandCarrySlots(slots, allowedMask);
    addSourceStorageSlots(slots, allowedMask);
    return slots;
}

function mapExtractedMiscSlots(typeId: number): EquipSlotKey[] {
    const allowedMask = getSourceItemAllowedSlotsMask('Misc', typeId);
    if (allowedMask == null || allowedMask === 0) return [];

    const slots: EquipSlotKey[] = [];
    addSourceWearSlots(slots, allowedMask);
    addSourceStorageSlots(slots, allowedMask);
    addHandCarrySlots(slots, allowedMask);
    return slots;
}

function mapExtractedConsumableSlots(category: 'Potion' | 'Scroll', typeId: number): EquipSlotKey[] {
    const allowedMask = getSourceItemAllowedSlotsMask(category, typeId);
    if (allowedMask == null || allowedMask === 0) return [];

    const slots: EquipSlotKey[] = [];
    addSourceStorageSlots(slots, allowedMask);
    addHandCarrySlots(slots, allowedMask);
    return slots;
}

function mapExtractedContainerSlots(typeId: number): EquipSlotKey[] {
    const allowedMask = getSourceItemAllowedSlotsMask('Container', typeId);
    if (allowedMask == null || allowedMask === 0) return ['rightHand', 'leftHand'];

    const slots: EquipSlotKey[] = [];
    addSourceStorageSlots(slots, allowedMask);
    addHandCarrySlots(slots, allowedMask);
    return slots.length > 0 ? slots : ['rightHand', 'leftHand'];
}

function mapFallbackArmorSlots(item: FloorItem): EquipSlotKey[] {
    const def = getArmorDef(item.typeId, item.rawName);
    if (!def) return [];
    return mapArmorWearSlots(def.slot);
}

function mapFallbackMiscSlots(item: FloorItem): EquipSlotKey[] {
    const explicitFallback = EXPLICIT_ZERO_SLOT_ITEM_FALLBACKS.Misc[item.typeId as keyof typeof EXPLICIT_ZERO_SLOT_ITEM_FALLBACKS.Misc];
    if (explicitFallback) return [...explicitFallback.equippableSlots];
    return [];
}

function mapStarterArmorSlots(item: FloorItem): EquipSlotKey[] {
    const def = getArmorDef(item.typeId, item.rawName);
    const slots: EquipSlotKey[] = [];
    if (def) {
        pushUniqueSlots(slots, ...mapArmorWearSlots(def.slot));
    }

    const allowedMask = getSourceItemAllowedSlotsMask('Armor', item.typeId, item.rawName);
    if (allowedMask == null || allowedMask === 0) return slots;

    addSourceWearSlots(slots, allowedMask);
    if (hasOriginalCarryLocation(allowedMask, 'Hands')) {
        pushUniqueSlots(slots, 'rightHand', 'leftHand');
    }
    return slots;
}

function mapStarterMiscSlots(typeId: number): EquipSlotKey[] {
    const allowedMask = getSourceItemAllowedSlotsMask('Misc', typeId);
    if (allowedMask == null || allowedMask === 0) {
        const explicitFallback = EXPLICIT_ZERO_SLOT_ITEM_FALLBACKS.Misc[typeId as keyof typeof EXPLICIT_ZERO_SLOT_ITEM_FALLBACKS.Misc];
        return explicitFallback ? [...explicitFallback.starterAutoEquipSlots] : [];
    }

    const slots: EquipSlotKey[] = [];
    addSourceWearSlots(slots, allowedMask);
    addSourceStorageSlots(slots, allowedMask);
    if (slots.length === 0) {
        addHandCarrySlots(slots, allowedMask);
    }
    return slots;
}

function mapStarterConsumableSlots(category: 'Potion' | 'Scroll', typeId: number): EquipSlotKey[] {
    const allowedMask = getSourceItemAllowedSlotsMask(category, typeId);
    if (allowedMask == null || allowedMask === 0) return ['pocket1', 'pocket2'];

    const slots: EquipSlotKey[] = [];
    addSourceStorageSlots(slots, allowedMask);
    if (slots.length === 0) {
        addHandCarrySlots(slots, allowedMask);
    }
    return slots;
}

export function getItemWeight(item: FloorItem): number {
    if (item.category === 'Weapon') return WEAPON_TYPES[item.typeId]?.weight ?? 0;
    if (item.category === 'Armor') return getArmorDef(item.typeId, item.rawName)?.weight ?? 0;
    if (item.category === 'Potion') return 0.3;
    if (item.category === 'Scroll') return 0.1;
    if (item.category === 'Container') return item.typeId === 4 ? 0 : 5.0;
    if (item.category === 'Misc') return MISC_TYPES[item.typeId]?.weight ?? 0;
    return 0;
}

export function getEquippableSlots(item: FloorItem): EquipSlotKey[] {
    switch (item.category) {
        case 'Weapon': {
            const extractedSlots = mapExtractedWeaponSlots(item.typeId);
            if (extractedSlots.length > 0) return extractedSlots;

            const def = WEAPON_TYPES[item.typeId];
            if (def?.type === 'Ammo' || def?.thrown) return ['quiver1', 'quiver2', 'quiver3', 'quiver4'];
            return ['rightHand', 'leftHand'];
        }
        case 'Armor': {
            const extractedSlots = mapExtractedArmorSlots(item);
            if (extractedSlots.length > 0) return extractedSlots;
            return mapFallbackArmorSlots(item);
        }
        case 'Misc': {
            const extractedSlots = mapExtractedMiscSlots(item.typeId);
            if (extractedSlots.length > 0) return extractedSlots;
            return mapFallbackMiscSlots(item);
        }
        case 'Potion':
            return mapExtractedConsumableSlots('Potion', item.typeId);
        case 'Scroll': {
            const extractedSlots = mapExtractedConsumableSlots('Scroll', item.typeId);
            if (extractedSlots.length > 0) return extractedSlots;
            return ['pocket1', 'pocket2', 'rightHand', 'leftHand'];
        }
        case 'Container':
            return mapExtractedContainerSlots(item.typeId);
        default:
            return [];
    }
}

export function getStarterAutoEquipSlots(item: FloorItem): EquipSlotKey[] {
    switch (item.category) {
        case 'Weapon': {
            const extractedSlots = mapExtractedWeaponSlots(item.typeId);
            if (extractedSlots.length > 0) return extractedSlots;

            const def = WEAPON_TYPES[item.typeId];
            if (def?.type === 'Ammo' || def?.thrown) return ['quiver1', 'quiver2', 'quiver3', 'quiver4'];
            return ['rightHand', 'leftHand'];
        }
        case 'Armor': {
            const starterSlots = mapStarterArmorSlots(item);
            if (starterSlots.length > 0) return starterSlots;
            return mapFallbackArmorSlots(item);
        }
        case 'Misc':
            return mapStarterMiscSlots(item.typeId);
        case 'Potion':
            return mapStarterConsumableSlots('Potion', item.typeId);
        case 'Scroll':
            return mapStarterConsumableSlots('Scroll', item.typeId);
        case 'Container':
            return mapExtractedContainerSlots(item.typeId);
        default:
            return [];
    }
}

export function getPreferredCombatItem(
    equipment: ChampionEquipment | undefined,
    deps: {
        getWeaponAttackOptions: (item: FloorItem | undefined) => WeaponAttackOption[];
        isThrowAttack: (option: WeaponAttackOption | null) => boolean;
    },
): { slot: EquipSlotKey; item: FloorItem } | null {
    const rightHand = equipment?.rightHand;
    if (rightHand) {
        return { slot: 'rightHand', item: rightHand };
    }

    for (const slot of QUIVER_SLOT_KEYS) {
        const item = equipment?.[slot];
        if (!item) continue;
        const attacks = deps.getWeaponAttackOptions(item);
        if (attacks.some((attack) => deps.isThrowAttack(attack))) {
            return { slot, item };
        }
    }

    return null;
}

export function canEquipItemInSlot(item: FloorItem, slotKey: EquipSlotKey): boolean {
    return getEquippableSlots(item).includes(slotKey);
}

export function getTotalWeight(equip: ChampionEquipment, inv: FloorItem[]): number {
    return [...Object.values(equip).filter(Boolean) as FloorItem[], ...inv]
        .reduce((sum, item) => sum + getItemWeight(item), 0);
}

export function getEquipmentStatBonuses(equip: ChampionEquipment | undefined): EquipmentStatBonuses {
    return getOriginalEquipmentStatBonuses(equip);
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

export function getEffectiveChampionStatsWithBonuses(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    extraBonuses: Partial<EquipmentStatBonuses> | undefined,
): EffectiveChampionStats {
    const effective = getEffectiveChampionStats(champion, equip);
    if (!extraBonuses) return effective;
    return {
        ...effective,
        mana: effective.mana + (extraBonuses.mana ?? 0),
        strength: effective.strength + (extraBonuses.strength ?? 0),
        dexterity: effective.dexterity + (extraBonuses.dexterity ?? 0),
        wisdom: effective.wisdom + (extraBonuses.wisdom ?? 0),
        vitality: effective.vitality + (extraBonuses.vitality ?? 0),
        antiMagic: effective.antiMagic + (extraBonuses.antiMagic ?? 0),
        antiFire: effective.antiFire + (extraBonuses.antiFire ?? 0),
        luck: effective.luck + (extraBonuses.luck ?? 0),
        health: effective.health,
        stamina: effective.stamina,
    };
}

export function hasAnyChampionWound(wounds: ChampionWounds | undefined): boolean {
    if (!wounds) return false;
    return Object.values(wounds).some(Boolean);
}

export function getChampionMaxLoad(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    currentStamina?: number,
    wounds?: ChampionWounds,
    extraBonuses?: Partial<EquipmentStatBonuses>,
): number {
    const effective = getEffectiveChampionStatsWithBonuses(champion, equip, extraBonuses);
    let baseMaxLoadTenths = (8 * effective.strength) + 100;
    const stamina = currentStamina ?? champion.stamina;
    const maxStamina = champion.stamina;
    if (maxStamina > 0 && stamina < maxStamina / 2) {
        const halfBase = Math.floor(baseMaxLoadTenths / 2);
        baseMaxLoadTenths = halfBase + Math.floor((halfBase * Math.max(0, stamina)) / Math.max(1, Math.floor(maxStamina / 2)));
    }

    if (hasAnyChampionWound(wounds)) {
        baseMaxLoadTenths -= Math.floor(baseMaxLoadTenths / (wounds?.legs ? 4 : 8));
    }

    const feet = equip?.feet;
    if (feet?.category === 'Armor' && feet.typeId === 15) {
        baseMaxLoadTenths += Math.floor(baseMaxLoadTenths / 16);
    }

    baseMaxLoadTenths += 9;
    baseMaxLoadTenths -= baseMaxLoadTenths % 10;
    return Math.max(1, Math.floor(baseMaxLoadTenths / 10));
}

import { WEAPON_TYPES } from './items';
import type { FloorItem } from '../types/game';
import type { CastSkill } from './runes';
import { getGameDbRawSync } from './gameDbData';

const gameDb = JSON.parse(getGameDbRawSync()) as unknown;

type RawAttack = {
    index: number;
    enumName: string;
    displayName: string;
    experienceForAttacking: number;
    skillNumber: number;
    defenseModifier: number;
    staminaCost: number;
    strengthRequired: number;
    baseDamage: number;
    disableTime: number;
};

type RawLegalAttack = {
    attackType: number;
    enumName: string;
    displayName: string;
    requiresCharges?: boolean;
    masteryThreshold?: number;
};

type RawWeaponAttackReference = {
    weaponIndex: number;
    objectInfoIndex: number;
    displayName: string;
    symbol?: string;
    rawDescriptor?: {
        index: number;
        weightKg: number;
        rawClass: number;
        damage: number;
        kineticEnergy: number;
        shootDamage: number;
        throwGraphic: number;
    };
    legalAttacks?: {
        primaryAttack?: RawLegalAttack;
        optionalAttacks?: RawLegalAttack[];
    };
};

export type WeaponAttackOption = {
    attackType: number;
    enumName: string;
    displayName: string;
    requiresCharges: boolean;
    masteryThreshold: number;
    source: 'primary' | 'optional';
    attack: RawAttack;
};

export type WeaponProjectileDescriptor = {
    weaponIndex: number;
    objectInfoIndex: number;
    displayName: string;
    weightKg: number;
    rawClass: number;
    damage: number;
    kineticEnergy: number;
    shootDamage: number;
    throwGraphic: number;
};

const originalAtari = (gameDb as unknown as {
    originalAtari?: {
        i560?: { attacks?: RawAttack[] };
        weaponAttackReference?: RawWeaponAttackReference[];
    };
}).originalAtari;

const ATTACKS_BY_INDEX = new Map<number, RawAttack>(
    (originalAtari?.i560?.attacks ?? []).map((attack) => [attack.index, attack]),
);

const REFERENCE_ENTRIES = originalAtari?.weaponAttackReference ?? [];

const DISPLAY_NAME_TO_ENTRY = new Map<string, RawWeaponAttackReference>();
const SYMBOL_NAME_TO_ENTRY = new Map<string, RawWeaponAttackReference>();

function normalizeName(value: string | undefined): string {
    return String(value ?? '')
        .toLowerCase()
        .replace(/weapon_/g, '')
        .replace(/\(complete\)/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function registerReferenceEntry(entry: RawWeaponAttackReference): void {
    const displayKey = normalizeName(entry.displayName);
    if (!DISPLAY_NAME_TO_ENTRY.has(displayKey) || entry.weaponIndex < (DISPLAY_NAME_TO_ENTRY.get(displayKey)?.weaponIndex ?? Number.MAX_SAFE_INTEGER)) {
        DISPLAY_NAME_TO_ENTRY.set(displayKey, entry);
    }

    const symbolKey = normalizeName(entry.symbol);
    if (symbolKey) SYMBOL_NAME_TO_ENTRY.set(symbolKey, entry);
}

for (const entry of REFERENCE_ENTRIES) {
    registerReferenceEntry(entry);
}

function getReferenceEntry(item: FloorItem | undefined): RawWeaponAttackReference | null {
    if (!item || item.category !== 'Weapon') return null;

    const weaponName = WEAPON_TYPES[item.typeId]?.name;
    const rawName = item.rawName;
    const candidates = [
        rawName,
        weaponName,
        rawName?.replace(/\s+of\s+/gi, ' Of '),
        rawName?.replace(/Staff of Claws/i, 'Staff Of Claws'),
        rawName?.replace(/Teowand/i, 'Teo Wand'),
        weaponName?.replace(/Staff of Claws/i, 'Staff Of Claws'),
        weaponName?.replace(/Teowand/i, 'Teo Wand'),
    ]
        .filter((value): value is string => Boolean(value))
        .flatMap((value) => [value, normalizeName(value), value.replace(/\s+/g, '')]);

    for (const candidate of candidates) {
        const normalized = normalizeName(candidate);
        const byDisplay = DISPLAY_NAME_TO_ENTRY.get(normalized);
        if (byDisplay) return byDisplay;

        const bySymbol = SYMBOL_NAME_TO_ENTRY.get(normalized);
        if (bySymbol) return bySymbol;
    }

    return null;
}

export function getOriginalWeaponReference(item: FloorItem | undefined): WeaponProjectileDescriptor | null {
    const entry = getReferenceEntry(item);
    if (!entry?.rawDescriptor) return null;
    return {
        weaponIndex: entry.weaponIndex,
        objectInfoIndex: entry.objectInfoIndex,
        displayName: entry.displayName,
        weightKg: entry.rawDescriptor.weightKg,
        rawClass: entry.rawDescriptor.rawClass,
        damage: entry.rawDescriptor.damage,
        kineticEnergy: entry.rawDescriptor.kineticEnergy,
        shootDamage: entry.rawDescriptor.shootDamage,
        throwGraphic: entry.rawDescriptor.throwGraphic,
    };
}

export function getWeaponAttackOptions(item: FloorItem | undefined): WeaponAttackOption[] {
    const entry = getReferenceEntry(item);
    if (!entry?.legalAttacks?.primaryAttack) return [];

    const options: WeaponAttackOption[] = [];
    const pushOption = (raw: RawLegalAttack | undefined, source: 'primary' | 'optional') => {
        if (!raw) return;
        const attack = ATTACKS_BY_INDEX.get(raw.attackType);
        if (!attack) return;
        options.push({
            attackType: raw.attackType,
            enumName: raw.enumName,
            displayName: raw.displayName,
            requiresCharges: Boolean(raw.requiresCharges),
            masteryThreshold: Number(raw.masteryThreshold ?? 0),
            source,
            attack,
        });
    };

    pushOption(entry.legalAttacks.primaryAttack, 'primary');
    for (const optional of entry.legalAttacks.optionalAttacks ?? []) {
        pushOption(optional, 'optional');
    }
    return options;
}

export function getDefaultAttackOption(item: FloorItem | undefined): WeaponAttackOption | null {
    const options = getWeaponAttackOptions(item);
    return options[0] ?? null;
}

export function isThrowAttack(option: WeaponAttackOption | null): boolean {
    return option?.enumName === 'Throw';
}

export function isShootAttack(option: WeaponAttackOption | null): boolean {
    return option?.enumName === 'Shoot';
}

export function getRequiredAmmoRawClass(item: FloorItem | undefined): number | null {
    const descriptor = getOriginalWeaponReference(item);
    if (!descriptor) return null;
    if (descriptor.rawClass >= 16 && descriptor.rawClass <= 31) return 10;
    if (descriptor.rawClass >= 32 && descriptor.rawClass <= 47) return 11;
    return null;
}

export function matchesRequiredAmmoRawClass(item: FloorItem | undefined, rawClass: number | null): boolean {
    if (rawClass === null) return false;
    const descriptor = getOriginalWeaponReference(item);
    return descriptor?.rawClass === rawClass;
}

export function mapOriginalSkillNumberToBasicSkill(skillNumber: number): CastSkill {
    const basicIndex = skillNumber >= 4 ? Math.floor((skillNumber - 4) / 4) : skillNumber;
    switch (basicIndex) {
        case 1: return 'ninja';
        case 2: return 'priest';
        case 3: return 'wizard';
        default: return 'fighter';
    }
}

export function getAttackCooldownSeconds(option: WeaponAttackOption | null): number {
    if (!option) return 2;
    return Math.max(0.35, option.attack.disableTime / 6);
}

export function isAttackOptionUsable(option: WeaponAttackOption): boolean {
    void option;
    return true;
}

export function isAttackOptionUsableAtMastery(option: WeaponAttackOption, masteryLevel: number): boolean {
    return masteryLevel >= option.masteryThreshold;
}

export function getAttackOptionUnusableReason(option: WeaponAttackOption, masteryLevel: number): string | null {
    if (masteryLevel < option.masteryThreshold) {
        return `niveau requis ${option.masteryThreshold}`;
    }
    return null;
}

export function isPhysicalAttack(option: WeaponAttackOption | null): boolean {
    if (!option) return true;
    return new Set([
        'Chop',
        'Climb Down',
        'Cleave',
        'Hack',
        'Jab',
        'Kick',
        'Melee',
        'Parry',
        'Punch',
        'Slash',
        'Stab',
        'Stun',
        'Swing',
        'Throw',
        'Shoot',
        'Bash',
        'Berzerk',
    ]).has(option.enumName);
}

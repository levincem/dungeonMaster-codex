import originalUiSupportRuntime from '../assets/runtime/reference/original_ui_support_runtime.json';
import type { ChampionWoundSlot } from './equipment';

type OriginalUiSupportRuntime = {
    paletteBrightnessThresholds: number[];
    luminousPowerToLuminance: number[];
    torchTypePerChargesCount: number[];
    creatureInjuryMasks: Record<string, number>;
    orderedPositionsToAttack: number[][];
    stringsUsedWhenReincarnating: {
        space: string;
        underscore: string;
    };
    specialCharactersWhenReincarnating: number[];
};

const ORIGINAL_UI_SUPPORT = originalUiSupportRuntime as OriginalUiSupportRuntime;

export const ORIGINAL_PALETTE_BRIGHTNESS_THRESHOLDS = ORIGINAL_UI_SUPPORT.paletteBrightnessThresholds;
export const ORIGINAL_LUMINOUS_POWER_TO_LUMINANCE = ORIGINAL_UI_SUPPORT.luminousPowerToLuminance;
export const ORIGINAL_TORCH_TYPE_PER_CHARGES_COUNT = ORIGINAL_UI_SUPPORT.torchTypePerChargesCount;
export const ORIGINAL_CREATURE_INJURY_MASKS = ORIGINAL_UI_SUPPORT.creatureInjuryMasks;
export const ORIGINAL_ORDERED_POSITIONS_TO_ATTACK = ORIGINAL_UI_SUPPORT.orderedPositionsToAttack;
export const ORIGINAL_REINCARNATION_STRINGS = ORIGINAL_UI_SUPPORT.stringsUsedWhenReincarnating;
export const ORIGINAL_REINCARNATION_SPECIAL_CHARACTERS = ORIGINAL_UI_SUPPORT.specialCharactersWhenReincarnating;

const ORIGINAL_CREATURE_INJURY_ZONE_TO_WOUND_SLOT = {
    head: 'head',
    torso: 'torso',
    legs: 'legs',
    feet: 'feet',
} as const satisfies Record<'head' | 'torso' | 'legs' | 'feet', ChampionWoundSlot>;

export type OriginalCreatureInjuryZone = keyof typeof ORIGINAL_CREATURE_INJURY_ZONE_TO_WOUND_SLOT;
export type OriginalCreatureCoverageZone = OriginalCreatureInjuryZone | 'hands';

const ORIGINAL_CREATURE_INJURY_ZONE_ORDER = Object.entries(ORIGINAL_CREATURE_INJURY_MASKS)
    .sort((left, right) => right[1] - left[1])
    .map(([zone]) => zone as OriginalCreatureInjuryZone);

export const ORIGINAL_TORCH_MAX_CHARGES = ORIGINAL_TORCH_TYPE_PER_CHARGES_COUNT.length - 1;
export const ORIGINAL_TORCH_CHARGE_DURATION_MS = 60_000;
export const ORIGINAL_TORCH_LIFETIME_MS = ORIGINAL_TORCH_MAX_CHARGES * ORIGINAL_TORCH_CHARGE_DURATION_MS;

export function getOriginalLuminancePercentForPower(power: number): number {
    const index = Math.max(0, Math.min(ORIGINAL_LUMINOUS_POWER_TO_LUMINANCE.length - 1, Math.floor(power)));
    return ORIGINAL_LUMINOUS_POWER_TO_LUMINANCE[index] ?? 0;
}

export function getOriginalNormalizedLuminanceForPower(power: number): number {
    return getOriginalLuminancePercentForPower(power) / 100;
}

export function getOriginalPaletteIndexForNormalizedLuminance(normalizedLuminance: number): number {
    const totalLuminancePercent = Math.max(0, Math.min(100, normalizedLuminance * 100));
    const thresholds = ORIGINAL_PALETTE_BRIGHTNESS_THRESHOLDS;
    for (let index = 0; index < thresholds.length; index += 1) {
        if (totalLuminancePercent >= (thresholds[index] ?? 0)) {
            return index;
        }
    }
    return Math.max(0, thresholds.length - 1);
}

export function getOriginalPaletteNormalizedBrightnessForLuminance(normalizedLuminance: number): number {
    const paletteIndex = getOriginalPaletteIndexForNormalizedLuminance(normalizedLuminance);
    const maxPaletteIndex = Math.max(1, ORIGINAL_PALETTE_BRIGHTNESS_THRESHOLDS.length - 1);
    return Number(Math.max(0, Math.min(1, 1 - (paletteIndex / maxPaletteIndex))).toFixed(2));
}

export function getOriginalTorchChargeCount(elapsedMs: number): number {
    if (elapsedMs >= ORIGINAL_TORCH_LIFETIME_MS) return 0;
    const remainingMs = Math.max(0, ORIGINAL_TORCH_LIFETIME_MS - Math.max(0, elapsedMs));
    return Math.max(
        0,
        Math.min(
            ORIGINAL_TORCH_MAX_CHARGES,
            Math.ceil(remainingMs / ORIGINAL_TORCH_CHARGE_DURATION_MS),
        ),
    );
}

export function getOriginalTorchStateIndex(elapsedMs: number): number {
    const chargeCount = getOriginalTorchChargeCount(elapsedMs);
    return ORIGINAL_TORCH_TYPE_PER_CHARGES_COUNT[chargeCount] ?? 0;
}

export function getOriginalTorchNormalizedLuminance(elapsedMs: number): number {
    return getOriginalNormalizedLuminanceForPower(getOriginalTorchChargeCount(elapsedMs));
}

export function getOriginalCreatureInjuryZoneOrder(): readonly OriginalCreatureInjuryZone[] {
    return ORIGINAL_CREATURE_INJURY_ZONE_ORDER;
}

export function mapOriginalCreatureCoverageZonesToWoundSlots(
    hitZones: readonly OriginalCreatureCoverageZone[] | undefined,
): ChampionWoundSlot[] {
    if (!hitZones || hitZones.length === 0) {
        return [ORIGINAL_CREATURE_INJURY_ZONE_TO_WOUND_SLOT.torso];
    }

    const slots = new Set<ChampionWoundSlot>();
    for (const zone of hitZones) {
        if (zone === 'hands') {
            slots.add('rightHand');
            slots.add('leftHand');
            continue;
        }
        const injuryZone = zone as OriginalCreatureInjuryZone;
        slots.add(ORIGINAL_CREATURE_INJURY_ZONE_TO_WOUND_SLOT[injuryZone]);
    }
    return [...slots];
}

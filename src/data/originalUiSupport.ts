import originalUiSupportRuntime from '../assets/runtime/reference/original_ui_support_runtime.json';

type OriginalUiSupportRuntime = {
    paletteBrightnessThresholds: number[];
    luminousPowerToLuminance: number[];
    creatureInjuryMasks: Record<string, number>;
    stringsUsedWhenReincarnating: {
        space: string;
        underscore: string;
    };
    specialCharactersWhenReincarnating: number[];
};

const ORIGINAL_UI_SUPPORT = originalUiSupportRuntime as OriginalUiSupportRuntime;

export const ORIGINAL_PALETTE_BRIGHTNESS_THRESHOLDS = ORIGINAL_UI_SUPPORT.paletteBrightnessThresholds;
export const ORIGINAL_LUMINOUS_POWER_TO_LUMINANCE = ORIGINAL_UI_SUPPORT.luminousPowerToLuminance;
export const ORIGINAL_CREATURE_INJURY_MASKS = ORIGINAL_UI_SUPPORT.creatureInjuryMasks;
export const ORIGINAL_REINCARNATION_STRINGS = ORIGINAL_UI_SUPPORT.stringsUsedWhenReincarnating;
export const ORIGINAL_REINCARNATION_SPECIAL_CHARACTERS = ORIGINAL_UI_SUPPORT.specialCharactersWhenReincarnating;

export function getOriginalLuminancePercentForPower(power: number): number {
    const index = Math.max(0, Math.min(ORIGINAL_LUMINOUS_POWER_TO_LUMINANCE.length - 1, Math.floor(power)));
    return ORIGINAL_LUMINOUS_POWER_TO_LUMINANCE[index] ?? 0;
}

export function getOriginalNormalizedLuminanceForPower(power: number): number {
    return getOriginalLuminancePercentForPower(power) / 100;
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    ORIGINAL_CREATURE_INJURY_MASKS,
    ORIGINAL_LUMINOUS_POWER_TO_LUMINANCE,
    ORIGINAL_ORDERED_POSITIONS_TO_ATTACK,
    ORIGINAL_PALETTE_BRIGHTNESS_THRESHOLDS,
    ORIGINAL_REINCARNATION_SPECIAL_CHARACTERS,
    ORIGINAL_REINCARNATION_STRINGS,
    ORIGINAL_TORCH_LIFETIME_MS,
    ORIGINAL_TORCH_TYPE_PER_CHARGES_COUNT,
    getOriginalNormalizedLuminanceForPower,
    getOriginalPaletteIndexForNormalizedLuminance,
    getOriginalPaletteNormalizedBrightnessForLuminance,
    getOriginalCreatureInjuryZoneOrder,
    getOriginalTorchChargeCount,
    getOriginalTorchNormalizedLuminance,
    getOriginalTorchStateIndex,
    mapOriginalCreatureCoverageZonesToWoundSlots,
} from '../src/data/originalUiSupport.js';
import {
    I562_REINCARNATE_SPECIAL_CHARACTERS,
    I562_RENAME_CHAMPION_INPUT_CHARACTER_STRING,
    I562_UNDERSCORE_CHARACTER_STRING,
} from '../src/data/items.js';
import { getOriginalSpellBrightnessSteps, getOriginalSpellLightContribution } from '../src/data/originalSpells.js';

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

const ORIGINAL_UI_SUPPORT_PATH = `${process.cwd()}\\src\\assets\\runtime\\reference\\original_ui_support_runtime.json`;

function readOriginalUiSupport(): OriginalUiSupportRuntime {
    return JSON.parse(readFileSync(ORIGINAL_UI_SUPPORT_PATH, 'utf8')) as OriginalUiSupportRuntime;
}

function decodeZeroTerminatedAscii(values: readonly number[]): string {
    return String.fromCharCode(...values.filter((value) => value > 0));
}

test('original UI support runtime module stays aligned with the packaged support reference', () => {
    const reference = readOriginalUiSupport();
    assert.deepEqual(ORIGINAL_PALETTE_BRIGHTNESS_THRESHOLDS, reference.paletteBrightnessThresholds);
    assert.deepEqual(ORIGINAL_LUMINOUS_POWER_TO_LUMINANCE, reference.luminousPowerToLuminance);
    assert.deepEqual(ORIGINAL_TORCH_TYPE_PER_CHARGES_COUNT, reference.torchTypePerChargesCount);
    assert.deepEqual(ORIGINAL_CREATURE_INJURY_MASKS, reference.creatureInjuryMasks);
    assert.deepEqual(ORIGINAL_ORDERED_POSITIONS_TO_ATTACK, reference.orderedPositionsToAttack);
    assert.deepEqual(ORIGINAL_REINCARNATION_STRINGS, reference.stringsUsedWhenReincarnating);
    assert.deepEqual(ORIGINAL_REINCARNATION_SPECIAL_CHARACTERS, reference.specialCharactersWhenReincarnating);
});

test('original spell light contributions use the canonical luminance lookup table', () => {
    const lightRunes = ['lo', 'oh', 'ir', 'ra'];
    const darknessRunes = ['lo', 'des', 'ir', 'sar'];
    const lightSteps = getOriginalSpellBrightnessSteps(lightRunes);
    const darknessSteps = getOriginalSpellBrightnessSteps(darknessRunes);

    assert.equal(
        getOriginalSpellLightContribution(lightRunes),
        getOriginalNormalizedLuminanceForPower(lightSteps),
    );
    assert.equal(
        getOriginalSpellLightContribution(darknessRunes),
        -getOriginalNormalizedLuminanceForPower(Math.abs(darknessSteps)),
    );
});

test('torch runtime helpers use the canonical charge-count and luminance tables', () => {
    assert.equal(getOriginalTorchChargeCount(0), 15);
    assert.equal(getOriginalTorchChargeCount(7 * 60_000), 8);
    assert.equal(getOriginalTorchChargeCount(8 * 60_000), 7);
    assert.equal(getOriginalTorchChargeCount(12 * 60_000), 3);
    assert.equal(getOriginalTorchChargeCount(ORIGINAL_TORCH_LIFETIME_MS), 0);

    assert.equal(getOriginalTorchStateIndex(0), 3);
    assert.equal(getOriginalTorchStateIndex(8 * 60_000), 2);
    assert.equal(getOriginalTorchStateIndex(12 * 60_000), 1);
    assert.equal(getOriginalTorchStateIndex(ORIGINAL_TORCH_LIFETIME_MS), 0);

    assert.equal(
        getOriginalTorchNormalizedLuminance(8 * 60_000),
        getOriginalNormalizedLuminanceForPower(7),
    );
});

test('palette brightness helpers quantize luminance using the canonical palette thresholds', () => {
    assert.equal(getOriginalPaletteIndexForNormalizedLuminance(1), 0);
    assert.equal(getOriginalPaletteIndexForNormalizedLuminance(0.99), 0);
    assert.equal(getOriginalPaletteIndexForNormalizedLuminance(0.75), 1);
    assert.equal(getOriginalPaletteIndexForNormalizedLuminance(0.5), 2);
    assert.equal(getOriginalPaletteIndexForNormalizedLuminance(0.25), 3);
    assert.equal(getOriginalPaletteIndexForNormalizedLuminance(0.01), 4);
    assert.equal(getOriginalPaletteIndexForNormalizedLuminance(0), 5);

    assert.equal(getOriginalPaletteNormalizedBrightnessForLuminance(1), 1);
    assert.equal(getOriginalPaletteNormalizedBrightnessForLuminance(0.51), 0.6);
    assert.equal(getOriginalPaletteNormalizedBrightnessForLuminance(0.24), 0.2);
    assert.equal(getOriginalPaletteNormalizedBrightnessForLuminance(0), 0);
});

test('reincarnation support constants stay consistent between ui support and i562 runtime consumers', () => {
    assert.equal(
        decodeZeroTerminatedAscii([...I562_UNDERSCORE_CHARACTER_STRING]),
        ORIGINAL_REINCARNATION_STRINGS.underscore,
    );
    assert.equal(
        decodeZeroTerminatedAscii([...I562_RENAME_CHAMPION_INPUT_CHARACTER_STRING]),
        ORIGINAL_REINCARNATION_STRINGS.space,
    );
    assert.deepEqual(
        [...I562_REINCARNATE_SPECIAL_CHARACTERS],
        ORIGINAL_REINCARNATION_SPECIAL_CHARACTERS,
    );
});

test('creature injury support helpers consume the canonical injury-mask table', () => {
    const reference = readOriginalUiSupport();
    const expectedZoneOrder = Object.entries(reference.creatureInjuryMasks)
        .sort((left, right) => right[1] - left[1])
        .map(([zone]) => zone);

    assert.deepEqual(getOriginalCreatureInjuryZoneOrder(), expectedZoneOrder);
    assert.deepEqual(mapOriginalCreatureCoverageZonesToWoundSlots(undefined), ['torso']);
    assert.deepEqual(
        mapOriginalCreatureCoverageZonesToWoundSlots(['feet', 'hands', 'head', 'hands']),
        ['feet', 'rightHand', 'leftHand', 'head'],
    );
});

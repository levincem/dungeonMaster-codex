import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    ORIGINAL_CREATURE_INJURY_MASKS,
    ORIGINAL_LUMINOUS_POWER_TO_LUMINANCE,
    ORIGINAL_PALETTE_BRIGHTNESS_THRESHOLDS,
    ORIGINAL_REINCARNATION_SPECIAL_CHARACTERS,
    ORIGINAL_REINCARNATION_STRINGS,
    getOriginalNormalizedLuminanceForPower,
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
    creatureInjuryMasks: Record<string, number>;
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
    assert.deepEqual(ORIGINAL_CREATURE_INJURY_MASKS, reference.creatureInjuryMasks);
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

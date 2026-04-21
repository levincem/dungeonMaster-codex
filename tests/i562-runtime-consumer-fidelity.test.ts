import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    I562_DROP_ORDER,
    I562_REINCARNATE_SPECIAL_CHARACTERS,
    I562_RENAME_CHAMPION_INPUT_CHARACTER_STRING,
    I562_UNDERSCORE_CHARACTER_STRING,
    I562_WOUND_DEFENSE_FACTORS,
} from '../src/data/items.js';
import { getOriginalWoundSlotFactor } from '../src/engine/systems/originalWoundDefense.js';

type SourceGameDbItems = {
    originalAtari?: {
        i562?: {
            woundDefenseFactors?: number[];
            dropOrder?: number[];
            underscoreCharacterString?: number[];
            renameChampionInputCharacterString?: number[];
            reincarnateSpecialCharacters?: number[];
        };
    };
};

const SOURCE_EXTRACTION_GAME_DB_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\output\\game_db.json`;
const SOURCE_GAME_DB_ITEMS_PATH = `${process.cwd()}\\src\\assets\\runtime\\db\\game_db_items.json`;

function readSourceGameDbItems(): SourceGameDbItems {
    return JSON.parse(readFileSync(SOURCE_GAME_DB_ITEMS_PATH, 'utf8')) as SourceGameDbItems;
}

function readExtractedGameDbItems(): SourceGameDbItems {
    return JSON.parse(readFileSync(SOURCE_EXTRACTION_GAME_DB_PATH, 'utf8')) as SourceGameDbItems;
}

test('runtime I562 wound defense factors stay aligned with the packaged game_db i562 slice', () => {
    const expected = readSourceGameDbItems().originalAtari?.i562?.woundDefenseFactors ?? [];
    assert.deepEqual([...I562_WOUND_DEFENSE_FACTORS], expected);
});

test('runtime I562 drop order stays aligned with the packaged game_db i562 slice', () => {
    const expected = readSourceGameDbItems().originalAtari?.i562?.dropOrder ?? [];
    assert.deepEqual([...I562_DROP_ORDER], expected);
});

test('packaged game_db items slice preserves the extracted I562 drop order', () => {
    const extracted = readExtractedGameDbItems().originalAtari?.i562?.dropOrder ?? [];
    const packaged = readSourceGameDbItems().originalAtari?.i562?.dropOrder ?? [];
    assert.deepEqual(packaged, extracted);
});

test('packaged game_db items slice preserves the extracted I562 support-character arrays', () => {
    const extracted = readExtractedGameDbItems().originalAtari?.i562 ?? {};
    const packaged = readSourceGameDbItems().originalAtari?.i562 ?? {};
    assert.deepEqual(packaged.underscoreCharacterString ?? [], extracted.underscoreCharacterString ?? []);
    assert.deepEqual(packaged.renameChampionInputCharacterString ?? [], extracted.renameChampionInputCharacterString ?? []);
    assert.deepEqual(packaged.reincarnateSpecialCharacters ?? [], extracted.reincarnateSpecialCharacters ?? []);
});

test('runtime item module preserves the packaged I562 support-character arrays', () => {
    const packaged = readSourceGameDbItems().originalAtari?.i562 ?? {};
    assert.deepEqual([...I562_UNDERSCORE_CHARACTER_STRING], packaged.underscoreCharacterString ?? []);
    assert.deepEqual([...I562_RENAME_CHAMPION_INPUT_CHARACTER_STRING], packaged.renameChampionInputCharacterString ?? []);
    assert.deepEqual([...I562_REINCARNATE_SPECIAL_CHARACTERS], packaged.reincarnateSpecialCharacters ?? []);
});

test('original wound slot factor mapping preserves the exact original i562 slot order', () => {
    const factors = [...I562_WOUND_DEFENSE_FACTORS];
    assert.equal(getOriginalWoundSlotFactor('rightHand', factors), factors[0] ?? 0);
    assert.equal(getOriginalWoundSlotFactor('leftHand', factors), factors[1] ?? 0);
    assert.equal(getOriginalWoundSlotFactor('head', factors), factors[2] ?? 0);
    assert.equal(getOriginalWoundSlotFactor('torso', factors), factors[3] ?? 0);
    assert.equal(getOriginalWoundSlotFactor('legs', factors), factors[4] ?? 0);
    assert.equal(getOriginalWoundSlotFactor('feet', factors), factors[5] ?? 0);
});

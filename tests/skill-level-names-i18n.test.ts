import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTranslations } from '../src/i18n/index.js';

test('skill level names keep the original early rank order in english and french', () => {
    const english = getTranslations('en').championSheet.skillLevelNames.slice(1, 4);
    const french = getTranslations('fr').championSheet.skillLevelNames.slice(1, 4);

    assert.deepEqual(english, ['Neophyte', 'Novice', 'Apprentice']);
    assert.deepEqual(french, ['Neophyte', 'Novice', 'Apprenti']);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTranslations } from '../src/i18n/index.js';

test('skill level names keep the original rank table in english and french', () => {
    const english = getTranslations('en').championSheet.skillLevelNames;
    const french = getTranslations('fr').championSheet.skillLevelNames;

    assert.deepEqual(english, [
        'Neophyte',
        'Novice',
        'Apprentice',
        'Journeyman',
        'Craftsman',
        'Artisan',
        'Adept',
        'Expert',
        'Lo (1) Master',
        'Um (2) Master',
        'On (3) Master',
        'Ee (4) Master',
        'Pal (5) Master',
        'Mon (6) Master',
        'Archmaster',
    ]);
    assert.deepEqual(french, [
        'Neophyte',
        'Novice',
        'Apprenti',
        'Compagnon',
        'Artisan',
        'Patron',
        'Adepte',
        'Expert',
        'Maitre Lo (1)',
        'Maitre Um (2)',
        'Maitre On (3)',
        'Maitre Ee (4)',
        'Maitre Pal (5)',
        'Maitre Mon (6)',
        'Sur-maitre',
    ]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    ITEM_IMAGE_NAME_ALIASES,
    LEGACY_ARMOR_TYPE_IMAGE_MAP,
    LEGACY_CONTAINER_TYPE_IMAGE_MAP,
    LEGACY_MISC_TYPE_IMAGE_MAP,
    LEGACY_POTION_TYPE_IMAGE_MAP,
    LEGACY_WEAPON_TYPE_IMAGE_MAP,
} from '../src/data/itemImageCompatibility.js';

test('item image aliases keep only friendly potion labels that do not match shipped filenames directly', () => {
    assert.equal(ITEM_IMAGE_NAME_ALIASES['health potion'], 'vi_potion.png');
    assert.equal(ITEM_IMAGE_NAME_ALIASES.antidote, 'bro_potion_antivenin.png');
    assert.equal(ITEM_IMAGE_NAME_ALIASES['shield potion'], 'ya_potion.png');
    assert.equal(ITEM_IMAGE_NAME_ALIASES.flamitt, 'flamitt_empty.png');
    assert.equal(ITEM_IMAGE_NAME_ALIASES.robe, 'robe_body.png');
    assert.equal(ITEM_IMAGE_NAME_ALIASES.zokathra, 'zokathra_spell.png');
    assert.equal(ITEM_IMAGE_NAME_ALIASES.chest, 'chest_closed.png');

    assert.equal(Object.hasOwn(ITEM_IMAGE_NAME_ALIASES, 'ven potion'), false);
    assert.equal(Object.hasOwn(ITEM_IMAGE_NAME_ALIASES, 'ful bomb'), false);
    assert.equal(Object.hasOwn(ITEM_IMAGE_NAME_ALIASES, 'empty flask'), false);
    assert.equal(Object.hasOwn(ITEM_IMAGE_NAME_ALIASES, 'water flask'), false);
    assert.equal(Object.hasOwn(ITEM_IMAGE_NAME_ALIASES, 'the firestaff (complete)'), false);
    assert.equal(Object.hasOwn(ITEM_IMAGE_NAME_ALIASES, 'the firestaff complete'), false);
});

test('legacy image maps keep only ids that still cannot be resolved by canonical names or aliases', () => {
    assert.equal(Object.hasOwn(LEGACY_WEAPON_TYPE_IMAGE_MAP, 0), false);
    assert.equal(Object.hasOwn(LEGACY_WEAPON_TYPE_IMAGE_MAP, 2), false);
    assert.equal(Object.hasOwn(LEGACY_WEAPON_TYPE_IMAGE_MAP, 13), false);
    assert.equal(Object.hasOwn(LEGACY_WEAPON_TYPE_IMAGE_MAP, 63), false);
    assert.deepEqual(
        Object.keys(LEGACY_WEAPON_TYPE_IMAGE_MAP).sort(),
        ['33', '48', '49', '50', '56'],
    );

    assert.deepEqual(LEGACY_ARMOR_TYPE_IMAGE_MAP, {});

    assert.equal(Object.hasOwn(LEGACY_POTION_TYPE_IMAGE_MAP, 3), false);
    assert.equal(Object.hasOwn(LEGACY_POTION_TYPE_IMAGE_MAP, 14), false);
    assert.equal(Object.hasOwn(LEGACY_POTION_TYPE_IMAGE_MAP, 15), false);
    assert.equal(Object.hasOwn(LEGACY_POTION_TYPE_IMAGE_MAP, 20), false);
    assert.equal(LEGACY_POTION_TYPE_IMAGE_MAP[10], 'bro_potion_antivenin.png');
    assert.equal(LEGACY_POTION_TYPE_IMAGE_MAP[13], 'ee_potion_mana.png');

    assert.equal(Object.hasOwn(LEGACY_MISC_TYPE_IMAGE_MAP, 1), false);
    assert.equal(Object.hasOwn(LEGACY_MISC_TYPE_IMAGE_MAP, 17), false);
    assert.equal(Object.hasOwn(LEGACY_MISC_TYPE_IMAGE_MAP, 51), false);
    assert.deepEqual(LEGACY_MISC_TYPE_IMAGE_MAP, { 52: 'cross_key.png' });

    assert.deepEqual(LEGACY_CONTAINER_TYPE_IMAGE_MAP, {});
});

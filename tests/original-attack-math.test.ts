import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    adjustOriginalAttackByAttribute,
    getOriginalAttackAdjustedByResistance,
    getOriginalPsychicAdjustedAttack,
    scaleOriginalAttackValue,
} from '../src/engine/systems/originalAttackMath.js';

test('adjustOriginalAttackByAttribute follows the original low-end floor rule', () => {
    assert.equal(adjustOriginalAttackByAttribute(80, 170), 10);
    assert.equal(adjustOriginalAttackByAttribute(80, 160), 10);
    assert.equal(adjustOriginalAttackByAttribute(80, 100), 43);
});

test('scaleOriginalAttackValue clamps negative attack input before scaling', () => {
    assert.equal(scaleOriginalAttackValue(-10, 6, 64), 0);
    assert.equal(scaleOriginalAttackValue(96, 6, 80), 120);
});

test('getOriginalPsychicAdjustedAttack reduces attack from wisdom and bottoms at zero', () => {
    assert.equal(getOriginalPsychicAdjustedAttack(64, 15), 100);
    assert.equal(getOriginalPsychicAdjustedAttack(64, 120), 0);
});

test('getOriginalAttackAdjustedByResistance routes fire, magic and mental through the right stats', () => {
    const stats = { antiFire: 20, antiMagic: 40, wisdom: 60 };
    assert.equal(getOriginalAttackAdjustedByResistance(80, 'physical', stats), 80);
    assert.equal(getOriginalAttackAdjustedByResistance(80, 'fire', stats), adjustOriginalAttackByAttribute(80, 20));
    assert.equal(getOriginalAttackAdjustedByResistance(80, 'magic', stats), adjustOriginalAttackByAttribute(80, 40));
    assert.equal(getOriginalAttackAdjustedByResistance(80, 'mental', stats), adjustOriginalAttackByAttribute(80, 60));
});

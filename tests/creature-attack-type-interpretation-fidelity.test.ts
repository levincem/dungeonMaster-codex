import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    CREATURE_TYPES,
    ORIGINAL_CREATURE_ATTACK_TYPE_INTERPRETATIONS,
    ORIGINAL_CREATURE_BASE_ATTACK_TYPE_MAP,
} from '../src/data/creatures.js';

test('creature attack type interpretations stay explicit and bounded to the documented special cases', () => {
    assert.deepEqual(ORIGINAL_CREATURE_ATTACK_TYPE_INTERPRETATIONS, {
        2: ['Physical', 'Steal'],
        5: ['Physical', 'Rust'],
        8: ['StaminaDrain'],
        13: ['Physical', 'Poison'],
        14: ['Magic', 'Physical'],
        15: ['Physical', 'Poison'],
        17: ['Physical', 'Poison'],
        19: ['Magic', 'Physical'],
        21: ['Physical', 'Magic'],
        22: ['Physical', 'Fire'],
        23: ['Magic', 'Physical', 'Fire'],
        24: ['Fire', 'Physical'],
        25: ['Physical', 'Magic'],
        26: ['Physical', 'Magic'],
    });
});

test('creatures without a special interpretation keep the direct attack-type mapping from the source-backed original attack type', () => {
    for (const [typeIdText, def] of Object.entries(CREATURE_TYPES)) {
        const typeId = Number(typeIdText);
        if (ORIGINAL_CREATURE_ATTACK_TYPE_INTERPRETATIONS[typeId]) continue;
        assert.deepEqual(
            def.attackTypes,
            ORIGINAL_CREATURE_BASE_ATTACK_TYPE_MAP[def.originalAttackType],
            `creature ${typeId} attackTypes should follow the base mapping for ${def.originalAttackType}`,
        );
    }
});

test('special creature attack interpretations stay aligned with the runtime creature table', () => {
    for (const [typeIdText, attackTypes] of Object.entries(ORIGINAL_CREATURE_ATTACK_TYPE_INTERPRETATIONS)) {
        const typeId = Number(typeIdText);
        assert.deepEqual(
            CREATURE_TYPES[typeId]?.attackTypes,
            attackTypes,
            `creature ${typeId} special attack interpretation drifted`,
        );
    }
});

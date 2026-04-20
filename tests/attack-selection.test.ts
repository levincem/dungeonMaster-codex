import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAttackSelection } from '../src/engine/systems/attackSelection.js';
import type { WeaponAttackOption } from '../src/data/weaponAttacks.js';

function createAttack(
    overrides: Partial<WeaponAttackOption> = {},
): WeaponAttackOption {
    return {
        attackType: 1,
        enumName: 'Melee',
        displayName: 'Swing',
        requiresCharges: false,
        masteryThreshold: 0,
        source: 'primary',
        attack: {
            index: 1,
            enumName: 'Melee',
            displayName: 'Swing',
            experienceForAttacking: 5,
            skillNumber: 0,
            defenseModifier: 0,
            staminaCost: 5,
            strengthRequired: 0,
            baseDamage: 10,
            disableTime: 10,
        },
        ...overrides,
    };
}

test('resolveAttackSelection chooses the first usable attack by default', () => {
    const result = resolveAttackSelection(
        { availableAttacks: [createAttack()] },
        {
            getMasteryLevel: () => 10,
            hasCompatibleAmmo: () => true,
            isAttackUsableAtMastery: () => true,
            getAttackUnusableReason: () => null,
            isShootAttack: () => false,
        },
    );

    assert.ok(result.availableAttacks.length > 0);
    assert.ok(result.selectedAttack);
    assert.equal(result.blockedMessage, undefined);
});

test('resolveAttackSelection reports unusable mastery-gated attacks', () => {
    const result = resolveAttackSelection(
        { availableAttacks: [createAttack({ attackType: 2, displayName: 'Hack' })], attackType: 2 },
        {
            getMasteryLevel: () => 0,
            hasCompatibleAmmo: () => true,
            isAttackUsableAtMastery: () => false,
            getAttackUnusableReason: () => 'maitrise insuffisante',
            isShootAttack: () => false,
        },
    );

    assert.ok(result.selectedAttack);
    assert.match(result.blockedMessage ?? '', /unavailable/i);
});

test('resolveAttackSelection blocks ranged attacks without compatible ammo', () => {
    const result = resolveAttackSelection(
        {
            availableAttacks: [createAttack({
                attackType: 3,
                enumName: 'Shoot',
                displayName: 'Shoot',
            })],
        },
        {
            getMasteryLevel: () => 10,
            hasCompatibleAmmo: () => false,
            isAttackUsableAtMastery: () => true,
            getAttackUnusableReason: () => null,
            isShootAttack: (option) => option?.enumName === 'Shoot',
        },
    );

    assert.equal(result.selectedAttack?.attackType !== undefined, true);
    assert.equal(result.blockedMessage, 'No compatible ammunition in the quiver.');
});

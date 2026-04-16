import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCreatureRuntimeStateArgs, resolveCreatureRuntimeState } from '../src/engine/systems/creatureRuntimeState.js';

test('resolveCreatureRuntimeState derives active control flags from expiration times', () => {
    const result = resolveCreatureRuntimeState({
        nowMs: 1000,
        confusedUntilMs: 1200,
        fluxcageUntilMs: 900,
        frightenedUntilMs: 1500,
        attackRange: 1,
        preferBackRow: false,
        nonMaterial: false,
        levitates: false,
        attackTypes: [],
    });

    assert.equal(result.confused, true);
    assert.equal(result.fluxcaged, false);
    assert.equal(result.frightened, true);
    assert.equal(result.attackReach, 1);
    assert.equal(result.prefersRangedSpacing, false);
});

test('resolveCreatureRuntimeState enables ranged spacing for magical ranged creatures', () => {
    const result = resolveCreatureRuntimeState({
        nowMs: 1000,
        confusedUntilMs: 0,
        fluxcageUntilMs: 0,
        frightenedUntilMs: 0,
        attackRange: 4,
        preferBackRow: false,
        nonMaterial: false,
        levitates: false,
        attackTypes: ['Magic'],
    });

    assert.equal(result.attackReach, 4);
    assert.equal(result.prefersRangedSpacing, true);
});

test('buildCreatureRuntimeStateArgs maps creature defs into runtime arguments', () => {
    const result = buildCreatureRuntimeStateArgs(
        {
            id: 1,
            name: 'Mock',
            sizeOnTile: 0,
            baseHP: 10,
            armor: 0,
            hitProb: 0,
            atkSpd: 8,
            moveSpd: 8,
            exp: 0,
            poison: false,
            originalAttackType: 'Blunt',
            attackTypes: ['Magic'],
            drops: [],
            fixedDrops: [],
            rawAttack: 10,
            poisonAttack: 0,
            dexterity: 10,
            fireResistance: 0,
            poisonResistance: 0,
            nonMaterial: true,
            attackAnyChampion: false,
            attackFromAllSides: false,
            attackRange: 3,
            sightRange: 8,
            preferBackRow: true,
            levitates: true,
            absorbMissiles: false,
            seeInvisible: false,
            fearResistance: 0,
            archenemy: false,
        },
        1000,
        {
            confusedUntilMs: 1100,
            fluxcageUntilMs: 1200,
            frightenedUntilMs: 1300,
        },
    );

    assert.deepEqual(result, {
        nowMs: 1000,
        confusedUntilMs: 1100,
        fluxcageUntilMs: 1200,
        frightenedUntilMs: 1300,
        attackRange: 3,
        preferBackRow: true,
        nonMaterial: true,
        levitates: true,
        attackTypes: ['Magic'],
    });
});

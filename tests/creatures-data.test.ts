import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CREATURE_TYPES } from '../src/data/creatures.js';

test('CREATURE_TYPES prefer direct I559 core stats when available', () => {
    const giggler = CREATURE_TYPES[2];

    assert.ok(giggler);
    assert.equal(giggler.baseHP, 10);
    assert.equal(giggler.armor, 50);
    assert.equal(giggler.hitProb, 110);
    assert.equal(giggler.atkSpd, 5);
    assert.equal(giggler.moveSpd, 3);
    assert.equal(giggler.originalAttackType, 'Unconditional');
    assert.equal(giggler.exp, 15);
});

test('CREATURE_TYPES decode direct attack type and poison flags from I559 payload', () => {
    const giantScorpion = CREATURE_TYPES[0];
    const screamer = CREATURE_TYPES[6];

    assert.ok(giantScorpion);
    assert.equal(giantScorpion.originalAttackType, 'Sharp');
    assert.equal(giantScorpion.poison, true);

    assert.ok(screamer);
    assert.equal(screamer.baseHP, 165);
    assert.equal(screamer.originalAttackType, 'Mental');
    assert.equal(screamer.poison, false);
});

test('CREATURE_TYPES keep the source-backed mummy combat profile from the extracted runtime DB', () => {
    const mummy = CREATURE_TYPES[10];

    assert.ok(mummy);
    assert.equal(mummy.baseHP, 33);
    assert.equal(mummy.armor, 25);
    assert.equal(mummy.hitProb, 40);
    assert.equal(mummy.atkSpd, 12);
    assert.equal(mummy.moveSpd, 17);
    assert.equal(mummy.rawAttack, 20);
    assert.equal(mummy.dexterity, 40);
    assert.equal(mummy.attackRange, 1);
});

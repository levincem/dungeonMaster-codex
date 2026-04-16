import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildBlockedSpellProjectilePatch,
    resolveBlockedSpellProjectileConsequences,
} from '../src/engine/systems/blockedSpellProjectile.js';

test('buildBlockedSpellProjectilePatch prefers backlash state when present', () => {
    const patch = buildBlockedSpellProjectilePatch({
        nextChampionVitals: { 1: { hp: 20 } } as never,
        blockedPoisonCloud: null,
        backlash: {
            championVitals: { 1: { hp: 12 } } as never,
            damageEvents: [{ id: 'dmg', level: 0, target: 'champion', championId: 1, amount: 8, ts: 100 }],
            party: [{ id: 1 }] as never,
            floorItems: [{ id: 'item' }] as never,
            championInventories: { 1: [] },
            championEquipment: { 1: {} },
            deadChampions: { 1: { id: 1 } } as never,
            selectedChampionIndex: 0,
        } as never,
        currentSpellVisualEvents: [],
        blockedImpactEvent: {
            id: 'impact',
            level: 0,
            x: 1,
            y: 2,
            effect: 'fireball',
            ts: 100,
            kind: 'wall',
        },
        currentActivePoisonClouds: [],
    });

    assert.deepEqual(patch.championVitals, { 1: { hp: 12 } });
    assert.equal(patch.damageEvents?.length, 1);
    assert.equal(patch.spellVisualEvents.length, 1);
});

test('buildBlockedSpellProjectilePatch appends blocked poison clouds when no backlash is used', () => {
    const patch = buildBlockedSpellProjectilePatch({
        nextChampionVitals: { 1: { hp: 20 } } as never,
        blockedPoisonCloud: { id: 'cloud' } as never,
        backlash: null,
        currentSpellVisualEvents: [],
        blockedImpactEvent: {
            id: 'impact',
            level: 0,
            x: 1,
            y: 2,
            effect: 'poison_cloud',
            ts: 100,
            kind: 'wall',
        },
        currentActivePoisonClouds: [{ id: 'existing' }] as never,
    });

    assert.deepEqual(patch.championVitals, { 1: { hp: 20 } });
    assert.deepEqual(patch.activePoisonClouds, [{ id: 'existing' }, { id: 'cloud' }]);
    assert.equal(patch.spellVisualEvents.length, 1);
});

test('resolveBlockedSpellProjectileConsequences builds a blocked poison cloud without backlash', () => {
    const poisonCloud = { id: 'cloud', remainingAttack: 42 } as never;
    const result = resolveBlockedSpellProjectileConsequences({
        spellEffect: 'poison_cloud',
        level: 1,
        x: 2,
        y: 3,
        visualScale: 0.75,
        projectileAttack: 99,
        elapsedGameTimeTicks: 120,
        projectileDamage: { min: 4, max: 8 },
        initialRange: 0,
        buildBlockedPoisonCloud: (_level, _x, _y, _attack, _elapsedGameTimeTicks, scaledVisual) => {
            assert.equal(scaledVisual, 0.75 * 1.08);
            return poisonCloud;
        },
        rollSourceBackedImpactDamage: () => {
            throw new Error('source-backed impact damage should not be requested for poison clouds');
        },
        rollRandomDamage: () => {
            throw new Error('random damage should not be requested for poison clouds');
        },
        applyBacklash: () => {
            throw new Error('backlash should not be applied when a poison cloud is spawned');
        },
    });

    assert.equal(result.blockedPoisonCloud, poisonCloud);
    assert.equal(result.backlash, null);
});

test('resolveBlockedSpellProjectileConsequences prefers source-backed damage before backlash', () => {
    const result = resolveBlockedSpellProjectileConsequences({
        spellEffect: 'fireball',
        level: 1,
        x: 2,
        y: 3,
        visualScale: 1,
        projectileAttack: 99,
        elapsedGameTimeTicks: 120,
        projectileDamage: { min: 4, max: 8 },
        initialRange: 6,
        buildBlockedPoisonCloud: () => {
            throw new Error('poison cloud builder should not be called for fireball');
        },
        rollSourceBackedImpactDamage: (initialRange) => {
            assert.equal(initialRange, 6);
            return 13;
        },
        rollRandomDamage: () => {
            throw new Error('fallback random damage should not be used when source damage is available');
        },
        applyBacklash: (rolledDamage) => {
            assert.equal(rolledDamage, 13);
            return { championVitals: { 1: { hp: 9 } } } as never;
        },
    });

    assert.equal(result.blockedPoisonCloud, null);
    assert.deepEqual(result.backlash, { championVitals: { 1: { hp: 9 } } });
});

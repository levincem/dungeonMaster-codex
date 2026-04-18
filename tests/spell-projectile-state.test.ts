import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SpellDef } from '../src/data/runes.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import { buildProjectileSpellStatePatch } from '../src/engine/systems/spellProjectileState.js';

function createVitals(overrides: Partial<ChampionVitals> = {}): ChampionVitals {
    return {
        hp: 30,
        stamina: 40,
        mana: 20,
        food: 500,
        water: 500,
        currentStats: {
            luck: 10,
            strength: 10,
            dexterity: 10,
            wisdom: 10,
            vitality: 10,
            antiMagic: 0,
            antiFire: 0,
        },
        wounds: {
            rightHand: false,
            leftHand: false,
            head: false,
            torso: false,
            legs: false,
            feet: false,
        },
        poisonEntries: [],
        ...overrides,
    };
}

test('buildProjectileSpellStatePatch appends a launched projectile when the path is clear', () => {
    const spell = {
        runes: ['ful', 'ir'],
        name: 'Fireball',
        effect: 'fireball',
        manaCost: 8,
        manaBase: 4,
        castSkill: 'wizard',
        description: 'Fireball',
    } as SpellDef;

    const result = buildProjectileSpellStatePatch(
        {
            spell,
            championId: 1,
            level: 0,
            position: [5, 5],
            direction: 'NORTH',
            now: 1000,
            skillLevel: 4,
            maxMana: 40,
            elapsedGameTimeTicks: 10,
            nextVitals: createVitals({ mana: 12 }),
            currentChampionVitals: { 1: createVitals() },
            currentSpellVisualEvents: [],
            currentOpenDoors: new Set<string>(),
            currentProjectiles: [],
            currentActivePoisonClouds: [],
        },
        {
            projectileAttack: 32,
            projectileStepMs: 150,
            gridSize: 2,
            getImmediateDoor: () => null,
            isImmediatelyBlocked: () => false,
            buildBlockedPoisonCloud: () => { throw new Error('unexpected blocked cloud'); },
            rollSourceBackedImpactDamage: () => null,
            rollRandomDamage: () => 0,
            applyBacklash: () => null,
        },
    );

    assert.equal(result.patch.championVitals[1]?.mana, 12);
    assert.equal(result.patch.projectiles?.length, 1);
    assert.equal(result.patch.projectiles?.[0]?.effect, 'fireball');
    assert.deepEqual(
        [result.patch.projectiles?.[0]?.x, result.patch.projectiles?.[0]?.y],
        [5, 5],
    );
    assert.equal(result.shouldPlayDoorMotion, undefined);
});

test('buildProjectileSpellStatePatch resolves immediate open-door impacts and requests door audio', () => {
    const spell = {
        runes: ['zo', 'bro'],
        name: 'Open',
        effect: 'open',
        manaCost: 3,
        manaBase: 2,
        castSkill: 'priest',
        description: 'Open',
    } as SpellDef;

    const result = buildProjectileSpellStatePatch(
        {
            spell,
            championId: 1,
            level: 0,
            position: [4, 4],
            direction: 'EAST',
            now: 2000,
            skillLevel: 3,
            maxMana: 30,
            elapsedGameTimeTicks: 10,
            nextVitals: createVitals({ mana: 17 }),
            currentChampionVitals: { 1: createVitals() },
            currentSpellVisualEvents: [],
            currentOpenDoors: new Set<string>(),
            currentProjectiles: [],
            currentActivePoisonClouds: [],
        },
        {
            projectileAttack: 32,
            projectileStepMs: 150,
            gridSize: 2,
            getImmediateDoor: () => ({ key: '0,4,5', door: { hasButton: true } }),
            isImmediatelyBlocked: () => false,
            buildBlockedPoisonCloud: () => { throw new Error('unexpected blocked cloud'); },
            rollSourceBackedImpactDamage: () => null,
            rollRandomDamage: () => 0,
            applyBacklash: () => null,
        },
    );

    assert.equal(result.patch.openDoors?.has('0,4,5'), true);
    assert.equal(result.patch.spellVisualEvents?.length, 1);
    assert.equal(result.shouldPlayDoorMotion, true);
    assert.deepEqual(result.doorMotionSquare, { level: 0, x: 5, y: 4 });
});

test('buildProjectileSpellStatePatch applies blocked open impacts without launching a projectile', () => {
    const spell = {
        runes: ['zo', 'bro'],
        name: 'Open',
        effect: 'open',
        manaCost: 3,
        manaBase: 2,
        castSkill: 'priest',
        description: 'Open',
    } as SpellDef;

    const result = buildProjectileSpellStatePatch(
        {
            spell,
            championId: 1,
            level: 0,
            position: [4, 4],
            direction: 'WEST',
            now: 3000,
            skillLevel: 3,
            maxMana: 30,
            elapsedGameTimeTicks: 10,
            nextVitals: createVitals({ mana: 17 }),
            currentChampionVitals: { 1: createVitals() },
            currentSpellVisualEvents: [],
            currentOpenDoors: new Set<string>(),
            currentProjectiles: [],
            currentActivePoisonClouds: [],
        },
        {
            projectileAttack: 32,
            projectileStepMs: 150,
            gridSize: 2,
            getImmediateDoor: () => null,
            isImmediatelyBlocked: () => true,
            buildBlockedPoisonCloud: () => { throw new Error('unexpected blocked cloud'); },
            rollSourceBackedImpactDamage: () => null,
            rollRandomDamage: () => 0,
            applyBacklash: () => null,
        },
    );

    assert.equal(result.patch.projectiles, undefined);
    assert.equal(result.patch.spellVisualEvents?.length, 1);
    assert.equal(result.patch.championVitals[1]?.mana, 17);
});

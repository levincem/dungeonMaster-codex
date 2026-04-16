import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureInstance, FloorItem } from '../src/types/game.js';
import type {
    ActivePoisonCloud,
    DamageEvent,
    Projectile,
    SpellVisualEvent,
} from '../src/engine/runtimeTypes.js';
import { applyProjectileCreatureHit } from '../src/engine/systems/tickProjectileCreatureHit.js';

function createCreature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
    return {
        id: 'creature-1',
        typeId: 1,
        mapIndex: 0,
        x: 2,
        y: 2,
        currentHP: 12,
        alive: true,
        cell: 'frontLeft',
        ...overrides,
    };
}

function createProjectile(overrides: Partial<Projectile> = {}): Projectile {
    return {
        id: 'proj-1',
        level: 0,
        x: 2,
        y: 2,
        direction: 'NORTH',
        effect: 'fireball',
        damage: [4, 8],
        nextMoveAt: 1000,
        remainingRange: 6,
        remainingAttack: 10,
        visualScale: 1.2,
        ...overrides,
    };
}

function createState(overrides: Partial<{
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    activePoisonClouds: ActivePoisonCloud[];
}> = {}) {
    return {
        creatures: [createCreature()],
        floorItems: [] as FloorItem[],
        damageEvents: [] as DamageEvent[],
        spellVisualEvents: [] as SpellVisualEvent[],
        activePoisonClouds: [] as ActivePoisonCloud[],
        ...overrides,
    };
}

test('applyProjectileCreatureHit damages a creature, drops loot on kill, and emits visuals', () => {
    const hit = createCreature({ currentHP: 6 });
    const result = applyProjectileCreatureHit(
        createProjectile({ effect: 'physical', remainingAttack: 6, physicalItem: { id: 'rock', category: 'Misc', typeId: 1, mapIndex: 0, x: 2, y: 2, tilePos: 'North' } }),
        hit,
        [hit],
        false,
        0,
        2,
        2,
        10,
        1000,
        createState({ creatures: [hit] }),
        {
            rollSourceBackedImpact: () => null,
            getCreaturePoisonAdjustedAttack: (_typeId, attack) => attack,
            rollRandomProjectileDamage: () => 0,
            rollExplosionBurstAttack: () => 0,
            isLikelyNonMaterial: () => false,
            rollDisruptNonMaterialAttack: () => 0,
            dropCreatureCarriedItems: (creatures, floorItems) => ({ creatures, floorItems }),
            buildDeathDustEvent: (level, x, y) => ({
                id: 'dust-1',
                level,
                x,
                y,
                effect: 'fireball',
                ts: 1000,
                kind: 'death',
            }),
            buildCreatureDamageEvent: (level, x, y, amount, creatureId) => ({
                id: 'damage-1',
                level,
                target: 'creature',
                x,
                y,
                amount,
                creatureId,
                ts: 1000,
            }),
            buildLingeringPoisonCloud: () => null,
            buildActivePoisonCloud: () => {
                throw new Error('no active cloud expected');
            },
            getThrownExplosionVisualScale: () => 1.3,
            buildDroppedItem: (item) => item,
            gridSize: 2,
        },
    );

    assert.equal(result.creatures[0]?.alive, false);
    assert.equal(result.damageEvents.length, 1);
    assert.equal(result.spellVisualEvents.length, 1);
    assert.equal(result.spellVisualEvents[0]?.kind, 'death');
});

test('applyProjectileCreatureHit handles disrupt_nonmaterial as an area hit on non-material targets', () => {
    const targetA = createCreature({ id: 'a', currentHP: 10 });
    const targetB = createCreature({ id: 'b', currentHP: 8, cell: 'frontRight' });
    const result = applyProjectileCreatureHit(
        createProjectile({ effect: 'disrupt_nonmaterial', remainingAttack: 9 }),
        targetA,
        [targetA, targetB],
        false,
        0,
        2,
        2,
        10,
        1000,
        createState({ creatures: [targetA, targetB] }),
        {
            rollSourceBackedImpact: () => null,
            getCreaturePoisonAdjustedAttack: (_typeId, attack) => attack,
            rollRandomProjectileDamage: () => 0,
            rollExplosionBurstAttack: () => 6,
            isLikelyNonMaterial: () => true,
            rollDisruptNonMaterialAttack: (_now, creature) => creature.id === 'a' ? 4 : 3,
            dropCreatureCarriedItems: (creatures, floorItems) => ({ creatures, floorItems }),
            buildDeathDustEvent: () => ({
                id: 'dust-1',
                level: 0,
                x: 2,
                y: 2,
                effect: 'fireball',
                ts: 1000,
                kind: 'death',
            }),
            buildCreatureDamageEvent: (level, x, y, amount) => ({
                id: 'damage-1',
                level,
                target: 'creature',
                x,
                y,
                amount,
                ts: 1000,
            }),
            buildLingeringPoisonCloud: () => null,
            buildActivePoisonCloud: () => {
                throw new Error('no poison cloud expected');
            },
            getThrownExplosionVisualScale: () => 1,
            buildDroppedItem: (item) => item,
            gridSize: 2,
        },
    );

    assert.equal(result.creatures[0]?.currentHP, 6);
    assert.equal(result.creatures[1]?.currentHP, 5);
    assert.equal(result.damageEvents[0]?.amount, 7);
    assert.equal(result.spellVisualEvents.length, 1);
    assert.equal(result.spellVisualEvents[0]?.effect, 'disrupt_nonmaterial');
});

test('applyProjectileCreatureHit creates poison clouds from poison impacts and lingering explosions', () => {
    const hit = createCreature({ currentHP: 12 });
    const result = applyProjectileCreatureHit(
        createProjectile({
            effect: 'physical',
            remainingAttack: 4,
            explosionOnImpact: 'poison_cloud',
            explosionAttack: 8,
        }),
        hit,
        [hit],
        false,
        0,
        2,
        2,
        10,
        1000,
        createState({ creatures: [hit] }),
        {
            rollSourceBackedImpact: () => null,
            getCreaturePoisonAdjustedAttack: (_typeId, attack) => attack,
            rollRandomProjectileDamage: () => 0,
            rollExplosionBurstAttack: () => 5,
            isLikelyNonMaterial: () => false,
            rollDisruptNonMaterialAttack: () => 0,
            dropCreatureCarriedItems: (creatures, floorItems) => ({ creatures, floorItems }),
            buildDeathDustEvent: () => ({
                id: 'dust-1',
                level: 0,
                x: 2,
                y: 2,
                effect: 'fireball',
                ts: 1000,
                kind: 'death',
            }),
            buildCreatureDamageEvent: (level, x, y, amount) => ({
                id: 'damage-1',
                level,
                target: 'creature',
                x,
                y,
                amount,
                ts: 1000,
            }),
            buildLingeringPoisonCloud: (level, x, y, initialAttack, nextPulseGameTick, visualScale) => ({
                id: 'linger-1',
                level,
                x,
                y,
                remainingAttack: initialAttack - 3,
                nextPulseGameTick,
                visualScale,
            }),
            buildActivePoisonCloud: (level, x, y, attack, currentGameTick, visualScale) => ({
                id: 'cloud-1',
                level,
                x,
                y,
                remainingAttack: attack,
                nextPulseGameTick: currentGameTick,
                visualScale,
            }),
            getThrownExplosionVisualScale: () => 1.4,
            buildDroppedItem: (item) => item,
            gridSize: 2,
        },
    );

    assert.equal(result.activePoisonClouds.length, 1);
    assert.equal(result.activePoisonClouds[0]?.remainingAttack, 5);
    assert.equal(result.damageEvents[0]?.amount, 9);
    assert.equal(result.spellVisualEvents[0]?.effect, 'poison_cloud');
});

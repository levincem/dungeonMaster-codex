import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureInstance, FloorItem } from '../src/types/game.js';
import type {
    ActivePoisonCloud,
    DamageEvent,
    Projectile,
    SpellVisualEvent,
} from '../src/engine/runtimeTypes.js';
import { normalizeCreatureCellsOnTile as normalizeCreatureCellsOnTileSystem } from '../src/engine/systems/creatureTileState.js';
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

const normalizeCreatureCellsOnTile = (creatures: CreatureInstance[], level: number, x: number, y: number) =>
    normalizeCreatureCellsOnTileSystem(creatures, level, x, y, () => 4);

test('applyProjectileCreatureHit damages a creature, drops loot on kill, and emits visuals', () => {
    const dagger: FloorItem = {
        id: 'dagger-kill',
        category: 'Weapon',
        typeId: 8,
        rawName: 'Dagger',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
    const hit = createCreature({ currentHP: 2 });
    const result = applyProjectileCreatureHit(
        createProjectile({
            effect: 'physical',
            remainingRange: 24,
            remainingAttack: 40,
            physicalItem: dagger,
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
            scaleCreatureProjectileImpactDamage: (_typeId, attack) => attack,
            getCreatureFireAdjustedExplosionAttack: (_typeId, attack) => attack,
            randomInt: () => 0,
            rollRandomProjectileDamage: () => 0,
            rollExplosionBurstAttack: () => 0,
            isLikelyNonMaterial: () => false,
            rollDisruptNonMaterialAttack: () => 0,
            dropCreatureCarriedItems: (creatures, floorItems) => ({ creatures, floorItems }),
            normalizeCreatureCellsOnTile,
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
            buildDroppedItem: (item, level, x, y) => ({ ...item, mapIndex: level, x, y, tilePos: 'North' }),
            gridSize: 2,
        },
    );

    assert.equal(result.creatures[0]?.alive, false);
    assert.equal(result.damageEvents.length, 1);
    assert.equal(result.damageEvents[0]?.creatureId, 'creature-1');
    assert.equal(result.floorItems.length, 1);
    assert.equal(result.floorItems[0]?.tilePos, 'South');
    assert.equal(result.spellVisualEvents.length, 1);
    assert.equal(result.spellVisualEvents[0]?.kind, 'death');
});

test('applyProjectileCreatureHit keeps a thrown physical weapon on the creature square after a non-lethal hit', () => {
    const hit = createCreature({ currentHP: 12 });
    const dagger: FloorItem = {
        id: 'dagger-hit',
        category: 'Weapon',
        typeId: 8,
        rawName: 'Dagger',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };

    const result = applyProjectileCreatureHit(
        createProjectile({
            effect: 'physical',
            remainingRange: 24,
            remainingAttack: 40,
            physicalItem: dagger,
            direction: 'EAST',
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
            scaleCreatureProjectileImpactDamage: (_typeId, attack) => attack,
            getCreatureFireAdjustedExplosionAttack: (_typeId, attack) => attack,
            randomInt: () => 0,
            rollRandomProjectileDamage: () => 0,
            rollExplosionBurstAttack: () => 0,
            isLikelyNonMaterial: () => false,
            rollDisruptNonMaterialAttack: () => 0,
            dropCreatureCarriedItems: (creatures, floorItems) => ({ creatures, floorItems }),
            normalizeCreatureCellsOnTile,
            buildDeathDustEvent: () => ({
                id: 'dust-1',
                level: 0,
                x: 2,
                y: 2,
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
            buildDroppedItem: (item, level, x, y) => ({ ...item, mapIndex: level, x, y, tilePos: 'North' }),
            gridSize: 2,
        },
    );

    assert.equal(result.creatures[0]?.alive, true);
    assert.equal(result.creatures[0]?.currentHP, 9);
    assert.equal(result.floorItems.length, 1);
    assert.deepEqual(result.floorItems[0], {
        ...dagger,
        mapIndex: 0,
        x: 2,
        y: 2,
        tilePos: 'West',
        projectileDropped: true,
    });
});

test('applyProjectileCreatureHit normalizes surviving group cells after a kill', () => {
    const target = createCreature({ id: 'creature-a', currentHP: 2, cell: 'frontLeft' });
    const survivorA = createCreature({ id: 'creature-b', currentHP: 12, cell: 'backLeft' });
    const survivorB = createCreature({ id: 'creature-c', currentHP: 12, cell: 'backRight' });

    const result = applyProjectileCreatureHit(
        createProjectile({
            effect: 'physical',
            remainingRange: 24,
            remainingAttack: 40,
        }),
        target,
        [target, survivorA, survivorB],
        false,
        0,
        2,
        2,
        10,
        1000,
        createState({ creatures: [target, survivorA, survivorB] }),
        {
            rollSourceBackedImpact: () => null,
            getCreaturePoisonAdjustedAttack: (_typeId, attack) => attack,
            scaleCreatureProjectileImpactDamage: (_typeId, attack) => attack,
            getCreatureFireAdjustedExplosionAttack: (_typeId, attack) => attack,
            randomInt: () => 0,
            rollRandomProjectileDamage: () => 0,
            rollExplosionBurstAttack: () => 0,
            isLikelyNonMaterial: () => false,
            rollDisruptNonMaterialAttack: () => 0,
            dropCreatureCarriedItems: (creatures, floorItems) => ({ creatures, floorItems }),
            normalizeCreatureCellsOnTile,
            buildDeathDustEvent: () => ({
                id: 'dust-1',
                level: 0,
                x: 2,
                y: 2,
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

    assert.deepEqual(
        result.creatures.map((creature) => [creature.id, creature.alive, creature.cell]),
        [
            ['creature-a', false, 'frontLeft'],
            ['creature-b', true, 'frontLeft'],
            ['creature-c', true, 'frontRight'],
        ],
    );
});

test('applyProjectileCreatureHit stores a thrown physical weapon on missile-absorbing creatures instead of losing it', () => {
    const hit = createCreature({ currentHP: 12, carriedItems: [] });
    const dagger: FloorItem = {
        id: 'dagger-absorbed',
        category: 'Weapon',
        typeId: 8,
        rawName: 'Dagger',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };

    const result = applyProjectileCreatureHit(
        createProjectile({
            effect: 'physical',
            remainingRange: 24,
            remainingAttack: 40,
            physicalItem: dagger,
            direction: 'EAST',
        }),
        hit,
        [hit],
        true,
        0,
        2,
        2,
        10,
        1000,
        createState({ creatures: [hit] }),
        {
            rollSourceBackedImpact: () => null,
            getCreaturePoisonAdjustedAttack: (_typeId, attack) => attack,
            scaleCreatureProjectileImpactDamage: (_typeId, attack) => attack,
            getCreatureFireAdjustedExplosionAttack: (_typeId, attack) => attack,
            randomInt: () => 0,
            rollRandomProjectileDamage: () => 0,
            rollExplosionBurstAttack: () => 0,
            isLikelyNonMaterial: () => false,
            rollDisruptNonMaterialAttack: () => 0,
            dropCreatureCarriedItems: (creatures, floorItems) => ({ creatures, floorItems }),
            normalizeCreatureCellsOnTile,
            buildDeathDustEvent: () => ({
                id: 'dust-1',
                level: 0,
                x: 2,
                y: 2,
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
            buildDroppedItem: (item, level, x, y) => ({ ...item, mapIndex: level, x, y, tilePos: 'North' }),
            gridSize: 2,
        },
    );

    assert.equal(result.floorItems.length, 0);
    assert.equal(result.damageEvents.length, 1);
    assert.equal(result.damageEvents[0]?.amount, 3);
    assert.equal(result.creatures[0]?.currentHP, 9);
    assert.deepEqual(result.creatures[0]?.carriedItems, [
        {
            ...dagger,
            mapIndex: 0,
            x: 2,
            y: 2,
            tilePos: 'North',
        },
    ]);
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
            scaleCreatureProjectileImpactDamage: (_typeId, attack) => attack,
            getCreatureFireAdjustedExplosionAttack: (_typeId, attack) => attack,
            randomInt: () => 0,
            rollRandomProjectileDamage: () => 0,
            rollExplosionBurstAttack: () => 6,
            isLikelyNonMaterial: () => true,
            rollDisruptNonMaterialAttack: (_now, creature) => creature.id === 'a' ? 4 : 3,
            dropCreatureCarriedItems: (creatures, floorItems) => ({ creatures, floorItems }),
            normalizeCreatureCellsOnTile,
            buildDeathDustEvent: () => ({
                id: 'dust-1',
                level: 0,
                x: 2,
                y: 2,
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
    const hit = createCreature({ currentHP: 20 });
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
            scaleCreatureProjectileImpactDamage: (_typeId, attack) => attack,
            getCreatureFireAdjustedExplosionAttack: (_typeId, attack) => attack,
            randomInt: () => 0,
            rollRandomProjectileDamage: () => 0,
            rollExplosionBurstAttack: () => 5,
            isLikelyNonMaterial: () => false,
            rollDisruptNonMaterialAttack: () => 0,
            dropCreatureCarriedItems: (creatures, floorItems) => ({ creatures, floorItems }),
            normalizeCreatureCellsOnTile,
            buildDeathDustEvent: () => ({
                id: 'dust-1',
                level: 0,
                x: 2,
                y: 2,
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
    assert.equal(result.damageEvents[0]?.creatureId, 'creature-1');
    assert.equal(result.activePoisonClouds[0]?.remainingAttack, 5);
    assert.equal(result.damageEvents[0]?.amount, 17);
    assert.equal(result.spellVisualEvents[0]?.effect, 'poison_cloud');
});

test('applyProjectileCreatureHit scales direct spell impact by creature defense before adding poison damage', () => {
    const hit = createCreature({ currentHP: 20 });
    const result = applyProjectileCreatureHit(
        createProjectile({ effect: 'poison_bolt' }),
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
            rollSourceBackedImpact: () => ({ damage: 8, poisonStrength: 4 }),
            getCreaturePoisonAdjustedAttack: (_typeId, attack) => attack + 1,
            scaleCreatureProjectileImpactDamage: (_typeId, attack) => Math.floor(attack / 2),
            getCreatureFireAdjustedExplosionAttack: (_typeId, attack) => attack,
            randomInt: () => 0,
            rollRandomProjectileDamage: () => 0,
            rollExplosionBurstAttack: () => 0,
            isLikelyNonMaterial: () => false,
            rollDisruptNonMaterialAttack: () => 0,
            dropCreatureCarriedItems: (creatures, floorItems) => ({ creatures, floorItems }),
            normalizeCreatureCellsOnTile,
            buildDeathDustEvent: () => ({
                id: 'dust-1',
                level: 0,
                x: 2,
                y: 2,
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
                throw new Error('no poison cloud expected');
            },
            getThrownExplosionVisualScale: () => 1,
            buildDroppedItem: (item) => item,
            gridSize: 2,
        },
    );

    assert.equal(result.creatures[0]?.currentHP, 11);
    assert.equal(result.damageEvents[0]?.amount, 9);
});

test('applyProjectileCreatureHit applies the fire burst separately after direct fireball impact', () => {
    const hit = createCreature({ currentHP: 20 });
    const result = applyProjectileCreatureHit(
        createProjectile({ effect: 'fireball', remainingRange: 7 }),
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
            rollSourceBackedImpact: () => ({ damage: 9 }),
            getCreaturePoisonAdjustedAttack: () => 0,
            scaleCreatureProjectileImpactDamage: (_typeId, attack) => attack - 3,
            getCreatureFireAdjustedExplosionAttack: (_typeId, attack) => attack - 5,
            randomInt: () => 0,
            rollRandomProjectileDamage: () => 0,
            rollExplosionBurstAttack: (effect, attack) => {
                assert.equal(effect, 'fireball');
                assert.equal(attack, 7);
                return 8;
            },
            isLikelyNonMaterial: () => false,
            rollDisruptNonMaterialAttack: () => 0,
            dropCreatureCarriedItems: (creatures, floorItems) => ({ creatures, floorItems }),
            normalizeCreatureCellsOnTile,
            buildDeathDustEvent: () => ({
                id: 'dust-1',
                level: 0,
                x: 2,
                y: 2,
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
                throw new Error('no poison cloud expected');
            },
            getThrownExplosionVisualScale: () => 1,
            buildDroppedItem: (item) => item,
            gridSize: 2,
        },
    );

    assert.equal(result.creatures[0]?.currentHP, 11);
    assert.equal(result.damageEvents[0]?.amount, 9);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DoorObject, FloorItem, GameTile } from '../src/types/game.js';
import type { ActivePoisonCloud, Projectile } from '../src/engine/runtimeTypes.js';
import { resolveProjectileTraversalStep } from '../src/engine/systems/projectileTraversal.js';

function createProjectile(overrides: Partial<Projectile> = {}): Projectile {
    return {
        id: 'proj-1',
        level: 0,
        x: 2,
        y: 2,
        direction: 'EAST',
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
    projectile: Projectile;
    now: number;
    currentGameTick: number;
    openDoors: Set<string>;
    openWalls: Set<string>;
    floorItems: FloorItem[];
    spellVisualEvents: never[];
    activePoisonClouds: ActivePoisonCloud[];
}> = {}) {
    return {
        projectile: createProjectile(),
        now: 1000,
        currentGameTick: 10,
        openDoors: new Set<string>(),
        openWalls: new Set<string>(),
        floorItems: [] as FloorItem[],
        spellVisualEvents: [],
        activePoisonClouds: [] as ActivePoisonCloud[],
        ...overrides,
    };
}

test('resolveProjectileTraversalStep keeps projectiles waiting until nextMoveAt', () => {
    const projectile = createProjectile({ nextMoveAt: 1500 });
    const result = resolveProjectileTraversalStep(
        createState({ projectile, now: 1000 }),
        {
            getTile: () => ({ type: 'Floor', objects: [] } as unknown as GameTile),
            doorBlocksProjectile: () => false,
            buildActivePoisonCloud: () => {
                throw new Error('no cloud expected');
            },
            getThrownExplosionVisualScale: () => 1,
            buildDroppedItem: (item) => item,
            resolveProjectileTeleporterTransport: (level, x, y, direction) => ({ level, x, y, direction }),
            gridSize: 2,
            originalSpellProjectileAttack: 32,
        },
    );

    assert.equal(result.kind, 'waiting');
    if (result.kind === 'waiting') {
        assert.equal(result.keepProjectile, projectile);
    }
});

test('resolveProjectileTraversalStep opens button doors for the open spell', () => {
    const door = { category: 'Door', doorType: 0, hasButton: true } as DoorObject;
    const result = resolveProjectileTraversalStep(
        createState({ projectile: createProjectile({ effect: 'open' }) }),
        {
            getTile: () => ({ type: 'Door', objects: [door] } as unknown as GameTile),
            doorBlocksProjectile: () => false,
            buildActivePoisonCloud: () => {
                throw new Error('no cloud expected');
            },
            getThrownExplosionVisualScale: () => 1,
            buildDroppedItem: (item) => item,
            resolveProjectileTeleporterTransport: (level, x, y, direction) => ({ level, x, y, direction }),
            gridSize: 2,
            originalSpellProjectileAttack: 32,
        },
    );

    assert.equal(result.kind, 'consumed');
    if (result.kind === 'consumed') {
        assert.equal(result.openDoors.has('0,2,3'), true);
        assert.equal(result.shouldPlayDoorMotion, true);
        assert.equal(result.spellVisualEvents.length, 1);
        assert.equal(result.spellVisualEvents[0]?.effect, 'open');
    }
});

test('resolveProjectileTraversalStep turns blocked poison impacts into active clouds', () => {
    const result = resolveProjectileTraversalStep(
        createState({ projectile: createProjectile({ effect: 'poison_cloud', remainingAttack: 9, direction: 'NORTH' }) }),
        {
            getTile: () => undefined,
            doorBlocksProjectile: () => false,
            buildActivePoisonCloud: (level, x, y, attack, currentGameTick, visualScale) => ({
                id: 'cloud-1',
                level,
                x,
                y,
                remainingAttack: attack,
                nextPulseGameTick: currentGameTick,
                visualScale,
            }),
            getThrownExplosionVisualScale: () => 1,
            buildDroppedItem: (item) => item,
            resolveProjectileTeleporterTransport: (level, x, y, direction) => ({ level, x, y, direction }),
            gridSize: 2,
            originalSpellProjectileAttack: 32,
        },
    );

    assert.equal(result.kind, 'consumed');
    if (result.kind === 'consumed') {
        assert.equal(result.activePoisonClouds.length, 1);
        assert.equal(result.activePoisonClouds[0]?.x, 2);
        assert.equal(result.activePoisonClouds[0]?.y, 2);
        assert.equal(result.spellVisualEvents.length, 1);
        assert.equal(result.spellVisualEvents[0]?.kind, 'wall');
    }
});

test('resolveProjectileTraversalStep applies teleporter transport before later hit resolution', () => {
    const result = resolveProjectileTraversalStep(
        createState(),
        {
            getTile: () => ({ type: 'Floor', objects: [] } as unknown as GameTile),
            doorBlocksProjectile: () => false,
            buildActivePoisonCloud: () => {
                throw new Error('no cloud expected');
            },
            getThrownExplosionVisualScale: () => 1,
            buildDroppedItem: (item) => item,
            resolveProjectileTeleporterTransport: () => ({ level: 1, x: 7, y: 8, direction: 'SOUTH' }),
            gridSize: 2,
            originalSpellProjectileAttack: 32,
        },
    );

    assert.equal(result.kind, 'advanced');
    if (result.kind === 'advanced') {
        assert.deepEqual(
            { level: result.level, x: result.x, y: result.y, direction: result.direction },
            { level: 1, x: 7, y: 8, direction: 'SOUTH' },
        );
    }
});

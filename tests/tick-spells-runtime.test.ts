import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, CreatureInstance, FloorItem, GameMap } from '../src/types/game.js';
import type {
    ActivePoisonCloud,
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    FootprintEntry,
    PartyShield,
    Projectile,
    SpellLight,
    SpellVisualEvent,
} from '../src/engine/runtimeTypes.js';
import { buildTickSpellsRuntimePatch } from '../src/engine/systems/tickSpellsRuntime.js';

type UnusedProjectileDeps = ReturnType<Parameters<typeof buildTickSpellsRuntimePatch>[2]['buildProjectileTickDeps']>;

const EMPTY_WOUNDS = {
    rightHand: false,
    leftHand: false,
    head: false,
    torso: false,
    legs: false,
    feet: false,
};

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champion ${id}`,
        title: 'Tester',
        gender: 'M',
        class: 'Fighter',
        health: 100,
        stamina: 80,
        mana: 20,
        luck: 10,
        strength: 10,
        dexterity: 10,
        wisdom: 10,
        vitality: 10,
        antiMagic: 0,
        antiFire: 0,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: '',
    };
}

function buildBaseState() {
    return {
        optionsModalOpen: false,
        elapsedGameTimeTicks: 123,
        spellLights: [] as SpellLight[],
        projectiles: [] as Projectile[],
        creatures: [] as CreatureInstance[],
        damageEvents: [] as DamageEvent[],
        spellVisualEvents: [] as SpellVisualEvent[],
        floorItems: [] as FloorItem[],
        openDoors: new Set<string>(),
        party: [createChampion(1)],
        level: 0,
        position: [0, 0] as [number, number],
        championVitals: {
            1: {
                hp: 100,
                stamina: 80,
                mana: 20,
                food: 1000,
                water: 1000,
                currentStats: {
                    luck: 10,
                    strength: 10,
                    dexterity: 10,
                    wisdom: 10,
                    vitality: 10,
                    antiMagic: 0,
                    antiFire: 0,
                },
                wounds: EMPTY_WOUNDS,
                poisonEntries: [],
            } as ChampionVitals,
        },
        championInventories: { 1: [] as FloorItem[] },
        championEquipment: { 1: {} as ChampionEquipment },
        deadChampions: {} as Record<number, Champion>,
        selectedChampionIndex: 0,
        activePoisonClouds: [] as ActivePoisonCloud[],
        activeShields: [] as PartyShield[],
        activePotionBoosts: [] as ActivePotionBoost[],
        championCombat: {} as Record<number, ChampionCombat>,
        openWalls: new Set<string>(),
        openTeleporters: new Set<string>(),
        footprintHistory: [] as FootprintEntry[],
        lastCreatureAttackGameTick: 0,
    };
}

function createState(overrides: Partial<ReturnType<typeof buildBaseState>> = {}) {
    return {
        ...buildBaseState(),
        ...overrides,
    };
}

function createUnusedProjectileDeps(): UnusedProjectileDeps {
    const emptyMap: GameMap = {
        index: 0,
        name: 'Test',
        level: 0,
        width: 0,
        height: 0,
        difficulty: 0,
        tiles: [],
    };
    return {
        getMap: () => emptyMap,
        currentGameTick: 0,
        now: 0,
        randomInt: () => 0,
        doorBlocksProjectile: () => false,
        buildActivePoisonCloud: () => ({ id: 'cloud', level: 0, x: 0, y: 0, remainingAttack: 1, nextPulseGameTick: 1 }),
        getThrownExplosionVisualScale: () => 1,
        buildDroppedItem: (item: FloorItem) => item,
        resolveProjectileTeleporterTransport: (level: number, x: number, y: number, direction: Projectile['direction']) => ({
            level,
            x,
            y,
            direction,
        }),
        originalSpellProjectileAttack: 90,
        resolveProjectileImpact: () => ({ damage: 0, attackType: 'Normal', poisonAttack: 0 }),
        resolveChampionIncomingAttack: () => ({
            damage: 0,
            nextVitals: {
                hp: 0,
                stamina: 0,
                mana: 0,
                food: 0,
                water: 0,
                currentStats: {
                    luck: 0,
                    strength: 0,
                    dexterity: 0,
                    wisdom: 0,
                    vitality: 0,
                    antiMagic: 0,
                    antiFire: 0,
                },
                wounds: EMPTY_WOUNDS,
                poisonEntries: [],
            },
        }),
        buildChampionDamageEvent: () => ({ id: 'dmg', level: 0, target: 'champion' as const, amount: 0, ts: 0 }),
        applyPoisonCharacter: (vitals: ChampionVitals) => vitals,
        buildDeathDrop: () => null,
        applyPartySpellBacklashDamage: () => null,
        applyPartyWideIncomingAttack: () => null,
        rollExplosionBurstAttack: () => 0,
        gridSize: 1,
        rollSourceBackedImpact: () => null,
        getCreaturePoisonAdjustedAttack: () => 0,
        scaleCreatureProjectileImpactDamage: (_typeId: number, attack: number) => attack,
        getCreatureFireAdjustedExplosionAttack: (_typeId: number, attack: number) => attack,
        hitCreatureAbsorbsMissiles: () => false,
        rollRandomProjectileDamage: () => 0,
        isLikelyNonMaterial: () => false,
        rollDisruptNonMaterialAttack: () => 0,
        dropCreatureCarriedItems: () => [],
        normalizeCreatureCellsOnTile: (creatures: CreatureInstance[]) => creatures,
        buildDeathDustEvent: () => ({ id: 'fx', level: 0, x: 0, y: 0, effect: 'fireball' as const, ts: 0, kind: 'death' as const }),
        buildCreatureDamageEvent: () => ({ id: 'dmg', level: 0, target: 'creature' as const, amount: 0, ts: 0 }),
        buildLingeringPoisonCloud: () => null,
        rollPoisonCloudPulseAttack: () => 0,
        onDoorMotion: () => {},
        doorToggleSoundDurationMs: 0,
        getDoorSoundVolume: () => 0,
        projectileStepMs: 1,
        physicalProjectileStepMs: 1,
    } as unknown as UnusedProjectileDeps;
}

function createFloorMap(width: number, height: number): GameMap {
    return {
        index: 0,
        name: 'Floor Test',
        level: 0,
        width,
        height,
        difficulty: 0,
        tiles: Array.from({ length: height }, (_, y) =>
            Array.from({ length: width }, (_, x) => ({
                x,
                y,
                type: 'Floor' as const,
                objects: [],
            })),
        ),
    };
}

test('buildTickSpellsRuntimePatch returns the original state when the options modal is open', () => {
    let called = false;
    const state = createState({ optionsModalOpen: true });

    const patch = buildTickSpellsRuntimePatch(state, 1000, {
        buildProjectileTickDeps: () => {
            called = true;
            return createUnusedProjectileDeps();
        },
        footprintLifetimeMs: 100,
        damageEventLifetimeMs: 100,
    });

    assert.equal(patch, state);
    assert.equal(called, false);
});

test('buildTickSpellsRuntimePatch prunes expired spell lights through the extracted orchestration', () => {
    const state = createState({
        spellLights: [
            { id: 'expired', lightContrib: 1, expiresAt: 50 },
            { id: 'active', lightContrib: 1, expiresAt: 150 },
        ],
    });

    const patch = buildTickSpellsRuntimePatch(state, 100, {
        buildProjectileTickDeps: (_state, currentGameTick, now) => ({
            ...createUnusedProjectileDeps(),
            currentGameTick,
            now,
        }),
        footprintLifetimeMs: 100,
        damageEventLifetimeMs: 100,
    });

    assert.deepEqual(patch, {
        spellLights: [{ id: 'active', lightContrib: 1, expiresAt: 150 }],
    });
});

test('buildTickSpellsRuntimePatch resolves spell projectile hits on the current front tile before advancing', () => {
    const creature: CreatureInstance = {
        id: 'creature-contact',
        typeId: 1,
        mapIndex: 0,
        x: 1,
        y: 0,
        currentHP: 7,
        alive: true,
        cell: 'frontLeft',
    };
    const projectile: Projectile = {
        id: 'spell-contact',
        level: 0,
        x: 1,
        y: 0,
        direction: 'EAST',
        effect: 'fireball',
        spellRunes: ['ful', 'ir'],
        damage: [4, 8],
        nextMoveAt: 1000,
        remainingRange: 6,
        remainingAttack: 10,
        visualScale: 1.2,
    };
    const state = createState({
        position: [0, 0],
        creatures: [creature],
        projectiles: [projectile],
    });

    const patch = buildTickSpellsRuntimePatch(state, 1000, {
        buildProjectileTickDeps: (_state, currentGameTick, now) => ({
            ...createUnusedProjectileDeps(),
            currentGameTick,
            now,
            rollSourceBackedImpact: () => ({ damage: 4 }),
            buildCreatureDamageEvent: (level, x, y, amount, creatureId) => ({
                id: 'damage-contact',
                level,
                target: 'creature',
                x,
                y,
                amount,
                creatureId,
                ts: now,
            }),
        }),
        footprintLifetimeMs: 100,
        damageEventLifetimeMs: 100,
    });

    assert.equal((patch.projectiles ?? []).length, 0);
    assert.equal(patch.damageEvents?.length, 1);
    assert.equal(patch.damageEvents?.[0]?.creatureId, 'creature-contact');
    assert.equal(patch.creatures?.[0]?.currentHP, 3);
});

test('buildTickSpellsRuntimePatch lets a creature projectile leave its launch square before any creature collision check', () => {
    const caster: CreatureInstance = {
        id: 'wizard-eye',
        typeId: 3,
        mapIndex: 0,
        x: 0,
        y: 0,
        currentHP: 12,
        alive: true,
        cell: 'center',
    };
    const projectile: Projectile = {
        id: 'wizard-eye-shot',
        level: 0,
        x: 0,
        y: 0,
        direction: 'EAST',
        effect: 'lightning',
        launchedBy: 'creature',
        sourceCreatureId: 'wizard-eye',
        damage: [4, 8],
        nextMoveAt: 1000,
        remainingRange: 6,
        remainingAttack: 10,
        visualScale: 1.05,
    };
    const map: GameMap = {
        index: 0,
        name: 'Open Corridor',
        level: 0,
        width: 3,
        height: 1,
        difficulty: 0,
        tiles: [[
            { x: 0, y: 0, type: 'Floor', objects: [] },
            { x: 1, y: 0, type: 'Floor', objects: [] },
            { x: 2, y: 0, type: 'Floor', objects: [] },
        ]],
    };
    const state = createState({
        position: [0, 2],
        creatures: [caster],
        projectiles: [projectile],
    });

    const patch = buildTickSpellsRuntimePatch(state, 1000, {
        buildProjectileTickDeps: (_state, currentGameTick, now) => ({
            ...createUnusedProjectileDeps(),
            currentGameTick,
            now,
            getMap: () => map,
            rollSourceBackedImpact: () => ({ damage: 4 }),
            buildCreatureDamageEvent: (level, x, y, amount, creatureId) => ({
                id: 'damage-self-hit',
                level,
                target: 'creature',
                x,
                y,
                amount,
                creatureId,
                ts: now,
            }),
        }),
        footprintLifetimeMs: 100,
        damageEventLifetimeMs: 100,
    });

    assert.equal(patch.projectiles?.length, 1);
    assert.equal(patch.projectiles?.[0]?.x, 1);
    assert.equal(patch.projectiles?.[0]?.y, 0);
    assert.equal(patch.damageEvents?.length ?? 0, 0);
    assert.equal(patch.creatures, undefined);
});

test('buildTickSpellsRuntimePatch applies wall projectile damage when a trap projectile enters the party square', () => {
    const projectile: Projectile = {
        id: 'wall-fireball',
        level: 0,
        x: 0,
        y: 0,
        direction: 'EAST',
        effect: 'fireball',
        launchedBy: 'wall',
        damage: [4, 8],
        nextMoveAt: 1000,
        remainingRange: 6,
        remainingAttack: 10,
        visualScale: 1,
    };
    const state = createState({
        position: [0, 1],
        projectiles: [projectile],
    });
    const map = createFloorMap(3, 1);

    const patch = buildTickSpellsRuntimePatch(state, 1000, {
        buildProjectileTickDeps: (_state, currentGameTick, now) => ({
            ...createUnusedProjectileDeps(),
            currentGameTick,
            now,
            getMap: () => map,
            resolveProjectileImpact: () => ({ damage: 5, attackType: 'Fire', poisonAttack: 0 }),
            resolveChampionIncomingAttack: (_incomingState, _targetChampion, currentVitals) => ({
                damage: 5,
                nextVitals: { ...currentVitals, hp: currentVitals.hp - 5 },
            }),
            buildChampionDamageEvent: (level, championId, amount) => ({
                id: 'damage-wall-fireball',
                level,
                target: 'champion',
                championId,
                amount,
                ts: now,
            }),
            applyPartySpellBacklashDamage: () => null,
        }),
        footprintLifetimeMs: 100,
        damageEventLifetimeMs: 100,
    });

    assert.deepEqual(patch.projectiles, []);
    assert.equal(patch.championVitals?.[1]?.hp, 95);
    assert.equal(patch.damageEvents?.length, 1);
    assert.equal(patch.damageEvents?.[0]?.championId, 1);
});

test('buildTickSpellsRuntimePatch drops a thrown physical weapon on the creature square after a hit', () => {
    const creature: CreatureInstance = {
        id: 'creature-dagger',
        typeId: 1,
        mapIndex: 0,
        x: 1,
        y: 0,
        currentHP: 2,
        alive: true,
        cell: 'frontLeft',
    };
    const dagger: FloorItem = {
        id: 'dagger-1',
        category: 'Weapon',
        typeId: 8,
        rawName: 'Dagger',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
    const projectile: Projectile = {
        id: 'throw-dagger',
        level: 0,
        x: 0,
        y: 0,
        direction: 'EAST',
        effect: 'physical',
        damage: [6, 6],
        nextMoveAt: 1000,
        remainingRange: 24,
        remainingAttack: 40,
        physicalItem: dagger,
    };
    const state = createState({
        position: [0, 0],
        creatures: [creature],
        projectiles: [projectile],
    });
    const map = createFloorMap(4, 1);

    const patch = buildTickSpellsRuntimePatch(state, 1000, {
        buildProjectileTickDeps: (_state, currentGameTick, now) => ({
            ...createUnusedProjectileDeps(),
            currentGameTick,
            now,
            getMap: () => map,
            buildDroppedItem: (item, level, x, y) => ({ ...item, mapIndex: level, x, y, tilePos: 'North' }),
            dropCreatureCarriedItems: (creatures, floorItems) => ({ creatures, floorItems }),
            normalizeCreatureCellsOnTile: (creatures: CreatureInstance[]) => creatures,
            buildCreatureDamageEvent: (level, x, y, amount, creatureId) => ({
                id: 'damage-dagger-hit',
                level,
                target: 'creature',
                x,
                y,
                amount,
                creatureId,
                ts: now,
            }),
        }),
        footprintLifetimeMs: 100,
        damageEventLifetimeMs: 100,
    });

    assert.deepEqual(patch.projectiles, []);
    assert.equal(patch.floorItems?.length, 1);
    assert.deepEqual(patch.floorItems?.[0], { ...dagger, mapIndex: 0, x: 1, y: 0, tilePos: 'West', projectileDropped: true });
    assert.equal(patch.damageEvents?.[0]?.creatureId, 'creature-dagger');
    assert.equal(patch.creatures?.[0]?.alive, false);
});

test('buildTickSpellsRuntimePatch preserves a thrown physical weapon on the creature square after a non-lethal hit', () => {
    const creature: CreatureInstance = {
        id: 'creature-dagger-live',
        typeId: 1,
        mapIndex: 0,
        x: 1,
        y: 0,
        currentHP: 8,
        alive: true,
        cell: 'frontLeft',
    };
    const dagger: FloorItem = {
        id: 'dagger-live',
        category: 'Weapon',
        typeId: 8,
        rawName: 'Dagger',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
    const projectile: Projectile = {
        id: 'throw-dagger-live',
        level: 0,
        x: 0,
        y: 0,
        direction: 'EAST',
        effect: 'physical',
        damage: [4, 4],
        nextMoveAt: 1000,
        remainingRange: 4,
        remainingAttack: 4,
        physicalItem: dagger,
    };
    const state = createState({
        position: [0, 0],
        creatures: [creature],
        projectiles: [projectile],
    });
    const map = createFloorMap(4, 1);

    const patch = buildTickSpellsRuntimePatch(state, 1000, {
        buildProjectileTickDeps: (_state, currentGameTick, now) => ({
            ...createUnusedProjectileDeps(),
            currentGameTick,
            now,
            getMap: () => map,
            buildDroppedItem: (item, level, x, y) => ({ ...item, mapIndex: level, x, y, tilePos: 'North' }),
            dropCreatureCarriedItems: (creatures, floorItems) => ({ creatures, floorItems }),
            normalizeCreatureCellsOnTile: (creatures: CreatureInstance[]) => creatures,
            buildCreatureDamageEvent: (level, x, y, amount, creatureId) => ({
                id: 'damage-dagger-live',
                level,
                target: 'creature',
                x,
                y,
                amount,
                creatureId,
                ts: now,
            }),
        }),
        footprintLifetimeMs: 100,
        damageEventLifetimeMs: 100,
    });

    assert.deepEqual(patch.projectiles, []);
    assert.equal(patch.floorItems?.length, 1);
    assert.deepEqual(patch.floorItems?.[0], { ...dagger, mapIndex: 0, x: 1, y: 0, tilePos: 'West', projectileDropped: true });
    assert.equal(patch.creatures?.[0]?.alive, true);
    assert.equal(patch.creatures?.[0]?.currentHP, 5);
});

test('buildTickSpellsRuntimePatch keeps a thrown physical weapon on a missile-absorbing creature instead of deleting it', () => {
    const creature: CreatureInstance = {
        id: 'creature-absorber',
        typeId: 1,
        mapIndex: 0,
        x: 1,
        y: 0,
        currentHP: 8,
        alive: true,
        cell: 'frontLeft',
        carriedItems: [],
    };
    const dagger: FloorItem = {
        id: 'dagger-absorber',
        category: 'Weapon',
        typeId: 8,
        rawName: 'Dagger',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
    const projectile: Projectile = {
        id: 'throw-dagger-absorber',
        level: 0,
        x: 0,
        y: 0,
        direction: 'EAST',
        effect: 'physical',
        damage: [4, 4],
        nextMoveAt: 1000,
        remainingRange: 4,
        remainingAttack: 4,
        physicalItem: dagger,
    };
    const state = createState({
        position: [0, 0],
        creatures: [creature],
        projectiles: [projectile],
    });
    const map = createFloorMap(4, 1);

    const patch = buildTickSpellsRuntimePatch(state, 1000, {
        buildProjectileTickDeps: (_state, currentGameTick, now) => ({
            ...createUnusedProjectileDeps(),
            currentGameTick,
            now,
            getMap: () => map,
            buildDroppedItem: (item, level, x, y) => ({ ...item, mapIndex: level, x, y, tilePos: 'North' }),
            buildCreatureDamageEvent: (level, x, y, amount, creatureId) => ({
                id: 'damage-absorber',
                level,
                target: 'creature',
                x,
                y,
                amount,
                creatureId,
                ts: now,
            }),
            hitCreatureAbsorbsMissiles: () => true,
        }),
        footprintLifetimeMs: 100,
        damageEventLifetimeMs: 100,
    });

    assert.deepEqual(patch.projectiles, []);
    assert.equal(patch.floorItems, undefined);
    assert.equal(patch.creatures?.[0]?.currentHP, 5);
    assert.equal(patch.damageEvents?.length, 1);
    assert.equal(patch.damageEvents?.[0]?.amount, 3);
    assert.deepEqual(patch.creatures?.[0]?.carriedItems, [
        {
            ...dagger,
            mapIndex: 0,
            x: 1,
            y: 0,
            tilePos: 'North',
        },
    ]);
});

test('buildTickSpellsRuntimePatch drops a thrown physical weapon on the last reachable square when it runs out of range', () => {
    const dagger: FloorItem = {
        id: 'dagger-range',
        category: 'Weapon',
        typeId: 8,
        rawName: 'Dagger',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
    const projectile: Projectile = {
        id: 'throw-dagger-range',
        level: 0,
        x: 0,
        y: 0,
        direction: 'EAST',
        effect: 'physical',
        damage: [6, 6],
        nextMoveAt: 1000,
        remainingRange: 1,
        remainingAttack: 6,
        physicalItem: dagger,
    };
    const state = createState({
        position: [0, 0],
        projectiles: [projectile],
    });
    const map = createFloorMap(4, 1);

    const patch = buildTickSpellsRuntimePatch(state, 1000, {
        buildProjectileTickDeps: (_state, currentGameTick, now) => ({
            ...createUnusedProjectileDeps(),
            currentGameTick,
            now,
            getMap: () => map,
            buildDroppedItem: (item, level, x, y) => ({ ...item, mapIndex: level, x, y, tilePos: 'North' }),
        }),
        footprintLifetimeMs: 100,
        damageEventLifetimeMs: 100,
    });

    assert.deepEqual(patch.projectiles, []);
    assert.equal(patch.floorItems?.length, 1);
    assert.deepEqual(patch.floorItems?.[0], { ...dagger, mapIndex: 0, x: 1, y: 0, tilePos: 'West', projectileDropped: true });
});

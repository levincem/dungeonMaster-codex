import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStoreMovementRuntime } from '../src/engine/systems/storeMovementRuntime.js';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../src/types/game.js';
import type {
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    PartyShield,
    SpellVisualEvent,
} from '../src/engine/runtimeTypes.js';

type TestState = {
    gamePhase: 'exploration';
    movementCooldown: number;
    level: number;
    position: [number, number];
    direction: 'NORTH';
    party: Champion[];
    selectedChampionIndex: number;
    hydratedLevels: Set<number>;
    openDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    championVitals: Record<number, ChampionVitals>;
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    deadChampions: Record<number, Champion>;
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    championCombat: Record<number, ChampionCombat>;
    pendingSensorEvents: Array<{ level: number; sensorIndex: number; remaining: number }>;
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

function createState(): TestState {
    return {
        gamePhase: 'exploration',
        movementCooldown: 0,
        level: 1,
        position: [4, 5],
        direction: 'NORTH',
        party: [createChampion(1)],
        selectedChampionIndex: 0,
        hydratedLevels: new Set<number>([1]),
        openDoors: new Set<string>(),
        openPits: new Set<string>(),
        openTeleporters: new Set<string>(),
        openWalls: new Set<string>(),
        creatures: [],
        floorItems: [],
        championInventories: { 1: [] },
        championEquipment: { 1: {} },
        championVitals: { 1: { hp: 30 } as ChampionVitals },
        damageEvents: [],
        spellVisualEvents: [],
        deadChampions: {},
        activeShields: [],
        activePotionBoosts: [],
        championCombat: {},
        pendingSensorEvents: [],
    };
}

function createRuntime() {
    return createStoreMovementRuntime<TestState, { snapshot: true }, { kind: 'wall-push' }, { id: string }>({
        applyPartyMoveFatigue: () => null,
        isPartyStepBlockedByCreature: () => false,
        getTile: (_level, x, y) => ({ type: (x === 8 && y === 3) ? 'Floor' : 'Teleporter' }),
        isWalkable: () => true,
        buildSensorStateSnapshot: () => ({ snapshot: true }),
        buildWallPushSensorDeps: () => ({ kind: 'wall-push' as const }),
        triggerWallPushSensorsSystem: (_level, _x, _y, _direction, _sensorState, pendingSensorEvents) => ({
            sensorChanges: {},
            pendingSensorEvents,
        }),
        buildPartyDamageDeps: () => ({
            applyFrontRowWallBumpDamage: (_state, championVitals) => ({ championVitals }),
        }),
        applyOpenedPitEffects: (state) => ({
            ...state,
            changed: true,
            position: [9, 9] as [number, number],
        }),
        applyOpenedTeleporterEffects: (state) => ({
            ...state,
            changed: true,
            direction: 'NORTH' as const,
            position: [7, 7] as [number, number],
        }),
        applyFloorItemTeleporterEffects: (_state, patch) => patch,
        resolveOpenPitEntryTransport: () => null,
        findStairLink: () => undefined,
        resolveStairStepTransport: () => null,
        resolveTeleporterStepTransport: () => null,
        resolveStandardStepTransport: (_state, x, y, nx, ny, movedVitals) => ({
            patch: {
                position: [ny, nx] as [number, number],
                from: [y, x],
                championVitals: movedVitals ?? undefined,
            },
        }),
    });
}

test('store movement runtime merges immediate opened pit and teleporter effects', () => {
    const runtime = createRuntime();
    const state = createState();

    const patch = runtime.applyImmediateTransportSquareEffects(state, {
        openPits: new Set(['1,9,9']),
        openTeleporters: new Set(['1,7,7']),
    });

    assert.deepEqual(patch.position, [7, 7]);
});

test('store movement runtime resolves standard step transport through the extracted wrapper', () => {
    const runtime = createRuntime();
    const state = createState();

    const result = runtime.resolvePartyStepTransport(
        state,
        3,
        8,
        { 1: { hp: 25 } as ChampionVitals },
    );

    assert.deepEqual(result.patch, {
        position: [3, 8],
        from: [4, 5],
        championVitals: { 1: { hp: 25 } },
    });
});

test('store movement runtime toggles front-row bump damage in built move deps', () => {
    const runtime = createRuntime();
    const enabledDeps = runtime.buildPartyMoveDeps(true);
    const disabledDeps = runtime.buildPartyMoveDeps(false);
    const state = createState();

    assert.deepEqual(
        enabledDeps.applyFrontRowWallBumpDamage(state, state.championVitals, 1000),
        { championVitals: state.championVitals },
    );
    assert.equal(
        disabledDeps.applyFrontRowWallBumpDamage(state, state.championVitals, 1000),
        null,
    );
});

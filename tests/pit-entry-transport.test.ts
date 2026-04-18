import { test } from 'node:test';
import assert from 'node:assert/strict';
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
import { resolveOpenPitEntryTransport } from '../src/engine/systems/pitEntryTransport.js';

const EMPTY_WOUNDS = {
    rightHand: false,
    leftHand: false,
    head: false,
    torso: false,
    legs: false,
    feet: false,
};

type TestPendingSensorEvent = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type TestSensorState = {
    openDoors: Set<string>;
    openedBy?: string;
};

type TestState = ReturnType<typeof createState>;
type TestPatch = Record<string, unknown>;

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champ ${id}`,
        title: 'Adventurer',
        gender: 'M',
        class: 'Fighter',
        health: 30,
        stamina: 40,
        mana: 5,
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

function createVitals(hp: number): ChampionVitals {
    return {
        hp,
        stamina: 40,
        mana: 5,
        food: 100,
        water: 100,
        currentStats: {
            luck: 10,
            strength: 10,
            dexterity: 10,
            wisdom: 10,
            vitality: 10,
            antiMagic: 0,
            antiFire: 0,
        },
        wounds: { ...EMPTY_WOUNDS },
        poisonEntries: [],
    };
}

function createState() {
    return {
        level: 0,
        position: [2, 3] as [number, number],
        party: [createChampion(1)],
        selectedChampionIndex: 0,
        openDoors: new Set<string>(),
        openWalls: new Set<string>(),
        openPits: new Set<string>(['0,4,5']),
        creatures: [] as CreatureInstance[],
        floorItems: [] as FloorItem[],
        championInventories: {} as Record<number, FloorItem[]>,
        championEquipment: {} as Record<number, ChampionEquipment>,
        championVitals: { 1: createVitals(30) } as Record<number, ChampionVitals>,
        damageEvents: [] as DamageEvent[],
        spellVisualEvents: [] as SpellVisualEvent[],
        deadChampions: {} as Record<number, Champion>,
        activeShields: [] as PartyShield[],
        activePotionBoosts: [] as ActivePotionBoost[],
        championCombat: {} as Record<number, ChampionCombat>,
        pendingSensorEvents: [{ level: 0, sensorIndex: 1, remaining: 5 }] as TestPendingSensorEvent[],
        elapsedGameTimeTicks: 123,
    };
}

test('resolveOpenPitEntryTransport returns null when the pit has no valid landing', () => {
    const result = resolveOpenPitEntryTransport<TestState, TestSensorState, TestPendingSensorEvent, TestPatch>(
        createState(),
        3,
        2,
        4,
        5,
        null,
        {
            resolvePitLanding: () => null,
            buildSensorStateSnapshot: () => ({ openDoors: new Set<string>() }),
            triggerFloorSensors: () => ({ sensorChanges: {}, pendingSensorEvents: [] }),
            applyPartyTelefragAtSquare: () => null,
            applyPartyFallImpactDamage: () => null,
            buildLevelHydrationPatch: () => null,
            applyImmediateTransportSquareEffects: (_state, basePatch) => basePatch,
            computeMovementCooldown: () => 0.5,
        },
    );

    assert.equal(result, null);
});

test('resolveOpenPitEntryTransport applies sensor transitions, telefrag and fall damage before transport effects', () => {
    const state = createState();
    let enterSensorState: TestSensorState | null = null;
    let capturedPatch: TestPatch | null = null;

    const result = resolveOpenPitEntryTransport<TestState, TestSensorState, TestPendingSensorEvent, TestPatch>(
        state,
        3,
        2,
        4,
        5,
        null,
        {
            resolvePitLanding: () => ({ level: 1, x: 7, y: 8 }),
            buildSensorStateSnapshot: () => ({ openDoors: new Set<string>(), openedBy: 'snapshot' }),
            triggerFloorSensors: (_level, _x, _y, ss, _inventories, _equipment, _floorItems, _pending, mode) => {
                if (mode === 'enter') {
                    enterSensorState = ss;
                    return {
                        sensorChanges: { openedBy: 'enter' },
                        pendingSensorEvents: [{ level: 1, sensorIndex: 2, remaining: 1 }],
                    };
                }

                return {
                    sensorChanges: { openDoors: new Set(['leave-door']), openedBy: 'leave' },
                    pendingSensorEvents: [{ level: 0, sensorIndex: 9, remaining: 2 }],
                };
            },
            applyPartyTelefragAtSquare: () => ({
                creatures: [{ id: 'c1', typeId: 1, mapIndex: 1, x: 7, y: 8, currentHP: 0, alive: false, cell: 'center' }],
                floorItems: [{ id: 'loot-1', category: 'Misc', typeId: 1, mapIndex: 1, x: 7, y: 8, tilePos: 'North' }],
                spellVisualEvents: [{ id: 'fx-1', level: 1, x: 7, y: 8, effect: 'fireball', ts: 0, kind: 'death' }],
            }),
            applyPartyFallImpactDamage: () => ({
                championVitals: { 1: createVitals(22) },
                damageEvents: [{ id: 'fall-1', level: 1, target: 'champion', championId: 1, amount: 8, ts: 0 }],
            }),
            buildLevelHydrationPatch: () => null,
            applyImmediateTransportSquareEffects: (_state, basePatch) => {
                capturedPatch = basePatch as Record<string, unknown>;
                return basePatch;
            },
            computeMovementCooldown: () => 1.25,
        },
    );

    assert.ok(result);
    assert.equal(result?.fellThroughPit, true);
    assert.deepEqual(enterSensorState, { openDoors: new Set(['leave-door']), openedBy: 'leave' });
    assert.ok(capturedPatch);
    const patch = capturedPatch as TestPatch;
    assert.equal(patch.level, 1);
    assert.deepEqual(patch.position, [8, 7]);
    assert.equal(patch.lastPartyMoveGameTick, 123);
    assert.equal(patch.movementCooldown, 1.25);
    assert.deepEqual(patch.pendingSensorEvents, [{ level: 1, sensorIndex: 2, remaining: 1 }]);
    assert.equal((patch.championVitals as Record<number, ChampionVitals>)[1]?.hp, 22);
    assert.equal((patch.damageEvents as DamageEvent[])[0]?.amount, 8);
    assert.equal((patch.floorItems as FloorItem[]).length, 1);
    assert.equal((patch.spellVisualEvents as SpellVisualEvent[]).length, 1);
    assert.equal((patch.openDoors as Set<string>).has('leave-door'), true);
    assert.equal(patch.openedBy, 'enter');
});

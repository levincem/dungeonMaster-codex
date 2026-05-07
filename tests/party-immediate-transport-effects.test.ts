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
import { applyImmediateTransportSquareEffects } from '../src/engine/systems/partyImmediateTransportEffects.js';

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

function createState() {
    return {
        level: 1,
        position: [4, 5] as [number, number],
        direction: 'NORTH' as const,
        activeFloorDrag: { itemId: 'dragged-item', pointerX: 10, pointerY: 20 },
        party: [createChampion(1)],
        selectedChampionIndex: 0,
        openDoors: new Set<string>(),
        openPits: new Set<string>(),
        openTeleporters: new Set<string>(),
        openWalls: new Set<string>(),
        creatures: [] as CreatureInstance[],
        floorItems: [] as FloorItem[],
        championInventories: {} as Record<number, FloorItem[]>,
        championEquipment: {} as Record<number, ChampionEquipment>,
        championVitals: {} as Record<number, ChampionVitals>,
        damageEvents: [] as DamageEvent[],
        spellVisualEvents: [] as SpellVisualEvent[],
        deadChampions: {} as Record<number, Champion>,
        activeShields: [] as PartyShield[],
        activePotionBoosts: [] as ActivePotionBoost[],
        championCombat: {} as Record<number, ChampionCombat>,
        pendingSensorEvents: [] as Array<{ level: number; sensorIndex: number; remaining: number }>,
    };
}

test('applyImmediateTransportSquareEffects returns the base patch unchanged when no new open squares appear', () => {
    const state = createState();
    const basePatch = { position: [6, 7] as [number, number] };

    const result = applyImmediateTransportSquareEffects(
        state,
        basePatch,
        {
            applyOpenedPitEffects: () => {
                throw new Error('pit effects should not run');
            },
            applyOpenedTeleporterEffects: () => {
                throw new Error('teleporter effects should not run');
            },
        },
    );

    assert.equal(result, basePatch);
});

test('applyImmediateTransportSquareEffects merges pit and teleporter effect patches into the transport patch', () => {
    const state = createState();
    const basePatch: TestBasePatch = {
        openPits: new Set(['1,4,5']),
        openTeleporters: new Set(['1,8,9']),
        creatures: [{ id: 'before', typeId: 1, mapIndex: 1, x: 4, y: 5, currentHP: 10, alive: true, cell: 'center' }] as CreatureInstance[],
    };

    const result = applyImmediateTransportSquareEffects(
        state,
        basePatch,
        {
            applyOpenedPitEffects: (_transportState, openedPitKeys) => {
                assert.deepEqual(openedPitKeys, ['1,4,5']);
                return {
                    level: 2,
                    position: [6, 7] as [number, number],
                    creatures: [{ id: 'pit', typeId: 2, mapIndex: 2, x: 7, y: 6, currentHP: 8, alive: true, cell: 'center' }],
                    floorItems: [{ id: 'loot', category: 'Misc', typeId: 1, mapIndex: 2, x: 7, y: 6, tilePos: 'North' }],
                    championVitals: { 1: { hp: 22 } as ChampionVitals },
                    party: state.party,
                    championInventories: state.championInventories,
                    championEquipment: state.championEquipment,
                    deadChampions: state.deadChampions,
                    selectedChampionIndex: 0,
                    damageEvents: [{ id: 'fall', level: 2, target: 'champion', championId: 1, amount: 8, ts: 0 }],
                    spellVisualEvents: [{ id: 'dust', level: 2, x: 7, y: 6, effect: 'fireball', ts: 0, kind: 'death' }],
                    changed: true,
                };
            },
            applyOpenedTeleporterEffects: (_transportState, openedTeleporterKeys) => {
                assert.deepEqual(openedTeleporterKeys, ['1,8,9']);
                return {
                    level: 3,
                    position: [1, 2] as [number, number],
                    direction: 'EAST' as const,
                    creatures: [{ id: 'tele', typeId: 3, mapIndex: 3, x: 2, y: 1, currentHP: 6, alive: true, cell: 'center' }],
                    floorItems: [{ id: 'after', category: 'Misc', typeId: 2, mapIndex: 3, x: 2, y: 1, tilePos: 'South' }],
                    spellVisualEvents: [{ id: 'zap', level: 3, x: 2, y: 1, effect: 'lightning', ts: 1, kind: 'wall' }],
                    openDoors: new Set(['3,30,14']),
                    openPits: new Set(['1,4,5']),
                    openTeleporters: new Set(['1,8,9']),
                    openWalls: new Set<string>(),
                    pendingSensorEvents: [{ level: 3, sensorIndex: 104, remaining: 2 }],
                    changed: true,
                };
            },
        },
    );

    assert.equal(result.level, 3);
    assert.deepEqual(result.position, [1, 2]);
    assert.equal(result.direction, 'EAST');
    assert.equal(result.activeFloorDrag, null);
    assert.equal((result.championVitals as Record<number, ChampionVitals>)[1]?.hp, 22);
    assert.equal((result.damageEvents as DamageEvent[])[0]?.amount, 8);
    assert.equal((result.creatures as CreatureInstance[])[0]?.id, 'tele');
    assert.equal((result.floorItems as FloorItem[])[0]?.id, 'after');
    assert.equal((result.spellVisualEvents as SpellVisualEvent[])[0]?.id, 'zap');
    assert.equal((result.openDoors as Set<string>).has('3,30,14'), true);
    assert.deepEqual(result.pendingSensorEvents, [{ level: 3, sensorIndex: 104, remaining: 2 }]);
});
type TestBasePatch = Partial<ReturnType<typeof createState>>;

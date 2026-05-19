import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { CreatureInstance, FloorItem, ChampionEquipment } from '../src/types/game.js';
import type {
    ActivePoisonCloud,
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    PartyShield,
    SpellVisualEvent,
} from '../src/engine/runtimeTypes.js';
import { normalizeCreatureCellsOnTile as normalizeCreatureCellsOnTileSystem } from '../src/engine/systems/creatureTileState.js';
import { tickPoisonClouds } from '../src/engine/systems/tickPoisonClouds.js';

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champion ${id}`,
        title: 'The Test',
        gender: 'M',
        class: 'Fighter',
        health: 100,
        stamina: 100,
        mana: 30,
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
        portrait: 'test.png',
    };
}

function createVitals(overrides: Partial<ChampionVitals> = {}): ChampionVitals {
    return {
        hp: 50,
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

function createCreature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
    return {
        id: 'creature-1',
        typeId: 1,
        mapIndex: 0,
        x: 1,
        y: 1,
        currentHP: 12,
        alive: true,
        cell: 'frontLeft',
        ...overrides,
    };
}

function createCloud(overrides: Partial<ActivePoisonCloud> = {}): ActivePoisonCloud {
    return {
        id: 'cloud-1',
        level: 0,
        x: 1,
        y: 1,
        remainingAttack: 9,
        nextPulseGameTick: 5,
        visualScale: 1,
        ...overrides,
    };
}

function createState(overrides: Partial<{
    activePoisonClouds: ActivePoisonCloud[];
    creatures: CreatureInstance[];
    level: number;
    position: [number, number];
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    deadChampions: Record<number, Champion>;
    selectedChampionIndex: number;
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    championCombat: Record<number, ChampionCombat>;
}> = {}) {
    const champion = createChampion(1);
    return {
        activePoisonClouds: [createCloud()],
        creatures: [],
        level: 0,
        position: [3, 3] as [number, number],
        party: [champion],
        championVitals: { 1: createVitals() },
        championInventories: {} as Record<number, FloorItem[]>,
        championEquipment: {} as Record<number, ChampionEquipment>,
        floorItems: [] as FloorItem[],
        deadChampions: {} as Record<number, Champion>,
        selectedChampionIndex: 0,
        damageEvents: [] as DamageEvent[],
        spellVisualEvents: [] as SpellVisualEvent[],
        activeShields: [] as PartyShield[],
        activePotionBoosts: [] as ActivePotionBoost[],
        championCombat: {} as Record<number, ChampionCombat>,
        ...overrides,
    };
}

const normalizeCreatureCellsOnTile = (creatures: CreatureInstance[], level: number, x: number, y: number) =>
    normalizeCreatureCellsOnTileSystem(creatures, level, x, y, () => 4);

test('tickPoisonClouds applies party backlash when a cloud pulses on the party square', () => {
    const state = createState({
        activePoisonClouds: [createCloud({ x: 3, y: 3, sourceName: 'Vexirk' })],
    });

    let backlashCalled = false;

    const result = tickPoisonClouds(state, 5, 1000, {
        rollPoisonCloudPulseAttack: () => 7,
        applyPartyWideIncomingAttack: (incomingState, championVitals, _attack, _now, sourceName) => {
            backlashCalled = true;
            assert.equal(incomingState.party.length, 1);
            assert.equal(sourceName, 'Vexirk');
            return {
                championVitals: {
                    ...championVitals,
                    1: { ...championVitals[1]!, hp: 43 },
                },
            };
        },
        getCreaturePoisonAdjustedAttack: () => {
            throw new Error('creatures should not be hit on the party square');
        },
        buildCreatureDamageEvent: () => {
            throw new Error('no creature damage event expected');
        },
        dropCreatureCarriedItems: () => {
            throw new Error('no creature drop expected');
        },
        normalizeCreatureCellsOnTile,
        buildDeathDustEvent: () => {
            throw new Error('no death dust expected');
        },
    });

    assert.equal(backlashCalled, true);
    assert.equal(result.championVitals[1]?.hp, 43);
    assert.equal(result.activePoisonClouds[0]?.remainingAttack, 6);
    assert.equal(result.activePoisonClouds[0]?.nextPulseGameTick, 6);
});

test('tickPoisonClouds damages creatures on a cloud square and emits death visuals on kill', () => {
    const creature = createCreature({ id: 'mummy-1', x: 1, y: 1, currentHP: 5 });
    const state = createState({
        creatures: [creature],
        activePoisonClouds: [createCloud({ x: 1, y: 1, remainingAttack: 6 })],
    });

    const result = tickPoisonClouds(state, 5, 1500, {
        rollPoisonCloudPulseAttack: () => 4,
        applyPartyWideIncomingAttack: () => {
            throw new Error('party backlash should not run for creature-only pulse');
        },
        getCreaturePoisonAdjustedAttack: () => 5,
        buildCreatureDamageEvent: (level, x, y, amount, creatureId) => ({
            id: 'damage-1',
            level,
            target: 'creature',
            x,
            y,
            amount,
            creatureId,
            ts: 1500,
        }),
        dropCreatureCarriedItems: (creatures, floorItems) => ({ creatures, floorItems }),
        normalizeCreatureCellsOnTile,
        buildDeathDustEvent: (level, x, y) => ({
            id: 'dust-1',
            level,
            x,
            y,
            effect: 'fireball',
            ts: 1500,
            kind: 'death',
        }),
    });

    assert.equal(result.creatures[0]?.alive, false);
    assert.equal(result.damageEvents.length, 1);
    assert.equal(result.damageEvents[0]?.creatureId, 'mummy-1');
    assert.equal(result.spellVisualEvents.length, 1);
    assert.equal(result.spellVisualEvents[0]?.kind, 'death');
    assert.equal(result.activePoisonClouds.length, 1);
    assert.equal(result.activePoisonClouds[0]?.remainingAttack, 3);
});

test('tickPoisonClouds removes a cloud once it decays below the last pulse threshold', () => {
    const state = createState({
        activePoisonClouds: [createCloud({ remainingAttack: 5 })],
    });

    const result = tickPoisonClouds(state, 5, 2000, {
        rollPoisonCloudPulseAttack: () => 2,
        applyPartyWideIncomingAttack: () => null,
        getCreaturePoisonAdjustedAttack: () => 0,
        buildCreatureDamageEvent: () => {
            throw new Error('no creature damage event expected');
        },
        dropCreatureCarriedItems: () => {
            throw new Error('no drop expected');
        },
        normalizeCreatureCellsOnTile,
        buildDeathDustEvent: () => {
            throw new Error('no death dust expected');
        },
    });

    assert.equal(result.activePoisonClouds.length, 0);
});

test('tickPoisonClouds normalizes surviving group cells after a kill', () => {
    const target = createCreature({ id: 'mummy-a', x: 1, y: 1, currentHP: 5, cell: 'frontLeft' });
    const survivorA = createCreature({ id: 'mummy-b', x: 1, y: 1, currentHP: 12, cell: 'backLeft' });
    const survivorB = createCreature({ id: 'mummy-c', x: 1, y: 1, currentHP: 12, cell: 'backRight' });
    const state = createState({
        creatures: [target, survivorA, survivorB],
        activePoisonClouds: [createCloud({ x: 1, y: 1, remainingAttack: 6 })],
    });

    const result = tickPoisonClouds(state, 5, 1500, {
        rollPoisonCloudPulseAttack: () => 4,
        applyPartyWideIncomingAttack: () => {
            throw new Error('party backlash should not run for creature-only pulse');
        },
        getCreaturePoisonAdjustedAttack: () => 5,
        buildCreatureDamageEvent: (level, x, y, amount, creatureId) => ({
            id: 'damage-1',
            level,
            target: 'creature',
            x,
            y,
            amount,
            creatureId,
            ts: 1500,
        }),
        dropCreatureCarriedItems: (creatures, floorItems) => ({ creatures, floorItems }),
        normalizeCreatureCellsOnTile,
        buildDeathDustEvent: (level, x, y) => ({
            id: 'dust-1',
            level,
            x,
            y,
            effect: 'fireball',
            ts: 1500,
            kind: 'death',
        }),
    });

    assert.deepEqual(
        result.creatures.map((creature) => [creature.id, creature.alive, creature.cell]),
        [
            ['mummy-a', false, 'frontLeft'],
            ['mummy-b', true, 'frontLeft'],
            ['mummy-c', true, 'frontRight'],
        ],
    );
});

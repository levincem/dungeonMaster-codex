import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureInstance, ChampionEquipment, FloorItem } from '../src/types/game.js';
import type { ChampionVitals, Projectile } from '../src/engine/runtimeTypes.js';
import { resolveCreatureAttackOutcomeState } from '../src/engine/systems/creatureAttackOutcomeState.js';

function createCreature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
    return {
        id: 'creature-1',
        typeId: 1,
        mapIndex: 0,
        x: 5,
        y: 5,
        currentHP: 20,
        alive: true,
        cell: 'frontLeft',
        carriedItems: [],
        ...overrides,
    };
}

function createItem(id: string): FloorItem {
    return {
        id,
        category: 'Misc',
        typeId: 1,
        rawName: id,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

function createVitals(hp: number): ChampionVitals {
    return {
        hp,
        stamina: 30,
        mana: 5,
        food: 900,
        water: 900,
        currentStats: {
            luck: 10,
            strength: 20,
            dexterity: 16,
            wisdom: 8,
            vitality: 14,
            antiMagic: 6,
            antiFire: 4,
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
    };
}

test('resolveCreatureAttackOutcomeState appends creature projectiles', () => {
    const projectile: Projectile = {
        id: 'proj-1',
        level: 0,
        x: 5,
        y: 5,
        direction: 'NORTH',
        effect: 'fireball',
        launchedBy: 'creature',
        sourceCreatureId: 'creature-1',
        damage: [1, 20],
        nextMoveAt: 1000,
        remainingRange: 20,
        remainingAttack: 5,
        stepDecay: 8,
        visualScale: 1,
    };
    const result = resolveCreatureAttackOutcomeState(
        {
            attackResult: { kind: 'projectile', projectile },
            creature: createCreature(),
            creatures: [createCreature()],
            stateCreatures: [createCreature()],
            stateProjectiles: [],
            currentProjectiles: [],
            championInventories: {},
            championEquipment: {},
            baseChampionEquipment: {},
            championVitals: {},
            damageEvents: [],
            level: 0,
        },
        {
            buildChampionDamageEvent: () => {
                throw new Error('damage event should not be built for projectile result');
            },
        },
    );

    assert.equal(result.kind, 'projectile');
    if (result.kind === 'projectile') {
        assert.deepEqual(result.projectiles, [projectile]);
    }
});

test('resolveCreatureAttackOutcomeState applies steal updates to creature and target inventory', () => {
    const stolenItem = createItem('compass');
    const nextEquipment: ChampionEquipment = { torso: undefined };
    const result = resolveCreatureAttackOutcomeState(
        {
            attackResult: {
                kind: 'steal',
                targetChampionId: 2,
                stolenItem,
                nextInventory: [],
                nextEquipment,
                nextVitals: createVitals(12),
                shouldFlee: true,
            },
            creature: createCreature(),
            creatures: [createCreature()],
            stateCreatures: [createCreature()],
            stateProjectiles: [],
            currentProjectiles: [],
            championInventories: { 2: [createItem('apple')] },
            championEquipment: {},
            baseChampionEquipment: { 2: { torso: createItem('mail') } },
            championVitals: {},
            damageEvents: [],
            level: 0,
        },
        {
            buildChampionDamageEvent: () => {
                throw new Error('damage event should not be built for steal result');
            },
        },
    );

    assert.equal(result.kind, 'steal');
    if (result.kind === 'steal') {
        assert.equal(result.creatures[0]?.carriedItems?.[0]?.id, 'compass');
        assert.deepEqual(result.championInventories[2], []);
        assert.deepEqual(result.championEquipment[2], nextEquipment);
        assert.equal(result.championVitals[2]?.hp, 12);
        assert.equal(result.shouldFlee, true);
    }
});

test('resolveCreatureAttackOutcomeState preserves champion vitals for none results with runtime updates', () => {
    const nextVitals = createVitals(12);
    nextVitals.currentStats.luck = 14;

    const result = resolveCreatureAttackOutcomeState(
        {
            attackResult: {
                kind: 'none',
                targetChampionId: 2,
                nextVitals,
            },
            creature: createCreature(),
            creatures: [createCreature()],
            stateCreatures: [createCreature()],
            stateProjectiles: [],
            currentProjectiles: [],
            championInventories: {},
            championEquipment: {},
            baseChampionEquipment: {},
            championVitals: { 2: createVitals(12) },
            damageEvents: [],
            level: 0,
        },
        {
            buildChampionDamageEvent: () => {
                throw new Error('damage event should not be built for none result');
            },
        },
    );

    assert.equal(result.kind, 'none');
    assert.equal(result.championVitals?.[2]?.currentStats.luck, 14);
});

test('resolveCreatureAttackOutcomeState applies damage and returns defeated champion id when hp reaches zero', () => {
    const result = resolveCreatureAttackOutcomeState(
        {
            attackResult: {
                kind: 'damage',
                targetChampionId: 3,
                damage: 6,
                nextVitals: createVitals(0),
            },
            creature: createCreature(),
            creatures: [createCreature()],
            stateCreatures: [createCreature()],
            stateProjectiles: [],
            currentProjectiles: [],
            championInventories: {},
            championEquipment: {},
            baseChampionEquipment: {},
            championVitals: { 3: createVitals(12) },
            damageEvents: [],
            level: 0,
        },
        {
            buildChampionDamageEvent: (level, championId, amount) => ({ level, championId, amount }),
        },
    );

    assert.equal(result.kind, 'damage');
    if (result.kind === 'damage') {
        assert.equal(result.championVitals[3]?.hp, 0);
        assert.deepEqual(result.damageEvents, [{ level: 0, championId: 3, amount: 6 }]);
        assert.equal(result.defeatedChampionId, 3);
    }
});

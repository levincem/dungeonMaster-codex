import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureDef } from '../src/data/creatures.js';
import type { CreatureInstance } from '../src/types/game.js';
import { resolveMonsterTurnState } from '../src/engine/systems/monsterTurnState.js';

function createCreature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
    return {
        id: 'creature-1',
        typeId: 1,
        mapIndex: 0,
        x: 5,
        y: 4,
        currentHP: 12,
        alive: true,
        cell: 'frontLeft',
        carriedItems: [],
        ...overrides,
    };
}

function createCreatureDef(overrides: Partial<CreatureDef> = {}): CreatureDef {
    return {
        id: 1,
        name: 'Test Creature',
        sizeOnTile: 0,
        baseHP: 10,
        armor: 0,
        hitProb: 100,
        atkSpd: 10,
        moveSpd: 12,
        exp: 0,
        experienceClass: 0,
        poison: false,
        originalAttackType: 'Impact',
        attackTypes: ['Physical'],
        drops: [],
        fixedDrops: [],
        rawAttack: 8,
        poisonAttack: 0,
        dexterity: 10,
        fireResistance: 0,
        poisonResistance: 0,
        nonMaterial: false,
        archenemy: false,
        attackAnyChampion: false,
        attackFromAllSides: false,
        attackRange: 1,
        sightRange: 4,
        preferBackRow: false,
        levitates: false,
        absorbMissiles: false,
        seeInvisible: false,
        fearResistance: 0,
        ...overrides,
    };
}

test('resolveMonsterTurnState seeds missing timers and records a fresh remembered target when the party is seen', () => {
    const result = resolveMonsterTurnState(
        {
            creature: createCreature(),
            creatureDef: createCreatureDef(),
            currentTimers: undefined,
            deltaSeconds: 0.25,
            nowMs: 1000,
            partyPosition: [6, 4],
            invisibleUntil: 0,
            lastSeen: undefined,
            confusedUntilMs: 0,
            fluxcageUntilMs: 0,
            frightenedUntilMs: 0,
        },
        {
            randomFraction: () => 0.5,
            nextMonsterMoveDelaySeconds: () => 0.8,
            nextMonsterAttackDelaySeconds: () => 1.2,
            hasLineOfSight: () => true,
        },
    );

    assert.ok(Math.abs(result.moveTimer - 0.15) < 1e-9);
    assert.ok(Math.abs(result.attackTimer - 0.35) < 1e-9);
    assert.equal(result.perception.canDetectParty, true);
    assert.equal(result.memoryUpdate.kind, 'set');
    if (result.memoryUpdate.kind === 'set') {
        assert.deepEqual(result.memoryUpdate.value, { x: 6, y: 4, expiresAt: 7000 });
    }
});

test('resolveMonsterTurnState clears expired memory when the party is no longer detectable', () => {
    const result = resolveMonsterTurnState(
        {
            creature: createCreature(),
            creatureDef: createCreatureDef({ attackRange: 2, preferBackRow: true }),
            currentTimers: { mt: 0.4, at: 0.9 },
            deltaSeconds: 0.1,
            nowMs: 5000,
            partyPosition: [10, 10],
            invisibleUntil: 6000,
            lastSeen: { x: 6, y: 4, expiresAt: 4500 },
            confusedUntilMs: 5200,
            fluxcageUntilMs: 5300,
            frightenedUntilMs: 5400,
        },
        {
            randomFraction: () => 0,
            nextMonsterMoveDelaySeconds: () => 1,
            nextMonsterAttackDelaySeconds: () => 1,
            hasLineOfSight: () => false,
        },
    );

    assert.ok(Math.abs(result.moveTimer - 0.3) < 1e-9);
    assert.ok(Math.abs(result.attackTimer - 0.8) < 1e-9);
    assert.equal(result.memoryUpdate.kind, 'clear');
    assert.equal(result.runtimeState.confused, true);
    assert.equal(result.runtimeState.fluxcaged, true);
    assert.equal(result.runtimeState.frightened, true);
    assert.equal(result.runtimeState.attackReach, 2);
    assert.equal(result.runtimeState.prefersRangedSpacing, true);
});

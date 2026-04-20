import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureInstance, FloorItem } from '../src/types/game.js';
import { buildFuseActionPatch } from '../src/engine/systems/fuseAction.js';

type TestPatch = {
    lastCastResult: { success: boolean; message: string; ts: number };
};

function createCreature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
    return {
        id: 'target',
        typeId: 5,
        mapIndex: 2,
        x: 7,
        y: 3,
        currentHP: 120,
        alive: true,
        cell: 'frontLeft',
        ...overrides,
    };
}

function createDeps() {
    const droppedItem: FloorItem = {
        id: 'drop',
        category: 'Misc',
        typeId: 1,
        mapIndex: 2,
        x: 7,
        y: 3,
        tilePos: 'North',
    };

    return {
        buildAttackResultMessage: (message: string) => ({ success: false, message, ts: 99 }),
        getEndgameMessagesForMap: () => ['The Firestaff is complete...'],
        dropCreatureCarriedItems: (creatures: CreatureInstance[], floorItems: FloorItem[]) => ({
            creatures,
            floorItems: [...floorItems, droppedItem],
        }),
        buildCreatureDamageEvent: (level: number, x: number, y: number, amount: number, creatureId?: string) => ({
            id: 'dmg',
            level,
            x,
            y,
            amount,
            creatureId,
        }),
        buildDeathDustEvent: (level: number, x: number, y: number) => ({
            id: 'dust',
            level,
            x,
            y,
            effect: 'poison_cloud',
        }),
    };
}

function createBasePatch(): TestPatch {
    return {
        lastCastResult: {
            success: true,
            message: 'Fuse',
            ts: 1,
        },
    };
}

test('buildFuseActionPatch reports missing target and missing complete Firestaff', () => {
    const deps = createDeps();

    const noTarget = buildFuseActionPatch(
        {
            now: 1000,
            level: 2,
            target: null,
            rightHand: { typeId: 45, rawName: 'The Firestaff Complete' },
            rightHandWeaponName: 'Firestaff',
            fluxcageExpiresAt: 0,
            creatures: [],
            floorItems: [],
            damageEvents: [],
            spellVisualEvents: [],
        },
        createBasePatch(),
        deps,
    );
    const noFirestaff = buildFuseActionPatch(
        {
            now: 1000,
            level: 2,
            target: createCreature(),
            rightHand: { typeId: 1, rawName: 'Sword' },
            rightHandWeaponName: 'Sword',
            fluxcageExpiresAt: 0,
            creatures: [createCreature()],
            floorItems: [],
            damageEvents: [],
            spellVisualEvents: [],
        },
        createBasePatch(),
        deps,
    );

    assert.equal(noTarget.patch.lastCastResult.message, 'FUSE has no target.');
    assert.equal(noFirestaff.patch.lastCastResult.message, 'FUSE requires the complete Firestaff.');
});

test('buildFuseActionPatch requires Lord Chaos to be fluxcaged before starting endgame', () => {
    const deps = createDeps();
    const result = buildFuseActionPatch(
        {
            now: 1000,
            level: 2,
            target: createCreature({ id: 'chaos', typeId: 23 }),
            rightHand: { typeId: 45, rawName: 'The Firestaff Complete' },
            rightHandWeaponName: 'Firestaff',
            fluxcageExpiresAt: 999,
            creatures: [createCreature({ id: 'chaos', typeId: 23 })],
            floorItems: [],
            damageEvents: [],
            spellVisualEvents: [],
        },
        createBasePatch(),
        deps,
    );

    assert.equal(result.patch.lastCastResult.message, 'Lord Chaos must be fluxcaged before FUSE.');
  });

test('buildFuseActionPatch starts the endgame flow for trapped Lord Chaos', () => {
    const deps = createDeps();
    const result = buildFuseActionPatch(
        {
            now: 1000,
            level: 2,
            target: createCreature({ id: 'chaos', typeId: 23 }),
            rightHand: { typeId: 45, rawName: 'The Firestaff Complete' },
            rightHandWeaponName: 'Firestaff',
            fluxcageExpiresAt: 2000,
            creatures: [createCreature({ id: 'chaos', typeId: 23 })],
            floorItems: [],
            damageEvents: [],
            spellVisualEvents: [],
        },
        createBasePatch(),
        deps,
    ) as { patch: TestPatch & { gamePhase: string; endgameSequence: { lordChaosId: string; messages: string[] }; projectiles: []; activePoisonClouds: [] }; clearCreatureControlStatuses?: boolean };

    assert.equal(result.clearCreatureControlStatuses, true);
    assert.equal(result.patch.gamePhase, 'endgame');
    assert.equal(result.patch.endgameSequence.lordChaosId, 'chaos');
    assert.deepEqual(result.patch.endgameSequence.messages, ['The Firestaff is complete...']);
    assert.deepEqual(result.patch.projectiles, []);
    assert.deepEqual(result.patch.activePoisonClouds, []);
});

test('buildFuseActionPatch applies fuse damage and death visuals to non-chaos targets', () => {
    const deps = createDeps();
    const target = createCreature({ currentHP: 80 });
    const result = buildFuseActionPatch(
        {
            now: 1000,
            level: 2,
            target,
            rightHand: { typeId: 45, rawName: 'The Firestaff Complete' },
            rightHandWeaponName: 'Firestaff',
            fluxcageExpiresAt: 0,
            creatures: [target],
            floorItems: [],
            damageEvents: [],
            spellVisualEvents: [],
        },
        createBasePatch(),
        deps,
    ) as { patch: TestPatch & { creatures: CreatureInstance[]; floorItems: FloorItem[]; damageEvents: Array<{ amount: number }>; spellVisualEvents: Array<{ id: string }> } };

    assert.equal(result.patch.creatures[0]?.currentHP, 0);
    assert.equal(result.patch.creatures[0]?.alive, false);
    assert.equal(result.patch.floorItems.length, 1);
    assert.equal(result.patch.damageEvents[0]?.amount, 90);
    assert.equal(result.patch.spellVisualEvents[0]?.id, 'dust');
});

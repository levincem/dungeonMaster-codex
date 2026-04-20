import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureDef } from '../src/data/creatures.js';
import type { CreatureInstance } from '../src/types/game.js';
import { buildUtilityRuntimeActionPatch } from '../src/engine/systems/utilityAttackControlState.js';

type TestPatch = {
    lastCastResult: { success: boolean; message: string; ts: number };
};

function createCreature(id: string, typeId: number): CreatureInstance {
    return {
        id,
        typeId,
        mapIndex: 2,
        x: 5,
        y: 4,
        cell: 'frontLeft',
        currentHP: 30,
        alive: true,
    };
}

const basePatch: TestPatch = {
    lastCastResult: {
        success: true,
        message: 'ok',
        ts: 1,
    },
};

const deps = {
    buildAttackResultMessage: (message: string) => ({ success: false, message, ts: 99 }),
    getCreatureDef: (typeId: number) => ({ fearResistance: typeId === 23 ? 20 : 1 }) as CreatureDef,
    quantizeDurationMs: (durationMs: number) => durationMs,
    randomInt: () => 2,
    timerTickMs: 100,
};

test('buildUtilityRuntimeActionPatch returns a control update for Confuse and Fluxcage', () => {
    const target = createCreature('chaos', 23);

    const confuse = buildUtilityRuntimeActionPatch(
        'Confuse',
        {
            now: 1000,
            frontCreatures: [target],
            target,
            rightHandTypeId: undefined,
            targetTimers: { mt: 0.5, at: 0.5 },
        },
        basePatch,
        deps,
    );
    const fluxcage = buildUtilityRuntimeActionPatch(
        'Fluxcage',
        {
            now: 1000,
            frontCreatures: [target],
            target,
            rightHandTypeId: undefined,
            targetTimers: { mt: 0.5, at: 0.5 },
        },
        basePatch,
        deps,
    );

    assert.equal(confuse.controlUpdate?.kind, 'confused');
    assert.equal(confuse.controlUpdate?.targetId, 'chaos');
    assert.deepEqual(confuse.controlUpdate?.nextTimers, { mt: 0.75, at: 1.25 });

    assert.equal(fluxcage.controlUpdate?.kind, 'fluxcaged');
    assert.equal(fluxcage.controlUpdate?.expiresAt, 121000);
});

test('buildUtilityRuntimeActionPatch reports a missing target for control actions', () => {
    const result = buildUtilityRuntimeActionPatch(
        'Confuse',
        {
            now: 1000,
            frontCreatures: [],
            target: null,
            rightHandTypeId: undefined,
            targetTimers: undefined,
        },
        basePatch,
        deps,
    );

    assert.equal(result.patch.lastCastResult.message, 'CONFUSE has no target.');
    assert.equal(result.controlUpdate, undefined);
});

test('buildUtilityRuntimeActionPatch returns fear updates and sound feedback for utility fear actions', () => {
    const result = buildUtilityRuntimeActionPatch(
        'War Cry',
        {
            now: 2000,
            frontCreatures: [createCreature('mummy', 5)],
            target: null,
            rightHandTypeId: 43,
            targetTimers: undefined,
        },
        basePatch,
        deps,
    );

    assert.equal(result.patch, basePatch);
    assert.equal(result.fearResult?.sound, 'horn');
    assert.equal(result.fearResult?.frightenedCreatures.length, 1);
    assert.deepEqual(result.fearResult?.clearLastSeenIds, ['mummy']);
});

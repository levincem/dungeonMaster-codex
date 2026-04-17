import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    applyConsumedChampionEquipmentPatch,
    buildChampionDamageEvent,
    buildCreatureDamageEvent,
    buildDeathDustEvent,
    buildRuntimeCastResult,
    buildViAltarCelebrationEvents,
    decorateViAltarResurrectionPatch,
} from '../src/engine/systems/storeFeedbackRuntime.js';

test('buildRuntimeCastResult stamps a transient message payload', () => {
    const result = buildRuntimeCastResult('Bonjour', true);
    assert.equal(result.message, 'Bonjour');
    assert.equal(result.success, true);
    assert.equal(typeof result.ts, 'number');
});

test('damage and death visual builders return the expected runtime targets', () => {
    assert.equal(buildCreatureDamageEvent(0, 2, 3, 9, 'c-1').target, 'creature');
    assert.equal(buildChampionDamageEvent(0, 1, 5).target, 'champion');
    assert.equal(buildDeathDustEvent(0, 2, 3).kind, 'death');
});

test('decorateViAltarResurrectionPatch consumes equipped bones and adds celebration feedback', () => {
    const patch = decorateViAltarResurrectionPatch(
        {
            level: 0,
            spellVisualEvents: [],
            championEquipment: {
                1: {
                    rightHand: { id: 'bones', category: 'Misc', typeId: 5, mapIndex: 0, x: 0, y: 0, tilePos: 'North' },
                },
            },
        },
        {
            championEquipment: {
                1: {
                    rightHand: { id: 'bones', category: 'Misc', typeId: 5, mapIndex: 0, x: 0, y: 0, tilePos: 'North' },
                },
            },
            spellVisualEvents: [],
        },
        4,
        18,
        'South',
        { championId: 1, fromSlot: 'rightHand' },
        {
            applyConsumedChampionEquipmentPatch,
            buildCelebrationEvents: (level, x, y, face) => buildViAltarCelebrationEvents(level, x, y, face, 1),
            buildMessageResult: buildRuntimeCastResult,
            miracleMessage: 'Miracle',
        },
    );

    assert.ok(patch);
    assert.deepEqual(patch.championEquipment?.[1], {});
    const patchedState = patch as typeof patch & { lastCastResult?: { message?: string } | null };
    assert.equal(patchedState.lastCastResult?.message, 'Miracle');
    assert.equal(patchedState.spellVisualEvents?.length, 4);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreatureDef } from '../src/data/creatures.js';
import type { CreatureInstance } from '../src/types/game.js';
import { resolveFearUtilityAction } from '../src/engine/systems/fearUtilityActions.js';

function createCreature(id: string, typeId: number): CreatureInstance {
    return {
        id,
        typeId,
        mapIndex: 0,
        x: 0,
        y: 0,
        currentHP: 10,
        alive: true,
        cell: 'frontLeft',
    };
}

test('resolveFearUtilityAction frightens eligible front creatures and clears their last seen state', () => {
    const result = resolveFearUtilityAction(
        'Calm',
        [createCreature('mummy', 1), createCreature('ghost', 2)],
        1000,
        undefined,
        {
            getCreatureDef: (typeId) => (
                typeId === 1
                    ? { fearResistance: 2 }
                    : typeId === 2
                        ? { fearResistance: 15 }
                        : undefined
            ) as CreatureDef | undefined,
            randomInt: () => 3,
            quantizeDurationMs: (durationMs) => durationMs + 5,
            timerTickMs: 10,
        },
    );

    assert.equal(result.sound, null);
    assert.deepEqual(result.clearLastSeenIds, ['mummy']);
    assert.deepEqual(result.frightenedCreatures, [{ id: 'mummy', expiresAt: 1565 }]);
});

test('resolveFearUtilityAction keeps Blow Horn sound feedback separate from the fear roll', () => {
    const result = resolveFearUtilityAction(
        'Blow Horn',
        [createCreature('screamer', 1)],
        400,
        undefined,
        {
            getCreatureDef: () => ({ fearResistance: 8 } as CreatureDef),
            randomInt: () => 2,
            quantizeDurationMs: (durationMs) => durationMs,
            timerTickMs: 10,
        },
    );

    assert.equal(result.sound, 'horn');
    assert.deepEqual(result.frightenedCreatures, []);
    assert.deepEqual(result.clearLastSeenIds, []);
});

test('resolveFearUtilityAction uses the horn sound for War Cry when the Horn of Fear is equipped', () => {
    const hornResult = resolveFearUtilityAction(
        'War Cry',
        [],
        0,
        43,
        {
            getCreatureDef: () => undefined,
            randomInt: () => 0,
            quantizeDurationMs: (durationMs) => durationMs,
            timerTickMs: 1,
        },
    );
    const voiceResult = resolveFearUtilityAction(
        'War Cry',
        [],
        0,
        12,
        {
            getCreatureDef: () => undefined,
            randomInt: () => 0,
            quantizeDurationMs: (durationMs) => durationMs,
            timerTickMs: 1,
        },
    );

    assert.equal(hornResult.sound, 'horn');
    assert.equal(voiceResult.sound, 'war-cry');
});

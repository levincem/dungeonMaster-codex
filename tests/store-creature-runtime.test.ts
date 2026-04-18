import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    clearCreatureControlStatuses,
    creatureAttackWindows,
    creatureConfusedUntil,
    creatureFluxcageUntil,
    creatureFrightenedUntil,
    creatureLastSeenPartyPos,
    creatureTimers,
    getCreatureFluxcageExpiry,
    notifyCreatureAction,
    notifyPlateActivated,
    onCreatureAction,
    resetExternalCreatureRuntimeState,
    subscribePlateActivated,
} from '../src/engine/systems/storeCreatureRuntime.js';

test('store creature runtime plate listeners subscribe, notify, and unsubscribe cleanly', () => {
    const seen: Array<[number, number, number]> = [];
    const unsubscribe = subscribePlateActivated((level, x, y) => {
        seen.push([level, x, y]);
    });

    notifyPlateActivated(1, 2, 3);
    unsubscribe();
    notifyPlateActivated(4, 5, 6);

    assert.deepEqual(seen, [[1, 2, 3]]);
});

test('store creature runtime action listeners receive move and attack events until unsubscribed', () => {
    const seen: Array<[string, 'move' | 'attack']> = [];
    const unsubscribe = onCreatureAction((id, action) => {
        seen.push([id, action]);
    });

    notifyCreatureAction('creature-1', 'move');
    notifyCreatureAction('creature-1', 'attack');
    unsubscribe();
    notifyCreatureAction('creature-2', 'move');

    assert.deepEqual(seen, [
        ['creature-1', 'move'],
        ['creature-1', 'attack'],
    ]);
});

test('store creature runtime reset and control-status helpers clear external mutable state', () => {
    creatureTimers.set('creature-1', { mt: 1, at: 2 });
    creatureAttackWindows.set('creature-1', 50);
    creatureConfusedUntil.set('creature-1', 60);
    creatureFluxcageUntil.set('creature-1', 70);
    creatureFrightenedUntil.set('creature-1', 80);
    creatureLastSeenPartyPos.set('creature-1', { x: 3, y: 4, expiresAt: 90 });

    assert.equal(getCreatureFluxcageExpiry('creature-1'), 70);

    clearCreatureControlStatuses();
    assert.equal(creatureConfusedUntil.size, 0);
    assert.equal(creatureFluxcageUntil.size, 0);
    assert.equal(creatureFrightenedUntil.size, 0);
    assert.equal(creatureTimers.size, 1);
    assert.equal(creatureAttackWindows.size, 1);

    resetExternalCreatureRuntimeState();
    assert.equal(creatureTimers.size, 0);
    assert.equal(creatureAttackWindows.size, 0);
    assert.equal(creatureLastSeenPartyPos.size, 0);
    assert.equal(getCreatureFluxcageExpiry('creature-1'), 0);
});

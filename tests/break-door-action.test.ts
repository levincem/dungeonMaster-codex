import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBreakDoorAttempt } from '../src/engine/systems/breakDoorAction.js';

test('resolveBreakDoorAttempt returns null when the door cannot be broken or is already open', () => {
    const openDoors = new Set(['0,1,2']);
    const brokenDoors = new Set(['0,3,4']);

    assert.equal(resolveBreakDoorAttempt({
        openDoors,
        brokenDoors,
        doorKey: '0,1,2',
        doorBreakable: true,
        breakPower: 99,
    }), null);

    assert.equal(resolveBreakDoorAttempt({
        openDoors,
        brokenDoors,
        doorKey: '0,7,8',
        doorBreakable: false,
        breakPower: 99,
    }), null);
});

test('resolveBreakDoorAttempt keeps the same sets when the door resists', () => {
    const openDoors = new Set<string>();
    const brokenDoors = new Set<string>();

    const result = resolveBreakDoorAttempt({
        openDoors,
        brokenDoors,
        doorKey: '0,2,3',
        doorBreakable: true,
        breakPower: 18,
    });

    assert.equal(result?.outcome, 'resisted');
    assert.equal(result?.nextOpenDoors, openDoors);
    assert.equal(result?.nextBrokenDoors, brokenDoors);
});

test('resolveBreakDoorAttempt opens and marks the door as broken once the threshold is met', () => {
    const openDoors = new Set(['0,1,1']);
    const brokenDoors = new Set(['0,4,4']);

    const result = resolveBreakDoorAttempt({
        openDoors,
        brokenDoors,
        doorKey: '0,2,3',
        doorBreakable: true,
        breakPower: 34,
    });

    assert.equal(result?.outcome, 'broken');
    assert.deepEqual([...result?.nextOpenDoors ?? []], ['0,1,1', '0,2,3']);
    assert.deepEqual([...result?.nextBrokenDoors ?? []], ['0,4,4', '0,2,3']);
});

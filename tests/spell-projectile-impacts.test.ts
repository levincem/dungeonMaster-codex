import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildBlockedSpellImpactEvent,
    buildOpenBlockedSpellPatch,
    buildOpenSpellDoorPatch,
    buildOpenBlockedSpellImpactEvent,
    buildSpellDoorImpactResult,
    getBlockedSpellImpactOffset,
} from '../src/engine/systems/spellProjectileImpacts.js';

test('buildSpellDoorImpactResult opens button doors and creates a wall visual', () => {
    const current = new Set(['a']);
    const result = buildSpellDoorImpactResult(
        {
            openDoors: current,
            doorKey: 'b',
            doorHasButton: true,
            level: 2,
            x: 4,
            y: 7,
            now: 100,
            gridSize: 1.25,
            visualScale: 0.82,
        },
        { buildIdSuffix: () => 'seed' },
    );

    assert.deepEqual([...result.nextOpenDoors], ['a', 'b']);
    assert.equal(result.shouldPlayDoorMotion, true);
    assert.deepEqual(result.visualEvent, {
        id: 'spellimpact_door_100_seed',
        level: 2,
        x: 4,
        y: 7,
        height: 0.1,
        effect: 'open',
        visualScale: 0.82,
        ts: 100,
        kind: 'wall',
    });
});

test('buildSpellDoorImpactResult keeps the same set for non-button doors', () => {
    const current = new Set(['a']);
    const result = buildSpellDoorImpactResult(
        {
            openDoors: current,
            doorKey: 'b',
            doorHasButton: false,
            level: 0,
            x: 0,
            y: 0,
            now: 0,
            gridSize: 1,
            visualScale: 1,
        },
        { buildIdSuffix: () => 'same' },
    );

    assert.equal(result.nextOpenDoors, current);
    assert.equal(result.shouldPlayDoorMotion, false);
});

test('buildOpenSpellDoorPatch merges the door visual and optional open door state', () => {
    const currentOpenDoors = new Set(['a']);
    const doorImpact = buildSpellDoorImpactResult(
        {
            openDoors: currentOpenDoors,
            doorKey: 'b',
            doorHasButton: true,
            level: 0,
            x: 2,
            y: 3,
            now: 100,
            gridSize: 1,
            visualScale: 1,
        },
        { buildIdSuffix: () => 'door' },
    );

    const patch = buildOpenSpellDoorPatch({
        nextChampionVitals: { 1: { hp: 7 } } as never,
        currentSpellVisualEvents: [{ id: 'existing' }] as never,
        currentOpenDoors,
        doorImpact,
    });

    assert.deepEqual(patch, {
        championVitals: { 1: { hp: 7 } },
        openDoors: new Set(['a', 'b']),
        spellVisualEvents: [{ id: 'existing' }, doorImpact.visualEvent],
        shouldPlayDoorMotion: true,
    });
});

test('buildOpenBlockedSpellPatch appends the wall impact and updates vitals', () => {
    const impactEvent = buildOpenBlockedSpellImpactEvent(
        {
            level: 1,
            x: 5,
            y: 6,
            now: 200,
            gridSize: 1.5,
            visualScale: 0.97,
            effect: 'open',
        },
        { buildIdSuffix: () => 'blocked' },
    );

    const patch = buildOpenBlockedSpellPatch({
        nextChampionVitals: { 1: { hp: 4 } } as never,
        currentSpellVisualEvents: [{ id: 'existing' }] as never,
        impactEvent,
    });

    assert.deepEqual(patch, {
        championVitals: { 1: { hp: 4 } },
        spellVisualEvents: [{ id: 'existing' }, impactEvent],
    });
});

test('blocked spell impact helpers compute direction offsets and wall visuals', () => {
    assert.deepEqual(getBlockedSpellImpactOffset('NORTH', 2), { offsetX: 0, offsetZ: -0.36 });
    assert.deepEqual(getBlockedSpellImpactOffset('WEST', 2), { offsetX: -0.36, offsetZ: 0 });

    const openImpact = buildOpenBlockedSpellImpactEvent(
        {
            level: 1,
            x: 5,
            y: 6,
            now: 200,
            gridSize: 1.5,
            visualScale: 0.97,
            effect: 'open',
        },
        { buildIdSuffix: () => 'open' },
    );
    const blockedImpact = buildBlockedSpellImpactEvent(
        {
            level: 1,
            x: 5,
            y: 6,
            now: 200,
            gridSize: 1.5,
            visualScale: 1,
            effect: 'fireball',
            direction: 'EAST',
        },
        { buildIdSuffix: () => 'wall' },
    );

    assert.deepEqual(openImpact, {
        id: 'spellimpact_wall_200_open',
        level: 1,
        x: 5,
        y: 6,
        height: 0.12,
        effect: 'open',
        visualScale: 0.97,
        ts: 200,
        kind: 'wall',
    });
    assert.deepEqual(blockedImpact, {
        id: 'spellimpact_wall_200_wall',
        level: 1,
        x: 5,
        y: 6,
        offsetX: 0.27,
        offsetZ: 0,
        height: 0.12,
        effect: 'fireball',
        visualScale: 1.2,
        ts: 200,
        kind: 'wall',
    });
});

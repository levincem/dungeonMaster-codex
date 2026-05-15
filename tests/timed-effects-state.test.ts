import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageTimedEffectsState, shiftRealtimeLightEffectsState } from '../src/engine/systems/timedEffectsState.js';

test('ageTimedEffectsState shifts timers back and prunes expired entries', () => {
    const patch = ageTimedEffectsState(
        {
            torchBurnStart: { torch: 1000 },
            spellLights: [
                { id: 'keep', lightContrib: 1, expiresAt: 3000 },
                { id: 'drop', lightContrib: 1, expiresAt: 1500 },
            ],
            activeFluxcages: [
                { id: 'flux-keep', level: 0, x: 1, y: 2, expiresAt: 2600 },
                { id: 'flux-drop', level: 0, x: 2, y: 2, expiresAt: 1200 },
            ],
            activeShields: [
                { id: 'shield-keep', expiresAt: 2800, defense: 4 },
                { id: 'shield-drop', expiresAt: 1200, defense: 4 },
            ],
            activePotionBoosts: [
                { id: 'boost-keep', championId: 1, stat: 'strength', amount: 5, expiresAt: 2600 },
                { id: 'boost-drop', championId: 1, stat: 'strength', amount: 5, expiresAt: 1100 },
            ],
            invisibleUntil: 900,
            magicVisionUntil: 800,
            seeThroughWallsUntil: 700,
            footprintsUntil: 600,
        },
        500,
        1000,
    );

    assert.deepEqual(patch.torchBurnStart, { torch: 500 });
    assert.deepEqual(patch.spellLights?.map((entry) => entry.id), ['keep']);
    assert.deepEqual(patch.activeFluxcages?.map((entry) => entry.id), ['flux-keep']);
    assert.deepEqual(patch.activeShields?.map((entry) => entry.id), ['shield-keep']);
    assert.deepEqual(patch.activePotionBoosts?.map((entry) => entry.id), ['boost-keep']);
    assert.equal(patch.invisibleUntil, 400);
    assert.equal(patch.magicVisionUntil, 300);
    assert.equal(patch.seeThroughWallsUntil, 200);
    assert.equal(patch.footprintsUntil, 100);
});

test('shiftRealtimeLightEffectsState moves torch and spell-light timers forward after a pause', () => {
    const patch = shiftRealtimeLightEffectsState(
        {
            torchBurnStart: { torch: 1000 },
            spellLights: [
                { id: 'light', lightContrib: 1, expiresAt: 3000 },
            ],
            activeFluxcages: [
                { id: 'flux', level: 0, x: 1, y: 1, expiresAt: 3200 },
            ],
        },
        750,
    );

    assert.deepEqual(patch.torchBurnStart, { torch: 1750 });
    assert.deepEqual(patch.spellLights, [
        { id: 'light', lightContrib: 1, expiresAt: 3750 },
    ]);
    assert.deepEqual(patch.activeFluxcages, [
        { id: 'flux', level: 0, x: 1, y: 1, expiresAt: 3950 },
    ]);
});

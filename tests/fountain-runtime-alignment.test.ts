import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameTile } from '../src/types/game.js';
import { buildChampionSheetFrontWallContext } from '../src/components/UI/championSheetDerivedState.js';
import { isFacingFountain } from '../src/engine/systems/frontWallState.js';
import {
    buildStoreDrinkFromFountainPatch,
    createStoreDrinkFromFountainRuntimeDeps,
} from '../src/engine/systems/storeItemRuntime.js';

const wallTile: GameTile = {
    x: 5,
    y: 4,
    type: 'Wall',
    objects: [],
};

function createVitals() {
    return {
        hp: 50,
        stamina: 40,
        mana: 10,
        food: 0,
        water: 0,
        currentStats: {
            luck: 10,
            strength: 10,
            dexterity: 10,
            wisdom: 10,
            vitality: 10,
            antiMagic: 10,
            antiFire: 10,
        },
        wounds: {
            head: false,
            torso: false,
            leftHand: false,
            rightHand: false,
            legs: false,
            feet: false,
        },
        poisonEntries: [],
    };
}

test('champion-sheet fountain context and store runtime agree on direct fountain drinking', () => {
    const getTileAt = (_level: number, tileX: number, tileY: number) =>
        tileX === 5 && tileY === 4 ? wallTile : undefined;
    const hasOverlay = (_level: number, tileX: number, tileY: number, face: string, overlayName: string) =>
        tileX === 5 && tileY === 4 && face === 'South' && overlayName === 'Fountain';

    const context = buildChampionSheetFrontWallContext({
        level: 0,
        position: [5, 5] as [number, number],
        direction: 'NORTH' as const,
        firedSensors: new Set<string>(),
        getTileAt,
        hasOriginalWallOverlayAt: hasOverlay,
        isAltarWallFace: () => false,
        getMechanismsAtFace: () => [],
        isFrontWallMechanism: () => false,
    });

    assert.equal(context.facingFountain, true);
    assert.equal(
        isFacingFountain(0, [5, 5], 'NORTH', {
            getTile: getTileAt,
            hasOriginalWallOverlayAt: hasOverlay,
        }),
        true,
    );

    const deps = createStoreDrinkFromFountainRuntimeDeps({
        isFacingFountain: (state) => isFacingFountain(state.level, state.position, state.direction, {
            getTile: getTileAt,
            hasOriginalWallOverlayAt: hasOverlay,
        }),
        clampWater: (value) => Math.min(2048, value),
        waterGain: 800,
    });

    assert.deepEqual(
        buildStoreDrinkFromFountainPatch(
            {
                level: 0,
                position: [5, 5] as [number, number],
                direction: 'NORTH' as const,
                championVitals: { 1: createVitals() },
            },
            1,
            deps,
        ),
        {
            championVitals: {
                1: {
                    ...createVitals(),
                    water: 800,
                },
            },
        },
    );
});

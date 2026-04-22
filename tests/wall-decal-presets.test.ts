import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRID_SIZE, WALL_HEIGHT } from '../src/engine/constants.js';
import { miscPath } from '../src/data/assetPaths.js';
import { resolveWallDecalScatterOffset } from '../src/data/wallDecalPresets.js';

test('slime and grate wall decals keep deterministic scatter offsets in the lower half of the wall', () => {
    const slimeImage = miscPath('wall_slime.png');
    const grateImage = miscPath('wall_grate.png');

    const slimeA = resolveWallDecalScatterOffset(slimeImage, 4, 7, 'East');
    const slimeB = resolveWallDecalScatterOffset(slimeImage, 4, 7, 'East');
    const grate = resolveWallDecalScatterOffset(grateImage, 9, 12, 'North');

    assert.deepEqual(slimeA, slimeB, 'wall slime scatter should stay deterministic for a given wall face');

    for (const offset of [slimeA, grate]) {
        assert.ok(
            Math.abs(offset.x) <= GRID_SIZE * 0.22 + 1e-9,
            'wall scatter should stay within the intended left/right bounds',
        );
        assert.ok(
            offset.y <= WALL_HEIGHT * 0.04 + 1e-9,
            'wall scatter should never raise the decal above its calibrated lower-half anchor',
        );
        assert.ok(
            offset.y >= -WALL_HEIGHT * 0.08 - 1e-9,
            'wall scatter should stay within the intended low-wall variation band',
        );
    }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    isFacingFountain,
    resolveFrontWallTarget,
} from '../src/engine/systems/frontWallState.js';

test('resolveFrontWallTarget maps party direction to wall coordinates and face', () => {
    assert.deepEqual(resolveFrontWallTarget([5, 6], 'NORTH'), { wallX: 6, wallY: 4, face: 'South' });
    assert.deepEqual(resolveFrontWallTarget([5, 6], 'SOUTH'), { wallX: 6, wallY: 6, face: 'North' });
    assert.deepEqual(resolveFrontWallTarget([5, 6], 'EAST'), { wallX: 7, wallY: 5, face: 'West' });
    assert.deepEqual(resolveFrontWallTarget([5, 6], 'WEST'), { wallX: 5, wallY: 5, face: 'East' });
});

test('isFacingFountain only succeeds for wall tiles with the matching fountain overlay', () => {
    const seenOverlays: Array<{ level: number; x: number; y: number; face: string; overlayName: string }> = [];
    const deps = {
        getTile: (_level: number, x: number, y: number) => (
            x === 6 && y === 4
                ? { x, y, type: 'Wall' as const, objects: [] }
                : { x, y, type: 'Floor' as const, objects: [] }
        ),
        hasOriginalWallOverlayAt: (level: number, x: number, y: number, face: string, overlayName: string) => {
            seenOverlays.push({ level, x, y, face, overlayName });
            return level === 2 && x === 6 && y === 4 && face === 'South' && overlayName === 'Fountain';
        },
    };

    assert.equal(isFacingFountain(2, [5, 6], 'NORTH', deps), true);
    assert.equal(isFacingFountain(2, [5, 6], 'SOUTH', deps), false);
    assert.deepEqual(seenOverlays[0], { level: 2, x: 6, y: 4, face: 'South', overlayName: 'Fountain' });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTorchImage } from '../src/data/itemImages.js';
import { preloadDungeonData } from '../src/data/dungeonData.js';
import { preloadGameDbData } from '../src/data/gameDbData.js';

test('getTorchImage follows the original torch charge-state table instead of equal thirds', () => {
    assert.match(getTorchImage('torch', { torch: 0 }, 8 * 60_000), /torch_used_1\.png$/);
    assert.match(getTorchImage('torch', { torch: 0 }, 12 * 60_000), /torch_used_2\.png$/);
    assert.match(getTorchImage('torch', { torch: 0 }, 15 * 60_000), /torch_unlit\.png$/);
});

test('computeLightLevel uses the original torch luminance lookup by remaining charges', async () => {
    await preloadDungeonData();
    await preloadGameDbData();
    const { computeLightLevel } = await import('../src/engine/store.js');
    const championEquipment = {
        1: {
            rightHand: {
                id: 'torch',
                category: 'Weapon' as const,
                typeId: 2,
                mapIndex: 0,
                x: 0,
                y: 0,
                tilePos: 'North' as const,
            },
        },
    };

    assert.equal(computeLightLevel([], { torch: 0 }, championEquipment, 8 * 60_000), 0.6);
    assert.equal(computeLightLevel([], { torch: 0 }, championEquipment, 12 * 60_000), 0.2);
    assert.equal(computeLightLevel([], { torch: 0 }, championEquipment, 15 * 60_000), 0);
});

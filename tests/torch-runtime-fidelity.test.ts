import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTorchImage } from '../src/data/itemImages.js';
import { preloadDungeonData } from '../src/data/dungeonData.js';
import { preloadGameDbData } from '../src/data/gameDbData.js';

test('getTorchImage follows the original torch charge-state table instead of equal thirds', () => {
    const originalNow = Date.now;
    try {
        Date.now = () => 8 * 60_000;
        assert.match(getTorchImage('torch', { torch: 0 }), /torch_used_1\.png$/);
        Date.now = () => 12 * 60_000;
        assert.match(getTorchImage('torch', { torch: 0 }), /torch_used_2\.png$/);
        Date.now = () => 15 * 60_000;
        assert.match(getTorchImage('torch', { torch: 0 }), /torch_unlit\.png$/);
    } finally {
        Date.now = originalNow;
    }
});

test('computeLightLevel uses the original torch luminance lookup by remaining charges', async () => {
    const originalNow = Date.now;
    try {
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

        Date.now = () => 8 * 60_000;
        assert.equal(computeLightLevel([], { torch: 0 }, championEquipment), 0.6);
        Date.now = () => 12 * 60_000;
        assert.equal(computeLightLevel([], { torch: 0 }, championEquipment), 0.2);
        Date.now = () => 15 * 60_000;
        assert.equal(computeLightLevel([], { torch: 0 }, championEquipment), 0);
    } finally {
        Date.now = originalNow;
    }
});

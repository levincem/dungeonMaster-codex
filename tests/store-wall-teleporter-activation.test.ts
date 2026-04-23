import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preloadDungeonData } from '../src/data/dungeonData.js';

function enterDungeonForTest<TState extends { enterDungeon: () => void }>(
    useStore: { getState: () => TState },
) {
    useStore.getState().enterDungeon();
    return useStore.getState();
}

function withAudioStub<T>(run: () => T): T {
    const originalAudio = globalThis.Audio;
    class AudioStub {
        currentTime = 0;
        volume = 1;
        muted = false;
        preload = 'auto';
        src = '';
        play() { return Promise.resolve(); }
        pause() { return undefined; }
        cloneNode() { return new AudioStub(); }
    }
    Object.assign(globalThis, { Audio: AudioStub });
    try {
        return run();
    } finally {
        Object.assign(globalThis, { Audio: originalAudio });
    }
}

test('level 2 wall buttons move the Mirror Of Dawn chest when they open a teleporter square', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);

    try {
        useStore.getState().goToLevel(2, [24, 0], 'SOUTH');

        useStore.setState({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            movementCooldown: 0,
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        });

        const beforeChest = useStore.getState().floorItems.find((item) =>
            item.mapIndex === 2 &&
            item.x === 0 &&
            item.y === 26 &&
            item.category === 'Container' &&
            item.rawName === 'Chest',
        );
        assert.ok(beforeChest, 'expected the Mirror Of Dawn chest on the closed teleporter square');
        assert.equal(beforeChest.containerContents?.[0]?.rawName, 'Mirror Of Dawn');

        withAudioStub(() => {
            useStore.getState().activateWallSensor(2, 1, 25, 65);
        });

        const afterState = useStore.getState();
        assert.equal(afterState.openTeleporters.has('2,26,0'), true);

        const afterChest = afterState.floorItems.find((item) => item.id === beforeChest.id);
        assert.ok(afterChest, 'expected the same chest item after teleporter activation');
        assert.deepEqual(
            afterChest && {
                mapIndex: afterChest.mapIndex,
                x: afterChest.x,
                y: afterChest.y,
            },
            { mapIndex: 2, x: 6, y: 26 },
        );
        assert.equal(afterChest?.containerContents?.[0]?.rawName, 'Mirror Of Dawn');
    } finally {
        useStore.setState(initialState, true);
    }
});

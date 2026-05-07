import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preloadDungeonData } from '../src/data/dungeonData.js';
import { ORIGINAL_TIMER_TICK_SECONDS } from '../src/engine/time.js';

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

const ZOOOOOM_RING_KEYS = [
    '9,14,22',
    '9,15,22',
    '9,16,22',
    '9,17,22',
    '9,18,22',
    '9,18,23',
    '9,18,24',
    '9,17,24',
    '9,16,24',
    '9,15,24',
    '9,14,24',
    '9,14,23',
];

function tickZooooomFrame<TState extends { tickGameplayFrame: (delta: number, now: number) => void }>(
    useStore: { getState: () => TState },
    now: number,
): void {
    withAudioStub(() => {
        useStore.getState().tickGameplayFrame(ORIGINAL_TIMER_TICK_SECONDS, now);
    });
}

test('level 9 Zooooom advances one square per timer tick after the party steps onto the ring', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);

    try {
        useStore.getState().goToLevel(9, [13, 22], 'SOUTH');
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

        withAudioStub(() => {
            useStore.getState().moveForward();
        });

        const afterMove = useStore.getState();
        assert.deepEqual(afterMove.position, [14, 22]);
        assert.equal(afterMove.direction, 'SOUTH');
        assert.equal(afterMove.openTeleporters.has('9,14,22'), false);
        assert.equal(afterMove.pendingSensorEvents.length > 0, true);

        tickZooooomFrame(useStore, 1_000);
        const afterTick1 = useStore.getState();
        assert.deepEqual(afterTick1.position, [15, 22]);
        assert.equal(afterTick1.direction, 'SOUTH');

        tickZooooomFrame(useStore, 1_000 + ORIGINAL_TIMER_TICK_SECONDS * 1_000);
        const afterTick2 = useStore.getState();
        assert.deepEqual(afterTick2.position, [16, 22]);
        assert.equal(afterTick2.direction, 'SOUTH');

        tickZooooomFrame(useStore, 1_000 + ORIGINAL_TIMER_TICK_SECONDS * 2_000);
        const afterTick3 = useStore.getState();
        assert.deepEqual(afterTick3.position, [17, 22]);
        assert.equal(afterTick3.direction, 'SOUTH');

        tickZooooomFrame(useStore, 1_000 + ORIGINAL_TIMER_TICK_SECONDS * 3_000);
        const afterCorner = useStore.getState();
        assert.deepEqual(afterCorner.position, [18, 22]);
        assert.equal(afterCorner.direction, 'EAST');
    } finally {
        useStore.setState(initialState, true);
    }
});

test('level 9 Zooooom lets the party step out to the east-side bonus square from the eastern lane', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);

    try {
        useStore.getState().goToLevel(9, [13, 22], 'SOUTH');
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

        withAudioStub(() => {
            useStore.getState().moveForward();
        });

        for (let index = 0; index < 7; index += 1) {
            tickZooooomFrame(useStore, 2_000 + ORIGINAL_TIMER_TICK_SECONDS * index * 1_000);
        }

        const afterRing = useStore.getState();
        assert.deepEqual(afterRing.position, [17, 24]);
        assert.equal(afterRing.direction, 'NORTH');
        assert.notDeepEqual(
            ZOOOOOM_RING_KEYS.filter((key) => afterRing.openTeleporters.has(key)),
            ZOOOOOM_RING_KEYS,
        );

        useStore.setState({
            ...afterRing,
            movementCooldown: 0,
        });

        withAudioStub(() => {
            useStore.getState().strafeRight();
        });

        const afterExit = useStore.getState();
        assert.deepEqual(afterExit.position, [17, 25]);
        assert.equal(afterExit.direction, 'NORTH');
        assert.deepEqual(
            afterExit.floorItems
                .filter((item) => item.mapIndex === 9 && item.x === 25 && item.y === 17)
                .map((item) => item.id)
                .sort(),
            ['9_25_17_Misc_179', '9_25_17_Potion_42', '9_25_17_Potion_43'],
        );
    } finally {
        useStore.setState(initialState, true);
    }
});

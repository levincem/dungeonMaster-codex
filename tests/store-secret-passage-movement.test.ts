import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preloadDungeonData } from '../src/data/dungeonData.js';
import { creatureLastSeenPartyPos, creatureTimers } from '../src/engine/systems/storeCreatureRuntime.js';

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

test('opened level 2 trick-wall secret passage allows moving forward into the floor tile beyond it', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);

    try {
        useStore.setState({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            movementCooldown: 0,
            level: 2,
            position: [29, 10],
            direction: 'NORTH',
            party: [],
            openDoors: new Set(initialState.openDoors),
            openPits: new Set(initialState.openPits),
            openTeleporters: new Set(initialState.openTeleporters),
            openWalls: new Set<string>(['2,29,10']),
            creatures: [],
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        });

        useStore.getState().moveForward();

        const afterMove = useStore.getState();
        assert.deepEqual(afterMove.position, [28, 10]);
    } finally {
        useStore.setState(initialState, true);
    }
});

test('level 2 return teleporter sends the party back to the secret-passage entrance while active', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);

    try {
        useStore.setState({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            movementCooldown: 0,
            level: 2,
            position: [28, 5],
            direction: 'WEST',
            party: [],
            openDoors: new Set(initialState.openDoors),
            openPits: new Set(initialState.openPits),
            openTeleporters: new Set(initialState.openTeleporters),
            openWalls: new Set(['2,29,10']),
            creatures: [],
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        });

        assert.equal(useStore.getState().openTeleporters.has('2,28,4'), true);
        withAudioStub(() => {
            useStore.getState().moveForward();
        });

        const afterMove = useStore.getState();
        assert.deepEqual(afterMove.position, [28, 10]);
    } finally {
        useStore.setState(initialState, true);
    }
});

test('level 2 secret-passage flasher turns the return teleporter off, then back on after the delayed reset', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);

    try {
        useStore.setState({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            movementCooldown: 0,
            level: 2,
            position: [29, 10],
            direction: 'NORTH',
            party: [],
            openDoors: new Set(initialState.openDoors),
            openPits: new Set(initialState.openPits),
            openTeleporters: new Set(initialState.openTeleporters),
            openWalls: new Set<string>(['2,29,10']),
            creatures: [],
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        });

        assert.equal(useStore.getState().openTeleporters.has('2,28,4'), true);
        useStore.getState().moveForward();

        let afterMove = useStore.getState();
        assert.deepEqual(afterMove.position, [28, 10]);
        assert.equal(afterMove.openTeleporters.has('2,28,4'), false);

        useStore.getState().tickFrame(1, Date.now());

        afterMove = useStore.getState();
        assert.equal(afterMove.openTeleporters.has('2,28,4'), true);
        assert.deepEqual(afterMove.pendingSensorEvents, [
            {
                level: 2,
                sensorIndex: 623,
                remaining: 0.96,
                actionOverride: 'Clear',
            },
        ]);

        useStore.getState().tickFrame(1, Date.now());
        afterMove = useStore.getState();
        assert.equal(afterMove.openTeleporters.has('2,28,4'), false);
    } finally {
        useStore.setState(initialState, true);
    }
});

test('level 2 mummies behind the opened Mirror Of Dawn secret passage can move toward the party', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);

    try {
        useStore.getState().goToLevel(2, [24, 7], 'NORTH');

        useStore.setState({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            movementCooldown: 0,
            position: [24, 7],
            direction: 'NORTH',
            party: [{ id: 1 } as never],
            openWalls: new Set<string>(['2,23,7']),
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        });

        const mummyIds = useStore.getState().creatures
            .filter((creature) =>
                creature.alive &&
                creature.mapIndex === 2 &&
                creature.typeId === 10 &&
                creature.x === 7 &&
                creature.y === 22,
            )
            .map((creature) => creature.id);

        assert.equal(mummyIds.length, 2, 'expected the two mummies behind the secret passage');

        for (const id of mummyIds) {
            creatureTimers.set(id, { mt: 0, at: 999 });
            creatureLastSeenPartyPos.delete(id);
        }

        withAudioStub(() => {
            useStore.getState().tickMonsters(0.1);
        });

        const afterMummies = useStore.getState().creatures.filter((creature) => mummyIds.includes(creature.id));
        assert.equal(
            afterMummies.some((creature) => creature.y === 23 && creature.x === 7),
            true,
            'expected at least one mummy to step through the opened trick wall',
        );
    } finally {
        useStore.setState(initialState, true);
    }
});

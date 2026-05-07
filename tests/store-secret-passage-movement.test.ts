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

test('level 2 secret-passage flasher schedules the return teleporter pulse after the delayed trigger', async () => {
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
        assert.equal(afterMove.openTeleporters.has('2,28,4'), true);
        assert.deepEqual(afterMove.pendingSensorEvents, [
            {
                level: 2,
                sensorIndex: 625,
                remaining: 0.24,
                actionOverride: 'Clear',
            },
        ]);

        useStore.getState().tickFrame(1, Date.now());

        afterMove = useStore.getState();
        assert.equal(afterMove.openTeleporters.has('2,28,4'), true);
        assert.deepEqual(afterMove.pendingSensorEvents, [
            {
                level: 2,
                sensorIndex: 624,
                remaining: 0.24,
                actionOverride: 'Toggle',
            },
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
        assert.deepEqual(afterMove.pendingSensorEvents, [
            {
                level: 2,
                sensorIndex: 624,
                remaining: 0.24,
                actionOverride: 'Toggle',
            },
            {
                level: 2,
                sensorIndex: 623,
                remaining: 0.96,
                actionOverride: 'Clear',
            },
        ]);
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

test('imaginary level 3 trick walls are traversable without being added to openWalls', async () => {
    await preloadDungeonData();
    const { getGameMap } = await import('../src/data/mapLoader.js');
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);
    const map = getGameMap(3);
    const wallX = 13;
    const wallY = 21;
    const wall = map.tiles[wallY]?.[wallX];

    assert.equal(wall?.type, 'TrickWall');
    assert.equal(wall?.imaginary, true);
    const westTile = map.tiles[wallY]?.[wallX - 1];
    const eastTile = map.tiles[wallY]?.[wallX + 1];
    assert.equal(westTile?.type, 'Floor');
    assert.equal(eastTile?.type, 'Floor');

    try {
        useStore.setState({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            movementCooldown: 0,
            level: 3,
            position: [wallY, wallX - 1],
            direction: 'EAST',
            party: [],
            openDoors: new Set(initialState.openDoors),
            openPits: new Set(initialState.openPits),
            openTeleporters: new Set(initialState.openTeleporters),
            openWalls: new Set<string>(),
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        });

        useStore.getState().moveForward();

        const afterMove = useStore.getState();
        assert.deepEqual(afterMove.position, [wallY, wallX]);
        assert.equal(afterMove.openWalls.has('3,21,13'), false);
    } finally {
        useStore.setState(initialState, true);
    }
});

test('tickDoors treats the prisoner-room mummy death as leaving the creature-only sensor tile', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);

    try {
        useStore.getState().goToLevel(3, [6, 7], 'NORTH');
        const baseState = useStore.getState();
        const prisonerMummy = baseState.creatures.find((creature) =>
            creature.alive &&
            creature.mapIndex === 3 &&
            creature.typeId === 10 &&
            creature.x === 7 &&
            creature.y === 5,
        );

        assert.ok(prisonerMummy, 'expected the prisoner-room mummy');

        useStore.setState({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            level: 3,
            position: [6, 7],
            direction: 'NORTH',
            openWalls: new Set<string>(),
            crushingDoors: { '3,5,7': { phase: 'closing', timer: 0.05 } },
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            floorItems: [],
            creatures: baseState.creatures.map((creature) =>
                creature.id === prisonerMummy?.id
                    ? {
                        ...creature,
                        currentHP: 5,
                        carriedItems: [{
                            id: 'mummy-loot',
                            category: 'Misc',
                            typeId: 1,
                            mapIndex: 3,
                            x: 7,
                            y: 5,
                            tilePos: 'North',
                        }],
                    }
                    : creature,
            ),
        });

        withAudioStub(() => {
            useStore.getState().tickDoors(0.2);
        });

        let afterTick = useStore.getState();
        let deadMummy = afterTick.creatures.find((creature) => creature.id === prisonerMummy?.id);
        assert.equal(deadMummy?.alive, false);
        assert.deepEqual(deadMummy?.carriedItems, []);
        assert.equal(afterTick.openWalls.has('3,5,6'), false);
        assert.equal(afterTick.floorItems.some((item) => item.id === 'mummy-loot' && item.x === 7 && item.y === 5), true);
        assert.equal(afterTick.spellVisualEvents.some((event) => event.kind === 'death' && event.x === 7 && event.y === 5), true);
        assert.equal(afterTick.crushingDoors['3,5,7'], undefined);

        withAudioStub(() => {
            useStore.getState().tickFrame(1, Date.now());
        });

        afterTick = useStore.getState();
        deadMummy = afterTick.creatures.find((creature) => creature.id === prisonerMummy?.id);
        assert.equal(deadMummy?.alive, false);
        assert.equal(afterTick.openWalls.has('3,5,6'), true);
    } finally {
        useStore.setState(initialState, true);
    }
});

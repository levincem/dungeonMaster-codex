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
    const originalWindow = (globalThis as typeof globalThis & { window?: typeof globalThis }).window;
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
    Object.assign(globalThis, { Audio: AudioStub, window: globalThis });
    try {
        return run();
    } finally {
        Object.assign(globalThis, { Audio: originalAudio, window: originalWindow });
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

test('level 3 gold coin wall slot opens the creature-only teleporter from the original walkthrough route', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);

    try {
        useStore.getState().goToLevel(3, [13, 25], 'WEST');

        const goldCoin = {
            id: 'test-gold-coin',
            category: 'Misc',
            typeId: 8,
            rawName: 'Gold Coin',
            mapIndex: 3,
            x: 25,
            y: 13,
            tilePos: 'North',
        } as const;

        useStore.setState({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            movementCooldown: 0,
            position: [13, 25],
            direction: 'WEST',
            championInventories: { 1: [goldCoin] },
            championEquipment: { 1: {} },
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        });

        assert.equal(useStore.getState().openTeleporters.has('3,15,23'), false);

        const didUse = withAudioStub(() =>
            useStore.getState().useItemOnFrontWall(1, goldCoin.id, 'inventory'),
        );

        assert.equal(didUse, true);
        assert.equal(useStore.getState().openTeleporters.has('3,15,23'), true);
    } finally {
        useStore.setState(initialState, true);
    }
});

test('level 5 solid-key wall face resolves the full original multi-lock sequence in one use', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);

    try {
        useStore.getState().goToLevel(5, [8, 20], 'SOUTH');

        const solidKey = {
            id: 'test-solid-key',
            category: 'Misc',
            typeId: 11,
            rawName: 'Solid Key',
            mapIndex: 5,
            x: 20,
            y: 8,
            tilePos: 'North',
        } as const;

        useStore.setState({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            movementCooldown: 0,
            position: [8, 20],
            direction: 'SOUTH',
            championInventories: { 1: [solidKey] },
            championEquipment: { 1: {} },
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        });

        assert.equal(useStore.getState().openDoors.has('5,8,19'), false);

        const usedKey = withAudioStub(() =>
            useStore.getState().useItemOnFrontWall(1, solidKey.id, 'inventory'),
        );
        assert.equal(usedKey, true);

        const afterUse = useStore.getState();
        assert.equal(afterUse.firedSensors.has('5_413'), true);
        assert.equal(afterUse.firedSensors.has('5_404'), true);
        assert.equal(afterUse.openDoors.has('5,8,19'), true);
        assert.equal(afterUse.championInventories[1]?.length ?? 0, 0);
    } finally {
        useStore.setState(initialState, true);
    }
});

test('level 5 solid-key wall face clears both linked teleporters and opens the door in one use', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);

    try {
        useStore.getState().goToLevel(5, [8, 20], 'SOUTH');

        const solidKey = {
            id: 'test-solid-key',
            category: 'Misc',
            typeId: 11,
            rawName: 'Solid Key',
            mapIndex: 5,
            x: 20,
            y: 8,
            tilePos: 'North',
        } as const;

        useStore.setState({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            movementCooldown: 0,
            position: [8, 20],
            direction: 'SOUTH',
            championInventories: { 1: [solidKey] },
            championEquipment: { 1: {} },
            openTeleporters: new Set([
                ...useStore.getState().openTeleporters,
                '5,4,21',
                '5,6,21',
            ]),
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        });

        const usedKey = withAudioStub(() =>
            useStore.getState().useItemOnFrontWall(1, solidKey.id, 'inventory'),
        );
        assert.equal(usedKey, true);

        const afterUse = useStore.getState();
        assert.equal(afterUse.openTeleporters.has('5,4,21'), false);
        assert.equal(afterUse.openTeleporters.has('5,6,21'), false);
        assert.equal(afterUse.firedSensors.has('5_413'), true);
        assert.equal(afterUse.firedSensors.has('5_404'), true);
        assert.equal(afterUse.openDoors.has('5,8,19'), true);
        assert.equal(afterUse.championInventories[1]?.length ?? 0, 0);
    } finally {
        useStore.setState(initialState, true);
    }
});

test('level 3 gold-key wall face resolves all original matching locks in one use', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);

    try {
        useStore.getState().goToLevel(3, [7, 28], 'SOUTH');

        const goldKey = {
            id: 'test-gold-key',
            category: 'Misc',
            typeId: 17,
            rawName: 'Gold Key',
            mapIndex: 3,
            x: 28,
            y: 7,
            tilePos: 'North',
        } as const;

        useStore.setState({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            movementCooldown: 0,
            position: [7, 28],
            direction: 'SOUTH',
            championInventories: { 1: [goldKey] },
            championEquipment: { 1: {} },
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        });

        const usedKey = withAudioStub(() =>
            useStore.getState().useItemOnFrontWall(1, goldKey.id, 'inventory'),
        );
        assert.equal(usedKey, true);

        const afterUse = useStore.getState();
        assert.equal(afterUse.firedSensors.has('3_379'), true);
        assert.equal(afterUse.firedSensors.has('3_288'), true);
        assert.equal(afterUse.firedSensors.has('3_177'), true);
        assert.equal(afterUse.championInventories[1]?.length ?? 0, 0);
    } finally {
        useStore.setState(initialState, true);
    }
});

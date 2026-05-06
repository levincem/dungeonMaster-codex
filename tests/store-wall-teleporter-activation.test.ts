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

test('level 8 pressure plate and lever route the hidden Green Gem chest through the gate pit puzzle', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);

    try {
        useStore.getState().goToLevel(8, [10, 9], 'SOUTH');

        useStore.setState({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            movementCooldown: 0,
            position: [10, 9],
            direction: 'SOUTH',
            party: [],
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        });

        const beforeChest = useStore.getState().floorItems.find((item) =>
            item.mapIndex === 8 &&
            item.x === 28 &&
            item.y === 0 &&
            item.category === 'Container' &&
            item.rawName === 'Chest',
        );
        assert.ok(beforeChest, 'expected the hidden Green Gem chest on the closed teleporter square');
        assert.equal(beforeChest.containerContents?.[0]?.rawName, 'Green Gem');

        assert.equal(useStore.getState().openTeleporters.has('8,0,28'), false);

        withAudioStub(() => {
            useStore.getState().moveForward();
        });

        const afterPlate = useStore.getState();
        assert.deepEqual(afterPlate.position, [11, 9]);
        assert.equal(afterPlate.openTeleporters.has('8,0,28'), true);

        const gateChest = afterPlate.floorItems.find((item) => item.id === beforeChest.id);
        assert.ok(gateChest, 'expected the same chest after the pressure plate opens the hidden teleporter');
        assert.deepEqual(
            gateChest && {
                mapIndex: gateChest.mapIndex,
                x: gateChest.x,
                y: gateChest.y,
            },
            { mapIndex: 8, x: 9, y: 7 },
        );

        withAudioStub(() => {
            useStore.getState().activateWallSensor(8, 10, 8, 254);
        });

        const afterLever = useStore.getState();
        assert.equal(afterLever.openPits.has('8,7,9'), true);

        const fallenChest = afterLever.floorItems.find((item) => item.id === beforeChest.id);
        assert.ok(fallenChest, 'expected the same chest after the lever opens the pit under it');
        assert.deepEqual(
            fallenChest && {
                mapIndex: fallenChest.mapIndex,
                x: fallenChest.x,
                y: fallenChest.y,
            },
            { mapIndex: 9, x: 11, y: 2 },
        );
        assert.equal(fallenChest?.containerContents?.[0]?.rawName, 'Green Gem');
    } finally {
        useStore.setState(initialState, true);
    }
});

test('level 8 Corbamite alcove rejects the wrong item and keeps the matching quest item mounted in the wall', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);

    try {
        const skeletonKey = {
            id: 'test-skeleton-key',
            category: 'Misc',
            typeId: 16,
            rawName: 'Skeleton Key',
            mapIndex: 8,
            x: 23,
            y: 15,
            tilePos: 'North',
        } as const;
        const corbamite = {
            id: 'test-corbamite',
            category: 'Misc',
            typeId: 47,
            rawName: 'Corbamite',
            mapIndex: 8,
            x: 23,
            y: 15,
            tilePos: 'North',
        } as const;

        useStore.getState().goToLevel(8, [15, 23], 'SOUTH');

        useStore.setState({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            movementCooldown: 0,
            position: [15, 23],
            direction: 'SOUTH',
            championInventories: { 0: [skeletonKey] },
            championEquipment: { 0: {} },
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        });

        const wrongMatch = withAudioStub(() => useStore.getState().useItemOnFrontWall(0, skeletonKey.id, 'inventory'));
        const afterWrongItem = useStore.getState();
        assert.equal(wrongMatch, false);
        assert.equal(afterWrongItem.openDoors.has('8,15,22'), false);
        assert.equal(afterWrongItem.championInventories[0]?.some((item) => item.id === skeletonKey.id), true);
        assert.equal(afterWrongItem.floorItems.some((item) => item.id === skeletonKey.id), false);

        useStore.setState({
            championInventories: { 0: [corbamite] },
            championEquipment: { 0: {} },
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        });

        const correctMatch = withAudioStub(() => useStore.getState().useItemOnFrontWall(0, corbamite.id, 'inventory'));
        const afterCorbamite = useStore.getState();
        assert.equal(correctMatch, true);
        assert.equal(afterCorbamite.openDoors.has('8,15,22'), true);
        assert.equal(afterCorbamite.championInventories[0]?.some((item) => item.id === corbamite.id), false);
        assert.deepEqual(
            afterCorbamite.floorItems.find((item) => item.id === corbamite.id) && {
                mapIndex: afterCorbamite.floorItems.find((item) => item.id === corbamite.id)?.mapIndex,
                x: afterCorbamite.floorItems.find((item) => item.id === corbamite.id)?.x,
                y: afterCorbamite.floorItems.find((item) => item.id === corbamite.id)?.y,
                tilePos: afterCorbamite.floorItems.find((item) => item.id === corbamite.id)?.tilePos,
            },
            { mapIndex: 8, x: 23, y: 16, tilePos: 'North' },
        );
    } finally {
        useStore.setState(initialState, true);
    }
});

test('level 8 fireball plates stay quiet when the party walks onto a plate already occupied by an item', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);

    try {
        useStore.getState().goToLevel(8, [3, 21], 'WEST');

        const heldPlateItem = {
            id: 'test-level8-fireball-plate-weight',
            category: 'Misc',
            typeId: 3,
            rawName: 'Rock',
            mapIndex: 8,
            x: 20,
            y: 3,
            tilePos: 'North',
        } as const;

        useStore.setState((state) => ({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            movementCooldown: 0,
            position: [3, 21],
            direction: 'WEST',
            party: [],
            floorItems: [...state.floorItems, heldPlateItem],
            projectiles: [],
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        }));

        withAudioStub(() => {
            useStore.getState().moveForward();
        });

        const afterMove = useStore.getState();
        assert.deepEqual(afterMove.position, [3, 20]);
        assert.equal(afterMove.projectiles.length, 0);
    } finally {
        useStore.setState(initialState, true);
    }
});

test('level 7 front-pit drops carried items to the aligned level 8 landing square', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);

    try {
        const championId = 0;

        const greenGem = {
            id: 'test-green-gem',
            category: 'Misc',
            typeId: 29,
            rawName: 'Green Gem',
            mapIndex: 7,
            x: 1,
            y: 2,
            tilePos: 'North',
        } as const;

        useStore.getState().goToLevel(7, [2, 1], 'NORTH');

        useStore.setState({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            movementCooldown: 0,
            position: [2, 1],
            direction: 'NORTH',
            championInventories: { [championId]: [greenGem] },
            championEquipment: { [championId]: {} },
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        });

        withAudioStub(() => {
            useStore.getState().dropCarriedItemInFront(championId, greenGem.id, 'inventory');
        });

        const afterDrop = useStore.getState();
        const fallenGem = afterDrop.floorItems.find((item) => item.id === greenGem.id);
        assert.ok(fallenGem, 'expected the dropped gem to remain in world state after falling');
        assert.deepEqual(
            fallenGem && {
                mapIndex: fallenGem.mapIndex,
                x: fallenGem.x,
                y: fallenGem.y,
                tilePos: fallenGem.tilePos,
            },
            { mapIndex: 8, x: 9, y: 7, tilePos: 'North' },
        );
        assert.equal(
            afterDrop.floorItems.some((item) => item.id === greenGem.id && item.mapIndex === 7 && item.x === 1 && item.y === 1),
            false,
            'the dropped gem should no longer remain suspended on the open pit square',
        );
    } finally {
        useStore.setState(initialState, true);
    }
});

test('level 7 front-pit also drops projectile items after they land on the pit square', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);

    try {
        const greenGem = {
            id: 'test-green-gem-projectile',
            category: 'Misc',
            typeId: 29,
            rawName: 'Green Gem',
            mapIndex: 7,
            x: 1,
            y: 2,
            tilePos: 'North',
        } as const;
        const now = 1_234_567;

        useStore.getState().goToLevel(7, [2, 1], 'NORTH');

        useStore.setState({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            movementCooldown: 0,
            position: [2, 1],
            direction: 'NORTH',
            party: [],
            projectiles: [
                {
                    id: 'pit-throw',
                    level: 7,
                    x: 1,
                    y: 2,
                    direction: 'NORTH',
                    effect: 'physical',
                    damage: [6, 6],
                    nextMoveAt: now,
                    remainingRange: 1,
                    remainingAttack: 6,
                    physicalItem: greenGem,
                },
            ],
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        });

        assert.equal(useStore.getState().openPits.has('7,1,1'), true);

        useStore.getState().tickSpells(now);

        const afterTick = useStore.getState();
        const fallenGem = afterTick.floorItems.find((item) => item.id === greenGem.id);
        assert.equal(afterTick.projectiles.length, 0);
        assert.ok(fallenGem, 'expected the projectile item to remain in world state after falling');
        assert.deepEqual(
            fallenGem && {
                mapIndex: fallenGem.mapIndex,
                x: fallenGem.x,
                y: fallenGem.y,
                tilePos: fallenGem.tilePos,
            },
            { mapIndex: 8, x: 9, y: 7, tilePos: 'North' },
        );
        assert.equal(
            afterTick.floorItems.some((item) => item.id === greenGem.id && item.mapIndex === 7 && item.x === 1 && item.y === 1),
            false,
            'the projectile item should not remain suspended on the open pit square after landing there',
        );
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

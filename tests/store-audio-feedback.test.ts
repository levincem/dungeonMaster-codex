import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preloadDungeonData } from '../src/data/dungeonData.js';
import { preloadOriginalWallOverlayMapData } from '../src/data/originalWallOverlayData.js';
import { onSoundPlayed, playDoorMotion } from '../src/engine/sounds.js';
import { resetExternalCreatureRuntimeState } from '../src/engine/systems/storeCreatureRuntime.js';

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
        playbackRate = 1;
        muted = false;
        preload = 'auto';
        src = '';
        paused = true;
        ended = false;
        loop = false;
        play() {
            this.paused = false;
            this.ended = false;
            return Promise.resolve();
        }
        pause() {
            this.paused = true;
            return undefined;
        }
        cloneNode() { return new AudioStub(); }
    }
    Object.assign(globalThis, { Audio: AudioStub, window: globalThis });
    try {
        return run();
    } finally {
        Object.assign(globalThis, { Audio: originalAudio, window: originalWindow });
    }
}

test('playDoorMotion keeps the door clip active until the requested duration elapses', async () => {
    const originalAudio = globalThis.Audio;
    const originalWindow = (globalThis as typeof globalThis & { window?: typeof globalThis }).window;
    const instances: AudioStub[] = [];

    class AudioStub {
        currentTime = 0;
        volume = 1;
        playbackRate = 1;
        muted = false;
        preload = 'auto';
        src = '';
        paused = true;
        ended = false;
        loop = false;

        constructor() {
            instances.push(this);
        }

        play() {
            this.paused = false;
            this.ended = false;
            return Promise.resolve();
        }

        pause() {
            this.paused = true;
            return undefined;
        }

        cloneNode() { return new AudioStub(); }
    }

    Object.assign(globalThis, { Audio: AudioStub, window: globalThis });
    try {
        playDoorMotion(20, 0.5);
        const audio = instances[0];
        assert.ok(audio);
        assert.equal(audio.loop, true);
        assert.equal(audio.paused, false);

        await new Promise((resolve) => setTimeout(resolve, 35));

        assert.equal(audio.paused, true);
        assert.equal(audio.loop, false);
    } finally {
        Object.assign(globalThis, { Audio: originalAudio, window: originalWindow });
    }
});

test('adjacent button doors still emit the door sound cue when toggled', async () => {
    await preloadDungeonData();
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);
    const heard: string[] = [];
    const stopListening = onSoundPlayed((name) => heard.push(name));
    const originalDateNow = Date.now;
    const forcedNow = originalDateNow() + 10_000;

    try {
        Date.now = () => forcedNow;

        useStore.getState().goToLevel(0, [13, 1], 'SOUTH');
        useStore.setState({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            movementCooldown: 0,
            position: [13, 1],
            direction: 'SOUTH',
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        });

        withAudioStub(() => {
            useStore.getState().toggleDoor(1, 14);
        });

        assert.deepEqual(heard, ['door']);
    } finally {
        Date.now = originalDateNow;
        stopListening();
        useStore.setState(initialState, true);
        resetExternalCreatureRuntimeState();
    }
});

test('drinking from a fountain emits the swallowing cue', async () => {
    await preloadDungeonData();
    await preloadOriginalWallOverlayMapData(8);
    const { useStore } = await import('../src/engine/store.js');
    const initialState = enterDungeonForTest(useStore);
    const heard: string[] = [];
    const stopListening = onSoundPlayed((name) => heard.push(name));
    const originalDateNow = Date.now;
    const forcedNow = originalDateNow() + 20_000;

    try {
        Date.now = () => forcedNow;

        useStore.getState().goToLevel(8, [28, 0], 'EAST');
        useStore.setState({
            gamePhase: 'exploration',
            paused: false,
            sleeping: false,
            optionsModalOpen: false,
            movementCooldown: 0,
            position: [28, 0],
            direction: 'EAST',
            championVitals: {
                1: {
                    hp: 50,
                    stamina: 40,
                    mana: 10,
                    food: 0,
                    water: 0,
                    currentStats: {
                        luck: 10,
                        strength: 10,
                        dexterity: 10,
                        wisdom: 10,
                        vitality: 10,
                        antiMagic: 10,
                        antiFire: 10,
                    },
                    wounds: {
                        head: false,
                        torso: false,
                        leftHand: false,
                        rightHand: false,
                        legs: false,
                        feet: false,
                    },
                    poisonEntries: [],
                },
            },
            pendingSensorEvents: [],
            damageEvents: [],
            spellVisualEvents: [],
            activeFloorDrag: null,
            lastMonsterAttackDebug: null,
        });

        withAudioStub(() => {
            useStore.getState().drinkFromFountain(1);
        });

        assert.deepEqual(heard, ['swallowing']);
    } finally {
        Date.now = originalDateNow;
        stopListening();
        useStore.setState(initialState, true);
        resetExternalCreatureRuntimeState();
    }
});

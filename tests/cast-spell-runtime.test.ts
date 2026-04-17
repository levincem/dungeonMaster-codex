import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import { runCastSpellRuntime } from '../src/engine/systems/castSpellRuntime.js';

type TestSpell = {
    id: string;
};

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champ ${id}`,
        title: 'Tester',
        gender: 'M',
        class: 'Wizard',
        health: 50,
        stamina: 50,
        mana: 30,
        luck: 10,
        strength: 10,
        dexterity: 10,
        wisdom: 12,
        vitality: 10,
        antiMagic: 0,
        antiFire: 0,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: '',
    };
}

function createVitals(): ChampionVitals {
    return {
        hp: 40,
        stamina: 35,
        mana: 18,
        food: 900,
        water: 900,
        currentStats: {
            luck: 10,
            strength: 10,
            dexterity: 10,
            wisdom: 12,
            vitality: 10,
            antiMagic: 0,
            antiFire: 0,
        },
        wounds: {
            rightHand: false,
            leftHand: false,
            head: false,
            torso: false,
            legs: false,
            feet: false,
        },
        poisonEntries: [],
    };
}

function createState() {
    return {
        party: [createChampion(1)],
        championVitals: { 1: createVitals() },
    };
}

test('runCastSpellRuntime returns the unknown-rune patch when no spell matches', () => {
    const result = runCastSpellRuntime<TestSpell, { kind: string }>(
        createState(),
        1,
        ['zo', 'ku'],
        {
            findSpell: () => null,
            buildUnknownCombinationPatch: () => ({ kind: 'unknown' }),
            prepareCast: () => ({ kind: 'blocked', patch: { kind: 'blocked' } }),
            buildFailedCastPatch: (basePatch) => basePatch,
            buildNonProjectilePatch: () => null,
            buildProjectilePatch: () => null,
            mergeBasePatch: (basePatch) => basePatch,
        },
    );

    assert.deepEqual(result, {
        patch: { kind: 'unknown' },
        shouldPlayDoorMotion: false,
    });
});

test('runCastSpellRuntime delegates successful non-projectile spells through the non-projectile builder', () => {
    const spell = { id: 'light' };

    const result = runCastSpellRuntime<TestSpell, { kind: string; base?: boolean }>(
        createState(),
        1,
        ['ful'],
        {
            findSpell: () => spell,
            buildUnknownCombinationPatch: () => ({ kind: 'unknown' }),
            prepareCast: () => ({
                kind: 'ready',
                basePatch: { kind: 'base', base: true },
                castSucceeded: true,
                nextVitals: createVitals(),
                skillLevel: 4,
            }),
            buildFailedCastPatch: (basePatch) => basePatch,
            buildNonProjectilePatch: () => ({ kind: 'non-projectile' }),
            buildProjectilePatch: () => null,
            mergeBasePatch: (_basePatch, nextPatch) => nextPatch,
        },
    );

    assert.deepEqual(result, {
        patch: { kind: 'non-projectile' },
        shouldPlayDoorMotion: false,
    });
});

test('runCastSpellRuntime merges projectile patches and preserves door-motion metadata', () => {
    const spell = { id: 'open' };

    const result = runCastSpellRuntime<TestSpell, { base?: boolean; kind?: string }>(
        createState(),
        1,
        ['des', 'ew'],
        {
            findSpell: () => spell,
            buildUnknownCombinationPatch: () => ({ kind: 'unknown' }),
            prepareCast: () => ({
                kind: 'ready',
                basePatch: { base: true },
                castSucceeded: true,
                nextVitals: createVitals(),
                skillLevel: 6,
            }),
            buildFailedCastPatch: (basePatch) => basePatch,
            buildNonProjectilePatch: () => null,
            buildProjectilePatch: () => ({
                patch: { kind: 'projectile' },
                shouldPlayDoorMotion: true,
                doorMotionSquare: { level: 0, x: 5, y: 4 },
            }),
            mergeBasePatch: (basePatch, nextPatch) => ({
                ...basePatch,
                ...nextPatch,
            }),
        },
    );

    assert.deepEqual(result, {
        patch: { base: true, kind: 'projectile' },
        shouldPlayDoorMotion: true,
        doorMotionSquare: { level: 0, x: 5, y: 4 },
    });
});

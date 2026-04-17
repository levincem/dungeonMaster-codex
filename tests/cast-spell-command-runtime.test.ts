import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionVitals } from '../src/engine/runtimeTypes.js';
import { buildCastSpellCommandRuntimeResult } from '../src/engine/systems/castSpellCommandRuntime.js';

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
        championEquipment: { 1: {} },
        championCombat: { 1: { cooldown: 0, cooldownMax: 1, defenseModifier: 0 } },
        activePotionBoosts: [],
        activeShields: [],
        floorItems: [],
        spellLights: [],
        spellVisualEvents: [],
        activePoisonClouds: [],
        openDoors: new Set<string>(),
        openWalls: new Set<string>(),
        invisibleUntil: 0,
        seeThroughWallsUntil: 0,
        magicVisionUntil: 0,
        footprintsUntil: 0,
        level: 0,
        position: [0, 0] as [number, number],
        direction: 'NORTH' as const,
        elapsedGameTimeTicks: 0,
        projectiles: [],
    };
}

test('buildCastSpellCommandRuntimeResult delegates unknown combinations through the command wrapper', () => {
    const result = buildCastSpellCommandRuntimeResult<{ kind?: string; now?: number }>(
        createState(),
        1,
        ['zo', 'ku'],
        100,
        {
            findSpell: () => null,
            buildUnknownCombinationPatch: (now) => ({ kind: 'unknown', now }),
            prepareCast: () => ({ kind: 'blocked', patch: { kind: 'blocked' } }),
            buildFailedCastPatch: (_state, _championId, basePatch) => basePatch,
            buildNonProjectilePatch: () => null,
            buildProjectilePatch: () => null,
            mergeBasePatch: (basePatch) => basePatch,
        },
    );

    assert.deepEqual(result, {
        patch: { kind: 'unknown', now: 100 },
        shouldPlayDoorMotion: false,
    });
});

test('buildCastSpellCommandRuntimeResult preserves projectile door motion metadata', () => {
    const spell = {
        runes: ['des', 'ew'],
        effect: 'open' as const,
        manaBase: 4,
        manaCost: 4,
        castSkill: 'priest' as const,
        name: 'Open',
        description: 'Opens a door',
    };

    const result = buildCastSpellCommandRuntimeResult<{ kind?: string; base?: boolean }>(
        createState(),
        1,
        ['des', 'ew'],
        250,
        {
            findSpell: () => spell,
            buildUnknownCombinationPatch: () => ({ kind: 'unknown' as const }),
            prepareCast: () => ({
                kind: 'ready',
                basePatch: { base: true },
                castSucceeded: true,
                nextVitals: createVitals(),
                skillLevel: 4,
            }),
            buildFailedCastPatch: (_state, _championId, basePatch) => basePatch,
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

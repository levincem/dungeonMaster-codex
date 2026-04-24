import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type {
    ChampionEquipment,
    CreatureInstance,
    FloorItem,
} from '../src/types/game.js';
import type {
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    SpellVisualEvent,
} from '../src/engine/runtimeTypes.js';
import {
    createEmptyChampionTemporaryXP,
    createEmptyChampionXP,
} from '../src/data/skillProgression.js';
import type { WeaponAttackOption } from '../src/data/weaponAttacks.js';
import { buildAttackMeleeStatePatch } from '../src/engine/systems/attackMeleeState.js';

function createChampion(): Champion {
    return {
        id: 1,
        name: 'Halk',
        title: 'The Tester',
        gender: 'M',
        class: 'Fighter',
        health: 120,
        stamina: 90,
        mana: 10,
        luck: 20,
        strength: 50,
        dexterity: 25,
        wisdom: 12,
        vitality: 40,
        antiMagic: 4,
        antiFire: 6,
        skills: {
            fighter: [1, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: 'portrait.png',
    };
}

function createVitals(): ChampionVitals {
    return {
        hp: 100,
        stamina: 70,
        mana: 10,
        food: 900,
        water: 900,
        currentStats: {
            luck: 20,
            strength: 50,
            dexterity: 25,
            wisdom: 12,
            vitality: 40,
            antiMagic: 4,
            antiFire: 6,
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

function createCombat(): ChampionCombat {
    return {
        cooldown: 2,
        cooldownMax: 2,
        defenseModifier: 0,
    };
}

function createCreature(): CreatureInstance {
    return {
        id: 'target',
        typeId: 5,
        mapIndex: 0,
        x: 4,
        y: 2,
        currentHP: 20,
        alive: true,
        cell: 'frontLeft',
    };
}

function createAttack(): WeaponAttackOption {
    return {
        attackType: 0,
        enumName: 'Hack',
        displayName: 'Hack',
        requiresCharges: false,
        masteryThreshold: 0,
        source: 'primary',
        attack: {
            index: 0,
            enumName: 'Hack',
            displayName: 'Hack',
            experienceForAttacking: 5,
            skillNumber: 0,
            defenseModifier: 0,
            staminaCost: 5,
            strengthRequired: 0,
            baseDamage: 20,
            disableTime: 10,
        },
    };
}

function createState() {
    return {
        championId: 1,
        championCombat: { 1: createCombat() } as Record<number, ChampionCombat>,
        championVitals: { 1: createVitals() },
        level: 0,
        position: [3, 3] as [number, number],
        direction: 'NORTH' as const,
        openDoors: new Set<string>(),
        brokenDoors: new Set<string>(),
        creatures: [createCreature()],
        floorItems: [] as FloorItem[],
        party: [createChampion()],
        championXP: { 1: createEmptyChampionXP() },
        championTemporaryXP: { 1: createEmptyChampionTemporaryXP() },
        elapsedGameTimeTicks: 100,
        lastCreatureAttackGameTick: 90,
        damageEvents: [] as DamageEvent[],
        spellVisualEvents: [] as SpellVisualEvent[],
    };
}

test('buildAttackMeleeStatePatch returns the base patch when there is no target and no breakable door', () => {
    const state = createState();
    const patch = buildAttackMeleeStatePatch(
        state,
        createChampion(),
        {} as ChampionEquipment,
        [],
        createAttack(),
        null,
        createCombat(),
        'fighter',
        {
            tryBreakFrontDoor: () => null,
            determineMeleeDamage: () => 0,
            getAttackSkill: () => 'fighter',
            applyMeleeActionOutcomeVitals: (vitals) => vitals,
            buildMeleeActionExperiencePatch: () => null,
            buildMeleeAttackResolution: () => {
                throw new Error('should not resolve melee');
            },
        },
    );

    assert.deepEqual(patch, {
        championCombat: { 1: createCombat() },
        championVitals: state.championVitals,
    });
});

test('buildAttackMeleeStatePatch applies the break-door result when no target is present', () => {
    const state = createState();
    const patch = buildAttackMeleeStatePatch(
        state,
        createChampion(),
        {} as ChampionEquipment,
        [],
        createAttack(),
        null,
        createCombat(),
        'fighter',
        {
            tryBreakFrontDoor: () => ({
                openDoors: new Set(['0,2,4']),
                brokenDoors: new Set(['0,2,4']),
                message: { success: true, message: 'The door gives way.', ts: 1 },
            }),
            determineMeleeDamage: () => 0,
            getAttackSkill: () => 'fighter',
            applyMeleeActionOutcomeVitals: (vitals) => vitals,
            buildMeleeActionExperiencePatch: () => null,
            buildMeleeAttackResolution: () => {
                throw new Error('should not resolve melee');
            },
        },
    );

    const doorPatch = patch as {
        lastCastResult?: { message: string };
        openDoors?: Set<string>;
        brokenDoors?: Set<string>;
    };
    assert.equal(doorPatch.lastCastResult?.message, 'The door gives way.');
    assert.deepEqual([...doorPatch.openDoors ?? []], ['0,2,4']);
    assert.deepEqual([...doorPatch.brokenDoors ?? []], ['0,2,4']);
});

test('buildAttackMeleeStatePatch returns the base patch when melee damage is zero', () => {
    const state = createState();
    const patch = buildAttackMeleeStatePatch(
        state,
        createChampion(),
        {} as ChampionEquipment,
        [],
        createAttack(),
        state.creatures[0]!,
        createCombat(),
        'fighter',
        {
            tryBreakFrontDoor: () => null,
            determineMeleeDamage: () => 0,
            getAttackSkill: () => 'fighter',
            applyMeleeActionOutcomeVitals: (vitals) => vitals,
            buildMeleeActionExperiencePatch: () => null,
            buildMeleeAttackResolution: () => {
                throw new Error('should not resolve melee');
            },
        },
    );

    assert.deepEqual(patch, {
        championCombat: { 1: createCombat() },
        championVitals: state.championVitals,
    });
});

test('buildAttackMeleeStatePatch applies miss stamina and half action experience', () => {
    const state = createState();
    const missVitals = {
        ...state.championVitals,
        1: {
            ...state.championVitals[1]!,
            stamina: 67,
        },
    };
    let observedAmount = 0;
    let observedVitals: Record<number, ChampionVitals> | null = null;

    const patch = buildAttackMeleeStatePatch(
        state,
        createChampion(),
        {} as ChampionEquipment,
        [],
        createAttack(),
        state.creatures[0]!,
        createCombat(),
        'fighter',
        {
            tryBreakFrontDoor: () => null,
            determineMeleeDamage: () => 0,
            getAttackSkill: () => 'swing',
            applyMeleeActionOutcomeVitals: () => missVitals,
            buildMeleeActionExperiencePatch: (xpState, _championId, skill, amount) => {
                observedAmount = amount;
                observedVitals = xpState.championVitals;
                return {
                    championVitals: xpState.championVitals,
                    championXP: {
                        ...xpState.championXP,
                        1: {
                            ...xpState.championXP[1]!,
                            [skill]: amount,
                        },
                    },
                    championTemporaryXP: xpState.championTemporaryXP,
                };
            },
            buildMeleeAttackResolution: () => {
                throw new Error('should not resolve melee');
            },
        },
    );

    assert.equal(patch.championVitals[1]?.stamina, 67);
    assert.equal(observedAmount, 2);
    assert.equal(observedVitals, missVitals);
    assert.equal(patch.championXP?.[1]?.swing, 2);
});

test('buildAttackMeleeStatePatch merges the melee resolution into the full championCombat map', () => {
    const state = createState();
    state.championCombat = {
        1: createCombat(),
        2: {
            cooldown: 5,
            cooldownMax: 5,
            defenseModifier: 1,
        },
    } as Record<number, ChampionCombat>;

    const patch = buildAttackMeleeStatePatch(
        state,
        createChampion(),
        {} as ChampionEquipment,
        [],
        createAttack(),
        state.creatures[0]!,
        createCombat(),
        'fighter',
        {
            tryBreakFrontDoor: () => null,
            determineMeleeDamage: () => 12,
            getAttackSkill: () => 'swing',
            applyMeleeActionOutcomeVitals: (vitals) => vitals,
            buildMeleeActionExperiencePatch: () => null,
            buildMeleeAttackResolution: () => ({
                creatures: state.creatures,
                championVitals: state.championVitals,
                championXP: state.championXP,
                championTemporaryXP: state.championTemporaryXP,
                championCombat: { 1: createCombat() },
                damageEvents: state.damageEvents,
            }),
        },
    );

    assert.equal(patch.championCombat[1]?.cooldown, 2);
    assert.equal(patch.championCombat[2]?.cooldown, 5);
});

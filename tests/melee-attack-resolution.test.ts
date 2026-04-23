import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { CreatureInstance, FloorItem } from '../src/types/game.js';
import type { ChampionCombat, ChampionVitals } from '../src/engine/runtimeTypes.js';
import {
    createEmptyChampionTemporaryXP,
    createEmptyChampionXP,
    type ChampionTemporaryXP,
    type ChampionXP,
    type SkillKey,
} from '../src/data/skillProgression.js';
import { buildMeleeAttackResolutionPatch } from '../src/engine/systems/meleeAttackResolution.js';

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champion ${id}`,
        title: 'The Tester',
        gender: 'M',
        class: 'Fighter',
        health: 120,
        stamina: 90,
        mana: 30,
        luck: 40,
        strength: 45,
        dexterity: 35,
        wisdom: 25,
        vitality: 50,
        antiMagic: 10,
        antiFire: 11,
        skills: {
            fighter: [1, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#ffffff',
        equipment: [],
        portrait: 'portrait.png',
    };
}

function createVitals(hp = 80): ChampionVitals {
    return {
        hp,
        stamina: 60,
        mana: 20,
        food: 1500,
        water: 1400,
        currentStats: {
            luck: 10,
            strength: 10,
            dexterity: 10,
            wisdom: 10,
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

function createCreature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
    return {
        id: 'target',
        typeId: 5,
        mapIndex: 2,
        x: 7,
        y: 3,
        currentHP: 40,
        alive: true,
        cell: 'frontLeft',
        ...overrides,
    };
}

function createState() {
    const party = [createChampion(1), createChampion(2)];
    return {
        level: 2,
        creatures: [createCreature()],
        floorItems: [] as FloorItem[],
        party,
        championVitals: {
            1: createVitals(80),
            2: createVitals(70),
        } as Record<number, ChampionVitals>,
        championXP: {
            1: createEmptyChampionXP(),
            2: createEmptyChampionXP(),
        } as Record<number, ChampionXP>,
        championTemporaryXP: {
            1: createEmptyChampionTemporaryXP(),
            2: createEmptyChampionTemporaryXP(),
        } as Record<number, ChampionTemporaryXP>,
        elapsedGameTimeTicks: 100,
        lastCreatureAttackGameTick: 90,
        damageEvents: [],
        spellVisualEvents: [],
    };
}

function createCombat(): ChampionCombat {
    return {
        cooldown: 2,
        cooldownMax: 2,
        defenseModifier: 0,
    };
}

function createXpDeps() {
    const droppedItem: FloorItem = {
        id: 'drop_target',
        category: 'Misc',
        typeId: 1,
        mapIndex: 2,
        x: 7,
        y: 3,
        tilePos: 'North',
    };

    return {
        applyChampionSkillExperience: (
            carrier: {
                party: Champion[];
                championVitals: Record<number, ChampionVitals>;
                championXP: Record<number, ChampionXP>;
                championTemporaryXP: Record<number, ChampionTemporaryXP>;
            },
            championId: number,
            skill: SkillKey,
            amount: number,
        ) => {
            const nextChampionXP = {
                ...carrier.championXP,
                [championId]: {
                    ...carrier.championXP[championId],
                    [skill]: carrier.championXP[championId][skill] + amount,
                },
            };
            const nextChampionTemporaryXP = {
                ...carrier.championTemporaryXP,
                [championId]: {
                    ...carrier.championTemporaryXP[championId],
                    [skill]: carrier.championTemporaryXP[championId][skill] + amount,
                },
            };
            return {
                championVitals: {
                    ...carrier.championVitals,
                    [championId]: {
                        ...carrier.championVitals[championId],
                        currentStats: {
                            ...carrier.championVitals[championId]!.currentStats,
                            strength: carrier.championVitals[championId]!.currentStats.strength + 1,
                        },
                    },
                },
                championXP: nextChampionXP,
                championTemporaryXP: nextChampionTemporaryXP,
                party: carrier.party,
            };
        },
        dropCreatureCarriedItems: (creatures: CreatureInstance[], floorItems: FloorItem[], creatureId: string) => ({
            creatures,
            floorItems: [...floorItems, { ...droppedItem, id: `drop_${creatureId}` }],
        }),
        buildCreatureDamageEvent: (level: number, x: number, y: number, amount: number, creatureId?: string) => ({
            id: 'dmg',
            level,
            target: 'creature' as const,
            creatureId,
            x,
            y,
            amount,
            ts: 1,
        }),
        buildDeathDustEvent: (level: number, x: number, y: number) => ({
            id: 'dust',
            level,
            x,
            y,
            effect: 'poison_cloud' as const,
            ts: 1,
            kind: 'death' as const,
        }),
    };
}

test('buildMeleeAttackResolutionPatch applies damage without kill rewards when the creature survives', () => {
    const state = createState();
    const patch = buildMeleeAttackResolutionPatch(
        state,
        1,
        state.creatures[0]!,
        15,
        'swing',
        createCombat(),
        createXpDeps(),
    );

    assert.equal(patch.creatures[0]?.currentHP, 25);
    assert.equal(patch.creatures[0]?.alive, true);
    assert.equal(patch.damageEvents.length, 1);
    assert.equal(patch.spellVisualEvents, undefined);
    assert.equal(patch.championXP[1]?.swing, 15);
    assert.equal(patch.championXP[1]?.fighter, 0);
    assert.equal(patch.championVitals[1]?.currentStats.strength, 11);
});

test('buildMeleeAttackResolutionPatch drops loot and adds death visuals on kill without shared kill XP', () => {
    const state = createState();
    const target = createCreature({ currentHP: 25 });
    state.creatures = [target];

    const patch = buildMeleeAttackResolutionPatch(
        state,
        1,
        target,
        30,
        'swing',
        createCombat(),
        createXpDeps(),
    );

    assert.equal(patch.creatures[0]?.currentHP, 0);
    assert.equal(patch.creatures[0]?.alive, false);
    assert.equal(patch.floorItems?.length, 1);
    assert.equal(patch.damageEvents.length, 1);
    assert.equal(patch.spellVisualEvents?.length, 1);
    assert.equal(patch.championXP[1]?.swing, 30);
    assert.equal(patch.championXP[1]?.fighter, 0);
    assert.equal(patch.championXP[2]?.fighter, 0);
});

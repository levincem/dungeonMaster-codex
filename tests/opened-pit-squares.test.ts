import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../src/types/game.js';
import type {
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    PartyShield,
    SpellVisualEvent,
} from '../src/engine/runtimeTypes.js';
import { applyOpenedPitEffects } from '../src/engine/systems/openedPitSquares.js';

const EMPTY_WOUNDS = {
    rightHand: false,
    leftHand: false,
    head: false,
    torso: false,
    legs: false,
    feet: false,
};

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champ ${id}`,
        title: 'Adventurer',
        gender: 'M',
        class: 'Fighter',
        health: 30,
        stamina: 40,
        mana: 5,
        luck: 10,
        strength: 10,
        dexterity: 10,
        wisdom: 10,
        vitality: 10,
        antiMagic: 0,
        antiFire: 0,
        portrait: '',
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
    };
}

function createCreature(id: string, overrides: Partial<CreatureInstance> = {}): CreatureInstance {
    return {
        id,
        typeId: 1,
        mapIndex: 0,
        x: 1,
        y: 1,
        currentHP: 30,
        alive: true,
        cell: 'center',
        ...overrides,
    };
}

function createState(overrides: Partial<Parameters<typeof applyOpenedPitEffects>[0]> = {}) {
    return {
        level: 0,
        position: [4, 5] as [number, number],
        hydratedLevels: new Set<number>([0]),
        party: [createChampion(1)],
        selectedChampionIndex: 0,
        creatures: [] as CreatureInstance[],
        floorItems: [] as FloorItem[],
        championInventories: {} as Record<number, FloorItem[]>,
        championEquipment: {} as Record<number, ChampionEquipment>,
        championVitals: {
            1: {
                hp: 30,
                stamina: 40,
                mana: 5,
                food: 100,
                water: 100,
                currentStats: {
                    luck: 10,
                    strength: 10,
                    dexterity: 10,
                    wisdom: 10,
                    vitality: 10,
                    antiMagic: 0,
                    antiFire: 0,
                },
                wounds: { ...EMPTY_WOUNDS },
                poisonEntries: [],
            },
        } as Record<number, ChampionVitals>,
        damageEvents: [] as DamageEvent[],
        spellVisualEvents: [] as SpellVisualEvent[],
        deadChampions: {} as Record<number, Champion>,
        activeShields: [] as PartyShield[],
        activePotionBoosts: [] as ActivePotionBoost[],
        championCombat: {} as Record<number, ChampionCombat>,
        openDoors: new Set<string>(),
        openWalls: new Set<string>(),
        openPits: new Set<string>(['0,4,5']),
        ...overrides,
    };
}

test('applyOpenedPitEffects moves the party through newly opened pits and applies fall damage', () => {
    const result = applyOpenedPitEffects(
        createState({
            creatures: [createCreature('guardian', { mapIndex: 1, x: 7, y: 8 })],
        }),
        ['0,4,5'],
        {
            resolvePitLanding: () => ({ level: 1, x: 7, y: 8 }),
            applyPartyTelefragAtSquare: () => ({
                creatures: [createCreature('guardian', { mapIndex: 1, x: 7, y: 8, alive: false, currentHP: 0 })],
                floorItems: [{ id: 'loot-1', category: 'Misc', typeId: 1, mapIndex: 1, x: 7, y: 8, tilePos: 'North' }],
                spellVisualEvents: [{ id: 'fx-1', level: 1, x: 7, y: 8, effect: 'fireball', ts: 0, kind: 'death' }],
            }),
            buildLevelHydrationPatch: () => null,
            applyPartyFallImpactDamage: (_state, _vitals, landingLevel, landingPosition) => ({
                championVitals: {
                    1: {
                        hp: 22,
                        stamina: 40,
                        mana: 5,
                        food: 100,
                        water: 100,
                        currentStats: {
                            luck: 10,
                            strength: 10,
                            dexterity: 10,
                            wisdom: 10,
                            vitality: 10,
                            antiMagic: 0,
                            antiFire: 0,
                        },
                        wounds: { ...EMPTY_WOUNDS },
                        poisonEntries: [],
                    },
                },
                damageEvents: [{ id: 'fall-1', level: landingLevel, target: 'champion', championId: 1, amount: 8, ts: 0 }],
                floorItems: [{ id: 'loot-1', category: 'Misc', typeId: 1, mapIndex: landingLevel, x: landingPosition[1], y: landingPosition[0], tilePos: 'North' }],
            }),
            applyCreaturesStandingOnOpenPit: () => null,
        },
    );

    assert.equal(result.changed, true);
    assert.equal(result.level, 1);
    assert.deepEqual(result.position, [8, 7]);
    assert.equal(result.championVitals[1]?.hp, 22);
    assert.equal(result.damageEvents[0]?.amount, 8);
    assert.equal(result.floorItems.length, 1);
    assert.equal(result.spellVisualEvents.length, 1);
});

test('applyOpenedPitEffects also applies creature falls on newly opened pit squares', () => {
    const result = applyOpenedPitEffects(
        createState({
            position: [0, 0],
            creatures: [createCreature('c2', { mapIndex: 2, x: 4, y: 5, currentHP: 50 })],
            openPits: new Set<string>(['2,5,4']),
        }),
        ['2,5,4'],
        {
            resolvePitLanding: () => null,
            applyPartyTelefragAtSquare: () => null,
            buildLevelHydrationPatch: () => null,
            applyPartyFallImpactDamage: () => null,
            applyCreaturesStandingOnOpenPit: () => ({
                creatures: [createCreature('c2', { mapIndex: 3, x: 6, y: 7, currentHP: 30 })],
                damageEvents: [{ id: 'pit-c2', level: 3, target: 'creature', creatureId: 'c2', amount: 20, ts: 0 }],
            }),
        },
    );

    assert.equal(result.changed, true);
    assert.deepEqual(
        result.creatures[0] && {
            mapIndex: result.creatures[0].mapIndex,
            x: result.creatures[0].x,
            y: result.creatures[0].y,
            currentHP: result.creatures[0].currentHP,
        },
        { mapIndex: 3, x: 6, y: 7, currentHP: 30 },
    );
    assert.equal(result.damageEvents[0]?.amount, 20);
});

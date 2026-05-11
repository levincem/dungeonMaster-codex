import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createEmptyChampionTemporaryXP,
    createEmptyChampionXP,
    type ChampionTemporaryXP,
    type ChampionXP,
    type SkillKey,
} from '../src/data/skillProgression.js';
import {
    getAttackCooldownSeconds,
    getAttackOptionUnusableReason,
    getRequiredAmmoRawClass,
    getWeaponAttackOptions,
    isAttackOptionUsableAtMastery,
    isPhysicalAttack,
    isShootAttack,
    isThrowAttack,
} from '../src/data/weaponAttacks.js';
import { preloadGameDbData } from '../src/data/gameDbData.js';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, CreatureInstance, FloorItem, GameTile } from '../src/types/game.js';
import type {
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    PartyShield,
    Projectile,
    SpellVisualEvent,
} from '../src/engine/runtimeTypes.js';
import { createEmptyStatBonuses } from '../src/engine/systems/championRuntimeBonuses.js';
import { buildStoreAttackFrontRuntimePatch } from '../src/engine/systems/storeAttackFrontRuntime.js';
import { getOriginalThrownObjectExperience } from '../src/engine/systems/originalThrownObjectExperience.js';

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champion ${id}`,
        title: 'The Tester',
        gender: 'M',
        class: 'Fighter',
        health: 80,
        stamina: 70,
        mana: 25,
        luck: 12,
        strength: 20,
        dexterity: 18,
        wisdom: 14,
        vitality: 16,
        antiMagic: 4,
        antiFire: 3,
        skills: {
            fighter: [0, 0, 0, 0],
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
        hp: 60,
        stamina: 50,
        mana: 18,
        food: 1200,
        water: 1200,
        currentStats: {
            luck: 12,
            strength: 20,
            dexterity: 18,
            wisdom: 14,
            vitality: 16,
            antiMagic: 4,
            antiFire: 3,
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

function createWeaponItem(typeId: number, rawName: string): FloorItem {
    return {
        id: `weapon-${typeId}`,
        category: 'Weapon',
        typeId,
        rawName,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

function createState(equipment: ChampionEquipment) {
    const champion = createChampion(1);
    return {
        championCombat: {
            1: { cooldown: 0, cooldownMax: 1, defenseModifier: 0 },
        } as Record<number, ChampionCombat>,
        party: [champion],
        championEquipment: { 1: equipment } as Record<number, ChampionEquipment>,
        activePotionBoosts: [] as ActivePotionBoost[],
        championVitals: { 1: createVitals() } as Record<number, ChampionVitals>,
        championInventories: { 1: [] } as Record<number, FloorItem[]>,
        projectiles: [] as Projectile[],
        level: 0,
        position: [5, 5] as [number, number],
        direction: 'NORTH' as const,
        creatures: [] as CreatureInstance[],
        openDoors: new Set<string>(),
        brokenDoors: new Set<string>(),
        floorItems: [] as FloorItem[],
        championXP: { 1: createEmptyChampionXP() } as Record<number, ChampionXP>,
        championTemporaryXP: { 1: createEmptyChampionTemporaryXP() } as Record<number, ChampionTemporaryXP>,
        elapsedGameTimeTicks: 300,
        lastCreatureAttackGameTick: 290,
        damageEvents: [] as DamageEvent[],
        spellVisualEvents: [] as SpellVisualEvent[],
        freezeLifeRemainingTicks: 0,
        seeThroughWallsUntil: 0,
        spellLights: [],
        activeShields: [] as PartyShield[],
    };
}

function buildChampionSkillExperiencePatch<TState extends ReturnType<typeof createState>>(
    state: TState,
    championId: number,
    skill: SkillKey,
    amount: number,
) {
    return {
        championXP: {
            ...state.championXP,
            [championId]: {
                ...state.championXP[championId],
                [skill]: state.championXP[championId]![skill] + amount,
            },
        },
        championTemporaryXP: {
            ...state.championTemporaryXP,
            [championId]: {
                ...state.championTemporaryXP[championId],
                [skill]: state.championTemporaryXP[championId]![skill] + amount,
            },
        },
    };
}

function createDeps<TState extends ReturnType<typeof createState>>(state: TState) {
    void state;
    return {
        getWeaponAttackOptions: (item: FloorItem | null | undefined) => item ? getWeaponAttackOptions(item) : [],
        getRequiredAmmoRawClass: (item: FloorItem | undefined) => item ? getRequiredAmmoRawClass(item) : null,
        getAttackCooldownSeconds,
        isAttackOptionUsableAtMastery,
        getAttackUnusableReason: getAttackOptionUnusableReason,
        isPhysicalAttack,
        isShootAttack,
        isThrowAttack,
        getChampionMasteryLevel: () => 10,
        findCompatibleAmmo: () => null,
        getRightHandStats: () => ({ name: 'Fist', dmgMin: 1, dmgMax: 4, cooldownSec: 1, skill: 'fighter' as const }),
        createChampionCombatState: (cooldownSec: number, defenseModifier = 0) => ({
            cooldown: cooldownSec,
            cooldownMax: cooldownSec || 1,
            defenseModifier,
        }),
        applyChampionAttackVitals: () => ({ nextVitals: createVitals() }),
        getActionCharges: () => null,
        updateEquippedItemCharges: (equip: ChampionEquipment) => equip,
        buildAttackResultMessage: (message: string, success = false) => ({ message, success, ts: 1 }),
        originalThrowingDistance: () => 4,
        getThrownPotionExplosionEffect: () => undefined,
        buildDroppedItem: (item: FloorItem, level: number, x: number, y: number) => ({ ...item, level, x, y }),
        getWeaponName: (item: FloorItem | undefined) => item?.rawName ?? '',
        buildChampionSkillExperiencePatch: (
            currentState: TState,
            championId: number,
            skill: SkillKey,
            amount: number,
        ) => buildChampionSkillExperiencePatch(currentState, championId, skill, amount),
        getChampionRuntimeBonuses: () => createEmptyStatBonuses(),
        resolveAttackFrontContext: () => ({ target: null }),
        resolveClimbDown: () => ({ errorMessage: 'no stairs' }),
        applyControlUpdate: () => {},
        applyFearResult: () => {},
        clearCreatureControlStatuses: () => {},
        clearTargetFluxcageStatus: () => {},
        getEndgameMessagesForMap: () => [],
        buildFluxcageCastEvents: (level: number, x: number, y: number) => ([
            {
                id: 'flux-visual',
                level,
                x,
                y,
                effect: 'open' as const,
                ts: 1,
                kind: 'creature' as const,
            },
        ]),
        buildFuseIgnitionEvents: (level: number, x: number, y: number) => ([
            {
                id: 'fuse-visual',
                level,
                x,
                y,
                effect: 'fireball' as const,
                ts: 1,
                kind: 'creature' as const,
            },
        ]),
        dropCreatureCarriedItems: (creatures: CreatureInstance[], floorItems: FloorItem[]) => ({ creatures, floorItems }),
        normalizeCreatureCellsOnTile: (creatures: CreatureInstance[]) => creatures,
        buildCreatureDamageEvent: (level: number, x: number, y: number, amount: number, creatureId?: string) => ({
            id: 'damage',
            level,
            target: 'creature' as const,
            creatureId,
            x,
            y,
            amount,
            ts: 1,
        }),
        buildDeathDustEvent: (level: number, x: number, y: number) => ({
            id: 'death',
            kind: 'death' as const,
            level,
            x,
            y,
            effect: 'poison_cloud' as const,
            ts: 1,
        }),
        getFluxcageExpiresAt: () => 0,
        getTargetTimers: () => undefined,
        getMapDifficulty: () => 1,
        getMapTile: () => ({ x: 0, y: 0, type: 'Floor', objects: [] } as GameTile),
        canCreatureShareTile: () => true,
        getFrontPosition: () => ({ x: 5, y: 4 }),
        getEffectiveChampionStatsRuntime: (champion: Champion) => ({
            luck: champion.luck,
            strength: champion.strength,
            dexterity: champion.dexterity,
            wisdom: champion.wisdom,
            vitality: champion.vitality,
            antiMagic: champion.antiMagic,
            antiFire: champion.antiFire,
            stamina: champion.stamina,
            mana: champion.mana,
            health: champion.health,
            load: 0,
            maxLoad: 0,
        }),
        randomInt: () => 0,
        getOriginalThrownObjectExperience,
        isCharacterLuckyOriginal: () => false,
        computeOriginalQuicknessRuntime: () => 16,
        isLikelyNonMaterial: () => false,
        getCreatureDef: () => undefined,
        onPartyAttack: () => {},
    };
}

test('store attack runtime preserves source-backed throw XP and skill through the projectile path', async () => {
    await preloadGameDbData();
    const throwingStar = createWeaponItem(32, 'Throwing Star');
    const state = createState({ rightHand: throwingStar });
    const patch = buildStoreAttackFrontRuntimePatch(state, 1, undefined, createDeps(state));

    assert.ok(patch, 'expected a projectile patch for Throwing Star');
    assert.equal(patch?.championXP?.[1]?.throw, 21);
    assert.equal(patch?.championTemporaryXP?.[1]?.throw, 21);
    assert.equal(patch?.projectiles?.length, 1, 'throwing attack should still create a projectile');
});

test('store attack runtime preserves source-backed utility XP and skill through the utility path', async () => {
    await preloadGameDbData();
    const firestaff = createWeaponItem(45, 'The Firestaff');
    const state = createState({ rightHand: firestaff });
    const patch = buildStoreAttackFrontRuntimePatch(state, 1, undefined, createDeps(state));

    assert.ok(patch, 'expected a utility patch for Firestaff invoke');
    assert.equal(patch?.championXP?.[1]?.wizard, 25);
    assert.equal(patch?.championTemporaryXP?.[1]?.wizard, 25);
    assert.equal(patch?.projectiles?.length, 1, 'Invoke should still produce the runtime projectile');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampionTemporaryXP, ChampionXP } from '../src/data/skillProgression.js';
import type { WeaponAttackOption } from '../src/data/weaponAttacks.js';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../src/types/game.js';
import type {
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    PartyShield,
    Projectile,
    SpellLight,
    SpellVisualEvent,
} from '../src/engine/runtimeTypes.js';
import { runAttackFrontRuntime } from '../src/engine/systems/attackFrontRuntime.js';

function createChampion(id: number): Champion {
    return {
        id,
        name: `Champ ${id}`,
        title: 'Tester',
        gender: 'M',
        class: 'Fighter',
        health: 50,
        stamina: 50,
        mana: 10,
        luck: 10,
        strength: 10,
        dexterity: 10,
        wisdom: 10,
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
        mana: 8,
        food: 900,
        water: 900,
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

function createWeaponItem(typeId: number): FloorItem {
    return {
        id: `weapon-${typeId}`,
        category: 'Weapon',
        typeId,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

function createAttackOption(
    attackType: number,
    enumName: string,
    displayName: string,
    skillNumber = 0,
): WeaponAttackOption {
    return {
        attackType,
        enumName,
        displayName,
        requiresCharges: false,
        masteryThreshold: 0,
        source: 'primary',
        attack: {
            index: attackType,
            enumName,
            displayName,
            experienceForAttacking: 0,
            skillNumber,
            defenseModifier: 0,
            staminaCost: 0,
            strengthRequired: 0,
            baseDamage: 0,
            disableTime: 6,
        },
    };
}

function createBaseState(equip: ChampionEquipment = {}): {
    championCombat: Record<number, ChampionCombat>;
    party: Champion[];
    championEquipment: Record<number, ChampionEquipment>;
    activePotionBoosts: ActivePotionBoost[];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    projectiles: Projectile[];
    level: number;
    position: [number, number];
    direction: 'NORTH';
    creatures: CreatureInstance[];
    openDoors: Set<string>;
    brokenDoors: Set<string>;
    floorItems: FloorItem[];
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    elapsedGameTimeTicks: number;
    lastCreatureAttackGameTick: number;
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    freezeLifeRemainingTicks: number;
    seeThroughWallsUntil: number;
    spellLights: SpellLight[];
    activeShields: PartyShield[];
} {
    return {
        championCombat: { 1: { cooldown: 0, cooldownMax: 1, defenseModifier: 0 } },
        party: [createChampion(1)],
        championEquipment: { 1: equip },
        activePotionBoosts: [],
        championVitals: { 1: createVitals() },
        championInventories: { 1: [] },
        projectiles: [],
        level: 0,
        position: [5, 5],
        direction: 'NORTH',
        creatures: [],
        openDoors: new Set<string>(),
        brokenDoors: new Set<string>(),
        floorItems: [],
        championXP: {},
        championTemporaryXP: {},
        elapsedGameTimeTicks: 0,
        lastCreatureAttackGameTick: 0,
        damageEvents: [],
        spellVisualEvents: [],
        freezeLifeRemainingTicks: 0,
        seeThroughWallsUntil: 0,
        spellLights: [],
        activeShields: [],
    };
}

function createBaseDeps(
    attacks: WeaponAttackOption[] = [],
    overrides: Partial<Parameters<typeof runAttackFrontRuntime>[3]> = {},
) {
    return {
        getWeaponAttackOptions: () => attacks,
        getRequiredAmmoRawClass: () => null,
        getAttackCooldownSeconds: () => 1,
        isAttackOptionUsableAtMastery: () => true,
        getAttackUnusableReason: () => null,
        isPhysicalAttack: (option: WeaponAttackOption | null) => option?.enumName !== 'Confuse',
        isShootAttack: (option: WeaponAttackOption | null) => option?.enumName === 'Shoot',
        isThrowAttack: (option: WeaponAttackOption | null) => option?.enumName === 'Throw',
        getChampionMasteryLevel: () => 10,
        findCompatibleAmmo: () => ({ slot: 'quiver1', item: createWeaponItem(0) }),
        getRightHandStats: () => ({ name: 'Test', dmgMin: 1, dmgMax: 4, cooldownSec: 1, skill: 'fighter' as const }),
        createChampionCombatState: (cooldownSec: number, defenseModifier = 0) => ({
            cooldown: cooldownSec,
            cooldownMax: cooldownSec || 1,
            defenseModifier,
        }),
        applyChampionAttackVitals: () => ({ nextVitals: createVitals() }),
        getActionCharges: () => null,
        updateEquippedItemCharges: (equip: ChampionEquipment) => equip,
        buildAttackResultMessage: (message: string, success = false) => ({ message, success }),
        buildPhysicalProjectileAttackPatch: () => null,
        buildSupportedUtilityAttackPatch: () => null,
        resolveAttackFrontContext: () => ({ target: null }),
        resolveCombatItem: (equip: ChampionEquipment | undefined) =>
            equip?.rightHand ? { slot: 'rightHand' as const, item: equip.rightHand } : null,
        buildAttackMeleeStatePatch: () => ({ kind: 'melee' }),
        onPartyAttack: () => {},
        ...overrides,
    };
}

test('runAttackFrontRuntime delegates projectile attacks before utility or melee', () => {
    const throwAttack = createAttackOption(1, 'Throw', 'Throw');
    let utilityCalled = false;
    let meleeCalled = false;

    const result = runAttackFrontRuntime(
        createBaseState({ rightHand: createWeaponItem(1) }),
        1,
        undefined,
        createBaseDeps([throwAttack], {
            buildPhysicalProjectileAttackPatch: () => ({ kind: 'projectile' }),
            buildSupportedUtilityAttackPatch: () => {
                utilityCalled = true;
                return { kind: 'utility' };
            },
            buildAttackMeleeStatePatch: () => {
                meleeCalled = true;
                return { kind: 'melee' };
            },
        }),
    );

    assert.deepEqual(result, { kind: 'projectile' });
    assert.equal(utilityCalled, false);
    assert.equal(meleeCalled, false);
});

test('runAttackFrontRuntime delegates non-physical attacks to the utility path', () => {
    const utilityAttack = createAttackOption(2, 'Confuse', 'Confuse');
    let partyAttackPlayed = false;

    const result = runAttackFrontRuntime(
        createBaseState({ rightHand: createWeaponItem(2) }),
        1,
        undefined,
        createBaseDeps([utilityAttack], {
            buildSupportedUtilityAttackPatch: () => ({ kind: 'utility' }),
            onPartyAttack: () => {
                partyAttackPlayed = true;
            },
        }),
    );

    assert.deepEqual(result, { kind: 'utility' });
    assert.equal(partyAttackPlayed, false);
});

test('runAttackFrontRuntime falls back to melee orchestration and triggers party attack', () => {
    let partyAttackPlayed = false;

    const result = runAttackFrontRuntime(
        createBaseState(),
        1,
        undefined,
        createBaseDeps([], {
            resolveAttackFrontContext: () => ({
                target: {
                    id: 'creature-1',
                    typeId: 1,
                    mapIndex: 0,
                    x: 5,
                    y: 4,
                    currentHP: 10,
                    alive: true,
                    cell: 'frontLeft',
                    carriedItems: [],
                } satisfies CreatureInstance,
            }),
            buildAttackMeleeStatePatch: () => ({ kind: 'melee' }),
            onPartyAttack: () => {
                partyAttackPlayed = true;
            },
        }),
    );

    assert.deepEqual(result, { kind: 'melee' });
    assert.equal(partyAttackPlayed, true);
});

test('runAttackFrontRuntime blocks rear-rank contact attacks before spending the action', () => {
    let applyVitalsCalled = false;
    let meleeCalled = false;

    const result = runAttackFrontRuntime(
        {
            ...createBaseState(),
            party: [createChampion(1), createChampion(2), createChampion(3)],
            championCombat: {
                3: { cooldown: 0, cooldownMax: 1, defenseModifier: 0 },
            },
            championEquipment: { 3: {} },
            championVitals: { 3: createVitals() },
            championInventories: { 3: [] },
        },
        3,
        undefined,
        createBaseDeps([], {
            applyChampionAttackVitals: () => {
                applyVitalsCalled = true;
                return { nextVitals: createVitals() };
            },
            resolveAttackFrontContext: () => ({
                target: {
                    id: 'creature-1',
                    typeId: 1,
                    mapIndex: 0,
                    x: 5,
                    y: 4,
                    currentHP: 10,
                    alive: true,
                    cell: 'frontLeft',
                    carriedItems: [],
                } satisfies CreatureInstance,
            }),
            buildAttackMeleeStatePatch: () => {
                meleeCalled = true;
                return { kind: 'melee' };
            },
        }),
    );

    assert.deepEqual(result, {
        lastCastResult: { message: 'Target out of reach from the back row.', success: false },
    });
    assert.equal(applyVitalsCalled, false);
    assert.equal(meleeCalled, false);
});

test('runAttackFrontRuntime uses the next throwable quiver item when the hand is empty', () => {
    const throwAttack = createAttackOption(1, 'Throw', 'Throw');
    const dagger = createWeaponItem(1);
    let receivedAttackItemId: string | undefined;
    let receivedAttackItemSlot: string | null | undefined;

    const result = runAttackFrontRuntime(
        createBaseState({ quiver1: dagger }),
        1,
        undefined,
        createBaseDeps([], {
            getWeaponAttackOptions: (item) => item?.id === dagger.id ? [throwAttack] : [],
            resolveCombatItem: () => ({ slot: 'quiver1', item: dagger }),
            buildPhysicalProjectileAttackPatch: ({ attackItem, attackItemSlot }) => {
                receivedAttackItemId = attackItem?.id;
                receivedAttackItemSlot = attackItemSlot;
                return { kind: 'projectile' };
            },
        }),
    );

    assert.deepEqual(result, { kind: 'projectile' });
    assert.equal(receivedAttackItemId, dagger.id);
    assert.equal(receivedAttackItemSlot, 'quiver1');
});

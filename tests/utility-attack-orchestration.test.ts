import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WeaponAttackOption } from '../src/data/weaponAttacks.js';
import type { Champion } from '../src/types/champion.js';
import type { CreatureInstance, FloorItem } from '../src/types/game.js';
import type {
    ChampionVitals,
    PartyShield,
    Projectile,
    SpellLight,
    SpellVisualEvent,
} from '../src/engine/runtimeTypes.js';
import { buildSupportedUtilityAttackPatch } from '../src/engine/systems/utilityAttackOrchestration.js';

type TestMessage = {
    success: boolean;
    message: string;
    ts: number;
};

type TestPatch = {
    championVitals: Record<number, ChampionVitals>;
    lastCastResult: TestMessage;
    gamePhase?: string;
    spellVisualEvents?: SpellVisualEvent[];
};

type TestClimbDownState = Record<string, never>;
type TestDeps = Parameters<
    typeof buildSupportedUtilityAttackPatch<
        TestPatch,
        TestMessage,
        string,
        SpellVisualEvent,
        TestClimbDownState
    >
>[3];

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

function createVitals(hp: number): ChampionVitals {
    return {
        hp,
        stamina: 40,
        mana: 20,
        food: 500,
        water: 500,
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

function createCreature(
    id: string,
    overrides: Partial<CreatureInstance> = {},
): CreatureInstance {
    return {
        id,
        typeId: 1,
        mapIndex: 0,
        x: 1,
        y: 0,
        currentHP: 100,
        alive: true,
        cell: 'center',
        ...overrides,
    };
}

function createAction(enumName: string): WeaponAttackOption {
    return {
        attackType: 0,
        enumName,
        displayName: enumName,
        requiresCharges: false,
        masteryThreshold: 0,
        source: 'primary',
        attack: {
            index: 0,
            enumName,
            displayName: enumName,
            experienceForAttacking: 0,
            skillNumber: 0,
            defenseModifier: 0,
            staminaCost: 5,
            strengthRequired: 0,
            baseDamage: 20,
            disableTime: 10,
        },
    };
}

function createBasePatch(): TestPatch {
    return {
        championVitals: {
            1: createVitals(50),
        },
        lastCastResult: {
            success: true,
            message: 'Action',
            ts: 1,
        },
    };
}

function createState(overrides: Partial<{
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    damageEvents: string[];
    spellVisualEvents: SpellVisualEvent[];
    spellLights: SpellLight[];
    activeShields: PartyShield[];
    projectiles: Projectile[];
    openDoors: Set<string>;
    openPits: Set<string>;
    openWalls: Set<string>;
    rightHandTypeId: number | undefined;
    rightHand: { typeId: number; rawName?: string } | null | undefined;
    rightHandWeaponName: string;
}> = {}) {
    return {
        now: 1_000,
        level: 0,
        position: [1, 1] as [number, number],
        direction: 'NORTH' as const,
        creatures: [createCreature('front-target')],
        party: [createChampion()],
        championVitals: {
            1: createVitals(50),
        },
        championId: 1,
        championHealth: 120,
        freezeLifeRemainingTicks: 0,
        seeThroughWallsUntil: 0,
        spellLights: [] as SpellLight[],
        activeShields: [] as PartyShield[],
        projectiles: [] as Projectile[],
        openDoors: new Set<string>(),
        openPits: new Set<string>(),
        openWalls: new Set<string>(),
        rightHandTypeId: undefined,
        rightHand: undefined,
        rightHandWeaponName: '',
        floorItems: [] as FloorItem[],
        damageEvents: [] as string[],
        spellVisualEvents: [] as SpellVisualEvent[],
        ...overrides,
    };
}

function createDeps(overrides: Partial<TestDeps> = {}): TestDeps {
    return {
        randomInt: () => 0,
        quantizeDurationMs: (durationMs: number) => durationMs,
        buildAttackResultMessage: (message: string, success = false) => ({ success, message, ts: 1 }),
        getCreatureDef: () => ({ fearResistance: 0 }) as never,
        getMapTile: () => ({ x: 0, y: 0, type: 'Floor', objects: [] }),
        buildFluxcageCastEvents: (level: number, x: number, y: number) => ([
            {
                id: 'flux-open',
                level,
                x,
                y,
                effect: 'open',
                ts: 0,
                kind: 'creature',
            },
            {
                id: 'flux-disrupt',
                level,
                x,
                y,
                effect: 'disrupt_nonmaterial',
                ts: 0,
                kind: 'creature',
            },
        ]),
        canCreatureShareTile: () => true,
        timerTickMs: 1_000,
        getFluxcageExpiresAt: () => 0,
        getTargetTimers: () => ({ mt: 0.5, at: 0.25 }),
        resolveClimbDown: () => ({ patch: undefined, errorMessage: undefined }),
        climbDownState: {},
        applyControlUpdate: () => {},
        applyFearResult: () => {},
        clearCreatureControlStatuses: () => {},
        clearTargetFluxcageStatus: () => {},
        getEndgameMessagesForMap: () => ['Victory'],
        buildFuseIgnitionEvents: (level: number, x: number, y: number) => ([
            {
                id: 'fuse-open',
                level,
                x,
                y,
                effect: 'open',
                ts: 0,
                kind: 'creature',
            },
        ]),
        dropCreatureCarriedItems: (creatures: CreatureInstance[], floorItems: FloorItem[]) => ({ creatures, floorItems }),
        normalizeCreatureCellsOnTile: (creatures: CreatureInstance[]) => creatures,
        buildCreatureDamageEvent: () => 'damage',
        buildDeathDustEvent: (level: number, x: number, y: number) => ({
            id: 'dust',
            level,
            x,
            y,
            effect: 'fireball',
            ts: 0,
            kind: 'death',
        }),
        ...overrides,
    };
}

test('buildSupportedUtilityAttackPatch applies confuse control updates through the callback', () => {
    let controlUpdate: { targetId: string; expiresAt: number; kind: string } | null = null;

    const result = buildSupportedUtilityAttackPatch(
        createAction('Confuse'),
        createState(),
        createBasePatch(),
        createDeps({
            applyControlUpdate: (update) => {
                controlUpdate = {
                    targetId: update.targetId,
                    expiresAt: update.expiresAt,
                    kind: update.kind,
                };
            },
        }),
    );

    assert.ok(result.patch);
    assert.deepEqual(controlUpdate, {
        targetId: 'front-target',
        expiresAt: 91_000,
        kind: 'confused',
    });
    assert.deepEqual(result.influenceExperience, {
        action: 'Confuse',
        fullAwards: 1,
        halfAwards: 0,
        fullAmount: 45,
        halfAmount: 22,
    });
});

test('buildSupportedUtilityAttackPatch forwards fear effects through the callback', () => {
    let fearSound: string | null = null;
    let frightenedId: string | null = null;

    const result = buildSupportedUtilityAttackPatch(
        createAction('Blow Horn'),
        createState(),
        createBasePatch(),
        createDeps({
            applyFearResult: (fearResult) => {
                fearSound = fearResult.sound;
                frightenedId = fearResult.frightenedCreatures[0]?.id ?? null;
            },
        }),
    );

    assert.ok(result.patch);
    assert.equal(fearSound, 'horn');
    assert.equal(frightenedId, 'front-target');
    assert.deepEqual(result.influenceExperience, {
        action: 'Blow Horn',
        fullAwards: 1,
        halfAwards: 0,
        fullAmount: 20,
        halfAmount: 10,
    });
});

test('buildSupportedUtilityAttackPatch converts climb-down errors into attack result messages', () => {
    const result = buildSupportedUtilityAttackPatch(
        createAction('Climb Down'),
        createState({ creatures: [] }),
        createBasePatch(),
        createDeps({
            resolveClimbDown: () => ({ errorMessage: 'Cannot climb down here.' }),
        }),
    );

    assert.equal(result.patch?.lastCastResult.message, 'Cannot climb down here.');
    assert.equal(result.patch?.lastCastResult.success, false);
});

test('buildSupportedUtilityAttackPatch clears runtime control statuses when Fuse starts the endgame', () => {
    let clearedStatuses = 0;

    const result = buildSupportedUtilityAttackPatch(
        createAction('Fuse'),
        createState({
            creatures: [createCreature('lord-chaos', { typeId: 23 })],
            rightHand: { typeId: 45, rawName: 'Firestaff Complete' },
            rightHandTypeId: 45,
            rightHandWeaponName: 'Firestaff',
        }),
        createBasePatch(),
        createDeps({
            getFluxcageExpiresAt: () => 2_000,
            getMapTile: (_level, x, y) => {
                if (x === 1 && y === 0) return { x, y, type: 'Floor', objects: [] };
                return { x, y, type: 'Wall', objects: [] };
            },
            clearCreatureControlStatuses: () => {
                clearedStatuses += 1;
            },
        }),
    );
    const patch = result.patch as TestPatch & { gamePhase?: string };

    assert.equal(clearedStatuses, 1);
    assert.equal(patch.gamePhase, 'endgame');
});

test('buildSupportedUtilityAttackPatch makes Lord Chaos escape Fuse when he still has a free adjacent tile', () => {
    let clearedFluxcageTarget: string | null = null;

    const result = buildSupportedUtilityAttackPatch(
        createAction('Fuse'),
        createState({
            creatures: [createCreature('lord-chaos', { typeId: 23, x: 1, y: 0 })],
            rightHand: { typeId: 45, rawName: 'Firestaff Complete' },
            rightHandTypeId: 45,
            rightHandWeaponName: 'Firestaff',
        }),
        createBasePatch(),
        createDeps({
            getFluxcageExpiresAt: () => 2_000,
            getMapTile: (_level, x, y) => {
                if (x === 2 && y === 0) return { x, y, type: 'Floor', objects: [] };
                if (x === 1 && y === 0) return { x, y, type: 'Floor', objects: [] };
                return { x, y, type: 'Wall', objects: [] };
            },
            clearTargetFluxcageStatus: (creatureId) => {
                clearedFluxcageTarget = creatureId;
            },
        }),
    );
    const patch = result.patch as TestPatch & { creatures?: CreatureInstance[]; gamePhase?: string };

    assert.equal(clearedFluxcageTarget, 'lord-chaos');
    assert.equal(patch.gamePhase, undefined);
    assert.equal(patch.lastCastResult.message, 'Lord Chaos slips away from the fusion.');
    assert.deepEqual(
        patch.creatures?.map((creature) => [creature.id, creature.x, creature.y]),
        [['lord-chaos', 2, 0]],
    );
});

test('buildSupportedUtilityAttackPatch routes Disrupt through the non-material projectile path', () => {
    const result = buildSupportedUtilityAttackPatch(
        createAction('Disrupt'),
        createState(),
        createBasePatch(),
        createDeps(),
    );
    const patch = result.patch as TestPatch & { projectiles?: Projectile[] };

    assert.equal(patch.projectiles?.length, 1);
    assert.equal(patch.projectiles?.[0]?.effect, 'disrupt_nonmaterial');
    assert.deepEqual([patch.projectiles?.[0]?.x, patch.projectiles?.[0]?.y], [1, 0]);
});

test('buildSupportedUtilityAttackPatch adds a fluxcage burst when the target is trapped', () => {
    let controlUpdateCalled = false;

    const result = buildSupportedUtilityAttackPatch(
        createAction('Fluxcage'),
        createState(),
        createBasePatch(),
        createDeps({
            applyControlUpdate: () => {
                controlUpdateCalled = true;
            },
        }),
    );
    const patch = result.patch as TestPatch & { spellVisualEvents?: SpellVisualEvent[] };

    assert.equal(controlUpdateCalled, true);
    assert.deepEqual(
        patch.spellVisualEvents?.map((event) => event.effect),
        ['open', 'disrupt_nonmaterial'],
    );
});

test('buildSupportedUtilityAttackPatch lets Lord Chaos escape a Fluxcage cast on his square when an adjacent tile is free', () => {
    let controlUpdateCalled = false;

    const result = buildSupportedUtilityAttackPatch(
        createAction('Fluxcage'),
        createState({
            creatures: [createCreature('lord-chaos', { typeId: 23, x: 1, y: 0 })],
        }),
        createBasePatch(),
        createDeps({
            getMapTile: (_level, x, y) => {
                if (x === 2 && y === 0) return { x, y, type: 'Floor', objects: [] };
                if (x === 1 && y === 0) return { x, y, type: 'Floor', objects: [] };
                return { x, y, type: 'Wall', objects: [] };
            },
            applyControlUpdate: () => {
                controlUpdateCalled = true;
            },
        }),
    );
    const patch = result.patch as TestPatch & { creatures?: CreatureInstance[]; spellVisualEvents?: SpellVisualEvent[] };

    assert.equal(controlUpdateCalled, false);
    assert.deepEqual(
        patch.creatures?.map((creature) => [creature.id, creature.x, creature.y]),
        [['lord-chaos', 2, 0]],
    );
    assert.deepEqual(
        patch.spellVisualEvents?.map((event) => event.effect),
        ['open', 'disrupt_nonmaterial'],
    );
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampionCombat, ChampionVitals, PartyShield, Projectile, SpellLight } from '../src/engine/runtimeTypes.js';
import { buildSimpleUtilityAttackPatch } from '../src/engine/systems/utilityAttackState.js';

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

type TestPatch = {
    championCombat: Record<number, ChampionCombat>;
    championVitals: Record<number, ChampionVitals>;
    lastCastResult: { success: boolean; message: string; ts: number };
};

function createBasePatch(): TestPatch {
    return {
        championCombat: {
            1: {
                cooldown: 2,
                cooldownMax: 2,
                defenseModifier: 0,
            },
        },
        championVitals: {
            1: createVitals(20),
        },
        lastCastResult: {
            success: true,
            message: 'Light',
            ts: 1,
        },
    };
}

function createState(overrides: Partial<{
    spellLights: SpellLight[];
    activeShields: PartyShield[];
    projectiles: Projectile[];
    freezeLifeRemainingTicks: number;
    seeThroughWallsUntil: number;
}> = {}) {
    return {
        now: 1,
        level: 2,
        position: [5, 5] as [number, number],
        direction: 'NORTH' as const,
        freezeLifeRemainingTicks: 10,
        seeThroughWallsUntil: 100,
        spellLights: [],
        activeShields: [],
        projectiles: [],
        ...overrides,
    };
}

const deterministicDeps = {
    randomInt: () => 2,
    quantizeDurationMs: (durationMs: number) => durationMs,
    buildIdSuffix: () => 'seed',
};

test('buildSimpleUtilityAttackPatch heals the acting champion and caps health', () => {
    const base = createBasePatch();
    const championVitals = {
        1: createVitals(35),
    };

    const patch = buildSimpleUtilityAttackPatch(
        'Heal',
        createState(),
        base,
        championVitals,
        1,
        50,
        deterministicDeps,
    );

    assert.equal(patch.championVitals[1]?.hp, 50);
});

test('buildSimpleUtilityAttackPatch appends spell lights, shields and projectiles', () => {
    const base = createBasePatch();
    const championVitals = {
        1: createVitals(20),
    };

    const lightPatch = buildSimpleUtilityAttackPatch(
        'Light',
        createState(),
        base,
        championVitals,
        1,
        50,
        deterministicDeps,
    ) as TestPatch & { spellLights: SpellLight[] };
    const shieldPatch = buildSimpleUtilityAttackPatch(
        'Spellshield',
        createState(),
        base,
        championVitals,
        1,
        50,
        deterministicDeps,
    ) as TestPatch & { activeShields: PartyShield[] };
    const projectilePatch = buildSimpleUtilityAttackPatch(
        'Invoke',
        createState(),
        base,
        championVitals,
        1,
        50,
        deterministicDeps,
    ) as TestPatch & { projectiles: Projectile[] };

    assert.equal(lightPatch.spellLights.length, 1);
    assert.equal(lightPatch.spellLights[0]?.id, 'weapon_light_1_seed');

    assert.equal(shieldPatch.activeShields.length, 1);
    assert.equal(shieldPatch.activeShields[0]?.kind, 'magic');

    assert.equal(projectilePatch.projectiles.length, 1);
    assert.equal(projectilePatch.projectiles[0]?.id, 'weapon_invoke_1_seed');
    assert.equal(projectilePatch.projectiles[0]?.effect, 'disrupt_nonmaterial');
});

test('buildSimpleUtilityAttackPatch updates freeze life and window state without disturbing the base patch', () => {
    const base = createBasePatch();
    const championVitals = {
        1: createVitals(20),
    };

    const freezePatch = buildSimpleUtilityAttackPatch(
        'Freeze Life',
        createState({ freezeLifeRemainingTicks: 180 }),
        base,
        championVitals,
        1,
        50,
        deterministicDeps,
    ) as TestPatch & { freezeLifeRemainingTicks: number };
    const windowPatch = buildSimpleUtilityAttackPatch(
        'Window',
        createState({ seeThroughWallsUntil: 250000 }),
        base,
        championVitals,
        1,
        50,
        deterministicDeps,
    ) as TestPatch & { seeThroughWallsUntil: number };
    const blockPatch = buildSimpleUtilityAttackPatch(
        'Block',
        createState(),
        base,
        championVitals,
        1,
        50,
        deterministicDeps,
    );

    assert.equal(freezePatch.freezeLifeRemainingTicks, 200);
    assert.equal(windowPatch.seeThroughWallsUntil, 250000);
    assert.equal(blockPatch, base);
});

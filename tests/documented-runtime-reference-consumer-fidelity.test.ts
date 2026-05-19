import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    doorBlocksThrownItems,
    doorBlocksThrownPhysicalItem,
    getDoorDefinition,
} from '../src/data/doors.js';
import {
    ORIGINAL_CARRY_LOCATION_BITS,
    ORIGINAL_CARRY_LOCATION_TO_RUNTIME_SLOTS,
    ORIGINAL_ITEM_RULE_FLAGS,
    getOriginalCarryLocationBit,
    hasOriginalCarryLocation,
    isOriginalPouchCarriableItem,
} from '../src/data/originalItemRules.js';
import {
    MISC_TYPES,
    getSourceItemAllowedSlotsMask,
    resolveItemName,
} from '../src/data/items.js';
import {
    RUNES,
    RUNES_BY_ID,
    SPELLS,
    getOriginalPreparedRuneManaCost,
    getOriginalRuneSelectionManaCost,
} from '../src/data/runes.js';
import {
    ALL_SKILL_KEYS,
    BASIC_SKILL_KEYS,
    HIDDEN_SKILL_KEYS,
    getParentBasicSkill,
    mapOriginalSkillNumberToSkillKey,
    type BasicSkillKey,
    type SkillKey,
} from '../src/data/skillProgression.js';
import type { FloorItem } from '../src/types/game.js';

type OriginalSkillsRuntime = {
    basicSkills: Array<{
        id: number;
        name: string;
    }>;
    hiddenSkills: Array<{
        id: number;
        name: string;
        parentSkill: string;
    }>;
};

type OriginalItemRulesRuntime = {
    carryLocationBits: Record<string, string>;
    carryLocationToRuntimeSlots: Record<string, string[]>;
    rules: {
        pouchItemsCanPassThroughSomeDoors: boolean;
        keysRemainBlockedByDoorPassRuleException: boolean;
    };
};

type OriginalMagicRuntime = {
    powerSymbols: Array<{
        id: number;
        symbol: string;
        difficultyMultiplier: number;
        baseManaCost: number;
    }>;
    runeRows: Array<Array<{
        id: number;
        symbol: string;
        row: string;
        baseManaCost: number;
    }>>;
};

type AtariI560Stats = {
    byte19016: number[];
    byte19010: number[];
};

type OriginalActionsRuntime = {
    actions: Array<{
        id: number;
        name: string;
        skillIndex: number;
        experienceGain: number;
        defenseModifier: number;
        stamina: number;
        hitProbability: number;
        damageModifier32: number;
        fatigue: number;
        variants?: {
            earlierVersions?: {
                skillIndex?: number;
                experienceGain?: number;
                stamina?: number;
            };
            dm10?: {
                skillIndex?: number;
                experienceGain?: number;
                stamina?: number;
            };
        };
    }>;
};

type OriginalActionCombosRuntime = {
    combos: Array<{
        id: number;
        actions: Array<{
            actionId: number;
            useCharges: boolean;
            minSkillLevel: number;
        }>;
    }>;
};

type RuntimeWeaponAttacksDb = {
    originalAtari?: {
        i560?: {
            attacks?: Array<{
                index: number;
                enumName: string;
                displayName: string;
                experienceForAttacking: number;
                skillNumber: number;
                defenseModifier: number;
                staminaCost: number;
                strengthRequired: number;
                baseDamage: number;
                disableTime: number;
            }>;
            legalAttackClasses?: Array<{
                index: number;
                primaryAttack?: {
                    attackType: number;
                    requiresCharges?: boolean;
                    masteryThreshold?: number;
                };
                optionalAttacks?: Array<{
                    attackType: number;
                    requiresCharges?: boolean;
                    masteryThreshold?: number;
                }>;
            }>;
        };
    };
};

const ORIGINAL_SKILLS_PATH = `${process.cwd()}\\src\\assets\\runtime\\reference\\original_skills_runtime.json`;
const ORIGINAL_ITEM_RULES_PATH = `${process.cwd()}\\src\\assets\\runtime\\reference\\original_item_rules_runtime.json`;
const ORIGINAL_MAGIC_PATH = `${process.cwd()}\\src\\assets\\runtime\\reference\\original_magic_runtime.json`;
const RAW_I560_STATS_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\output\\atari_i560_stats.json`;
const ORIGINAL_ACTIONS_PATH = `${process.cwd()}\\src\\assets\\runtime\\reference\\original_actions_runtime.json`;
const ORIGINAL_ACTION_COMBOS_PATH = `${process.cwd()}\\src\\assets\\runtime\\reference\\original_action_combos_runtime.json`;
const RUNTIME_WEAPON_ATTACKS_DB_PATH = `${process.cwd()}\\src\\assets\\runtime\\db\\game_db_weapon_attacks.json`;

function normalizeSkillName(value: string): SkillKey {
    return value.toLowerCase() as SkillKey;
}

function normalizeBasicSkillName(value: string): BasicSkillKey {
    return value.toLowerCase() as BasicSkillKey;
}

function normalizeActionName(value: string): string {
    return value
        .toUpperCase()
        .replace(/\(UNUSED\)/g, '')
        .replace(/[^A-Z0-9]+/g, '');
}

function createItem(category: FloorItem['category'], typeId: number): FloorItem {
    return {
        id: `${category}-${typeId}`,
        category,
        typeId,
        rawName: resolveItemName(category, typeId),
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function normalizeLegalAttackClass(
    runtime: {
        primaryAttack?: {
            attackType: number;
            requiresCharges?: boolean;
            masteryThreshold?: number;
        };
        optionalAttacks?: Array<{
            attackType: number;
            requiresCharges?: boolean;
            masteryThreshold?: number;
        }>;
    } | undefined,
): Array<{
    actionId: number;
    useCharges: boolean;
    minSkillLevel: number;
}> {
    const sourceEntries = [runtime?.primaryAttack, ...(runtime?.optionalAttacks ?? [])];
    const entries = sourceEntries
        .filter((entry): entry is {
            attackType: number;
            requiresCharges?: boolean;
            masteryThreshold?: number;
        } => entry !== undefined)
        .map((entry) => ({
            actionId: entry.attackType,
            useCharges: Boolean(entry.requiresCharges),
            minSkillLevel: Number(entry.masteryThreshold ?? 0),
        }));

    const isEmptySentinel = entries.every((entry) => entry.actionId === 0 || entry.actionId === 255);
    return isEmptySentinel ? [] : entries;
}

test('skill progression runtime mapping stays aligned with the canonical documented skills table', () => {
    const reference = readJson<OriginalSkillsRuntime>(ORIGINAL_SKILLS_PATH);
    assert.deepEqual(
        BASIC_SKILL_KEYS,
        reference.basicSkills.map((skill) => normalizeBasicSkillName(skill.name)),
        'basic skill list drifted from documented order',
    );
    assert.deepEqual(
        HIDDEN_SKILL_KEYS,
        reference.hiddenSkills.map((skill) => normalizeSkillName(skill.name)),
        'hidden skill list drifted from documented order',
    );
    assert.deepEqual(
        ALL_SKILL_KEYS,
        [
            ...reference.basicSkills.map((skill) => normalizeBasicSkillName(skill.name)),
            ...reference.hiddenSkills.map((skill) => normalizeSkillName(skill.name)),
        ],
        'combined skill list drifted from documented order',
    );

    for (const basicSkill of reference.basicSkills) {
        const runtimeSkill = mapOriginalSkillNumberToSkillKey(basicSkill.id);
        const expectedSkill = normalizeSkillName(basicSkill.name);
        assert.equal(runtimeSkill, expectedSkill, `basic skill ${basicSkill.id} drifted`);
        assert.equal(getParentBasicSkill(runtimeSkill), expectedSkill, `basic skill ${basicSkill.id} parent drifted`);
    }

    for (const hiddenSkill of reference.hiddenSkills) {
        const runtimeSkill = mapOriginalSkillNumberToSkillKey(hiddenSkill.id);
        assert.equal(runtimeSkill, normalizeSkillName(hiddenSkill.name), `hidden skill ${hiddenSkill.id} drifted`);
        assert.equal(
            getParentBasicSkill(runtimeSkill),
            normalizeBasicSkillName(hiddenSkill.parentSkill),
            `hidden skill ${hiddenSkill.id} parent drifted`,
        );
    }
});

test('door runtime logic stays aligned with the documented pouch and key pass-through item rules', () => {
    const reference = readJson<OriginalItemRulesRuntime>(ORIGINAL_ITEM_RULES_PATH);
    assert.deepEqual(ORIGINAL_CARRY_LOCATION_BITS, reference.carryLocationBits);
    assert.deepEqual(ORIGINAL_CARRY_LOCATION_TO_RUNTIME_SLOTS, reference.carryLocationToRuntimeSlots);
    assert.deepEqual(ORIGINAL_ITEM_RULE_FLAGS, reference.rules);
    assert.equal(reference.carryLocationBits['8'], 'Pouch');
    assert.equal(getOriginalCarryLocationBit('Pouch'), 8);
    assert.deepEqual(reference.carryLocationToRuntimeSlots.Pouch, ['pocket1', 'pocket2']);
    assert.equal(reference.rules.pouchItemsCanPassThroughSomeDoors, true);
    assert.equal(reference.rules.keysRemainBlockedByDoorPassRuleException, true);

    const grateDoorType = 0;
    assert.equal(getDoorDefinition(grateDoorType)?.thrownItemsCanPassThrough, true);
    assert.equal(doorBlocksThrownItems(grateDoorType), false);

    const scroll = createItem('Scroll', 0);
    assert.equal(hasOriginalCarryLocation(getSourceItemAllowedSlotsMask('Scroll', 0), 'Pouch'), true, 'scroll should remain a pouch-carryable reference item');
    assert.equal(isOriginalPouchCarriableItem(scroll), true, 'scroll should remain pouch-carriable through the canonical rule helper');
    assert.equal(
        doorBlocksThrownPhysicalItem(grateDoorType, scroll),
        false,
        'pouch-carryable non-key items should remain passable through grates',
    );

    const pouchKeyTypeId = Object.keys(MISC_TYPES)
        .map(Number)
        .find((typeId) => MISC_TYPES[typeId]?.key && hasOriginalCarryLocation(getSourceItemAllowedSlotsMask('Misc', typeId), 'Pouch'));
    assert.ok(pouchKeyTypeId !== undefined, 'expected at least one pouch-carryable key-like misc item');

    const pouchKey = createItem('Misc', pouchKeyTypeId!);
    assert.equal(isOriginalPouchCarriableItem(pouchKey), true);
    assert.equal(
        doorBlocksThrownPhysicalItem(grateDoorType, pouchKey),
        true,
        'key-like items should remain blocked by the grate pass-through exception',
    );
});

test('magic runtime stays aligned with the documented power rune constants and mana-cost rule', () => {
    const reference = readJson<OriginalMagicRuntime>(ORIGINAL_MAGIC_PATH);
    const powerRunes = RUNES.filter((rune) => rune.family === 'power');

    assert.equal(powerRunes.length, reference.powerSymbols.length);

    for (const powerSymbol of reference.powerSymbols) {
        const runtimeRune = RUNES_BY_ID[powerSymbol.symbol.toLowerCase()];
        assert.ok(runtimeRune, `missing runtime power rune ${powerSymbol.symbol}`);
        assert.equal(runtimeRune.family, 'power');
        assert.equal(runtimeRune.level, powerSymbol.baseManaCost, `${powerSymbol.symbol} base mana cost drifted`);
        assert.equal(runtimeRune.manaFactor, powerSymbol.difficultyMultiplier, `${powerSymbol.symbol} mana factor drifted`);
    }

    const referenceRuneSet = new Set(
        reference.runeRows.flat().map((rune) => rune.symbol.toLowerCase()),
    );
    const runtimeRuneSet = new Set(RUNES.map((rune) => rune.id));
    assert.deepEqual(runtimeRuneSet, referenceRuneSet, 'runtime rune symbol set drifted from documented magic reference');

    for (const spell of SPELLS) {
        const powerRune = RUNES_BY_ID[spell.runes[0]];
        assert.ok(powerRune?.manaFactor, `spell ${spell.name} is missing its power rune`);
        const expectedManaCost = Math.floor((spell.sourceBaseDifficulty ?? spell.manaBase) * (powerRune.manaFactor ?? 8) / 8);
        assert.equal(spell.manaCost, expectedManaCost, `spell ${spell.name} mana cost drifted from documented formula`);
    }
});

test('original rune-click mana spending stays aligned with the documented symbol cost tables', () => {
    const reference = readJson<OriginalMagicRuntime>(ORIGINAL_MAGIC_PATH);
    const rawI560 = readJson<AtariI560Stats>(RAW_I560_STATS_PATH);
    const flatRows = reference.runeRows.flat();
    const baseManaBySymbol = new Map(
        flatRows.map((rune) => [rune.symbol.toLowerCase(), rune.baseManaCost]),
    );
    const rawBaseManaBySymbol = new Map(
        RUNES.map((rune, index) => [rune.id, rawI560.byte19010[index]]),
    );

    assert.deepEqual(
        reference.powerSymbols.map((symbol) => symbol.difficultyMultiplier),
        rawI560.byte19016,
        'power multipliers drifted from the raw i560 table',
    );
    assert.deepEqual(
        RUNES.map((rune) => rawBaseManaBySymbol.get(rune.id)),
        rawI560.byte19010,
        'runtime rune ordering drifted from the raw i560 symbol-cost table',
    );

    for (const powerSymbol of reference.powerSymbols) {
        const powerRuneId = powerSymbol.symbol.toLowerCase();
        assert.equal(
            getOriginalRuneSelectionManaCost([], powerRuneId),
            powerSymbol.baseManaCost,
            `${powerSymbol.symbol} click cost drifted`,
        );
        assert.equal(
            rawBaseManaBySymbol.get(powerRuneId),
            powerSymbol.baseManaCost,
            `${powerSymbol.symbol} raw base cost drifted`,
        );
    }

    const loMultiplier = reference.powerSymbols.find((symbol) => symbol.symbol === 'LO')?.difficultyMultiplier ?? 8;
    for (const rune of flatRows.filter((entry) => entry.row !== 'power')) {
        const expectedCost = Math.floor(rune.baseManaCost * loMultiplier / 8);
        assert.equal(
            getOriginalRuneSelectionManaCost(['lo'], rune.symbol.toLowerCase()),
            expectedCost,
            `${rune.symbol} click cost drifted under LO`,
        );
        assert.equal(
            baseManaBySymbol.get(rune.symbol.toLowerCase()),
            rune.baseManaCost,
        );
        assert.equal(
            rawBaseManaBySymbol.get(rune.symbol.toLowerCase()),
            rune.baseManaCost,
            `${rune.symbol} raw base cost drifted`,
        );
    }

    assert.equal(getOriginalPreparedRuneManaCost(['lo', 'ful']), 6);
    assert.equal(getOriginalPreparedRuneManaCost(['lo', 'ful', 'ir']), 13);
    assert.equal(getOriginalPreparedRuneManaCost(['lo', 'des', 'ew']), 12);
    assert.equal(getOriginalPreparedRuneManaCost(['lo', 'oh', 'ir', 'ra']), 18);
});

test('documented action table stays aligned with the runtime weapon attack slice', () => {
    const reference = readJson<OriginalActionsRuntime>(ORIGINAL_ACTIONS_PATH);
    const runtimeDb = readJson<RuntimeWeaponAttacksDb>(RUNTIME_WEAPON_ATTACKS_DB_PATH);
    const runtimeAttacks = new Map(
        (runtimeDb.originalAtari?.i560?.attacks ?? []).map((attack) => [attack.index, attack]),
    );

    for (const action of reference.actions) {
        const runtime = runtimeAttacks.get(action.id);
        assert.ok(runtime, `missing runtime attack ${action.id}`);
        assert.equal(normalizeActionName(runtime!.displayName), normalizeActionName(action.name), `action ${action.id} name drifted`);
        const acceptedSkillIndices = new Set([
            action.skillIndex,
            action.variants?.earlierVersions?.skillIndex,
            action.variants?.dm10?.skillIndex,
        ].filter((value): value is number => typeof value === 'number'));
        const acceptedExperienceGains = new Set([
            action.experienceGain,
            action.variants?.earlierVersions?.experienceGain,
            action.variants?.dm10?.experienceGain,
        ].filter((value): value is number => typeof value === 'number'));
        const acceptedStaminaCosts = new Set([
            action.stamina,
            action.variants?.earlierVersions?.stamina,
            action.variants?.dm10?.stamina,
        ].filter((value): value is number => typeof value === 'number'));

        assert.equal(acceptedSkillIndices.has(runtime!.skillNumber), true, `action ${action.id} skill index drifted`);
        assert.equal(acceptedExperienceGains.has(runtime!.experienceForAttacking), true, `action ${action.id} experience drifted`);
        assert.equal(runtime!.defenseModifier, action.defenseModifier, `action ${action.id} defense modifier drifted`);
        assert.equal(acceptedStaminaCosts.has(runtime!.staminaCost), true, `action ${action.id} stamina drifted`);
        assert.equal(runtime!.strengthRequired, action.hitProbability, `action ${action.id} hit probability drifted`);
        assert.equal(runtime!.baseDamage, action.damageModifier32, `action ${action.id} damage modifier drifted`);
        assert.equal(runtime!.disableTime, action.fatigue, `action ${action.id} fatigue drifted`);
    }
});

test('documented action combo table stays aligned with the runtime legal attack classes slice', () => {
    const reference = readJson<OriginalActionCombosRuntime>(ORIGINAL_ACTION_COMBOS_PATH);
    const runtimeDb = readJson<RuntimeWeaponAttacksDb>(RUNTIME_WEAPON_ATTACKS_DB_PATH);
    const runtimeCombos = new Map(
        (runtimeDb.originalAtari?.i560?.legalAttackClasses ?? []).map((combo) => [combo.index, combo]),
    );

    for (const combo of reference.combos) {
        const runtime = runtimeCombos.get(combo.id);
        assert.ok(runtime, `missing runtime combo ${combo.id}`);
        assert.deepEqual(
            normalizeLegalAttackClass(runtime),
            combo.actions,
            `combo ${combo.id} attacks drifted`,
        );
    }
});

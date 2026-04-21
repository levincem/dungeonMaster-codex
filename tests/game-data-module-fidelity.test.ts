import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    preloadGameDbData,
    getGameDbCreaturesRawSync,
    getGameDbItemsRawSync,
    getGameDbWeaponAttacksRawSync,
} from '../src/data/gameDbData.js';
import {
    ARMOR_TYPES,
    MISC_TYPES,
    POTION_TYPES,
    WEAPON_TYPES,
    getSourceItemAllowedSlotsMask,
    getSourceItemAttackClass,
} from '../src/data/items.js';
import { getOriginalWeaponReference, getWeaponAttackOptions } from '../src/data/weaponAttacks.js';
import { mapOriginalSkillNumberToSkillKey } from '../src/data/skillProgression.js';
import type { FloorItem } from '../src/types/game.js';

type SourceGameDb = {
    itemTypeNames?: {
        weapons?: Record<string, string>;
        armor?: Record<string, string>;
        potions?: Record<string, string>;
        misc?: Record<string, string>;
    };
    originalAtari?: {
        weaponAttackReference?: Array<{
            weaponIndex: number;
            objectInfoIndex: number;
            displayName: string;
            rawDescriptor?: {
                weightKg: number;
                rawClass: number;
                damage: number;
                kineticEnergy: number;
                shootDamage: number;
                throwGraphic: number;
            };
            legalAttacks?: {
                primaryAttack?: {
                    attackType: number;
                    enumName: string;
                    displayName: string;
                    requiresCharges?: boolean;
                    masteryThreshold?: number;
                };
                optionalAttacks?: Array<{
                    attackType: number;
                    enumName: string;
                    displayName: string;
                    requiresCharges?: boolean;
                    masteryThreshold?: number;
                }>;
            };
        }>;
        i559?: {
            weapons?: Array<{ index: number; weightKg: number; damage: number }>;
            cloths?: Array<{ index: number; weightKg: number; protection: number; sharpDefense: number; isShield: boolean }>;
            miscWeightsKg?: number[];
            foodValues?: number[];
            objectInfo?: Array<{ allowedSlotsMask: number; attackClass?: number }>;
        };
        i560?: {
            attacks?: Array<{
                index: number;
                skillNumber: number;
                experienceForAttacking: number;
                defenseModifier: number;
                staminaCost: number;
                disableTime: number;
            }>;
        };
    };
};

const SOURCE_GAME_DB_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\output\\game_db.json`;
const FOOD_MISC_IDS = [29, 30, 31, 32, 33, 34, 35, 36] as const;
const SOURCE_ITEM_OBJECT_INDEX_OFFSETS = {
    Scroll: 0,
    Container: 1,
    Potion: 2,
    Weapon: 23,
    Armor: 69,
    Misc: 127,
} as const;
const SOURCE_ITEM_OBJECT_CATEGORY_ORDER = Object.entries(SOURCE_ITEM_OBJECT_INDEX_OFFSETS) as Array<
    [keyof typeof SOURCE_ITEM_OBJECT_INDEX_OFFSETS, number]
>;

function readSourceGameDb(): SourceGameDb {
    return JSON.parse(readFileSync(SOURCE_GAME_DB_PATH, 'utf8')) as SourceGameDb;
}

function createWeaponItem(typeId: number, rawName?: string): FloorItem {
    return {
        id: `weapon_${typeId}`,
        category: 'Weapon',
        typeId,
        rawName,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

test('game_db runtime slices stay byte-identical through the raw slice loaders', async () => {
    await preloadGameDbData();

    const runtimeItems = readFileSync(`${process.cwd()}\\src\\assets\\runtime\\db\\game_db_items.json`, 'utf8');
    const runtimeWeaponAttacks = readFileSync(`${process.cwd()}\\src\\assets\\runtime\\db\\game_db_weapon_attacks.json`, 'utf8');
    const runtimeCreatures = readFileSync(`${process.cwd()}\\src\\assets\\runtime\\db\\game_db_creatures.json`, 'utf8');

    assert.equal(getGameDbItemsRawSync(), runtimeItems);
    assert.equal(getGameDbWeaponAttacksRawSync(), runtimeWeaponAttacks);
    assert.equal(getGameDbCreaturesRawSync(), runtimeCreatures);
});

test('items module preserves extracted source-backed item fields across all categories', async () => {
    await preloadGameDbData();

    const sourceGameDb = readSourceGameDb();
    const sourceWeapons = new Map((sourceGameDb.originalAtari?.i559?.weapons ?? []).map((entry) => [entry.index, entry]));
    const sourceArmor = new Map((sourceGameDb.originalAtari?.i559?.cloths ?? []).map((entry) => [entry.index, entry]));
    const sourceMiscWeights = sourceGameDb.originalAtari?.i559?.miscWeightsKg ?? [];
    const sourceFoodValues = sourceGameDb.originalAtari?.i559?.foodValues ?? [];
    const sourceNames = sourceGameDb.itemTypeNames ?? {};

    for (const [id, source] of sourceWeapons) {
        const runtime = WEAPON_TYPES[id];
        if (!runtime) continue;
        assert.equal(runtime.weight, source.weightKg, `weapon ${id} weight drifted from source`);
        assert.deepEqual(runtime.damage, [source.damage, source.damage], `weapon ${id} damage drifted from source`);
        const expectedName = sourceNames.weapons?.[String(id)];
        if (expectedName) assert.equal(runtime.name, expectedName, `weapon ${id} name drifted from source`);
    }

    for (const [id, source] of sourceArmor) {
        const runtime = ARMOR_TYPES[id];
        if (!runtime) continue;
        assert.equal(runtime.weight, source.weightKg, `armor ${id} weight drifted from source`);
        assert.equal(runtime.armor, source.protection, `armor ${id} protection drifted from source`);
        assert.equal(runtime.sharpDefense ?? 0, source.sharpDefense, `armor ${id} sharp defense drifted from source`);
        assert.equal(runtime.isShield ?? false, source.isShield, `armor ${id} shield flag drifted from source`);
        const expectedName = sourceNames.armor?.[String(id)];
        if (expectedName) assert.equal(runtime.name, expectedName, `armor ${id} name drifted from source`);
    }

    for (const [idText, expectedName] of Object.entries(sourceNames.potions ?? {})) {
        const id = Number(idText);
        if (!Number.isFinite(id) || !POTION_TYPES[id]) continue;
        assert.equal(POTION_TYPES[id].name, expectedName, `potion ${id} name drifted from source`);
    }

    for (const [idText, expectedName] of Object.entries(sourceNames.misc ?? {})) {
        const id = Number(idText);
        if (!Number.isFinite(id) || !MISC_TYPES[id]) continue;
        assert.equal(MISC_TYPES[id].name, expectedName, `misc ${id} name drifted from source`);
    }

    for (const [idText, expectedWeight] of Object.entries(sourceMiscWeights)) {
        const id = Number(idText);
        if (!Number.isFinite(id) || !MISC_TYPES[id]) continue;
        assert.equal(MISC_TYPES[id].weight, expectedWeight, `misc ${id} weight drifted from source`);
    }

    FOOD_MISC_IDS.forEach((typeId, index) => {
        if (!MISC_TYPES[typeId]) return;
        assert.equal(
            MISC_TYPES[typeId].nutrition,
            sourceFoodValues[index],
            `misc ${typeId} nutrition drifted from source food tables`,
        );
    });
});

test('items module exposes original object-info slot masks and attack classes without loss', async () => {
    await preloadGameDbData();

    const sourceObjectInfo = readSourceGameDb().originalAtari?.i559?.objectInfo ?? [];

    SOURCE_ITEM_OBJECT_CATEGORY_ORDER.forEach(([category, offset], categoryIndex) => {
        const nextOffset = SOURCE_ITEM_OBJECT_CATEGORY_ORDER[categoryIndex + 1]?.[1] ?? sourceObjectInfo.length;
        sourceObjectInfo.slice(offset, nextOffset).forEach((entry, index) => {
                const typeId = index;
                assert.equal(
                    getSourceItemAllowedSlotsMask(category, typeId),
                    entry.allowedSlotsMask,
                    `${category} ${typeId} allowedSlotsMask drifted from source object info`,
                );
                assert.equal(
                    getSourceItemAttackClass(category, typeId),
                    entry.attackClass,
                    `${category} ${typeId} attackClass drifted from source object info`,
                );
            });
    });
});

test('weapon attack runtime honors extracted projectile descriptors and legal attacks', async () => {
    await preloadGameDbData();

    const sourceReferences = readSourceGameDb().originalAtari?.weaponAttackReference ?? [];
    const sourceAttacks = new Map((readSourceGameDb().originalAtari?.i560?.attacks ?? []).map((entry) => [entry.index, entry]));

    for (const entry of sourceReferences) {
        if (!WEAPON_TYPES[entry.weaponIndex]) continue;

        const item = createWeaponItem(entry.weaponIndex, WEAPON_TYPES[entry.weaponIndex].name);
        const descriptor = getOriginalWeaponReference(item);
        if (entry.rawDescriptor) {
            assert.deepEqual(
                descriptor,
                {
                    weaponIndex: entry.weaponIndex,
                    objectInfoIndex: entry.objectInfoIndex,
                    displayName: entry.displayName,
                    weightKg: entry.rawDescriptor.weightKg,
                    rawClass: entry.rawDescriptor.rawClass,
                    damage: entry.rawDescriptor.damage,
                    kineticEnergy: entry.rawDescriptor.kineticEnergy,
                    shootDamage: entry.rawDescriptor.shootDamage,
                    throwGraphic: entry.rawDescriptor.throwGraphic,
                },
                `weapon ${entry.weaponIndex} projectile descriptor drifted from source`,
            );
        }

        const actualOptions = getWeaponAttackOptions(item).map((option) => ({
            attackType: option.attackType,
            enumName: option.enumName,
            displayName: option.displayName,
            requiresCharges: option.requiresCharges,
            masteryThreshold: option.masteryThreshold,
            source: option.source,
            skillNumber: option.attack.skillNumber,
            skillKey: mapOriginalSkillNumberToSkillKey(sourceAttacks.get(option.attackType)?.skillNumber ?? -1),
            experienceForAttacking: option.attack.experienceForAttacking,
            defenseModifier: option.attack.defenseModifier,
            staminaCost: option.attack.staminaCost,
            disableTime: option.attack.disableTime,
        }));

        const expectedOptions = [
            entry.legalAttacks?.primaryAttack
                ? {
                    ...entry.legalAttacks.primaryAttack,
                    requiresCharges: Boolean(entry.legalAttacks.primaryAttack.requiresCharges),
                    masteryThreshold: Number(entry.legalAttacks.primaryAttack.masteryThreshold ?? 0),
                    source: 'primary',
                    skillNumber: sourceAttacks.get(entry.legalAttacks.primaryAttack.attackType)?.skillNumber ?? -1,
                    skillKey: mapOriginalSkillNumberToSkillKey(sourceAttacks.get(entry.legalAttacks.primaryAttack.attackType)?.skillNumber ?? -1),
                    experienceForAttacking: sourceAttacks.get(entry.legalAttacks.primaryAttack.attackType)?.experienceForAttacking ?? 0,
                    defenseModifier: sourceAttacks.get(entry.legalAttacks.primaryAttack.attackType)?.defenseModifier ?? 0,
                    staminaCost: sourceAttacks.get(entry.legalAttacks.primaryAttack.attackType)?.staminaCost ?? 0,
                    disableTime: sourceAttacks.get(entry.legalAttacks.primaryAttack.attackType)?.disableTime ?? 0,
                }
                : null,
            ...(entry.legalAttacks?.optionalAttacks ?? []).map((attack) => ({
                ...attack,
                requiresCharges: Boolean(attack.requiresCharges),
                masteryThreshold: Number(attack.masteryThreshold ?? 0),
                source: 'optional',
                skillNumber: sourceAttacks.get(attack.attackType)?.skillNumber ?? -1,
                skillKey: mapOriginalSkillNumberToSkillKey(sourceAttacks.get(attack.attackType)?.skillNumber ?? -1),
                experienceForAttacking: sourceAttacks.get(attack.attackType)?.experienceForAttacking ?? 0,
                defenseModifier: sourceAttacks.get(attack.attackType)?.defenseModifier ?? 0,
                staminaCost: sourceAttacks.get(attack.attackType)?.staminaCost ?? 0,
                disableTime: sourceAttacks.get(attack.attackType)?.disableTime ?? 0,
            })),
        ].filter((value): value is NonNullable<typeof value> => value !== null);

        assert.deepEqual(actualOptions, expectedOptions, `weapon ${entry.weaponIndex} legal attacks drifted from source`);
    }
});

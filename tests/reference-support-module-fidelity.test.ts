import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CREATURE_TYPES } from '../src/data/creatures.js';
import { preloadGameDbCreaturesData } from '../src/data/gameDbData.js';
import {
    getOriginalWallOverlayMapDataSync,
    preloadOriginalWallOverlayData,
} from '../src/data/originalWallOverlayData.js';

type OriginalCreaturesPayload = {
    creatures: Array<{
        id: number;
        name: string;
        baseHP: number;
        armor: number;
        hitProb: number;
        atkSpd: number;
        moveSpd: number;
        exp: number;
        poison: boolean;
        attackType: string;
    }>;
};

type OriginalDoorsPayload = {
    doors: Array<{
        id: number;
        name: string;
        animated: boolean;
        thrownItemsCanPassThrough: boolean;
        creaturesCanSeeThrough: boolean;
        resistance: number;
    }>;
};

type OriginalTeleportersPayload = Array<{
    mapIndex: number;
    x: number;
    y: number;
    index: number;
    scope?: string;
    rotationType: number;
    rotation: string;
    destMap: number;
    destX: number;
    destY: number;
}>;

type SourceGameDbCreatures = {
    originalAtari?: {
        i559?: {
            creatures?: Array<{
                index: number;
                baseHealth?: number;
                defense?: number;
                dexterity?: number;
                attackTicks?: number;
                movementTicks?: number;
                poisonAttack?: number;
                byte22?: number[];
                properties?: { fearResistance?: number };
                resistances?: { fire?: number; poison?: number };
                nonMaterial?: boolean;
                attackAnyChampion?: boolean;
                attackFromAllSides?: boolean;
                preferBackRow?: boolean;
                levitates?: boolean;
                absorbMissiles?: boolean;
                seeInvisible?: boolean;
                ranges?: { attack?: number; sight?: number };
                archenemy?: boolean;
                attack?: number;
            }>;
        };
    };
};

const ORIGINAL_CREATURES_PATH = `${process.cwd()}\\public\\original_creatures_runtime.json`;
const ORIGINAL_DOORS_PATH = `${process.cwd()}\\public\\original_doors_runtime.json`;
const ORIGINAL_EXPERIENCE_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\reference_exports\\original_experience_runtime.json`;
const ORIGINAL_CHAMPION_PROGRESSION_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\reference_exports\\original_champion_progression_runtime.json`;
const ORIGINAL_MIRROR_RECRUITMENT_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\reference_exports\\original_mirror_recruitment_runtime.json`;
const ORIGINAL_ITEM_RULES_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\reference_exports\\original_item_rules_runtime.json`;
const ORIGINAL_EQUIPMENT_BONUSES_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\reference_exports\\original_equipment_bonuses_runtime.json`;
const ORIGINAL_SKILLS_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\reference_exports\\original_skills_runtime.json`;
const ORIGINAL_MAGIC_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\reference_exports\\original_magic_runtime.json`;
const ORIGINAL_ACTIONS_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\reference_exports\\original_actions_runtime.json`;
const ORIGINAL_ACTION_COMBOS_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\reference_exports\\original_action_combos_runtime.json`;
const ORIGINAL_UI_SUPPORT_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\reference_exports\\original_ui_support_runtime.json`;
const ORIGINAL_TELEPORTERS_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\reference_exports\\original_teleporters_runtime.json`;
const SOURCE_GAME_DB_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\output\\game_db.json`;

function readOriginalCreatures(): OriginalCreaturesPayload {
    return JSON.parse(readFileSync(ORIGINAL_CREATURES_PATH, 'utf8')) as OriginalCreaturesPayload;
}

function readOriginalDoors(): OriginalDoorsPayload {
    return JSON.parse(readFileSync(ORIGINAL_DOORS_PATH, 'utf8')) as OriginalDoorsPayload;
}

function readOriginalTeleporters(): OriginalTeleportersPayload {
    return JSON.parse(readFileSync(ORIGINAL_TELEPORTERS_PATH, 'utf8')) as OriginalTeleportersPayload;
}

function readSourceGameDbCreatures(): SourceGameDbCreatures {
    return JSON.parse(readFileSync(SOURCE_GAME_DB_PATH, 'utf8')) as SourceGameDbCreatures;
}

test('runtime creature, door, teleporter and documented reference exports stay byte-identical to their canonical exports', () => {
    const runtimeCreatures = readFileSync(`${process.cwd()}\\src\\assets\\runtime\\reference\\original_creatures_runtime.json`, 'utf8');
    const runtimeDoors = readFileSync(`${process.cwd()}\\src\\assets\\runtime\\reference\\original_doors_runtime.json`, 'utf8');
    const runtimeExperience = readFileSync(`${process.cwd()}\\src\\assets\\runtime\\reference\\original_experience_runtime.json`, 'utf8');
    const runtimeChampionProgression = readFileSync(`${process.cwd()}\\src\\assets\\runtime\\reference\\original_champion_progression_runtime.json`, 'utf8');
    const runtimeMirrorRecruitment = readFileSync(`${process.cwd()}\\src\\assets\\runtime\\reference\\original_mirror_recruitment_runtime.json`, 'utf8');
    const runtimeItemRules = readFileSync(`${process.cwd()}\\src\\assets\\runtime\\reference\\original_item_rules_runtime.json`, 'utf8');
    const runtimeEquipmentBonuses = readFileSync(`${process.cwd()}\\src\\assets\\runtime\\reference\\original_equipment_bonuses_runtime.json`, 'utf8');
    const runtimeSkills = readFileSync(`${process.cwd()}\\src\\assets\\runtime\\reference\\original_skills_runtime.json`, 'utf8');
    const runtimeMagic = readFileSync(`${process.cwd()}\\src\\assets\\runtime\\reference\\original_magic_runtime.json`, 'utf8');
    const runtimeActions = readFileSync(`${process.cwd()}\\src\\assets\\runtime\\reference\\original_actions_runtime.json`, 'utf8');
    const runtimeActionCombos = readFileSync(`${process.cwd()}\\src\\assets\\runtime\\reference\\original_action_combos_runtime.json`, 'utf8');
    const runtimeUiSupport = readFileSync(`${process.cwd()}\\src\\assets\\runtime\\reference\\original_ui_support_runtime.json`, 'utf8');
    const runtimeTeleporters = readFileSync(`${process.cwd()}\\src\\assets\\runtime\\reference\\original_teleporters_runtime.json`, 'utf8');

    assert.equal(runtimeCreatures, readFileSync(ORIGINAL_CREATURES_PATH, 'utf8'));
    assert.equal(runtimeDoors, readFileSync(ORIGINAL_DOORS_PATH, 'utf8'));
    assert.equal(runtimeExperience, readFileSync(ORIGINAL_EXPERIENCE_PATH, 'utf8'));
    assert.equal(runtimeChampionProgression, readFileSync(ORIGINAL_CHAMPION_PROGRESSION_PATH, 'utf8'));
    assert.equal(runtimeMirrorRecruitment, readFileSync(ORIGINAL_MIRROR_RECRUITMENT_PATH, 'utf8'));
    assert.equal(runtimeItemRules, readFileSync(ORIGINAL_ITEM_RULES_PATH, 'utf8'));
    assert.equal(runtimeEquipmentBonuses, readFileSync(ORIGINAL_EQUIPMENT_BONUSES_PATH, 'utf8'));
    assert.equal(runtimeSkills, readFileSync(ORIGINAL_SKILLS_PATH, 'utf8'));
    assert.equal(runtimeMagic, readFileSync(ORIGINAL_MAGIC_PATH, 'utf8'));
    assert.equal(runtimeActions, readFileSync(ORIGINAL_ACTIONS_PATH, 'utf8'));
    assert.equal(runtimeActionCombos, readFileSync(ORIGINAL_ACTION_COMBOS_PATH, 'utf8'));
    assert.equal(runtimeUiSupport, readFileSync(ORIGINAL_UI_SUPPORT_PATH, 'utf8'));
    assert.equal(runtimeTeleporters, readFileSync(ORIGINAL_TELEPORTERS_PATH, 'utf8'));
});

test('runtime door reference preserves every original runtime door definition exactly', () => {
    const expected = readOriginalDoors();
    const actual = JSON.parse(
        readFileSync(`${process.cwd()}\\src\\assets\\runtime\\reference\\original_doors_runtime.json`, 'utf8'),
    ) as OriginalDoorsPayload;

    assert.deepEqual(actual, expected);
});

test('runtime teleporter reference preserves every canonical teleporter definition exactly', () => {
    const expected = readOriginalTeleporters();
    const actual = JSON.parse(
        readFileSync(`${process.cwd()}\\src\\assets\\runtime\\reference\\original_teleporters_runtime.json`, 'utf8'),
    ) as OriginalTeleportersPayload;

    assert.deepEqual(actual, expected);
});

test('creature reference export stays aligned with the source-backed I559 combat subset', () => {
    const originalCreatures = readOriginalCreatures().creatures;
    const sourceCreatures = new Map(
        (readSourceGameDbCreatures().originalAtari?.i559?.creatures ?? []).map((creature) => [creature.index, creature]),
    );
    const ORIGINAL_ATTACK_TYPE_BY_ID = [
        'Unconditional',
        'Fire',
        'Impact',
        'Blunt',
        'Sharp',
        'Magic',
        'Mental',
        'Blast',
    ];

    for (const original of originalCreatures) {
        const source = sourceCreatures.get(original.id);
        assert.ok(source, `creature ${original.id} missing from source-backed I559 export`);

        assert.equal(original.baseHP, source?.baseHealth ?? original.baseHP, `creature ${original.id} reference baseHP drifted`);
        assert.equal(original.armor, source?.defense ?? original.armor, `creature ${original.id} reference armor drifted`);
        assert.equal(original.hitProb, source?.dexterity ?? original.hitProb, `creature ${original.id} reference hitProb drifted`);
        assert.equal(original.atkSpd, source?.attackTicks ?? original.atkSpd, `creature ${original.id} reference atkSpd drifted`);
        assert.equal(original.moveSpd, source?.movementTicks ?? original.moveSpd, `creature ${original.id} reference moveSpd drifted`);
        assert.equal(original.poison, typeof source?.poisonAttack === 'number' ? source.poisonAttack > 0 : original.poison, `creature ${original.id} reference poison flag drifted`);
        assert.equal(
            original.attackType,
            typeof source?.byte22?.[2] === 'number'
                ? (ORIGINAL_ATTACK_TYPE_BY_ID[source.byte22[2]] ?? original.attackType)
                : original.attackType,
            `creature ${original.id} reference attack type drifted`,
        );
    }
});

test('creatures module preserves every source-backed creature characteristic used at runtime', async () => {
    await preloadGameDbCreaturesData();

    const originalCreatures = readOriginalCreatures().creatures;
    const sourceCreatures = new Map(
        (readSourceGameDbCreatures().originalAtari?.i559?.creatures ?? []).map((creature) => [creature.index, creature]),
    );
    const ORIGINAL_ATTACK_TYPE_BY_ID = [
        'Unconditional',
        'Fire',
        'Impact',
        'Blunt',
        'Sharp',
        'Magic',
        'Mental',
        'Blast',
    ];

    for (const original of originalCreatures) {
        const source = sourceCreatures.get(original.id);
        const runtime = CREATURE_TYPES[original.id];
        assert.ok(runtime, `creature ${original.id} missing from runtime creature table`);

        assert.equal(runtime.name, original.name, `creature ${original.id} name drifted`);
        assert.equal(runtime.baseHP, source?.baseHealth ?? original.baseHP, `creature ${original.id} baseHP drifted`);
        assert.equal(runtime.armor, source?.defense ?? original.armor, `creature ${original.id} armor drifted`);
        assert.equal(runtime.hitProb, source?.dexterity ?? original.hitProb, `creature ${original.id} hitProb drifted`);
        assert.equal(runtime.atkSpd, source?.attackTicks ?? original.atkSpd, `creature ${original.id} atkSpd drifted`);
        assert.equal(runtime.moveSpd, source?.movementTicks ?? original.moveSpd, `creature ${original.id} moveSpd drifted`);
        assert.equal(runtime.exp, original.exp, `creature ${original.id} exp drifted`);
        assert.equal(runtime.poison, typeof source?.poisonAttack === 'number' ? source.poisonAttack > 0 : original.poison, `creature ${original.id} poison flag drifted`);
        assert.equal(
            runtime.originalAttackType,
            typeof source?.byte22?.[2] === 'number'
                ? (ORIGINAL_ATTACK_TYPE_BY_ID[source.byte22[2]] ?? original.attackType)
                : original.attackType,
            `creature ${original.id} original attack type drifted`,
        );
        assert.equal(runtime.rawAttack, source?.attack ?? 0, `creature ${original.id} raw attack drifted`);
        assert.equal(runtime.poisonAttack, source?.poisonAttack ?? 0, `creature ${original.id} poison attack drifted`);
        assert.equal(runtime.dexterity, source?.dexterity ?? 0, `creature ${original.id} dexterity drifted`);
        assert.equal(runtime.fireResistance, source?.resistances?.fire ?? 0, `creature ${original.id} fire resistance drifted`);
        assert.equal(runtime.poisonResistance, source?.resistances?.poison ?? 0, `creature ${original.id} poison resistance drifted`);
        assert.equal(runtime.nonMaterial, Boolean(source?.nonMaterial), `creature ${original.id} non-material flag drifted`);
        assert.equal(runtime.attackAnyChampion, Boolean(source?.attackAnyChampion), `creature ${original.id} attackAnyChampion drifted`);
        assert.equal(runtime.attackFromAllSides, Boolean(source?.attackFromAllSides), `creature ${original.id} attackFromAllSides drifted`);
        assert.equal(runtime.attackRange, Math.max(1, source?.ranges?.attack ?? 1), `creature ${original.id} attack range drifted`);
        assert.equal(runtime.sightRange, Math.max(1, source?.ranges?.sight ?? 8), `creature ${original.id} sight range drifted`);
        assert.equal(runtime.preferBackRow, Boolean(source?.preferBackRow), `creature ${original.id} preferBackRow drifted`);
        assert.equal(runtime.levitates, Boolean(source?.levitates), `creature ${original.id} levitates drifted`);
        assert.equal(runtime.absorbMissiles, Boolean(source?.absorbMissiles), `creature ${original.id} absorbMissiles drifted`);
        assert.equal(runtime.seeInvisible, Boolean(source?.seeInvisible), `creature ${original.id} seeInvisible drifted`);
        assert.equal(runtime.fearResistance, Math.max(0, Math.min(15, source?.properties?.fearResistance ?? 0)), `creature ${original.id} fear resistance drifted`);
        assert.equal(runtime.archenemy, Boolean(source?.archenemy), `creature ${original.id} archenemy drifted`);
    }
});

test('wall overlay support loader preserves every split runtime map exactly', async () => {
    await preloadOriginalWallOverlayData();

    for (let mapIndex = 0; mapIndex <= 13; mapIndex += 1) {
        const expected = JSON.parse(
            readFileSync(`${process.cwd()}\\src\\assets\\runtime\\support\\wall_overlays\\map-${String(mapIndex).padStart(2, '0')}.json`, 'utf8'),
        ) as unknown;
        const actual = getOriginalWallOverlayMapDataSync<unknown>(mapIndex);
        assert.deepEqual(actual, expected, `wall overlay map ${mapIndex} drifted through the loader`);
    }
});

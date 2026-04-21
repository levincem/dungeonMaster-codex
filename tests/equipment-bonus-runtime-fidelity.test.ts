import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    ORIGINAL_CURSED_LUCK_PENALTY,
    ORIGINAL_EQUIPMENT_MASTERY_BONUSES,
    ORIGINAL_EQUIPMENT_STAT_BONUSES,
    getOriginalEquipmentBonusDescription,
    getOriginalEquipmentSkillLevelModifier,
    getOriginalEquipmentStatBonuses,
} from '../src/data/originalEquipmentBonuses.js';
import { getEquipmentStatBonuses, getEffectiveChampionStats } from '../src/data/equipment.js';
import { MISC_TYPES } from '../src/data/items.js';
import type { Champion } from '../src/types/champion.js';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';

type OriginalEquipmentBonusesRuntime = {
    masteryBonuses: Array<{
        category: FloorItem['category'];
        typeId: number;
        runtimeName: string;
        slot: string;
        appliesTo: 'all' | string[];
        bonusLevels: number;
    }>;
    statBonuses: Array<{
        category: FloorItem['category'];
        typeId: number;
        runtimeName: string;
        slot: string;
        stat: string;
        amount: number;
    }>;
    cursedLuckPenalty: {
        categories: string[];
        stat: string;
        amount: number;
    };
};

const CANONICAL_REFERENCE_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\reference_exports\\original_equipment_bonuses_runtime.json`;
const RUNTIME_REFERENCE_PATH = `${process.cwd()}\\src\\assets\\runtime\\reference\\original_equipment_bonuses_runtime.json`;

function createChampion(): Champion {
    return {
        id: 1,
        name: 'Hissssa',
        title: 'The Tested',
        gender: 'F',
        class: 'Wizard',
        health: 100,
        stamina: 90,
        mana: 40,
        luck: 10,
        strength: 20,
        dexterity: 15,
        wisdom: 12,
        vitality: 14,
        antiMagic: 8,
        antiFire: 7,
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

function createEquipment(): ChampionEquipment {
    return {
        rightHand: {
            id: 'firestaff-complete',
            category: 'Weapon',
            typeId: 45,
            rawName: 'The Firestaff (Complete)',
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
        },
        neck: {
            id: 'moonstone',
            category: 'Misc',
            typeId: 39,
            rawName: 'Moonstone',
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
        },
        pocket1: {
            id: 'rabbit',
            category: 'Misc',
            typeId: 46,
            rawName: "Rabbit's Foot",
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
        },
        torso: {
            id: 'cloak',
            category: 'Armor',
            typeId: 1,
            rawName: 'Cloak Of Night',
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
        },
        head: {
            id: 'cursed-dexhelm',
            category: 'Armor',
            typeId: 53,
            rawName: 'Dexhelm',
            cursed: true,
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
        },
    };
}

test('runtime equipment bonus reference stays byte-identical to the canonical source export', () => {
    assert.equal(
        readFileSync(RUNTIME_REFERENCE_PATH, 'utf8'),
        readFileSync(CANONICAL_REFERENCE_PATH, 'utf8'),
    );
});

test('original equipment bonus module stays aligned with the packaged canonical reference', () => {
    const reference = JSON.parse(readFileSync(CANONICAL_REFERENCE_PATH, 'utf8')) as OriginalEquipmentBonusesRuntime;
    assert.deepEqual(ORIGINAL_EQUIPMENT_MASTERY_BONUSES, reference.masteryBonuses);
    assert.deepEqual(ORIGINAL_EQUIPMENT_STAT_BONUSES, reference.statBonuses);
    assert.deepEqual(ORIGINAL_CURSED_LUCK_PENALTY, reference.cursedLuckPenalty);
});

test('equipment bonus consumers follow the source-backed mastery and stat rules', () => {
    const equipment = createEquipment();

    assert.equal(getOriginalEquipmentSkillLevelModifier('wizard', equipment), 2);
    assert.equal(getOriginalEquipmentSkillLevelModifier('fighter', equipment), 2);
    assert.equal(getOriginalEquipmentSkillLevelModifier('influence', equipment), 3);

    const bonuses = getOriginalEquipmentStatBonuses(equipment);
    assert.deepEqual(bonuses, {
        mana: 3,
        strength: 0,
        dexterity: 18,
        wisdom: 0,
        vitality: 0,
        antiMagic: 0,
        antiFire: 0,
        luck: 7,
    });

    assert.deepEqual(getEquipmentStatBonuses(equipment), bonuses);

    const effective = getEffectiveChampionStats(createChampion(), equipment);
    assert.equal(effective.mana, 43);
    assert.equal(effective.dexterity, 33);
    assert.equal(effective.luck, 17);
});

test('every source-backed mastery bonus is consumed with the documented slot and skill scope', () => {
    for (const rule of ORIGINAL_EQUIPMENT_MASTERY_BONUSES) {
        const equipment = {
            [rule.slot]: {
                id: `mastery-${rule.category}-${rule.typeId}`,
                category: rule.category,
                typeId: rule.typeId,
                rawName: rule.runtimeName,
                mapIndex: 0,
                x: 0,
                y: 0,
                tilePos: 'North',
            },
        } as ChampionEquipment;

        if (rule.appliesTo === 'all') {
            assert.equal(getOriginalEquipmentSkillLevelModifier('wizard', equipment), rule.bonusLevels);
            assert.equal(getOriginalEquipmentSkillLevelModifier('fighter', equipment), rule.bonusLevels);
            continue;
        }

        for (const skill of rule.appliesTo) {
            assert.equal(
                getOriginalEquipmentSkillLevelModifier(skill, equipment),
                rule.bonusLevels,
                `${rule.runtimeName} should grant ${rule.bonusLevels} to ${skill}`,
            );
        }
    }
});

test('every source-backed stat bonus is consumed with the documented slot and stat amount', () => {
    for (const rule of ORIGINAL_EQUIPMENT_STAT_BONUSES) {
        const targetSlot = rule.slot === 'any' ? 'neck' : rule.slot;
        const equipment = {
            [targetSlot]: {
                id: `stat-${rule.category}-${rule.typeId}-${targetSlot}`,
                category: rule.category,
                typeId: rule.typeId,
                rawName: rule.runtimeName,
                mapIndex: 0,
                x: 0,
                y: 0,
                tilePos: 'North',
            },
        } as ChampionEquipment;

        const bonuses = getOriginalEquipmentStatBonuses(equipment);
        for (const [stat, amount] of Object.entries(bonuses)) {
            const expected = stat === rule.stat ? rule.amount : 0;
            assert.equal(amount, expected, `${rule.runtimeName} should contribute ${expected} to ${stat}`);
        }
    }
});

test('source-backed misc bonus descriptions stay aligned with the canonical equipment bonus table', () => {
    const expectedDescriptions = {
         2: '+15 Anti-Magic',
        37: '+1 hidden priest heal skill',
        38: '+1 hidden priest defend skill',
        39: '+3 Mana, +1 hidden priest influence skill',
        41: '+1 Wizard skill',
        46: '+10 Luck',
    } as const;

    for (const [typeIdRaw, expected] of Object.entries(expectedDescriptions)) {
        const typeId = Number(typeIdRaw);
        assert.equal(getOriginalEquipmentBonusDescription('Misc', typeId), expected);
        assert.equal(MISC_TYPES[typeId]?.description, expected);
    }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { preloadDungeonData } from '../src/data/dungeonData.js';
import { buildInitialChampionXP, isLegacyChampionXPForChampion } from '../src/engine/systems/championState.js';
import { createEmptyChampionXP, type ChampionXP } from '../src/data/skillProgression.js';
import type { Champion, ChampionClass, ChampionSkills } from '../src/types/champion.js';

type SourceChampion = {
    portraitId: number;
    name: string;
    title: string;
    gender: Champion['gender'];
    health: number;
    stamina: number;
    mana: number;
    luck: number;
    strength: number;
    dexterity: number;
    wisdom: number;
    vitality: number;
    antiMagic: number;
    antiFire: number;
    skills: ChampionSkills;
};

type SourceDungeon = {
    champions: SourceChampion[];
};

const SOURCE_DUNGEON_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\output\\dungeon.json`;
const ORIGINAL_STAMINA_SCALE = 10;

function readSourceDungeon(): SourceDungeon {
    return JSON.parse(readFileSync(SOURCE_DUNGEON_PATH, 'utf8')) as SourceDungeon;
}

function sumSkillLevels(levels: [number, number, number, number]): number {
    return levels[0] + levels[1] + levels[2] + levels[3];
}

function deriveExpectedChampionClass(skills: ChampionSkills): ChampionClass {
    const totals: Array<[ChampionClass, number]> = [
        ['Fighter', sumSkillLevels(skills.fighter)],
        ['Ninja', sumSkillLevels(skills.ninja)],
        ['Priest', sumSkillLevels(skills.priest)],
        ['Wizard', sumSkillLevels(skills.wizard)],
    ];

    totals.sort((left, right) => right[1] - left[1]);
    return totals[0]?.[0] ?? 'Fighter';
}

function buildExpectedInitialChampionXP(skills: ChampionSkills): ChampionXP {
    const xp = createEmptyChampionXP();
    const groups: Array<[keyof ChampionSkills, Array<keyof ChampionXP>, keyof ChampionXP]> = [
        ['fighter', ['swing', 'thrust', 'club', 'parry'], 'fighter'],
        ['ninja', ['steal', 'fight', 'throw', 'shoot'], 'ninja'],
        ['priest', ['identify', 'heal', 'influence', 'defend'], 'priest'],
        ['wizard', ['fire', 'air', 'earth', 'water'], 'wizard'],
    ];

    for (const [basicSkill, hiddenSkills, parentSkill] of groups) {
        let basicExperience = 0;
        hiddenSkills.forEach((hiddenSkill, index) => {
            const encodedValue = skills[basicSkill][index] ?? 0;
            const hiddenExperience = encodedValue > 0 ? (125 << encodedValue) : 0;
            xp[hiddenSkill] = hiddenExperience;
            basicExperience += hiddenExperience;
        });
        xp[parentSkill] = basicExperience;
    }

    return xp;
}

function buildLegacyInitialChampionXP(skills: ChampionSkills): ChampionXP {
    const xp = createEmptyChampionXP();
    const toLegacyBasicXP = (values: [number, number, number, number]) => Math.pow(Math.max(values[0], values[2]), 2) * 500;
    xp.fighter = toLegacyBasicXP(skills.fighter);
    xp.ninja = toLegacyBasicXP(skills.ninja);
    xp.priest = toLegacyBasicXP(skills.priest);
    xp.wizard = toLegacyBasicXP(skills.wizard);
    return xp;
}

async function loadRuntimeChampions(): Promise<Champion[]> {
    await preloadDungeonData();
    const module = await import('../src/data/champions.js');
    return module.CHAMPIONS as Champion[];
}

test('runtime champion roster preserves extracted champion skill seeds and core stats', async () => {
    const sourceDungeon = readSourceDungeon();
    const runtimeChampions = await loadRuntimeChampions();
    const runtimeById = new Map(runtimeChampions.map((champion) => [champion.id, champion]));

    assert.equal(runtimeChampions.length, sourceDungeon.champions.length);

    for (const sourceChampion of sourceDungeon.champions) {
        const runtimeChampion = runtimeById.get(sourceChampion.portraitId);
        assert.ok(runtimeChampion, `missing runtime champion ${sourceChampion.portraitId}`);
        assert.equal(runtimeChampion!.name, sourceChampion.name, `${sourceChampion.name} name drifted`);
        assert.equal(runtimeChampion!.title, sourceChampion.title, `${sourceChampion.name} title drifted`);
        assert.equal(runtimeChampion!.gender, sourceChampion.gender, `${sourceChampion.name} gender drifted`);
        assert.equal(runtimeChampion!.health, sourceChampion.health, `${sourceChampion.name} health drifted`);
        assert.equal(runtimeChampion!.stamina, sourceChampion.stamina * ORIGINAL_STAMINA_SCALE, `${sourceChampion.name} stamina scaling drifted`);
        assert.equal(runtimeChampion!.mana, sourceChampion.mana, `${sourceChampion.name} mana drifted`);
        assert.equal(runtimeChampion!.luck, sourceChampion.luck, `${sourceChampion.name} luck drifted`);
        assert.equal(runtimeChampion!.strength, sourceChampion.strength, `${sourceChampion.name} strength drifted`);
        assert.equal(runtimeChampion!.dexterity, sourceChampion.dexterity, `${sourceChampion.name} dexterity drifted`);
        assert.equal(runtimeChampion!.wisdom, sourceChampion.wisdom, `${sourceChampion.name} wisdom drifted`);
        assert.equal(runtimeChampion!.vitality, sourceChampion.vitality, `${sourceChampion.name} vitality drifted`);
        assert.equal(runtimeChampion!.antiMagic, sourceChampion.antiMagic, `${sourceChampion.name} antiMagic drifted`);
        assert.equal(runtimeChampion!.antiFire, sourceChampion.antiFire, `${sourceChampion.name} antiFire drifted`);
        assert.deepEqual(runtimeChampion!.skills, sourceChampion.skills, `${sourceChampion.name} skills drifted`);
        assert.equal(
            runtimeChampion!.class,
            deriveExpectedChampionClass(sourceChampion.skills),
            `${sourceChampion.name} derived class drifted`,
        );
    }
});

test('championState initial XP stays aligned with extracted champion skill seeds for the full roster', async () => {
    const sourceDungeon = readSourceDungeon();
    const runtimeChampions = await loadRuntimeChampions();
    const runtimeById = new Map(runtimeChampions.map((champion) => [champion.id, champion]));

    for (const sourceChampion of sourceDungeon.champions) {
        const runtimeChampion = runtimeById.get(sourceChampion.portraitId);
        assert.ok(runtimeChampion, `missing runtime champion ${sourceChampion.portraitId}`);
        assert.deepEqual(
            buildInitialChampionXP(runtimeChampion!),
            buildExpectedInitialChampionXP(sourceChampion.skills),
            `${sourceChampion.name} initial XP drifted from extracted skill seeds`,
        );
    }
});

test('legacy basic-only champion XP detection stays separate from source-backed hidden-skill initialization', async () => {
    const sourceDungeon = readSourceDungeon();
    const runtimeChampions = await loadRuntimeChampions();
    const runtimeById = new Map(runtimeChampions.map((champion) => [champion.id, champion]));

    for (const sourceChampion of sourceDungeon.champions) {
        const runtimeChampion = runtimeById.get(sourceChampion.portraitId);
        assert.ok(runtimeChampion, `missing runtime champion ${sourceChampion.portraitId}`);
        assert.equal(
            isLegacyChampionXPForChampion(runtimeChampion!, buildLegacyInitialChampionXP(sourceChampion.skills)),
            true,
            `${sourceChampion.name} legacy XP detection drifted`,
        );
        assert.equal(
            isLegacyChampionXPForChampion(runtimeChampion!, buildExpectedInitialChampionXP(sourceChampion.skills)),
            false,
            `${sourceChampion.name} source-backed hidden XP should not be treated as legacy`,
        );
    }
});

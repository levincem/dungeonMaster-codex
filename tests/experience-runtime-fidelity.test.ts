import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getGameMap } from '../src/data/mapLoader.js';
import { preloadDungeonData } from '../src/data/dungeonData.js';
import { createEmptyChampionTemporaryXP, createEmptyChampionXP } from '../src/data/skillProgression.js';
import {
    ORIGINAL_EXPERIENCE_LEVEL_MULTIPLIERS,
    ORIGINAL_EXPERIENCE_RULES,
    ORIGINAL_RECENT_THREAT_TICKS,
    ORIGINAL_STALE_THREAT_HIDDEN_SKILLS,
    ORIGINAL_STALE_THREAT_TICKS,
} from '../src/data/originalExperience.js';
import { applyOriginalChampionSkillExperience } from '../src/engine/systems/originalChampionLeveling.js';
import type { Champion } from '../src/types/champion.js';
import type { SkillKey } from '../src/data/skillProgression.js';

type OriginalExperienceRuntime = {
    dungeonMasterLevelMultipliers: Record<string, number>;
    chaosStrikesBackLevelMultipliers: Record<string, number>;
    rules: {
        halveHiddenFighterOrNinjaExperienceWithoutRecentThreat: string;
        staleThreatHiddenSkills: SkillKey[];
        staleThreatTicks: number;
        applyLevelMultiplierWhenNonZero: string;
        doubleHiddenSkillExperienceAfterRecentThreat: string;
        recentThreatTicks: number;
        hiddenSkillAlsoFeedsParentBasicSkill: boolean;
    };
};

const CANONICAL_EXPERIENCE_REFERENCE_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\reference_exports\\original_experience_runtime.json`;
const RUNTIME_EXPERIENCE_REFERENCE_PATH = `${process.cwd()}\\src\\assets\\runtime\\reference\\original_experience_runtime.json`;

function readCanonicalExperienceRuntime(): OriginalExperienceRuntime {
    return JSON.parse(readFileSync(CANONICAL_EXPERIENCE_REFERENCE_PATH, 'utf8')) as OriginalExperienceRuntime;
}

function createChampion(): Champion {
    return {
        id: 1,
        name: 'Halk',
        title: 'The Tested',
        gender: 'M',
        class: 'Fighter',
        health: 100,
        stamina: 80,
        mana: 20,
        luck: 10,
        strength: 20,
        dexterity: 16,
        wisdom: 8,
        vitality: 15,
        antiMagic: 6,
        antiFire: 4,
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

test('runtime experience reference stays byte-identical to the canonical documented export', () => {
    assert.equal(
        readFileSync(RUNTIME_EXPERIENCE_REFERENCE_PATH, 'utf8'),
        readFileSync(CANONICAL_EXPERIENCE_REFERENCE_PATH, 'utf8'),
    );
});

test('originalExperience runtime module stays aligned with the packaged experience reference', () => {
    const reference = readCanonicalExperienceRuntime();
    assert.deepEqual(ORIGINAL_EXPERIENCE_LEVEL_MULTIPLIERS, reference.dungeonMasterLevelMultipliers);
    assert.deepEqual(ORIGINAL_EXPERIENCE_RULES, reference.rules);
    assert.equal(ORIGINAL_STALE_THREAT_TICKS, reference.rules.staleThreatTicks);
    assert.equal(ORIGINAL_RECENT_THREAT_TICKS, reference.rules.recentThreatTicks);
    assert.deepEqual(
        [...ORIGINAL_STALE_THREAT_HIDDEN_SKILLS].sort(),
        [...reference.rules.staleThreatHiddenSkills].sort(),
    );
});

test('runtime dungeon map difficulty matches the documented Dungeon Master level multipliers', async () => {
    await preloadDungeonData();
    const reference = readCanonicalExperienceRuntime();

    for (const [levelText, expectedMultiplier] of Object.entries(reference.dungeonMasterLevelMultipliers)) {
        const level = Number(levelText);
        assert.equal(
            getGameMap(level).difficulty,
            expectedMultiplier,
            `map ${level} difficulty drifted from documented experience multiplier`,
        );
    }
});

test('runtime champion XP adjustment follows documented multiplier and parent-feed rules', async () => {
    await preloadDungeonData();
    const reference = readCanonicalExperienceRuntime();
    assert.equal(reference.rules.applyLevelMultiplierWhenNonZero.includes('Multiply'), true);
    assert.equal(reference.rules.hiddenSkillAlsoFeedsParentBasicSkill, true);

    for (const [levelText, multiplier] of Object.entries(reference.dungeonMasterLevelMultipliers)) {
        const level = Number(levelText);
        const result = applyOriginalChampionSkillExperience(
            createChampion(),
            createEmptyChampionXP(),
            createEmptyChampionTemporaryXP(),
            'fighter',
            10,
            {
                mapDifficulty: getGameMap(level).difficulty,
                elapsedGameTimeTicks: 200,
                lastCreatureAttackGameTick: 0,
            },
            () => 0,
        );

        const expectedAdjustedExperience = multiplier > 0 ? 10 * multiplier : 10;
        assert.ok(result, `expected XP result for map ${level}`);
        assert.equal(
            result?.adjustedExperience,
            expectedAdjustedExperience,
            `map ${level} adjustedExperience drifted from documented multiplier rule`,
        );
        assert.equal(
            result?.championXP.fighter,
            expectedAdjustedExperience,
            `map ${level} fighter XP drifted from documented multiplier rule`,
        );
    }
});

test('runtime champion XP adjustment follows documented stale-threat and recent-threat hidden-skill rules', () => {
    const reference = readCanonicalExperienceRuntime();
    assert.equal(reference.rules.halveHiddenFighterOrNinjaExperienceWithoutRecentThreat.includes('divide experience by 2'), true);
    assert.equal(reference.rules.doubleHiddenSkillExperienceAfterRecentThreat.includes('multiply experience by 2'), true);
    assert.equal(reference.rules.staleThreatTicks, 150);
    assert.equal(reference.rules.recentThreatTicks, 25);
    assert.deepEqual(
        reference.rules.staleThreatHiddenSkills,
        ['swing', 'thrust', 'club', 'parry', 'steal', 'fight', 'throw', 'shoot'],
    );

    const staleHiddenResult = applyOriginalChampionSkillExperience(
        createChampion(),
        createEmptyChampionXP(),
        createEmptyChampionTemporaryXP(),
        'throw',
        10,
        {
            mapDifficulty: 2,
            elapsedGameTimeTicks: 200,
            lastCreatureAttackGameTick: 200 - reference.rules.staleThreatTicks,
        },
        () => 0,
    );

    assert.ok(staleHiddenResult);
    assert.equal(staleHiddenResult?.adjustedExperience, 10);
    assert.equal(staleHiddenResult?.championXP.throw, 10);
    assert.equal(staleHiddenResult?.championXP.ninja, 10);

    const recentHiddenResult = applyOriginalChampionSkillExperience(
        createChampion(),
        createEmptyChampionXP(),
        createEmptyChampionTemporaryXP(),
        'throw',
        10,
        {
            mapDifficulty: 2,
            elapsedGameTimeTicks: 200,
            lastCreatureAttackGameTick: 200 - reference.rules.recentThreatTicks + 1,
        },
        () => 0,
    );

    assert.ok(recentHiddenResult);
    assert.equal(recentHiddenResult?.adjustedExperience, 40);
    assert.equal(recentHiddenResult?.championXP.throw, 40);
    assert.equal(recentHiddenResult?.championXP.ninja, 40);
});

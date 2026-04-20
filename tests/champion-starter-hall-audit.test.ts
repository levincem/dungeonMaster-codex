import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CHAMPION_STARTER_LOADOUTS, buildChampionStarterLoadout } from '../src/data/championStarterItems.js';

type HallChampion = {
    x: number;
    y: number;
    name: string;
};

type HallObject = {
    category: 'Armor' | 'Weapon' | 'Potion' | 'Misc' | 'Scroll' | 'Container' | 'Sensor';
    type?: number;
    data?: number;
};

type HallMirrorEvidence = {
    championId: number;
    championName: string;
    slot: number;
    items: Array<{ category: Exclude<HallObject['category'], 'Sensor'>; type: number }>;
};

function readJson<T>(relativePath: string): T {
    return JSON.parse(
        fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8'),
    ) as T;
}

function normalizeName(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildChampionNameMatchers(): Array<{ championId: number; baseName: string }> {
    const gameDb = readJson<{
        championPortraits: Record<string, string>;
    }>('assets/OriginalDataExtraction/output/game_db.json');

    return Object.entries(gameDb.championPortraits)
        .map(([championId, portrait]) => ({
            championId: Number(championId),
            baseName: String(portrait).split('/')[0].trim(),
        }))
        .sort((left, right) => right.baseName.length - left.baseName.length);
}

function resolveChampionId(fullName: string, matchers: Array<{ championId: number; baseName: string }>): number {
    const normalizedFullName = normalizeName(fullName);
    const match = matchers.find(({ baseName }) => normalizedFullName.startsWith(normalizeName(baseName)));
    assert.ok(match, `Unable to match Hall champion "${fullName}" to championPortraits`);
    return match.championId;
}

function buildHallMirrorEvidence(): HallMirrorEvidence[] {
    const originalLevelContent = readJson<{
        levels: Array<{ name: string; champions?: HallChampion[] }>;
    }>('assets/OriginalDataExtraction/output/original_level_content.json');
    const dungeon = readJson<{
        maps: Array<{ tiles: Array<{ x: number; y: number; objects?: HallObject[] }> }>;
    }>('assets/OriginalDataExtraction/output/dungeon.json');
    const hallLevel = originalLevelContent.levels.find((level) => level.name === 'Hall of Champions');
    assert.ok(hallLevel?.champions, 'Hall of Champions champion list missing from original_level_content.json');
    const hallChampions = hallLevel.champions as HallChampion[];

    const championMatchers = buildChampionNameMatchers();
    const evidence: HallMirrorEvidence[] = [];

    for (const tile of dungeon.maps[0]?.tiles ?? []) {
        const mirror = (tile.objects ?? []).find((object) => object.category === 'Sensor' && object.type === 127);
        if (!mirror) continue;

        const adjacentChampions = hallChampions.filter((champion) => (
            Math.abs(champion.x - tile.x) + Math.abs(champion.y - tile.y) === 1
        ));
        assert.equal(
            adjacentChampions.length,
            1,
            `Expected exactly one adjacent champion for mirror slot ${mirror.data} at (${tile.x},${tile.y})`,
        );

        const championName = adjacentChampions[0].name;
        evidence.push({
            championId: resolveChampionId(championName, championMatchers),
            championName,
            slot: mirror.data ?? -1,
            items: (tile.objects ?? [])
                .filter((object): object is HallObject & { type: number } => object.category !== 'Sensor' && typeof object.type === 'number')
                .map((object) => ({
                    category: object.category as Exclude<HallObject['category'], 'Sensor'>,
                    type: object.type,
                })),
        });
    }

    evidence.sort((left, right) => left.championId - right.championId);
    return evidence;
}

function collectCurrentLoadoutItems(championId: number): Array<{ category: string; typeId: number }> {
    const loadout = buildChampionStarterLoadout(championId);
    return [
        ...Object.values(loadout.equipment).filter((item): item is NonNullable<typeof item> => Boolean(item)),
        ...loadout.inventory,
    ].map((item) => ({
        category: item.category,
        typeId: item.typeId,
    }));
}

test('Hall mirror extraction still resolves all 24 starter champions without a manual slot table', () => {
    const evidence = buildHallMirrorEvidence();
    assert.equal(evidence.length, 24);
    assert.equal(new Set(evidence.map((entry) => entry.slot)).size, 24);
    assert.equal(new Set(evidence.map((entry) => entry.championId)).size, 24);
    assert.deepEqual(
        [...new Set(evidence.map((entry) => entry.championId))].sort((left, right) => left - right),
        [...Object.keys(CHAMPION_STARTER_LOADOUTS).map(Number)].sort((left, right) => left - right),
    );
});

test('starter loadouts preserve the Hall mirror raw item ids for every champion', () => {
    const evidence = buildHallMirrorEvidence();

    for (const entry of evidence) {
        const currentItems = collectCurrentLoadoutItems(entry.championId)
            .map((item) => `${item.category}:${item.typeId}`)
            .sort();
        const sourceItems = entry.items
            .map((item) => `${item.category}:${item.type}`)
            .sort();

        assert.deepEqual(
            currentItems,
            sourceItems,
            `Starter raw item ids diverged for champion ${entry.championId} (${entry.championName})`,
        );
    }
});

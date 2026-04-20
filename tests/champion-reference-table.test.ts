import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

type BootstrapChampion = {
    portraitId: number;
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
};

type HallObject = {
    category: string;
    type?: number;
    name?: string;
    data?: number;
};

type HallTile = {
    objects?: HallObject[];
};

function readJson<T>(relativePath: string): T {
    return JSON.parse(
        fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8'),
    ) as T;
}

function normalizeItemName(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const EXPECTED_REFERENCE: Record<number, {
    stats: Omit<BootstrapChampion, 'portraitId'>;
    items: string[];
}> = {
    0: { stats: { health: 60, stamina: 58, mana: 22, luck: 50, strength: 42, dexterity: 40, wisdom: 42, vitality: 36, antiMagic: 53, antiFire: 40 }, items: ['Robe (Body)', 'Robe (Legs)', 'Sandals', 'Magical Box (Blue)'] },
    1: { stats: { health: 90, stamina: 75, mana: 0, luck: 40, strength: 55, dexterity: 43, wisdom: 30, vitality: 46, antiMagic: 38, antiFire: 48 }, items: ['Bezerker Helm', 'Barbarian Hide', 'Sandals', 'Club'] },
    2: { stats: { health: 53, stamina: 72, mana: 15, luck: 55, strength: 38, dexterity: 35, wisdom: 43, vitality: 45, antiMagic: 42, antiFire: 40 }, items: ['Elven Doublet', 'Tabard', 'Apple'] },
    3: { stats: { health: 80, stamina: 61, mana: 5, luck: 40, strength: 58, dexterity: 48, wisdom: 35, vitality: 35, antiMagic: 43, antiFire: 55 }, items: [] },
    4: { stats: { health: 60, stamina: 60, mana: 10, luck: 58, strength: 40, dexterity: 40, wisdom: 40, vitality: 50, antiMagic: 40, antiFire: 40 }, items: ['Mail Aketon', 'Blue Pants', 'Hosen', 'Torch'] },
    5: { stats: { health: 47, stamina: 67, mana: 17, luck: 57, strength: 37, dexterity: 47, wisdom: 57, vitality: 37, antiMagic: 47, antiFire: 37 }, items: ['Silk Shirt', 'Gunna', 'Sandals', 'Moonstone'] },
    6: { stats: { health: 70, stamina: 85, mana: 10, luck: 40, strength: 45, dexterity: 35, wisdom: 38, vitality: 55, antiMagic: 35, antiFire: 35 }, items: ['Leather Jerkin', 'Leather Pants', 'Suede Boots', 'Arrow', 'Arrow'] },
    7: { stats: { health: 35, stamina: 65, mana: 28, luck: 25, strength: 35, dexterity: 45, wisdom: 55, vitality: 40, antiMagic: 45, antiFire: 40 }, items: ['Tunic', 'Leather Pants', 'Leather Boots', "Rabbit's Foot"] },
    8: { stats: { health: 55, stamina: 55, mana: 19, luck: 40, strength: 42, dexterity: 35, wisdom: 40, vitality: 48, antiMagic: 40, antiFire: 45 }, items: ['Robe (Body)', 'Robe (Legs)', 'Sandals', 'Bread', 'Cheese', 'Apple'] },
    9: { stats: { health: 75, stamina: 70, mana: 7, luck: 35, strength: 46, dexterity: 40, wisdom: 39, vitality: 50, antiMagic: 45, antiFire: 45 }, items: ['Leather Jerkin', 'Leather Pants', 'Leather Boots'] },
    10: { stats: { health: 45, stamina: 47, mana: 20, luck: 40, strength: 38, dexterity: 35, wisdom: 53, vitality: 45, antiMagic: 47, antiFire: 40 }, items: ['Silk Shirt', 'Tabard', 'Sandals', 'Throwing Star', 'Throwing Star', 'Throwing Star'] },
    11: { stats: { health: 50, stamina: 57, mana: 13, luck: 47, strength: 44, dexterity: 55, wisdom: 45, vitality: 40, antiMagic: 35, antiFire: 40 }, items: ['Leather Jerkin', 'Leather Pants', 'Suede Boots', 'Sling'] },
    12: { stats: { health: 65, stamina: 50, mana: 12, luck: 45, strength: 45, dexterity: 45, wisdom: 47, vitality: 35, antiMagic: 50, antiFire: 35 }, items: ['Elven Doublet', 'Elven Huke', 'Elven Boots', 'Bow'] },
    13: { stats: { health: 61, stamina: 77, mana: 7, luck: 47, strength: 47, dexterity: 48, wisdom: 42, vitality: 45, antiMagic: 30, antiFire: 35 }, items: ['Halter', 'Barbarian Hide', 'Hide Shield', 'Dagger', 'Dagger'] },
    14: { stats: { health: 48, stamina: 65, mana: 11, luck: 40, strength: 43, dexterity: 55, wisdom: 40, vitality: 35, antiMagic: 45, antiFire: 50 }, items: ['Ghi', 'Ghi Trousers', 'Samurai Sword'] },
    15: { stats: { health: 39, stamina: 63, mana: 26, luck: 50, strength: 39, dexterity: 45, wisdom: 47, vitality: 33, antiMagic: 48, antiFire: 43 }, items: ['Leather Jerkin', 'Blue Pants', 'Leather Boots', 'Poison Dart', 'Poison Dart'] },
    16: { stats: { health: 75, stamina: 80, mana: 0, luck: 35, strength: 52, dexterity: 43, wisdom: 35, vitality: 50, antiMagic: 35, antiFire: 55 }, items: ['Tunic', 'Leather Pants', 'Suede Boots', 'Axe'] },
    17: { stats: { health: 48, stamina: 60, mana: 3, luck: 50, strength: 40, dexterity: 53, wisdom: 45, vitality: 47, antiMagic: 45, antiFire: 35 }, items: ['Silk Shirt', 'Leather Pants', 'Leather Boots', 'Rope'] },
    18: { stats: { health: 25, stamina: 45, mana: 35, luck: 45, strength: 30, dexterity: 45, wisdom: 50, vitality: 35, antiMagic: 59, antiFire: 40 }, items: ['Kirtle', 'Gunna', 'Sandals', 'Wand'] },
    19: { stats: { health: 65, stamina: 70, mana: 2, luck: 40, strength: 54, dexterity: 45, wisdom: 39, vitality: 49, antiMagic: 40, antiFire: 40 }, items: ['Halter', 'Gunna', 'Sandals', 'Choker', 'Sword'] },
    20: { stats: { health: 55, stamina: 65, mana: 13, luck: 40, strength: 41, dexterity: 36, wisdom: 45, vitality: 45, antiMagic: 55, antiFire: 55 }, items: ['Tunic', 'Blue Pants', 'Sandals', 'Staff'] },
    21: { stats: { health: 60, stamina: 55, mana: 18, luck: 30, strength: 40, dexterity: 35, wisdom: 48, vitality: 34, antiMagic: 50, antiFire: 59 }, items: ['Cloak of Night'] },
    22: { stats: { health: 40, stamina: 50, mana: 30, luck: 60, strength: 33, dexterity: 57, wisdom: 45, vitality: 40, antiMagic: 35, antiFire: 40 }, items: ['Leather Jerkin', 'Empty Flask'] },
    23: { stats: { health: 100, stamina: 65, mana: 6, luck: 35, strength: 50, dexterity: 30, wisdom: 35, vitality: 45, antiMagic: 30, antiFire: 45 }, items: [] },
};

test('bootstrap champion stats match the reference table base values', () => {
    const bootstrap = readJson<{ champions: BootstrapChampion[] }>('src/assets/runtime/dungeon/bootstrap.json');
    const championsById = new Map(bootstrap.champions.map((champion) => [champion.portraitId, champion]));

    for (const [portraitId, expected] of Object.entries(EXPECTED_REFERENCE)) {
        const champion = championsById.get(Number(portraitId));
        assert.ok(champion, `Missing champion ${portraitId} in bootstrap.json`);
        assert.deepEqual(
            {
                health: champion.health,
                stamina: champion.stamina,
                mana: champion.mana,
                luck: champion.luck,
                strength: champion.strength,
                dexterity: champion.dexterity,
                wisdom: champion.wisdom,
                vitality: champion.vitality,
                antiMagic: champion.antiMagic,
                antiFire: champion.antiFire,
            },
            expected.stats,
            `Base stats diverged for champion ${portraitId}`,
        );
    }
});

test('hall starter items match the reference table starter loadouts', () => {
    const hallMap = readJson<{ tiles: HallTile[] }>('src/assets/runtime/dungeon/maps/level-00.json');
    const starters = new Map<number, string[]>();

    for (const tile of hallMap.tiles) {
        const mirror = (tile.objects ?? []).find((object) => object.category === 'Sensor' && object.type === 127);
        if (!mirror || typeof mirror.type !== 'number' || typeof mirror.data !== 'number') continue;

        starters.set(
            mirror.data,
            (tile.objects ?? [])
                .filter((object) => object.category !== 'Sensor')
                .map((object) => normalizeItemName(object.name ?? `${object.category}:${object.type ?? ''}`))
                .sort(),
        );
    }

    for (const [portraitId, expected] of Object.entries(EXPECTED_REFERENCE)) {
        assert.deepEqual(
            starters.get(Number(portraitId)) ?? [],
            expected.items.map(normalizeItemName).sort(),
            `Starter items diverged for champion ${portraitId}`,
        );
    }
});

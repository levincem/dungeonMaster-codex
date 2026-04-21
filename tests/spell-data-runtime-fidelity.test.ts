import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORIGINAL_SPELLS } from '../src/data/originalSpells.js';
import { RUNES, findSpell, SPELLS } from '../src/data/runes.js';
import { mapOriginalSkillNumberToSkillKey } from '../src/data/skillProgression.js';
import { resolvePotionSpellResult } from '../src/engine/systems/spellPotionCreation.js';

type RuntimeRuneSymbol = {
    id: number;
    symbol: string;
    row: 'power' | 'element1' | 'form' | 'alignment';
    manaFactor?: number;
    uiPos: [number, number];
};

type RuntimeSpellEntry = {
    name: string;
    runeStr: string;
    manaBase: number;
};

type SourceI560Spell = {
    spellIDHex: string;
    runeOrdinals: number[];
    skillRequired: number;
    byte5: number;
    spellType: 1 | 2 | 3;
    missileTypeBits: number;
    recoveryTicks: number;
};

type SourceGameDb = {
    runeSymbols?: RuntimeRuneSymbol[];
    spells?: RuntimeSpellEntry[];
    originalAtari?: {
        i560?: {
            spells?: SourceI560Spell[];
        };
    };
};

const SOURCE_GAME_DB_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\output\\game_db.json`;
const RUNTIME_GAME_DB_PATH = `${process.cwd()}\\src\\assets\\runtime\\db\\game_db.json`;
const FAMILY_BY_ROW = {
    power: 'power',
    element1: 'element',
    form: 'form',
    alignment: 'alignment',
} as const;

function readGameDb(path: string): SourceGameDb {
    return JSON.parse(readFileSync(path, 'utf8')) as SourceGameDb;
}

function canonicalSignatureFromRuneStr(runeStr: string): string {
    return runeStr.toLowerCase().split(/\s+/).join(',');
}

test('runes.ts preserves packaged rune order, ids and mana factors', () => {
    const runtimeGameDb = readGameDb(RUNTIME_GAME_DB_PATH);
    const runtimeRunes = runtimeGameDb.runeSymbols ?? [];

    assert.equal(RUNES.length, runtimeRunes.length, 'runtime rune count drifted from packaged game_db');
    assert.deepEqual(
        RUNES.map((rune) => ({
            id: rune.id,
            name: rune.name.toUpperCase(),
            family: rune.family,
            manaFactor: rune.manaFactor,
        })),
        runtimeRunes.map((rune) => ({
            id: rune.symbol.toLowerCase(),
            name: rune.symbol,
            family: FAMILY_BY_ROW[rune.row],
            manaFactor: rune.manaFactor,
        })),
    );
});

test('originalSpells.ts stays aligned with the 25 original i560 spell descriptors and packaged spell names', () => {
    const sourceGameDb = readGameDb(SOURCE_GAME_DB_PATH);
    const runtimeGameDb = readGameDb(RUNTIME_GAME_DB_PATH);
    const sourceSpells = sourceGameDb.originalAtari?.i560?.spells ?? [];
    const runtimeSpells = runtimeGameDb.spells ?? [];
    const runtimeRunes = runtimeGameDb.runeSymbols ?? [];
    const runtimeSpellBySignature = new Map(
        runtimeSpells.map((spell) => [canonicalSignatureFromRuneStr(spell.runeStr), spell]),
    );

    assert.equal(ORIGINAL_SPELLS.length, 25, 'original spell descriptor count drifted from canonical 25');
    assert.equal(sourceSpells.length, 25, 'source i560 spell count drifted from canonical 25');
    assert.equal(runtimeSpells.length, 25, 'runtime packaged spell count drifted from canonical 25');

    ORIGINAL_SPELLS.forEach((spell, index) => {
        const source = sourceSpells[index];
        assert.ok(source, `missing source spell at index ${index}`);

        const expectedSignature = source.runeOrdinals
            .map((ordinal) => runtimeRunes[ordinal]?.symbol.toLowerCase())
            .join(',');
        const runtime = runtimeSpellBySignature.get(expectedSignature);

        assert.equal(spell.signature, expectedSignature, `spell ${index} signature drifted from source rune ordinals`);
        assert.ok(runtime, `missing packaged runtime spell for ${expectedSignature}`);
        assert.equal(spell.name, runtime.name, `spell ${index} display name drifted from packaged runtime data`);
        assert.equal(spell.spellIdHex, source.spellIDHex, `spell ${index} hex id drifted from i560`);
        assert.equal(spell.baseDifficulty, source.skillRequired, `spell ${index} difficulty drifted from i560`);
        assert.equal(spell.skillIndex, source.byte5, `spell ${index} skill index drifted from i560`);
        assert.equal(spell.spellType, source.spellType, `spell ${index} spell type drifted from i560`);
        assert.equal(spell.subtype, source.missileTypeBits, `spell ${index} subtype drifted from i560`);
        assert.equal(spell.disableTimeTicks, source.recoveryTicks, `spell ${index} recovery ticks drifted from i560`);
    });
});

test('runtime spell catalogue exposes only canonical power-prefixed spells with source-backed metadata', () => {
    const runtimeGameDb = readGameDb(RUNTIME_GAME_DB_PATH);
    const runtimeSpells = runtimeGameDb.spells ?? [];
    const canonicalSignatures = new Set(runtimeSpells.map((spell) => canonicalSignatureFromRuneStr(spell.runeStr)));
    const runtimeSignatures = new Set(SPELLS.map((spell) => spell.runes.slice(1).join(',')));

    assert.deepEqual(runtimeSignatures, canonicalSignatures, 'runtime spell signatures drifted from packaged canonical spell list');

    for (const packagedSpell of runtimeSpells) {
        const signature = canonicalSignatureFromRuneStr(packagedSpell.runeStr);
        const source = ORIGINAL_SPELLS.find((spell) => spell.signature === signature);
        assert.ok(source, `missing original descriptor for ${signature}`);

        for (const powerRune of RUNES.filter((rune) => rune.family === 'power')) {
            const spell = findSpell([powerRune.id, ...signature.split(',')]);
            assert.ok(spell, `missing runtime spell for ${powerRune.id},${signature}`);

            assert.equal(spell.name, source.name, `runtime spell name drifted for ${powerRune.id},${signature}`);
            assert.equal(spell.manaBase, source.baseDifficulty, `runtime mana base drifted for ${powerRune.id},${signature}`);
            assert.equal(
                spell.manaCost,
                Math.floor(source.baseDifficulty * (powerRune.manaFactor ?? 8) / 8),
                `runtime mana cost drifted for ${powerRune.id},${signature}`,
            );
            assert.equal(spell.sourceSkillIndex, source.skillIndex, `runtime source skill drifted for ${powerRune.id},${signature}`);
            assert.equal(spell.sourceBaseDifficulty, source.baseDifficulty, `runtime source difficulty drifted for ${powerRune.id},${signature}`);
            assert.equal(spell.sourceDisableTimeTicks, source.disableTimeTicks, `runtime cooldown drifted for ${powerRune.id},${signature}`);
            assert.equal(
                spell.progressionSkill,
                mapOriginalSkillNumberToSkillKey(source.skillIndex),
                `runtime progression skill drifted for ${powerRune.id},${signature}`,
            );
        }
    }
});

test('spell runtime rejects the old speculative healing signature and accepts canonical Ven Potion', () => {
    assert.equal(findSpell(['lo', 'vi', 'bro', 'ra']), null);

    const venPotion = findSpell(['lo', 'zo', 'ven']);
    assert.ok(venPotion, 'Lo Zo Ven should be a canonical runtime spell');

    const result = resolvePotionSpellResult(
        venPotion,
        {
            rightHand: { id: 'flask', category: 'Potion', typeId: 20, mapIndex: 0, x: 0, y: 0, tilePos: 'North' },
        },
        {
            randomInt: () => 0,
            resolvePotionName: () => 'Ven Potion',
        },
    );

    assert.deepEqual(result, {
        kind: 'success',
        slot: 'rightHand',
        potion: {
            id: 'flask',
            category: 'Potion',
            typeId: 3,
            mapIndex: 0,
            x: 0,
            y: 0,
            tilePos: 'North',
            rawName: 'Ven Potion',
            potionPower: 40,
        },
    });
});

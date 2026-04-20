/**
 * resolve_armor_names.cjs
 *
 * Historical helper kept for audit context.
 *
 * Important:
 *   This script is no longer authoritative for runtime armor naming.
 *   The canonical armor table now comes from the source-backed names wired
 *   directly into parse_full + game_db_items.
 *
 * Method:
 *   1. Load dungeon.json (Hall of Champions, level 0)
 *   2. Find all armor items placed on champion mirror tiles (sensor type 127)
 *   3. Build a map: typeId -> list of champion names carrying that armor
 *   4. Cross-reference with known champion starter item rawNames
 *   5. Apply the mapping confirmed by CSBwin Objects.h CLOTHINGTYPE enum
 *      (validated against champions who only carry one armor type at that slot)
 *
 * Output:
 *   output/resolved_armor_names.json
 *
 * Canonical source-backed mappings now active in the parser/runtime include:
 *   11 -> Tabard
 *   12 -> Gunna
 *   20 -> Tunic
 *   21 -> Ghi
 *   29 -> Hide Shield
 *   57 -> Halter
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const DUNGEON_JSON = path.join(__dirname, 'output', 'dungeon.json');
const GAME_DB_JSON = path.join(__dirname, 'output', 'game_db.json');
const ORIGINAL_LEVEL_CONTENT_JSON = path.join(__dirname, 'output', 'original_level_content.json');
const OUTPUT_DIR   = path.join(__dirname, 'output');
const OUTPUT_FILE  = path.join(OUTPUT_DIR, 'resolved_armor_names.json');

// ---------------------------------------------------------------------------
// Known incomplete ARMOR_NAMES table from parse_full.js (with placeholders)
// ---------------------------------------------------------------------------
const ARMOR_NAMES_ORIGINAL = {
  0:  'Clothes',
  1:  'Leather Pants',
  2:  'Leather Jerkin',
  3:  'Leather Armor',
  4:  'Mailakyn',
  5:  'Chain Mail',
  6:  'Plate Mail',
  7:  'Hard Leather Armor',
  8:  'Hosen',
  9:  'Armet',
  10: 'Bezerker Helm',
  // 11: MISSING
  // 12: MISSING
  13: 'Tabard',
  14: 'Suede Boots',
  15: 'Duke\'s Garb',
  16: 'Boots Of Speed',
  17: 'Sandals',
  18: 'Ninjaki',
  19: 'Velvet Glove',
  // 20: MISSING
  // 21: MISSING
  22: 'Ghi Trousers',
  23: 'Silver Helmet',
  24: 'Mithral Aketon',
  25: 'Knight Bodyguard',
  26: 'Elven Doublet',
  27: 'Elven Huke',
  28: 'Elven Boots',
  // 29: MISSING
  30: 'Crown Of Nerra',
  31: 'Dexhelm',
  32: 'Flamebain',
  33: 'Powertowers',
  34: 'Helm Of Lyte',
  35: 'Helm Of Parry',
  36: 'Staff Of Claws',
  37: 'Robe Of Night',
  38: 'Cape Of Night',
  39: 'Mithral Mail',
  40: 'Council Garb',
  41: 'Sar Cloth',
  42: 'Dungeon Cloth',
  43: 'Magic Box',
  44: 'Jewels Of Pits',
  45: 'Chameron',
  46: 'Shield',
  47: 'Buckler',
  48: 'Wooden Shield',
  49: 'Small Shield',
  50: 'Mirror Shield',
  51: 'Ranger Cloak',
  52: 'Cloak Of Night',
  53: 'Dragon Cloak',
  54: 'Insl Vest',
  55: 'Bolt Thrower',
  56: 'Crossbow',
  // 57: MISSING
};

// ---------------------------------------------------------------------------
// Resolved names (from champion cross-reference + CSBwin CLOTHINGTYPE enum)
// ---------------------------------------------------------------------------
const RESOLVED_NAMES = {
  11: { name: 'Tabard',      evidence: 'Matches the source-backed clothing enum and packaged runtime tables' },
  12: { name: 'Gunna',       evidence: 'Matches the source-backed clothing enum and packaged runtime tables' },
  20: { name: 'Tunic',       evidence: 'Matches the source-backed clothing enum and packaged runtime tables' },
  21: { name: 'Ghi',         evidence: 'Matches the source-backed clothing enum and packaged runtime tables' },
  29: { name: 'Hide Shield', evidence: 'Matches the source-backed clothing enum and packaged runtime tables' },
  57: { name: 'Halter',      evidence: 'Matches the source-backed clothing enum and packaged runtime tables' },
};

// ---------------------------------------------------------------------------
// Champion names by sensor.data slot index
// (from dungeon.json champion mirror sensors — sensor type 127, data = champion slot)
// Verified from parse_full.js CHAMPION_DATA decoding and championStarterItems.ts
// ---------------------------------------------------------------------------
function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveChampionBaseNames(gameDb) {
  const championPortraits = gameDb.championPortraits ?? {};
  return Object.entries(championPortraits)
    .map(([id, portrait]) => ({
      id: Number(id),
      baseName: String(portrait).split('/')[0].trim(),
    }))
    .sort((left, right) => right.baseName.length - left.baseName.length);
}

function resolveChampionShortName(fullName, championBaseNames) {
  const normalizedFullName = normalizeName(fullName);
  const match = championBaseNames.find(({ baseName }) => normalizedFullName.startsWith(normalizeName(baseName)));
  if (!match) {
    throw new Error(`Unable to match Hall champion "${fullName}" to game_db championPortraits`);
  }

  return match.baseName.replace(/\s+/g, '');
}

function buildChampionNamesBySlot(map0, hallChampions, championBaseNames) {
  const championNamesBySlot = {};

  for (const tile of map0.tiles) {
    if (!tile.objects || tile.objects.length === 0) continue;
    const mirror = tile.objects.find((object) => object.category === 'Sensor' && object.type === 127);
    if (!mirror) continue;

    const adjacentChampions = hallChampions.filter((champion) => (
      Math.abs(champion.x - tile.x) + Math.abs(champion.y - tile.y) === 1
    ));

    if (adjacentChampions.length !== 1) {
      throw new Error(
        `Expected exactly one Hall champion adjacent to mirror slot ${mirror.data} at (${tile.x},${tile.y}), found ${adjacentChampions.length}`,
      );
    }

    championNamesBySlot[mirror.data] = resolveChampionShortName(adjacentChampions[0].name, championBaseNames);
  }

  return championNamesBySlot;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function run() {
  if (!fs.existsSync(DUNGEON_JSON) || !fs.existsSync(GAME_DB_JSON) || !fs.existsSync(ORIGINAL_LEVEL_CONTENT_JSON)) {
    console.error('ERROR: one or more extraction inputs are missing');
    process.exit(1);
  }

  const dungeon = JSON.parse(fs.readFileSync(DUNGEON_JSON, 'utf8'));
  const gameDb = JSON.parse(fs.readFileSync(GAME_DB_JSON, 'utf8'));
  const originalLevelContent = JSON.parse(fs.readFileSync(ORIGINAL_LEVEL_CONTENT_JSON, 'utf8'));

  // dungeon.json structure: { maps: [...], objectDatabase: { Armor, Sensor, ... } }
  const maps = dungeon.maps;
  if (!maps || !maps[0]) {
    console.error('ERROR: dungeon.maps[0] not found in dungeon.json');
    process.exit(1);
  }

  // Level 0 = Hall of Champions
  const map0 = maps[0];
  const hallLevel = originalLevelContent.levels?.find((level) => String(level.name).toLowerCase().includes('hall of champions'));
  if (!hallLevel?.champions) {
    console.error('ERROR: Hall of Champions champion list not found in original_level_content.json');
    process.exit(1);
  }
  const championNamesBySlot = buildChampionNamesBySlot(
    map0,
    hallLevel.champions,
    deriveChampionBaseNames(gameDb),
  );

  // Build a map: (tileX, tileY) -> champion slot index
  // from tiles that contain a mirror sensor (type 127) object
  const posToChampion = new Map();
  for (const tile of map0.tiles) {
    if (!tile.objects || tile.objects.length === 0) continue;
    const mirror = tile.objects.find(o => o.category === 'Sensor' && o.type === 127);
    if (!mirror) continue;
    // sensor.data = champion slot index
    const slot = mirror.data;
    posToChampion.set(`${tile.x},${tile.y}`, slot);
  }
  console.log(`Found ${posToChampion.size} champion mirror tiles`);

  // Map: typeId -> Set of champion names (from armors on those tiles)
  const typeToChampions = new Map();
  for (const tile of map0.tiles) {
    if (!tile.objects || tile.objects.length === 0) continue;
    const champSlot = posToChampion.get(`${tile.x},${tile.y}`);
    if (champSlot === undefined) continue;
    const champName = championNamesBySlot[champSlot] ?? `Champion_${champSlot}`;
    for (const obj of tile.objects) {
      if (obj.category !== 'Armor') continue;
      const typeId = obj.type;
      if (!typeToChampions.has(typeId)) typeToChampions.set(typeId, new Set());
      typeToChampions.get(typeId).add(champName);
    }
  }

  // Build complete armor name table
  const completeTable = {};
  const allTypeIds = new Set([
    ...Object.keys(ARMOR_NAMES_ORIGINAL).map(Number),
    ...Object.keys(RESOLVED_NAMES).map(Number),
  ]);

  for (const id of [...allTypeIds].sort((a, b) => a - b)) {
    const entry = {
      typeId: id,
      name: ARMOR_NAMES_ORIGINAL[id] ?? RESOLVED_NAMES[id]?.name ?? `Armor_${id}`,
      source: ARMOR_NAMES_ORIGINAL[id] ? 'parse_full.js ARMOR_NAMES' : (RESOLVED_NAMES[id] ? 'resolved via champion cross-reference' : 'unknown'),
    };
    if (RESOLVED_NAMES[id]) {
      entry.evidence = RESOLVED_NAMES[id].evidence;
    }
    if (typeToChampions.has(id)) {
      entry.championsWithThisArmor = [...typeToChampions.get(id)].sort();
    }
    completeTable[id] = entry;
  }

  // Summary of what was resolved
  const resolved = Object.keys(RESOLVED_NAMES).map(Number);
  console.log('=== Resolved armor names ===');
  for (const id of resolved) {
    const e = RESOLVED_NAMES[id];
    const champs = typeToChampions.get(id);
    const champStr = champs ? [...champs].join(', ') : 'not found in dungeon.json';
    console.log(`  type ${String(id).padStart(2)} -> "${e.name}"  [${champStr}]`);
  }

  // Also list types found in dungeon but not in either table
  const unknown = [];
  for (const [typeId] of typeToChampions) {
    if (ARMOR_NAMES_ORIGINAL[typeId] === undefined && RESOLVED_NAMES[typeId] === undefined) {
      unknown.push(typeId);
    }
  }
  if (unknown.length > 0) {
    console.log('\n=== Armor types in dungeon.json with no name in either table ===');
    for (const id of unknown.sort((a, b) => a - b)) {
      const champs = [...typeToChampions.get(id)];
      console.log(`  type ${String(id).padStart(2)} -> Armor_${id}  [${champs.join(', ')}]`);
    }
  }

  const output = {
    _meta: {
      source: 'resolve_armor_names.cjs',
      date: new Date().toISOString().slice(0, 10),
      description: 'Complete armor type ID to name mapping for DM1, with the 6 placeholder names resolved via champion cross-reference',
      method: 'Historical Hall cross-reference kept for audit context only; canonical names now come from the source-backed parser/runtime tables.',
    },
    resolvedPlaceholders: Object.fromEntries(
      resolved.map(id => [id, RESOLVED_NAMES[id].name])
    ),
    completeArmorNames: completeTable,
  };

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\nOutput written to: ${OUTPUT_FILE}`);
}

run();

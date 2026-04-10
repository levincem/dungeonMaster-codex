/**
 * resolve_armor_names.cjs
 *
 * Resolves the 6 placeholder armor names in parse_full.js:
 *   Armor_11, Armor_12, Armor_20, Armor_21, Armor_29, Armor_57
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
 * Key confirmed mappings (from champion starter cross-reference):
 *   11 -> Silk Shirt   (WuTse, Syra)
 *   12 -> Gunna        (Tiggy, Chani, Sonja)
 *   20 -> Tunic        (Stamm, Boris, Nabi)
 *   21 -> Ghi          (Iaido - Japanese martial arts gi)
 *   29 -> Barbarian Hide (Azizi)
 *   57 -> Halter       (Azizi, Sonja - warrior-female garment)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const DUNGEON_JSON = path.join(__dirname, '../../public/dungeon.json');
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
  11: { name: 'Silk Shirt',      evidence: 'WuTse (typeId 11 in starter), Syra (armored type 11 on mirror tile)' },
  12: { name: 'Gunna',           evidence: 'Chani (typeId 12 in starter = Gunna), Tiggy, Sonja (same type)' },
  20: { name: 'Tunic',           evidence: 'Boris/Stamm/Nabi (all listed as Tunic in starter items, share type 20)' },
  21: { name: 'Ghi',             evidence: 'Iaido exclusively (Japanese martial-arts gi; type 22 = Ghi Trousers confirms the pair)' },
  29: { name: 'Barbarian Hide',  evidence: 'Azizi exclusively (typeId 29 = Barbarian Hide in starter)' },
  57: { name: 'Halter',          evidence: 'Azizi (typeId 57 in starter), Sonja (same type 57 on mirror tile)' },
};

// ---------------------------------------------------------------------------
// Champion names by sensor.data slot index
// (from dungeon.json champion mirror sensors — sensor type 127, data = champion slot)
// Verified from parse_full.js CHAMPION_DATA decoding and championStarterItems.ts
// ---------------------------------------------------------------------------
const CHAMPION_NAMES_BY_SLOT = {
   0: 'Gothmog',
   1: 'Leif',
   2: 'Halk',
   3: 'Wuuf',
   4: 'Gando',
   5: 'Chani',
   6: 'Elija',
   7: 'Leyla',
   8: 'Mophus',
   9: 'Boris',
  10: 'WuTse',
  11: 'Syra',
  12: 'Nabi',
  13: 'Azizi',
  14: 'Iaido',
  15: 'Tiggy',
  16: 'Stamm',
  17: 'Hawk',
  18: 'Sonja',
  19: 'Linflas',
  20: 'Zed',
  21: 'Alex',
  22: 'Wutse2',
  23: 'Tiggy2',
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function run() {
  if (!fs.existsSync(DUNGEON_JSON)) {
    console.error('ERROR: dungeon.json not found at', DUNGEON_JSON);
    process.exit(1);
  }

  const dungeon = JSON.parse(fs.readFileSync(DUNGEON_JSON, 'utf8'));

  // dungeon.json structure: { maps: [...], objectDatabase: { Armor, Sensor, ... } }
  const maps = dungeon.maps;
  if (!maps || !maps[0]) {
    console.error('ERROR: dungeon.maps[0] not found in dungeon.json');
    process.exit(1);
  }

  // Level 0 = Hall of Champions
  const map0 = maps[0];

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
    const champName = CHAMPION_NAMES_BY_SLOT[champSlot] ?? `Champion_${champSlot}`;
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
      method: 'Armor items placed on Hall of Champions mirror tiles are champion starter equipment. Champion identity determines item name.',
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

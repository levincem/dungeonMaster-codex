/**
 * Dungeon Master (FTL 1987) – Full DUNGEON.DAT parser
 * Outputs dungeon.json + game_db.json for extraction audits and runtime use
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  ROOT_DIR,
  RUNTIME_ROOT_DIR,
  RUNTIME_DUNGEON_DIR,
  RUNTIME_DUNGEON_MAPS_DIR,
  RUNTIME_DB_DIR,
  RUNTIME_REFERENCE_DIR,
  RUNTIME_SUPPORT_DIR,
  RUNTIME_WALL_OVERLAY_MAPS_DIR,
  RUNTIME_DUNGEON_BOOTSTRAP_FILE,
  RUNTIME_GAME_DB_FILE,
  RUNTIME_GAME_DB_ITEMS_FILE,
  RUNTIME_GAME_DB_WEAPON_ATTACKS_FILE,
  RUNTIME_GAME_DB_CREATURES_FILE,
  RUNTIME_MANIFEST_FILE,
  RUNTIME_WALL_OVERLAY_FILE,
  LEGACY_RUNTIME_DATA_DIR,
  LEGACY_RUNTIME_SUPPORT_DIR,
  buildRuntimeDungeonMapFile,
  buildRuntimeDungeonMapFileName,
  buildRuntimeWallOverlayMapFile,
  buildRuntimeWallOverlayMapFileName,
} = require('./runtime_paths.cjs');

const OUTPUT_DIR = path.join(__dirname, 'output');
const REFERENCE_EXPORTS_DIR = path.join(__dirname, 'reference_exports');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const dungeonFilePath = path.join(__dirname, 'EUDATA', 'DUNGEON.DAT');
const graphicsDbPath = path.join(ROOT_DIR, 'public', 'graphics_db.json');

const REQUIRED_RUNTIME_REFERENCE_FILES = [
  'original_creatures_runtime.json',
  'original_doors_runtime.json',
];

const GENERATED_RUNTIME_REFERENCE_FILES = [
  'original_teleporters_runtime.json',
];

const EXTRACTION_REFERENCE_FILES = [
  'original_level_content.json',
];

const SUPPORT_ASSET_FILES = [
  'original_wall_overlay_positions.json',
];

function listRuntimeReferenceFiles() {
  const missing = REQUIRED_RUNTIME_REFERENCE_FILES.filter((fileName) =>
    !fs.existsSync(path.join(PUBLIC_DIR, fileName)),
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required runtime reference exports in public/: ${missing.join(', ')}`,
    );
  }
  return [
    ...REQUIRED_RUNTIME_REFERENCE_FILES,
    ...GENERATED_RUNTIME_REFERENCE_FILES,
  ];
}

function listExtractionReferenceFiles() {
  const missing = EXTRACTION_REFERENCE_FILES.filter((fileName) =>
    !fs.existsSync(path.join(REFERENCE_EXPORTS_DIR, fileName)) &&
    !fs.existsSync(path.join(PUBLIC_DIR, fileName)),
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required extraction reference exports: ${missing.join(', ')}`,
    );
  }
  return [...EXTRACTION_REFERENCE_FILES];
}

function listSupportAssetFiles() {
  const missing = SUPPORT_ASSET_FILES.filter((fileName) =>
    !fs.existsSync(path.join(PUBLIC_DIR, fileName)),
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required runtime support assets in public/: ${missing.join(', ')}`,
    );
  }
  return [...SUPPORT_ASSET_FILES];
}

function cleanupRuntimeDirectoryEntries(targetDir, keepNames) {
  const resolvedTarget = path.resolve(targetDir);
  const resolvedRoot = path.resolve(RUNTIME_ROOT_DIR);

  if (
    resolvedTarget !== resolvedRoot &&
    !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    throw new Error(`Refusing to clean non-runtime directory: ${resolvedTarget}`);
  }

  if (!fs.existsSync(targetDir)) return;

  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    if (keepNames.has(entry.name)) continue;

    const targetPath = path.join(targetDir, entry.name);
    try {
      if (entry.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.rmSync(targetPath, { force: true });
      }
    } catch (error) {
      console.warn(`! Could not remove stale runtime package entry: ${targetPath}`);
    }
  }
}

function cleanupLegacyRuntimePaths(runtimeReferenceFiles, supportAssetFiles) {
  const legacyRuntimeFiles = [
    'dungeon.json',
    'game_db.json',
    'runtime_data_manifest.json',
    ...runtimeReferenceFiles,
  ];

  for (const fileName of legacyRuntimeFiles) {
    const targetPath = path.join(LEGACY_RUNTIME_DATA_DIR, fileName);
    if (!fs.existsSync(targetPath)) continue;
    try {
      fs.rmSync(targetPath, { force: true });
    } catch (error) {
      console.warn(`! Could not remove stale legacy runtime data file: ${targetPath}`);
    }
  }

  for (const fileName of supportAssetFiles) {
    const targetPath = path.join(LEGACY_RUNTIME_SUPPORT_DIR, fileName);
    if (!fs.existsSync(targetPath)) continue;
    try {
      fs.rmSync(targetPath, { force: true });
    } catch (error) {
      console.warn(`! Could not remove stale legacy runtime support asset: ${targetPath}`);
    }
  }
}

function buildRuntimeWallOverlaySnapshot(fullOverlayData) {
  return {
    fixedFaces: Array.isArray(fullOverlayData?.fixedFaces) ? fullOverlayData.fixedFaces : [],
  };
}

function buildRuntimeWallOverlayMapSnapshots(fullOverlayData) {
  const fixedFaces = Array.isArray(fullOverlayData?.fixedFaces) ? fullOverlayData.fixedFaces : [];
  const fixedFacesByMap = new Map();

  for (const face of fixedFaces) {
    const list = fixedFacesByMap.get(face.mapIndex) ?? [];
    list.push(face);
    fixedFacesByMap.set(face.mapIndex, list);
  }

  return Array.from(fixedFacesByMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([mapIndex, mapFixedFaces]) => ({
      mapIndex,
      file: `wall_overlays/${buildRuntimeWallOverlayMapFileName(mapIndex)}`,
      fixedFaces: mapFixedFaces,
    }));
}

const COMPRESSED_DUNGEON_SIGNATURE = 0x8104;
const UNCOMPRESSED_MAP_DATA_OFFSET = 0x5250;

function decodeCompressedDungeon(buffer) {
  if (buffer.length < 28) {
    throw new Error('Compressed dungeon header is too small.');
  }

  const signature = buffer.readUInt16LE(0);
  if (signature !== COMPRESSED_DUNGEON_SIGNATURE) {
    throw new Error(`Unexpected compressed dungeon signature ${signature.toString(16)}.`);
  }

  const uncompressedSize = buffer.readUInt32LE(2);
  const compressedDungeonId = buffer.readUInt16LE(6);
  const mostCommon = Array.from(buffer.subarray(8, 12));
  const lessCommon = Array.from(buffer.subarray(12, 28));

  const out = Buffer.alloc(uncompressedSize);
  let outPos = 0;
  let srcPos = 28;
  let bitMask = 0;
  let currentByte = 0;

  function readBit() {
    if (bitMask === 0) {
      if (srcPos >= buffer.length) {
        throw new Error('Unexpected end of compressed dungeon bitstream.');
      }
      currentByte = buffer[srcPos++];
      bitMask = 0x80;
    }
    const bit = (currentByte & bitMask) ? 1 : 0;
    bitMask >>= 1;
    return bit;
  }

  function readBits(count) {
    let value = 0;
    for (let i = 0; i < count; i++) {
      value = (value << 1) | readBit();
    }
    return value;
  }

  while (outPos < uncompressedSize) {
    const first = readBit();
    let byteValue;
    if (first === 0) {
      byteValue = mostCommon[readBits(2)];
    } else {
      const second = readBit();
      if (second === 0) {
        byteValue = lessCommon[readBits(4)];
      } else {
        byteValue = readBits(8);
      }
    }
    out[outPos++] = byteValue;
  }

  return {
    buffer: out,
    compression: {
      compressed: true,
      signature: COMPRESSED_DUNGEON_SIGNATURE,
      uncompressedSize,
      dungeonId: compressedDungeonId,
      mostCommonBytes: mostCommon,
      lessCommonBytes: lessCommon,
      compressedSize: buffer.length,
    },
  };
}

function loadDungeonData(filePath) {
  const rawBuffer = fs.readFileSync(filePath);
  const signature = rawBuffer.length >= 2 ? rawBuffer.readUInt16LE(0) : 0;

  if (signature === COMPRESSED_DUNGEON_SIGNATURE) {
    const decoded = decodeCompressedDungeon(rawBuffer);
    return {
      rawBuffer,
      buffer: decoded.buffer,
      compression: decoded.compression,
      format: 'PC DOS little-endian (compressed source)',
    };
  }

  return {
    rawBuffer,
    buffer: rawBuffer,
    compression: {
      compressed: false,
      compressedSize: rawBuffer.length,
      uncompressedSize: rawBuffer.length,
    },
    format: 'PC DOS little-endian',
  };
}

const loadedDungeon = loadDungeonData(dungeonFilePath);
const data = loadedDungeon.buffer;
const rawFileName = path.basename(dungeonFilePath);

function loadJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

const atariI559Stats = loadJsonIfExists(path.join(OUTPUT_DIR, 'atari_i559_stats.json'));
const atariI559Decoded = loadJsonIfExists(path.join(OUTPUT_DIR, 'atari_i559_decoded.json'));
const atariI560Stats = loadJsonIfExists(path.join(OUTPUT_DIR, 'atari_i560_stats.json'));
const atariI561Stats = loadJsonIfExists(path.join(OUTPUT_DIR, 'atari_i561_stats.json'));
const atariI562Stats = loadJsonIfExists(path.join(OUTPUT_DIR, 'atari_i562_stats.json'));
const weaponAttackReference = loadJsonIfExists(path.join(OUTPUT_DIR, 'weapon_attack_reference.json'));

function normalizeWeaponReferenceProvenance(value) {
  switch (value) {
    case 'missing_in_current_game_db':
      return 'reference_extract_only';
    case 'derived_game_db_matched_by_name':
      return 'reference_extract_matched_by_name';
    default:
      return value ?? null;
  }
}

function loadObjectTypeNames() {
  try {
    const graphicsDb = JSON.parse(fs.readFileSync(graphicsDbPath, 'utf8'));
    return Array.isArray(graphicsDb?.itemNames?.en) ? graphicsDb.itemNames.en : [];
  } catch {
    return [];
  }
}

const OBJECT_TYPE_NAMES = loadObjectTypeNames();
const OBJECT_TYPE_DISPLAY_FIXUPS = new Map([
  ['KEY OF B', 'Key of B'],
  ['TOURQUOISE KEY', 'Tourquoise Key'],
  ['MIRROR OF DAWN', 'Mirror Of Dawn'],
  ['BLUE GEM', 'Blue Gem'],
  ['GREEN GEM', 'Green Gem'],
  ['ORANGE GEM', 'Orange Gem'],
  ['COPPER COIN', 'Copper Coin'],
  ['SILVER COIN', 'Silver Coin'],
  ['GOLD COIN', 'Gold Coin'],
  ['IRON KEY', 'Iron Key'],
  ['GOLD KEY', 'Gold Key'],
  ['TOPAZ KEY', 'Topaz Key'],
  ['EMERALD KEY', 'Emerald Key'],
  ['RUBY KEY', 'Ruby Key'],
  ['RA KEY', 'Ra Key'],
  ['MASTER KEY', 'Master Key'],
  ['SKELETON KEY', 'Skeleton Key'],
  ['CROSS KEY', 'Cross Key'],
  ['WINGED KEY', 'Winged Key'],
  ['SQUARE KEY', 'Square Key'],
  ['SOLID KEY', 'Solid Key'],
  ['CORBAMITE', 'Corbamite'],
]);

function resolveObjectTypeName(objectType) {
  if (typeof objectType !== 'number' || objectType < 0) return null;
  const rawName = OBJECT_TYPE_NAMES[objectType];
  if (!rawName) return null;
  return OBJECT_TYPE_DISPLAY_FIXUPS.get(rawName) ?? rawName;
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const TILE_TYPES  = ['Wall','Floor','Pit','Stairs','Door','Teleporter','TrickWall','Empty'];
const DIRS        = ['North','East','South','West'];
const OBJ_POS     = ['North','East','South','West']; // position on tile
const OBJ_CAT     = ['Door','Teleporter','Text','Sensor','Creature',
                     'Weapon','Armor','Scroll','Potion','Container','Misc'];
const SCOPE_NAMES = ['Items','Creatures','Items+Party','Everything'];
const ACTION_NAMES= ['Set','Clear','Toggle','Hold'];

const MAP_NAMES = [
  'Hall of Champions','Level 1','Level 2','Level 3','Level 4','Level 5','Level 6',
  'Level 7','Level 8','Level 9','Level 10','Level 11','Level 12',"Lord Chaos's Lair",
];

// ─── HEADER ──────────────────────────────────────────────────────────────────

const dungeonId    = data.readUInt16LE(0x00);
const mapDataSize  = data.readUInt16LE(0x02);
const numMaps      = data.readUInt8(0x04);
const textWords    = data.readUInt16LE(0x06);
const startPosWord = data.readUInt16LE(0x08);
const objListWords = data.readUInt16LE(0x0A);

const NUM_DOORS      = data.readUInt16LE(0x0C);
const NUM_TELE       = data.readUInt16LE(0x0E);
const NUM_TEXTS      = data.readUInt16LE(0x10);
const NUM_SENSORS    = data.readUInt16LE(0x12);
const NUM_CREATURES  = data.readUInt16LE(0x14);
const NUM_WEAPONS    = data.readUInt16LE(0x16);
const NUM_ARMOR      = data.readUInt16LE(0x18);
const NUM_SCROLLS    = data.readUInt16LE(0x1A);
const NUM_POTIONS    = data.readUInt16LE(0x1C);
const NUM_CONTAINERS = data.readUInt16LE(0x1E);
const NUM_MISC       = data.readUInt16LE(0x20);

// ─── SECTION OFFSETS ─────────────────────────────────────────────────────────

const OFF_MAP_DEFS   = 0x002C;
const OFF_COL_IDX    = 0x010C;
const OFF_OBJ_LIST   = 0x043E;
const OFF_TEXT_DATA  = 0x115C;
const OFF_DOORS      = 0x1F06;
const OFF_TELE       = 0x21AE;
const OFF_TEXTS      = 0x25E0;
const OFF_SENSORS    = 0x27D4;
const OFF_CREATURES  = 0x3D34;
const OFF_WEAPONS    = 0x4894;
const OFF_ARMOR      = 0x4A40;
const OFF_SCROLLS    = 0x4C24;
const OFF_POTIONS    = 0x4CB0;
const OFF_CONTAINERS = 0x4D90;
const OFF_MISC       = 0x4DF0;
const trailingBytesAfterMapData = data.length - UNCOMPRESSED_MAP_DATA_OFFSET - mapDataSize;
const HAS_CHECKSUM = trailingBytesAfterMapData === 2;
const CHECKSUM_WORD = HAS_CHECKSUM ? data.readUInt16LE(data.length - 2) : null;
let COMPUTED_CHECKSUM = null;
if (HAS_CHECKSUM) {
  COMPUTED_CHECKSUM = 0;
  for (let i = 0; i < data.length - 2; i++) {
    COMPUTED_CHECKSUM = (COMPUTED_CHECKSUM + data[i]) & 0xFFFF;
  }
}
const CHECKSUM_VALID = HAS_CHECKSUM ? COMPUTED_CHECKSUM === CHECKSUM_WORD : null;
const OFF_MAP_DATA   = data.length - mapDataSize - (HAS_CHECKSUM ? 2 : 0);
const OFF_PROJECTILES = OFF_MISC + NUM_MISC * 4;
const OFF_CLOUDS = OFF_PROJECTILES;
const PROJECTILE_SECTION_BYTES = Math.max(0, OFF_MAP_DATA - OFF_PROJECTILES);
const CLOUD_SECTION_BYTES = 0;

if (OFF_MAP_DATA !== UNCOMPRESSED_MAP_DATA_OFFSET) {
  throw new Error(
    `Unexpected map data offset ${OFF_MAP_DATA}; expected ${UNCOMPRESSED_MAP_DATA_OFFSET}. ` +
    `The dungeon layout likely differs from the supported DM PC layout.`
  );
}

// ─── TEXT DECODER ─────────────────────────────────────────────────────────────

// Escape table for code 30 in non-wall texts
const ESC2_OTHER = [
  '?','!','THE ','YOU ',' ',' ',' ',"'",' ',' ',
  '','','','','','','','','','','','','','','','','','','','','','',
];

const SCROLL_TEXT_FIXUPS = {
  'SE PIT\nLEAVE A\nVALUABLE\nON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
  'PIT\nLEAVE A\nVALUABLE\nON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
  'LEAVE A\nVALUABLE\nON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
  'LE\nON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
  'UABLE\nON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
  'ON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
  FLOOR: 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
  'S FOUNTAIN\nACCEPTS ONE\nWISH.': 'THIS FOUNTAIN\nACCEPTS ONE\nWISH.',
  'OUNTAIN\nACCEPTS ONE\nWISH.': 'THIS FOUNTAIN\nACCEPTS ONE\nWISH.',
  'N\nACCEPTS ONE\nWISH.': 'THIS FOUNTAIN\nACCEPTS ONE\nWISH.',
  'E\nWISH.': 'THIS FOUNTAIN\nACCEPTS ONE\nWISH.',
  'L\nFOR A MAGIC\nTORCH': 'INVOKE FUL\nFOR A MAGIC\nTORCH',
  'OR A MAGIC\nTORCH': 'INVOKE FUL\nFOR A MAGIC\nTORCH',
  'AGIC\nTORCH': 'INVOKE FUL\nFOR A MAGIC\nTORCH',
  'C\nTORCH': 'INVOKE FUL\nFOR A MAGIC\nTORCH',
  ORCH: 'INVOKE FUL\nFOR A MAGIC\nTORCH',
  RTCUT: 'SHORTCUT',
  ACK: 'TURN BACK',
  'ADVENTURERS.': 'COME BACK\nBRAVE\nADVENTURERS.',
  'BRAVE\nADVENTURERS.': 'COME BACK\nBRAVE\nADVENTURERS.',
  'AVE\nADVENTURERS.': 'COME BACK\nBRAVE\nADVENTURERS.',
};

const SCROLL_INDEX_FIXUPS = {
  0: 'Invoke Ful\nfor a magic torch',
  1: 'Casting Vi into a flask creates a serum that heals wounds',
  2: 'Casting Vi Bro into a flask creates a serum for curing poison',
  3: 'Des Ven will conjure a poison spell',
  4: 'Ya will create a stamina potion',
  5: 'Some doors can be opened with a Zo spell',
  6: 'The spell Oh Ven cast a cloud of poison.',
  7: 'Ya Bro creates a magical shield potion',
  8: 'Fireball Ful Ir. Fire Shield Ful Bro Neta.',
  9: 'Light Oh Ir Ra. Darkness Des Ir Sar.',
  10: 'Four potions for boosting skills Ful Bro Ku Oh Bro Ros Ya Bro Dain Ya Bro Neta',
  11: 'The spell Ya Bro Ros leaves a trail of magic footprints.',
  12: 'Put the gem back...',
  13: 'Lightning bolt Oh Kath Ra',
  14: 'The spell Oh Ew Ra bestows magic vision.',
  15: 'Shield potion Ya Bro. Magic shield Ya Ir.',
  16: 'Mana potion Zo Bro Ra creates a pure mana potion.',
  17: 'Invisibility Oh Ew Sar',
  18: 'Neither Chaos nor Order is truly balanced',
  19: 'Balance is the ultimate good',
  20: 'The Firestaff can restore balance or destroy it.',
  21: 'The power gem is sealed in the mountain by a strange magical force.',
  22: 'I fear for the people of the world should the power gem and the Firestaff get in the wrong hands',
  23: 'Drink these to gain magical defense',
  24: 'I have given the Firestaff much power. Power to do and undo. Power to break and mend.',
  25: 'The Firestaff can contain a being of pure alignment with its fluxcage.',
  26: 'Once fluxcaged a being can be transmuted by the power of the staff which should always be used for balance.',
  27: 'Zokathra might create a plasma that could burn through the amalgam encasing the gem.',
  28: 'The spell Des Ew weakens nonmaterial beings',
  29: 'Small details can hide great rewards',
  30: 'The only way out is another way in.',
  31: 'Only the touch of the proper spell will free the gem and only the Firestaff can possess it.',
  32: 'New lives for old bones',
  34: 'The keys to passage lie hidden deep.',
};

function normalizeDecodedScrollText(rawText) {
  if (!rawText) return rawText;
  const exact = SCROLL_TEXT_FIXUPS[rawText];
  if (exact) return exact;
  if (rawText.includes('ACCEPTS ONE\nWISH.')) return 'THIS FOUNTAIN\nACCEPTS ONE\nWISH.';
  if (rawText.includes('FOR A MAGIC\nTORCH') || rawText === 'ORCH') return 'INVOKE FUL\nFOR A MAGIC\nTORCH';
  if (rawText.includes('VALUABLE\nON FLOOR') || rawText.endsWith('ON FLOOR') || rawText === 'FLOOR') {
    return 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR';
  }
  if (rawText.includes('BACK\nBRAVE\nADVENTURERS.') || rawText.endsWith('ADVENTURERS.')) {
    return 'COME BACK\nBRAVE\nADVENTURERS.';
  }
  if (rawText.endsWith('RTCUT') || rawText === 'RTCUT') return 'SHORTCUT';
  if (rawText.endsWith('ACK') || rawText === 'ACK') return 'TURN BACK';
  return rawText;
}

function decodeText(wordOffset) {
  if (wordOffset < 0 || wordOffset >= textWords) return '';
  const codes = [];
  for (let i = 0; i < 512; i++) {
    const off = OFF_TEXT_DATA + (wordOffset + i) * 2;
    if (off + 2 > OFF_TEXT_DATA + textWords * 2) break;
    const word = data.readUInt16LE(off);
    codes.push((word >> 10) & 0x1F, (word >> 5) & 0x1F, word & 0x1F);
  }
  let out = '', i = 0;
  while (i < codes.length) {
    const c = codes[i++];
    if (c === 31) break;
    if (c <= 25)   out += String.fromCharCode(65 + c);
    else if (c === 26) out += ' ';
    else if (c === 27) out += '.';
    else if (c === 28) out += '\n';
    else if (c === 29) { i++; } // escape 1 – skip
    else if (c === 30) { const idx = codes[i++] ?? 0; out += ESC2_OTHER[idx] ?? ''; }
  }
  return out.trim();
}

// ─── CHAMPION TEXT DECODER ────────────────────────────────────────────────────
// Champion texts encode stats as hex nibbles (codes 0–15)

function decodeChampionText(wordOffset) {
  const raw = [];
  for (let i = 0; i < 256; i++) {
    const off = OFF_TEXT_DATA + (wordOffset + i) * 2;
    if (off + 2 > OFF_TEXT_DATA + textWords * 2) break;
    const word = data.readUInt16LE(off);
    const codes = [(word >> 10) & 0x1F, (word >> 5) & 0x1F, word & 0x1F];
    for (const c of codes) {
      if (c === 31) { raw.push(31); break; }
      raw.push(c);
    }
    if (raw.includes(31)) break;
  }

  // Parse structure: name\r title1\r title2\r gender\r then hex stats
  let pos = 0;
  // Escape code 30 table for champion / non-wall texts
  const ESC2 = ['?','!','THE ','YOU ',' ',' ',' ',"'",' ',' '];
  const readUntilSep = () => {
    let s = '';
    while (pos < raw.length && raw[pos] !== 28 && raw[pos] !== 31) {
      const c = raw[pos++];
      if (c <= 25) s += String.fromCharCode(65 + c);
      else if (c === 26) s += ' ';
      else if (c === 27) s += '.';
      else if (c === 29) { pos++; } // escape 1: consume next, skip
      else if (c === 30) { const idx = raw[pos++] ?? 0; s += ESC2[idx] ?? ''; }
    }
    if (raw[pos] === 28) pos++; // consume separator
    return s;
  };
  const readHex4 = () => {
    let val = 0;
    for (let i = 0; i < 4; i++) val = (val << 4) | (raw[pos++] & 0xF);
    return val;
  };
  const readHex2 = () => {
    return ((raw[pos++] & 0xF) << 4) | (raw[pos++] & 0xF);
  };
  const readSkill4 = () => [raw[pos++]&0xF, raw[pos++]&0xF, raw[pos++]&0xF, raw[pos++]&0xF];

  try {
    const name    = readUntilSep();
    const title1  = readUntilSep();
    const title2  = readUntilSep();
    const gender  = readUntilSep();
    const health  = readHex4();
    const stamina = readHex4();
    const mana    = readHex4();
    if (raw[pos] === 28) pos++;
    const luck      = readHex2();
    const strength  = readHex2();
    const dexterity = readHex2();
    const wisdom    = readHex2();
    const vitality  = readHex2();
    const antiMagic = readHex2();
    const antiFire  = readHex2();
    if (raw[pos] === 28) pos++;
    const fighter = readSkill4();
    const ninja   = readSkill4();
    const priest  = readSkill4();
    const wizard  = readSkill4();
    return { name, title: title1 + title2, gender, health, stamina: stamina/10, mana,
             luck, strength, dexterity, wisdom, vitality, antiMagic, antiFire,
             skills: { fighter, ninja, priest, wizard } };
  } catch { return null; }
}

// ─── OBJECT ID ───────────────────────────────────────────────────────────────

function decodeObjId(word) {
  // In DM object references, 0xFFFE = RNeof and 0xFFFF = RNnul.
  // 0x0000 is a valid thing reference: Door, tilePos North, index 0.
  if (word === 0xFFFF || word === 0xFFFE) return null;
  return {
    pos:      (word >> 14) & 0x03,  // position on tile
    category: (word >> 10) & 0x0F,  // object type
    index:    word & 0x3FF,          // index in category array
  };
}

function hex(value, width = 4) {
  return `0x${value.toString(16).padStart(width, '0')}`;
}

// ─── PARSE OBJECT ARRAYS ─────────────────────────────────────────────────────

const doors = [];
for (let i = 0; i < NUM_DOORS; i++) {
  const b = OFF_DOORS + i * 4;
  const nextWord = data.readUInt16LE(b);
  const a = data.readUInt16LE(b + 2);
  doors.push({
    next:           decodeObjId(nextWord),
    destructChop:   !!(a & 0x100),
    destructFire:   !!(a & 0x080),
    hasButton:      !!(a & 0x040),
    openDirection:  (a & 0x020) ? 'Vertical' : 'Horizontal',
    ornate:         (a >> 1) & 0xF,
    doorType:       a & 0x01,   // 0=Grate, 1=Wood, etc. per map def
    raw:            {
      offset: b,
      bytes: Array.from(data.subarray(b, b + 4)),
      words: [hex(nextWord), hex(a)],
      nextWord,
      attributesWord: a,
      fields: {
        destructChopBit: !!(a & 0x0100),
        destructFireBit: !!(a & 0x0080),
        hasButtonBit: !!(a & 0x0040),
        openDirectionBit: !!(a & 0x0020),
        ornateBits: (a >> 1) & 0x0F,
        doorTypeBit: a & 0x0001,
        unreferencedBits: (a >> 9) & 0x007F,
      },
    },
  });
}

const teleporters = [];
for (let i = 0; i < NUM_TELE; i++) {
  const b = OFF_TELE + i * 6;
  const nextWord = data.readUInt16LE(b);
  const a = data.readUInt16LE(b + 2);
  const d = data.readUInt16LE(b + 4);
  teleporters.push({
    next:         decodeObjId(nextWord),
    sound:        !!(a & 0x8000),
    scope:        SCOPE_NAMES[(a >> 13) & 0x03],
    rotationType: (a >> 12) & 0x01,   // 0=relative, 1=absolute
    rotation:     DIRS[(a >> 10) & 0x03],
    destX:        a & 0x1F,
    destY:        (a >> 5) & 0x1F,
    destMap:      (d >> 8) & 0xFF,
    raw:          {
      offset: b,
      bytes: Array.from(data.subarray(b, b + 6)),
      words: [hex(nextWord), hex(a), hex(d)],
      nextWord,
      aWord: a,
      bWord: d,
      fields: {
        soundBit: !!(a & 0x8000),
        scopeBits: (a >> 13) & 0x03,
        rotationTypeBit: (a >> 12) & 0x01,
        rotationBits: (a >> 10) & 0x03,
        destYBits: (a >> 5) & 0x1F,
        destXBits: a & 0x1F,
        destMapByte: (d >> 8) & 0xFF,
        unreferencedByte: d & 0xFF,
      },
    },
  });
}

const wallTexts = [];
for (let i = 0; i < NUM_TEXTS; i++) {
  const b = OFF_TEXTS + i * 4;
  const nextWord = data.readUInt16LE(b);
  const a = data.readUInt16LE(b + 2);
  const textOff = (a >> 3) & 0x1FFF;
  const visible = a & 0x01;
  wallTexts.push({
    next:    decodeObjId(nextWord),
    visible: !!visible,
    textOffset: textOff,
    text:    decodeText(textOff),
    raw:     {
      offset: b,
      bytes: Array.from(data.subarray(b, b + 4)),
      words: [hex(nextWord), hex(a)],
      nextWord,
      attributesWord: a,
      fields: {
        visibleBit: !!(a & 0x0001),
        unreferencedBits: (a >> 1) & 0x0003,
        textDataWordOffset: (a >> 3) & 0x1FFF,
      },
    },
  });
}

const sensors = [];
const SENSOR_TYPES_WITH_OBJECT_REQUIREMENT = new Set([2, 3, 4, 8, 11, 12, 13, 16, 17]);
const SENSOR_TYPES_WITH_PROJECTILE_LAUNCH_ENERGY = new Set([7, 8, 9, 10, 14, 15]);
for (let i = 0; i < NUM_SENSORS; i++) {
  const b = OFF_SENSORS + i * 8;
  const nextWord = data.readUInt16LE(b);
  const td = data.readUInt16LE(b + 2);
  const a  = data.readUInt16LE(b + 4);
  const t  = data.readUInt16LE(b + 6);
  const sType = td & 0x7F;
  const sData = (td >> 7) & 0x1FF;
  const isLocal = !!(a & 0x800);
  // In the original sensor word layout, the low nibble is unreferenced and the
  // 12-bit Multiple payload lives in bits 15-4.
  const multipleValue = t >> 4;
  sensors.push({
    next:       decodeObjId(nextWord),
    type:       sType,
    data:       sData,
    generatedCreatureType: sType === 6 ? sData : undefined,
    generatedCountValue: sType === 6 ? ((a >> 7) & 0xF) : undefined,
    generatedCountRaw: sType === 6 ? (((a >> 7) & 0xF) & 0x7) : undefined,
    generatedCountRandomized: sType === 6 ? !!(((a >> 7) & 0xF) & 0x8) : undefined,
    generatorHealthMultiplier: sType === 6 ? (multipleValue & 0xF) : undefined,
    generatorTicks: sType === 6 ? (multipleValue >> 4) : undefined,
    graphic:    (a >> 12) & 0xF,
    isLocal,
    delay:      (a >> 7) & 0xF,
    sound:      !!(a & 0x040),
    revert:     !!(a & 0x020),
    action:     ACTION_NAMES[(a >> 3) & 0x03],
    onceOnly:   !!(a & 0x004),
    // Target (remote): y bits 15-11, x bits 10-6, dir bits 5-4
    targetY:    (t >> 11) & 0x1F,
    targetX:    (t >> 6) & 0x1F,
    targetDir:  DIRS[(t >> 4) & 0x03],
    multipleValue: (isLocal || sType === 6 || SENSOR_TYPES_WITH_PROJECTILE_LAUNCH_ENERGY.has(sType)) ? multipleValue : undefined,
    // champion portrait: sType === 127
    championGraphic: sType === 127 ? sData : undefined,
    kineticEnergy: SENSOR_TYPES_WITH_PROJECTILE_LAUNCH_ENERGY.has(sType) ? (multipleValue & 0xFF) : undefined,
    stepEnergy: SENSOR_TYPES_WITH_PROJECTILE_LAUNCH_ENERGY.has(sType) ? (multipleValue >> 8) : undefined,
    requiredObjectType: SENSOR_TYPES_WITH_OBJECT_REQUIREMENT.has(sType) ? sData : undefined,
    requiredObjectName: SENSOR_TYPES_WITH_OBJECT_REQUIREMENT.has(sType) ? resolveObjectTypeName(sData) : undefined,
    raw:        {
      offset: b,
      bytes: Array.from(data.subarray(b, b + 8)),
      words: [hex(nextWord), hex(td), hex(a), hex(t)],
      nextWord,
      typeDataWord: td,
      attributesWord: a,
      targetWord: t,
      fields: {
        typeBits: td & 0x7F,
        dataBits: (td >> 7) & 0x1FF,
        graphicBits: (a >> 12) & 0x0F,
        aUnreferencedBits: a & 0x0003,
        isLocalBit: !!(a & 0x0800),
        delayBits: (a >> 7) & 0x0F,
        soundBit: !!(a & 0x0040),
        revertBit: !!(a & 0x0020),
        actionBits: (a >> 3) & 0x03,
        onceOnlyBit: !!(a & 0x0004),
        multipleBits: t >> 4,
        targetYBits: (t >> 11) & 0x1F,
        targetXBits: (t >> 6) & 0x1F,
        targetDirBits: (t >> 4) & 0x03,
        targetUnreferencedBits: t & 0x000F,
      },
    },
  });
}

const CHAMPION_PORTRAITS = {
  0:'Elija/Airwing', 1:'Halk/Aroc',     2:'Syra/Talon',    3:'Hissssa/Leta',
  4:'Zed/Dema',      5:'Chani/Algor',   6:'Hawk/Toadrot',  7:'Boris/Ven',
  8:'Mophus/Mantia', 9:'Leif/Gnatu',   10:'WuTse/Slogar', 11:'Alex/Sting',
  12:'Linflas/Skelar',13:'Azizi/Deth', 14:'Iaido/Necro',  15:'Gando/Plague',
  16:'Stamm/Tunda',  17:'Leyla/Lana',  18:'Tiggy/Buzzzz', 19:'Sonja/Petal',
  20:'Nabi/Itza',    21:'Gothmog/Tula',22:'Wuuf/Kazai',   23:'Daroou/Lor',
};

const CREATURE_NAMES = [
  'Giant Scorpion','Swamp Slime','Giggler','Wizard Eye','Pain Rat','Ruster','Screamer',
  'Rockpile','Ghost','Stone Golem','Mummy','Black Flame','Skeleton','Couatl','Vexirk',
  'Magenta Worm','Trolin','Giant Wasp','Animated Armour','Materializer','Water Elemental',
  'Oitu','Demon','Lord Chaos','Red Dragon','Lord Order','Grey Lord',
];
for (const sensor of sensors) {
  if (sensor.type === 6) {
    sensor.generatedCreatureName = CREATURE_NAMES[sensor.generatedCreatureType] ?? `Creature_${sensor.generatedCreatureType}`;
  }
}
const creatures = [];
for (let i = 0; i < NUM_CREATURES; i++) {
  const b = OFF_CREATURES + i * 16;
  const nextWord = data.readUInt16LE(b);
  const possessionWord = data.readUInt16LE(b + 2);
  const flags = data.readUInt16LE(b + 14);
  const count = ((flags >> 5) & 0x03) + 1;
  const type  = data.readUInt8(b + 4);
  creatures.push({
    next:       decodeObjId(nextWord),
    possession: decodeObjId(possessionWord),
    type,
    name:       CREATURE_NAMES[type] ?? `Creature_${type}`,
    positions:  data.readUInt8(b + 5),  // packed: 2 bits per creature slot
    hp:         [0,1,2,3].slice(0, count).map(k => data.readUInt16LE(b + 6 + k*2)),
    count,
    direction:  DIRS[(flags >> 8) & 0x03],
    doNotDiscard:  !!(flags & 0x400),
    raw:        {
      offset: b,
      bytes: Array.from(data.subarray(b, b + 16)),
      words: Array.from({ length: 8 }, (_, wi) => hex(data.readUInt16LE(b + wi * 2))),
      nextWord,
      possessionWord,
      flagsWord: flags,
      fields: {
        typeByte: data.readUInt8(b + 4),
        cellsByte: data.readUInt8(b + 5),
        directionBits: (flags >> 8) & 0x03,
        doNotDiscardBit: !!(flags & 0x0400),
        countBits: (flags >> 5) & 0x03,
        aUnreferencedBit: !!(flags & 0x0010),
        bUnreferencedBit: !!(flags & 0x0080),
        cUnreferencedBits: (flags >> 11) & 0x001F,
      },
    },
  });
}

// ─── ITEM NAME TABLES ────────────────────────────────────────────────────────
// From Dungeon Master Encyclopaedia – Item Properties

// These names are a conservative blend of:
// - ReDMCSB constants documented in RESEARCH_NOTES.md
// - icon-name ordering recovered from GRAPHICS.DAT
// - spot checks against canonical single-item placements
const WEAPON_NAMES = {
  0:'Eye Of Time', 1:'Stormring', 2:'Torch', 3:'Flamitt', 4:'Staff Of Claws', 5:'Bolt Blade',
  6:'Fury', 7:'The Firestaff',
  8:'Dagger', 9:'Falchion', 10:'Sword', 11:'Rapier', 12:'Sabre', 13:'Samurai Sword',
  14:'Delta', 15:'Diamond Edge',
  16:'Vorpal Blade', 17:'The Inquisitor', 18:'Axe', 19:'Hardcleave', 20:'Mace',
  21:'Mace Of Order', 22:'Morningstar', 23:'Club',
  24:'Stone Club', 25:'Bow', 26:'Crossbow', 27:'Arrow',
  28:'Slayer', 29:'Sling', 30:'Rock', 31:'Poison Dart',
  32:'Throwing Star', 33:'Stick', 34:'Staff', 35:'Wand', 36:'Teowand',
  37:'Yew Staff', 38:'Staff Of Manar', 39:'Snake Staff',
  40:'The Conduit', 41:'Dragon Spit', 42:'Sceptre Of Lyf', 43:'Horn Of Fear', 44:'Speedbow',
  45:'The Firestaff (Complete)',
};

const ARMOR_NAMES = {
  // Torso
  0:'Cape', 1:'Cloak of Night', 2:'Elven Doublet', 3:'Leather Jerkin',
  4:'Leather Boots', 5:'Robe of the Kite Lord', 6:'Robe', 7:'Fine Robe (Body)',
  8:'Fine Robe (Legs)', 9:'Plate Mail', 10:'Tunic', 11:'Silk Shirt', 12:'Gunna',
  // Legs
  16:'Leather Jerkin', 17:'Leather Pants', 18:'Suede Boots', 19:'Chain Mail Aketon',
  // Leg armor
  13:'Elven Doublet', 14:'Elven Huke', 15:'Elven Boots', 20:'Tunic', 21:'Ghi',
  22:'Ghi Trousers', 23:'Calista', 24:'Crown Of Nerra', 25:'Bezerker Helm',
  // Head
  26:'Helmet', 27:'Basinet', 28:'Buckler', 29:'Barbarian Hide',
  32:'Mail Aketon', 33:'Leg Mail', 34:'Mithral Aketon', 35:'Mithral Mail',
  36:"Casque'n Coif", 37:'Hosen', 38:'Armet', 39:'Torso Plate',
  // Neck / plate
  30:'Wooden Shield', 31:'Small Shield',
  40:'Leg Plate', 41:'Foot Plate', 42:'Large Shield', 43:'Helm Of Lyte',
  // Hands
  44:'Plate Of Lyte', 45:'Poleyn Of Lyte', 46:'Greave Of Lyte', 47:'Shield Of Lyte',
  48:'Helm Of Darc', 49:'Plate Of Darc',
  // Misc
  50:'Poleyn Of Darc', 51:'Greave Of Darc', 52:'Shield Of Darc', 54:'Flamebain',
  56:'Boots Of Speed', 57:'Halter',
};

const POTION_NAMES = {
  3:'Ven Potion',
  6:'Ros Potion',
  7:'Ku Potion',
  8:'Dane Potion',
  9:'Neta Potion',
  10:'Antivenin',
  11:'Mon Potion',
  12:'Ya Potion',
  13:'Ee Potion',
  14:'Vi Potion',
  15:'Water Flask',
  19:'Ful Bomb',
  20:'Empty Flask',
};

const MISC_NAMES = {
  0:'Compass', 1:'Waterskin', 2:'Jewel Symal', 3:'Illumulet', 4:'Ashes',
  5:'Bones', 6:'Copper Coin', 7:'Silver Coin',
  8:'Gold Coin', 9:'Iron Key',
  10:'Key Of B', 11:'Solid Key', 12:'Square Key', 13:'Tourquoise Key', 14:'Cross Key',
  15:'Onyx Key', 16:'Skeleton Key', 17:'Gold Key', 18:'Winged Key', 19:'Topaz Key',
  20:'Sapphire Key', 21:'Emerald Key', 22:'Ruby Key', 23:'Ra Key',
  24:'Master Key', 25:'Boulder', 26:'Blue Gem', 27:'Orange Gem',
  28:'Green Gem', 29:'Apple', 30:'Corn', 31:'Bread',
  32:'Cheese', 33:'Screamer Slice', 34:'Worm Round', 35:'Drumstick',
  36:'Dragon Steak', 37:'Gem Of Ages', 38:'Ekkhard Cross', 39:'Moonstone',
  40:'The Hellion', 41:'Pendant Feral', 42:'Magical Box (Blue)', 43:'Magical Box (Green)',
  44:'Mirror Of Dawn', 45:'Rope', 46:"Rabbit's Foot", 47:'Corbamite',
  48:'Choker', 49:'Lock Picks', 50:'Magnifier', 51:'Zokathra',
};

const weapons = [];
for (let i = 0; i < NUM_WEAPONS; i++) {
  const b = OFF_WEAPONS + i * 4;
  const nextWord = data.readUInt16LE(b);
  const a = data.readUInt16LE(b + 2);
  const t = a & 0x7F;
  weapons.push({
    next:      decodeObjId(nextWord),
    type:      t,
    name:      WEAPON_NAMES[t] ?? `Weapon_${t}`,
    broken:    !!(a & 0x4000),
    charges:   (a >> 10) & 0xF,
    poisoned:  !!(a & 0x200),
    cursed:    !!(a & 0x100),
    doNotDiscard: !!(a & 0x080),
    raw:       {
      offset: b,
      bytes: Array.from(data.subarray(b, b + 4)),
      words: [hex(nextWord), hex(a)],
      nextWord,
      attributesWord: a,
      fields: {
        brokenBit: !!(a & 0x4000),
        chargesBits: (a >> 10) & 0x0F,
        poisonedBit: !!(a & 0x0200),
        cursedBit: !!(a & 0x0100),
        doNotDiscardBit: !!(a & 0x0080),
        typeBits: a & 0x007F,
        litBit: !!(a & 0x8000),
      },
    },
  });
}

const armor = [];
for (let i = 0; i < NUM_ARMOR; i++) {
  const b = OFF_ARMOR + i * 4;
  const nextWord = data.readUInt16LE(b);
  const a = data.readUInt16LE(b + 2);
  const t = a & 0x7F;
  armor.push({
    next:      decodeObjId(nextWord),
    type:      t,
    name:      ARMOR_NAMES[t] ?? `Armor_${t}`,
    broken:    !!(a & 0x2000),
    cursed:    !!(a & 0x100),
    doNotDiscard: !!(a & 0x080),
    raw:       {
      offset: b,
      bytes: Array.from(data.subarray(b, b + 4)),
      words: [hex(nextWord), hex(a)],
      nextWord,
      attributesWord: a,
      fields: {
        brokenBit: !!(a & 0x2000),
        cursedBit: !!(a & 0x0100),
        doNotDiscardBit: !!(a & 0x0080),
        typeBits: a & 0x007F,
        chargeCountBits: (a >> 9) & 0x000F,
        unreferencedBits: (a >> 14) & 0x0003,
      },
    },
  });
}

const scrolls = [];
for (let i = 0; i < NUM_SCROLLS; i++) {
  const b = OFF_SCROLLS + i * 4;
  const nextWord = data.readUInt16LE(b);
  const a = data.readUInt16LE(b + 2);
  // Scroll text offset: bits 15-1 (shift right 1, bit 0 = open/closed flag)
  const textOff = a >> 1;
  scrolls.push({
    next:       decodeObjId(nextWord),
    open:       !!(a & 0x01),
    textOffset: textOff,
    text:       normalizeDecodedScrollText(decodeText(textOff)),
    raw:        {
      offset: b,
      bytes: Array.from(data.subarray(b, b + 4)),
      words: [hex(nextWord), hex(a)],
      nextWord,
      attributesWord: a,
      fields: {
        textOffsetBits: a >> 1,
        openBit: !!(a & 0x0001),
      },
    },
  });
}
for (let i = 0; i < scrolls.length; i++) {
  const fixed = SCROLL_INDEX_FIXUPS[i];
  if (fixed) scrolls[i].text = fixed;
}

const potions = [];
for (let i = 0; i < NUM_POTIONS; i++) {
  const b = OFF_POTIONS + i * 4;
  const nextWord = data.readUInt16LE(b);
  const a = data.readUInt16LE(b + 2);
  // ReDMCSB: POTION = Next + Power:8 + Type:7 + DoNotDiscard:1
  const power = a & 0xFF;
  const t = (a >> 8) & 0x7F;
  const doNotDiscard = !!(a & 0x8000);
  potions.push({
    next:         decodeObjId(nextWord),
    type:         t,
    name:         POTION_NAMES[t] ?? `Potion_${t}`,
    power,
    doNotDiscard,
    raw:          {
      offset: b,
      bytes: Array.from(data.subarray(b, b + 4)),
      words: [hex(nextWord), hex(a)],
      nextWord,
      attributesWord: a,
      fields: {
        powerByte: a & 0x00FF,
        typeBits: (a >> 8) & 0x007F,
        doNotDiscardBit: !!(a & 0x8000),
      },
    },
  });
}

const containers = [];
const CONTAINER_NAMES = {
  0: 'Chest',
};
for (let i = 0; i < NUM_CONTAINERS; i++) {
  const b = OFF_CONTAINERS + i * 8;
  const nextWord = data.readUInt16LE(b);
  const firstContentWord = data.readUInt16LE(b + 2);
  const a = data.readUInt16LE(b + 4);
  const t = (a >> 1) & 0x03;
  containers.push({
    next:         decodeObjId(nextWord),
    firstContent: decodeObjId(firstContentWord),
    type:         t,
    name:         CONTAINER_NAMES[t] ?? null,
    raw:          {
      offset: b,
      bytes: Array.from(data.subarray(b, b + 8)),
      words: [hex(nextWord), hex(firstContentWord), hex(a), hex(data.readUInt16LE(b + 6))],
      nextWord,
      firstContentWord,
      attributesWord: a,
      cUnreferencedWord: data.readUInt16LE(b + 6),
      fields: {
        aUnreferencedBit: !!(a & 0x0001),
        typeBits: (a >> 1) & 0x0003,
        bUnreferencedBits: (a >> 3) & 0x1FFF,
        cUnreferencedWord: data.readUInt16LE(b + 6),
      },
    },
  });
}

const misc = [];
const COMPASS_DIRECTIONS = ['North', 'East', 'South', 'West'];
const WATERSKIN_STATES = ['Empty', 'Almost empty', 'Almost full', 'Full'];
for (let i = 0; i < NUM_MISC; i++) {
  const b = OFF_MISC + i * 4;
  const nextWord = data.readUInt16LE(b);
  const a = data.readUInt16LE(b + 2);
  const t = a & 0x7F;
  const doNotDiscard = !!(a & 0x80);
  const highBits = (a >> 14) & 0x03;
  const baseName = MISC_NAMES[t] ?? `Misc_${t}`;
  const details = {};

  if (t === 0) {
    details.compassDirection = COMPASS_DIRECTIONS[highBits];
  } else if (t === 1) {
    details.waterskinState = WATERSKIN_STATES[highBits];
    details.waterskinStateIndex = highBits;
  } else if (t === 5) {
    details.championOrdinal = highBits + 1;
  } else if (t === 2 || t === 3) {
    details.wornStateBits = highBits;
    details.worn = highBits !== 0;
  } else if (highBits !== 0) {
    details.highBits = highBits;
  }

  misc.push({
    next:      decodeObjId(nextWord),
    type:      t,
    name:      baseName,
    doNotDiscard,
    highBits,
    ...details,
    raw:       {
      offset: b,
      bytes: Array.from(data.subarray(b, b + 4)),
      words: [hex(nextWord), hex(a)],
      nextWord,
      attributesWord: a,
      fields: {
        doNotDiscardBit: doNotDiscard,
        typeBits: a & 0x007F,
        highBits: (a >> 14) & 0x03,
        cursedBit: !!(a & 0x0100),
        unreferencedBits: (a >> 9) & 0x001F,
      },
    },
  });
}

const projectiles = [];
for (let i = 0; i + 8 <= PROJECTILE_SECTION_BYTES; i += 8) {
  const b = OFF_PROJECTILES + i;
  const nextWord = data.readUInt16LE(b);
  const projectileObjectWord = data.readUInt16LE(b + 2);
  const rangeEnergyRemaining = data.readUInt8(b + 4);
  const damageEnergyRemaining = data.readUInt8(b + 5);
  const eventIndex = data.readUInt16LE(b + 6);
  projectiles.push({
    next: decodeObjId(nextWord),
    projectileObject: decodeObjId(projectileObjectWord),
    rangeEnergyRemaining,
    damageEnergyRemaining,
    eventIndex,
    raw: {
      offset: b,
      bytes: Array.from(data.subarray(b, b + 8)),
      words: [hex(nextWord), hex(projectileObjectWord), hex(eventIndex)],
      nextWord,
      projectileObjectWord,
      eventIndex,
      fields: {
        rangeEnergyRemaining,
        damageEnergyRemaining,
      },
    },
  });
}

const clouds = [];
for (let i = 0; i + 4 <= CLOUD_SECTION_BYTES; i += 4) {
  const b = OFF_CLOUDS + i;
  const nextWord = data.readUInt16LE(b);
  const valueAndType = data.readUInt16LE(b + 2);
  clouds.push({
    next: decodeObjId(nextWord),
    value: (valueAndType >> 8) & 0xFF,
    rawType: valueAndType & 0x7F,
    unknownBit7: !!(valueAndType & 0x80),
    raw: {
      offset: b,
      bytes: Array.from(data.subarray(b, b + 4)),
      words: [hex(nextWord), hex(valueAndType)],
      nextWord,
      valueAndType,
      fields: {
        valueByte: (valueAndType >> 8) & 0xFF,
        typeBits: valueAndType & 0x7F,
        unknownBit7: !!(valueAndType & 0x80),
      },
    },
  });
}

const allObjs = { doors, teleporters, wallTexts, sensors, creatures,
                  weapons, armor, scrolls, potions, containers, misc };

function getObj(objId) {
  if (!objId) return null;
  const arr = [doors, teleporters, wallTexts, sensors, creatures,
               weapons, armor, scrolls, potions, containers, misc];
  return arr[objId.category]?.[objId.index] ?? null;
}

function toGlobalCoords(mapOffset, x, y) {
  return { x: mapOffset.x + x, y: mapOffset.y + y };
}

function enrichObjectWithGlobalCoords(map, tile, obj) {
  obj.globalX = tile.globalX;
  obj.globalY = tile.globalY;

  if (obj.category === 'Sensor') {
    obj.targetGlobalX = map.mapOffset.x + obj.targetX;
    obj.targetGlobalY = map.mapOffset.y + obj.targetY;
  } else if (obj.category === 'Teleporter') {
    const destMap = maps[obj.destMap];
    if (destMap) {
      obj.destGlobalX = destMap.mapOffset.x + obj.destX;
      obj.destGlobalY = destMap.mapOffset.y + obj.destY;
    }
  } else if (obj.category === 'Container' && Array.isArray(obj.contents)) {
    for (const child of obj.contents) {
      child.globalX = tile.globalX;
      child.globalY = tile.globalY;
    }
  }
}

// ─── FOLLOW LINKED LIST ───────────────────────────────────────────────────────
// Returns array of {category, name, index, pos, ...data}

function followList(firstObjId) {
  const result = [];
  let id = firstObjId;
  const seen = new Set();
  while (id) {
    const key = `${id.category}-${id.index}`;
    if (seen.has(key)) break; // guard against cycles
    seen.add(key);
    const obj = getObj(id);
    if (!obj) break;
    const catName = OBJ_CAT[id.category] ?? `Cat${id.category}`;
    const entry = { category: catName, index: id.index, tilePos: OBJ_POS[id.pos] };
    // Include relevant fields per category (omit 'next')
    const { next, firstContent, ...rest } = obj;
    Object.assign(entry, rest);
    // Resolve container contents recursively
    if (catName === 'Container' && firstContent) {
      entry.contents = followList(firstContent);
    }
    result.push(entry);
    id = obj.next;
  }
  return result;
}

// Removed legacy display-name audit helper; parser now exports raw object structure only.

// ─── PARSE MAPS WITH FULL OBJECT RESOLUTION ───────────────────────────────────

const maps = [];
let globalColCounter = 0; // cumulative column index across all maps
let globalObjIdx = 0;     // current position in the object list

// Read column index (409 words = one per column)
const colIndex = [];
for (let i = 0; i <= 409; i++) {
  colIndex.push(data.readUInt16LE(OFF_COL_IDX + i * 2));
}

const objectListWordValues = [];
for (let i = 0; i < objListWords; i++) {
  objectListWordValues.push(data.readUInt16LE(OFF_OBJ_LIST + i * 2));
}

for (let mi = 0; mi < numMaps; mi++) {
  const defBase = OFF_MAP_DEFS + mi * 16;
  const rawDefinitionBytes = Array.from(data.subarray(defBase, defBase + 16));
  const mapDataRelOff = data.readUInt16LE(defBase + 0x00);
  const defWord1 = data.readUInt16LE(defBase + 0x02);
  const defWord2 = data.readUInt16LE(defBase + 0x04);
  const mapOffX = data.readUInt8(defBase + 0x06);
  const mapOffY = data.readUInt8(defBase + 0x07);
  const szWord  = data.readUInt16LE(defBase + 0x08);
  const height  = ((szWord >> 11) & 0x1F) + 1;
  const width   = ((szWord >> 6)  & 0x1F) + 1;
  const level   = szWord & 0x3F;
  const ornamentWord = data.readUInt16LE(defBase + 0x0A);
  const countWord    = data.readUInt16LE(defBase + 0x0C);
  const setWord      = data.readUInt16LE(defBase + 0x0E);
  const randomFloorOrnamentCount = (ornamentWord >> 12) & 0xF;
  const floorOrnamentCount = (ornamentWord >> 8) & 0xF;
  const randomWallOrnamentCount = (ornamentWord >> 4) & 0xF;
  const wallOrnamentCount = ornamentWord & 0xF;
  const difficulty = (countWord >> 12) & 0xF;
  const unreferencedNibble = (countWord >> 8) & 0xF;
  const creatureTypeCount = (countWord >> 4) & 0xF;
  const doorOrnamentCount = countWord & 0xF;
  const floorSet = (setWord >> 12) & 0xF;
  const wallSet = (setWord >> 8) & 0xF;
  const doorSet0 = (setWord >> 4) & 0xF;
  const doorSet1 = setWord & 0xF;
  const mapOffset = { x: mapOffX, y: mapOffY };
  const columnIndexStart = globalColCounter;
  const columnIndexValues = colIndex.slice(columnIndexStart, columnIndexStart + width);
  const localBounds = { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
  const globalBounds = {
    minX: mapOffset.x,
    minY: mapOffset.y,
    maxX: mapOffset.x + width - 1,
    maxY: mapOffset.y + height - 1,
  };

  const tileBase = OFF_MAP_DATA + mapDataRelOff;
  const rawTileBytes = Array.from(data.subarray(tileBase, tileBase + width * height));
  const mapMetaBase = tileBase + width * height;
  let metaCursor = mapMetaBase;
  const allowedCreatureTypes = Array.from(data.subarray(metaCursor, metaCursor + creatureTypeCount));
  metaCursor += creatureTypeCount;
  const wallOrnamentIndices = Array.from(data.subarray(metaCursor, metaCursor + wallOrnamentCount));
  metaCursor += wallOrnamentCount;
  const floorOrnamentIndices = Array.from(data.subarray(metaCursor, metaCursor + floorOrnamentCount));
  metaCursor += floorOrnamentCount;
  const doorOrnamentIndices = Array.from(data.subarray(metaCursor, metaCursor + doorOrnamentCount));
  metaCursor += doorOrnamentCount;

  // Build tiles with objects
  const tiles = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const byte = data.readUInt8(tileBase + x * height + y);
      const tileType = TILE_TYPES[(byte >> 5) & 7];
      const hasObjects = !!(byte & 0x10);
      const attrs = byte & 0x0F;

      // Decode tile attrs by type, keeping the raw nibble visible.
      let tileAttrs = {
        rawTypeBits: (byte >> 5) & 0x07,
        rawHasObjectsBit: !!(byte & 0x10),
        rawAttributeBits: attrs,
      };
      if (tileType === 'Pit') {
        tileAttrs = {
          rawTypeBits: (byte >> 5) & 0x07,
          rawHasObjectsBit: !!(byte & 0x10),
          rawAttributeBits: attrs,
          open: !!(attrs & 0x8),
          invisible: !!(attrs & 0x4),
          imaginary: !!(attrs & 0x1),
        };
      } else if (tileType === 'Stairs') {
        tileAttrs = {
          rawTypeBits: (byte >> 5) & 0x07,
          rawHasObjectsBit: !!(byte & 0x10),
          rawAttributeBits: attrs,
          orientation: (attrs & 0x8) ? 'NorthSouth' : 'WestEast',
          direction: (attrs & 0x4) ? 'Up' : 'Down',
          up: !!(attrs & 0x4),
        };
      } else if (tileType === 'Door') {
        const stateNames = ['Open','25%closed','50%closed','75%closed','Closed','Bashed','Invalid6','Invalid7'];
        tileAttrs = {
          rawTypeBits: (byte >> 5) & 0x07,
          rawHasObjectsBit: !!(byte & 0x10),
          rawAttributeBits: attrs,
          orientation: (attrs & 0x8) ? 'NorthSouth' : 'WestEast',
          state: stateNames[attrs & 0x7],
          stateIndex: attrs & 0x7,
        };
      } else if (tileType === 'Teleporter') {
        tileAttrs = {
          rawTypeBits: (byte >> 5) & 0x07,
          rawHasObjectsBit: !!(byte & 0x10),
          rawAttributeBits: attrs,
          open: !!(attrs & 0x8),
          visible: !!(attrs & 0x4),
        };
      } else if (tileType === 'TrickWall') {
        tileAttrs = {
          rawTypeBits: (byte >> 5) & 0x07,
          rawHasObjectsBit: !!(byte & 0x10),
          rawAttributeBits: attrs,
          allowRandomDecoration: !!(attrs & 0x8),
          open: !!(attrs & 0x4),
          imaginary: !!(attrs & 0x1),
        };
      } else if (tileType === 'Wall') {
        tileAttrs = {
          rawTypeBits: (byte >> 5) & 0x07,
          rawHasObjectsBit: !!(byte & 0x10),
          rawAttributeBits: attrs,
          allowDecoN: !!(attrs & 0x8),
          allowDecoE: !!(attrs & 0x4),
          allowDecoS: !!(attrs & 0x2),
          allowDecoW: !!(attrs & 0x1),
        };
      } else if (tileType === 'Floor') {
        tileAttrs = {
          rawTypeBits: (byte >> 5) & 0x07,
          rawHasObjectsBit: !!(byte & 0x10),
          rawAttributeBits: attrs,
          allowRandomDecoration: !!(attrs & 0x8),
        };
      }

      let objects = [];
      let objectListIndex = null;
      let objectListWord = null;
      if (hasObjects) {
        objectListIndex = globalObjIdx;
        objectListWord = data.readUInt16LE(OFF_OBJ_LIST + globalObjIdx * 2);
        const listWord = objectListWord;
        objects = followList(decodeObjId(listWord));
        globalObjIdx++;
      }

      const globalPos = toGlobalCoords(mapOffset, x, y);
      const tile = {
        x,
        y,
        globalX: globalPos.x,
        globalY: globalPos.y,
        type: tileType,
        rawByte: byte,
        rawByteHex: hex(byte, 2),
        rawTypeBits: (byte >> 5) & 0x07,
        rawHasObjectsBit: !!(byte & 0x10),
        rawAttrs: attrs,
        ...tileAttrs,
        objectListIndex,
        objectListWord,
        objectListWordHex: objectListWord === null ? null : hex(objectListWord),
        objects,
      };
      for (const obj of objects) enrichObjectWithGlobalCoords({ mapOffset }, tile, obj);
      tiles.push(tile);
    }
    globalColCounter++;
  }

  maps.push({
    index:      mi,
    name:       MAP_NAMES[mi] ?? `Map_${mi}`,
    level,
    width,
    height,
    difficulty,
    mapOffset,
    localBounds,
    globalBounds,
    original: {
      rawDefinitionBytes,
      rawMapDataOffset: mapDataRelOff,
      rawMapDataAbsoluteOffset: tileBase,
      rawTileBytes,
      columnIndexStart,
      columnIndexValues,
      headerWords: {
        rawMapDataOffsetWord: hex(mapDataRelOff),
        aUnreferencedWord: hex(defWord1),
        bUnreferencedWord: hex(defWord2),
        sizeWord: hex(szWord),
        ornamentWord: hex(ornamentWord),
        countWord: hex(countWord),
        setWord: hex(setWord),
      },
      headerBytes: {
        aUnreferencedLowByte: defWord1 & 0xFF,
        aUnreferencedHighByte: (defWord1 >> 8) & 0xFF,
        bUnreferencedLowByte: defWord2 & 0xFF,
        bUnreferencedHighByte: (defWord2 >> 8) & 0xFF,
        mapOffsetX: mapOffX,
        mapOffsetY: mapOffY,
      },
      counts: {
        wallOrnamentCount,
        randomWallOrnamentCount,
        floorOrnamentCount,
        randomFloorOrnamentCount,
        doorOrnamentCount,
        creatureTypeCount,
        unreferencedNibble,
      },
      sets: {
        floorSet,
        wallSet,
        doorSet0,
        doorSet1,
      },
      metadataLayout: {
        baseOffset: mapMetaBase,
        endOffsetExclusive: metaCursor,
      },
      rawMetadataBytes: Array.from(data.subarray(mapMetaBase, metaCursor)),
      metadataSections: {
        allowedCreatureTypes: {
          offset: mapMetaBase,
          length: creatureTypeCount,
          bytes: allowedCreatureTypes,
        },
        wallOrnamentIndices: {
          offset: mapMetaBase + creatureTypeCount,
          length: wallOrnamentCount,
          bytes: wallOrnamentIndices,
        },
        floorOrnamentIndices: {
          offset: mapMetaBase + creatureTypeCount + wallOrnamentCount,
          length: floorOrnamentCount,
          bytes: floorOrnamentIndices,
        },
        doorOrnamentIndices: {
          offset: mapMetaBase + creatureTypeCount + wallOrnamentCount + floorOrnamentCount,
          length: doorOrnamentCount,
          bytes: doorOrnamentIndices,
        },
      },
      metadata: {
        allowedCreatureTypes,
        wallOrnamentIndices,
        floorOrnamentIndices,
        doorOrnamentIndices,
      },
    },
    tiles,  // flat array, index = x * height + y
  });
}

// ─── RESOLVE STAIR DESTINATIONS ──────────────────────────────────────────────
// F154_afzz_DUNGEON_GetLocationAfterLevelChange logic:
// globalX = map.offsetX + stairX, globalY = map.offsetY + stairY
// targetLevel = map.level + (up ? -1 : +1)
// Find map at targetLevel whose bounds contain (globalX, globalY)
for (const map of maps) {
  for (const tile of map.tiles) {
    if (tile.type !== 'Stairs') continue;
    const globalX = map.mapOffset.x + tile.x;
    const globalY = map.mapOffset.y + tile.y;
    const targetLevel = map.level + (tile.up ? -1 : 1);
    for (const dest of maps) {
      if (dest.level !== targetLevel) continue;
      if (globalX >= dest.mapOffset.x && globalX < dest.mapOffset.x + dest.width &&
          globalY >= dest.mapOffset.y && globalY < dest.mapOffset.y + dest.height) {
        tile.destMap  = dest.index;
        tile.destX    = globalX - dest.mapOffset.x;
        tile.destY    = globalY - dest.mapOffset.y;
        tile.destGlobalX = globalX;
        tile.destGlobalY = globalY;
        break;
      }
    }
  }
}

// ─── IDENTIFY CHAMPION TEXTS ──────────────────────────────────────────────────
// Sensors of type 127 are champion portraits.
// The tile "in front" (determined by sensor's wall face direction) holds a
// disabled Text object with the champion's stats encoded as hex nibbles.
// The sensor's targetX/targetY also points to that tile.

// Pre-build a tile lookup by map+x+y for fast access
const tileLookup = new Map();
for (const map of maps) {
  for (const tile of map.tiles) {
    tileLookup.set(`${map.index}:${tile.x}:${tile.y}`, tile);
  }
}

function getTile(mapIdx, x, y) {
  return tileLookup.get(`${mapIdx}:${x}:${y}`) ?? null;
}

// Direction a portrait faces based on which wall it is on:
// wall 'North' → faces into tile from north side → front tile is south (y+1) — actually,
// in DM coords: north wall face = facing south toward the corridor = front at (x, y+1)
// south wall face = front at (x, y-1), east at (x-1, y), west at (x+1, y)
const FRONT_DELTA = { North:[0,1], East:[-1,0], South:[0,-1], West:[1,0] };

function findChampionText(mapIdx, tile, sensor) {
  // Try 1: sensor target coordinates
  const byTarget = getTile(mapIdx, sensor.targetX, sensor.targetY);
  if (byTarget) {
    for (const ao of byTarget.objects) {
      if (ao.category === 'Text') {
        const p = decodeChampionText(ao.textOffset);
        if (p?.name?.length > 1) return p;
      }
    }
  }
  // Try 2: all 4 adjacent tiles
  for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
    const adj = getTile(mapIdx, tile.x + dx, tile.y + dy);
    if (!adj) continue;
    for (const ao of adj.objects) {
      if (ao.category === 'Text') {
        const p = decodeChampionText(ao.textOffset);
        if (p?.name?.length > 1) return p;
      }
    }
  }
  return null;
}

const champions = [];
for (const map of maps) {
  for (const tile of map.tiles) {
    for (const obj of tile.objects) {
      if (obj.category === 'Sensor' && obj.type === 127) {
        const champ = {
          portraitId:    obj.data,
          portraitName:  CHAMPION_PORTRAITS[obj.data] ?? `Portrait_${obj.data}`,
          map:           map.index,
          x:             tile.x,
          y:             tile.y,
          globalX:       tile.globalX,
          globalY:       tile.globalY,
          wallFace:      obj.tilePos,
        };
        const parsed = findChampionText(map.index, tile, obj);
        if (parsed) Object.assign(champ, parsed);
        champions.push(champ);
      }
    }
  }
}

const categoryArrays = {
  Door: doors,
  Teleporter: teleporters,
  Text: wallTexts,
  Sensor: sensors,
  Creature: creatures,
  Weapon: weapons,
  Armor: armor,
  Scroll: scrolls,
  Potion: potions,
  Container: containers,
  Misc: misc,
};

const usedObjectKeys = new Set();
function markUsedObjectTree(obj) {
  if (!obj?.category || typeof obj.index !== 'number') return;
  const key = `${obj.category}:${obj.index}`;
  if (usedObjectKeys.has(key)) return;
  usedObjectKeys.add(key);
  if (obj.category === 'Container' && Array.isArray(obj.contents)) {
    for (const child of obj.contents) markUsedObjectTree(child);
  }
}

for (const map of maps) {
  for (const tile of map.tiles) {
    for (const obj of tile.objects) markUsedObjectTree(obj);
  }
}

const objectDatabase = Object.fromEntries(
  Object.entries(categoryArrays).map(([category, entries]) => [
    category,
    entries.map((entry, index) => ({
      index,
      usedInDungeon: usedObjectKeys.has(`${category}:${index}`),
      ...entry,
    })),
  ]),
);

// ─── GAME DATABASE (minimal extracted/reference payload) ───────────────

const GAME_DB = {
  _meta: {
    sourceFile: rawFileName,
    sourceFormat: loadedDungeon.format,
    source: 'Minimal extracted/reference export for audit and tooling',
    note: 'Item gameplay/runtime definitions now live in src/data/*. Prefer dungeon.json/objectDatabase + originalAtari for source-truth data. itemTypeNames now omit unproven placeholder entries instead of inventing names.',
  },

  itemTypeNames: {
    weapons: WEAPON_NAMES,
    armor: ARMOR_NAMES,
    potions: POTION_NAMES,
    containers: CONTAINER_NAMES,
    misc: MISC_NAMES,
  },

  // Champion portrait IDs → champion names
  championPortraits: {
    0:'Elija / Airwing',   1:'Halk / Aroc',      2:'Syra / Talon',
    3:'Hissssa / Leta',    4:'Zed / Dema',        5:'Chani / Algor',
    6:'Hawk / Toadrot',    7:'Boris / Ven',       8:'Mophus / Mantia',
    9:'Leif / Gnatu',     10:'Wu Tse / Slogar',  11:'Alex / Sting',
    12:'Linflas / Skelar', 13:'Azizi / Deth',    14:'Iaido / Necro',
    15:'Gando / Plague',  16:'Stamm / Tunda',    17:'Leyla / Lana',
    18:'Tiggy / Buzzzz',  19:'Sonja / Petal',    20:'Nabi / Itza',
    21:'Gothmog / Tula',  22:'Wuuf / Kazai',     23:'Daroou / Lor',
  },

  // ─── COMPLETE MAGIC SYSTEM ──────────────────────────────────────────────────
  // Dungeon Master uses a rune-combination system. Spells are formed by
  // selecting 1–4 rune symbols from a grid displayed in the UI.
  // The grid is 4 rows × 6 columns = 24 rune symbols.
  //
  // Symbol indices (0-based, left-to-right, top-to-bottom in the UI grid):
  // These ordinals must match the original Atari spell IDs encoded in I560.
  //   Row 0 (Power):         0=LO  1=UM  2=ON   3=EE   4=PAL  5=MON
  //   Row 1:                 6=YA  7=VI  8=OH   9=FUL 10=DES 11=ZO
  //   Row 2:                12=VEN 13=EW 14=KATH 15=IR 16=BRO 17=GOR
  //   Row 3:                18=KU 19=ROS 20=DAIN 21=NETA 22=RA 23=SAR
  //
  // The first rune chosen determines the power level (row 0).
  // Subsequent runes define the spell type and shape.
  // Mana cost = power_level × base_cost_of_spell.

  runeSymbols: [
    // Row 0 – Power (determines spell strength and mana cost multiplier)
    { id:0,  symbol:'LO',   row:'power',    manaFactor: 8, uiPos:[0,0] },
    { id:1,  symbol:'UM',   row:'power',    manaFactor:12, uiPos:[0,1] },
    { id:2,  symbol:'ON',   row:'power',    manaFactor:16, uiPos:[0,2] },
    { id:3,  symbol:'EE',   row:'power',    manaFactor:20, uiPos:[0,3] },
    { id:4,  symbol:'PAL',  row:'power',    manaFactor:24, uiPos:[0,4] },
    { id:5,  symbol:'MON',  row:'power',    manaFactor:28, uiPos:[0,5] },
    // Row 1 after power
    { id:6,  symbol:'YA',   row:'element1', uiPos:[1,0] },
    { id:7,  symbol:'VI',   row:'element1', uiPos:[1,1] },
    { id:8,  symbol:'OH',   row:'element1', uiPos:[1,2] },
    { id:9,  symbol:'FUL',  row:'element1', uiPos:[1,3] },
    { id:10, symbol:'DES',  row:'element1', uiPos:[1,4] },
    { id:11, symbol:'ZO',   row:'element1', uiPos:[1,5] },
    // Row 2 after power
    { id:12, symbol:'VEN',  row:'form',     uiPos:[2,0] },
    { id:13, symbol:'EW',   row:'form',     uiPos:[2,1] },
    { id:14, symbol:'KATH', row:'form',     uiPos:[2,2] },
    { id:15, symbol:'IR',   row:'form',     uiPos:[2,3] },
    { id:16, symbol:'BRO',  row:'form',     uiPos:[2,4] },
    { id:17, symbol:'GOR',  row:'form',     uiPos:[2,5] },
    // Row 3 after power
    { id:18, symbol:'KU',   row:'alignment',uiPos:[3,0] },
    { id:19, symbol:'ROS',  row:'alignment',uiPos:[3,1] },
    { id:20, symbol:'DAIN', row:'alignment',uiPos:[3,2] },
    { id:21, symbol:'NETA', row:'alignment',uiPos:[3,3] },
    { id:22, symbol:'RA',   row:'alignment',uiPos:[3,4] },
    { id:23, symbol:'SAR',  row:'alignment',uiPos:[3,5] },
  ],

  // Complete spell list.
  // runes: array of symbol IDs (first = power rune from row 0, then additional runes).
  // manaBase: original base difficulty from the canonical Atari spell descriptors.
  // Actual runtime mana cost = floor(manaBase * manaFactor / 8).
  // skill: which champion skill improves this spell's effectiveness.
  // This catalog mirrors the 25 original Atari spell descriptors; no speculative heal spells.
  spells: [
    // ── LIGHT & UTILITY ─────────────────────────────────────────────────────
    { name:'Torch',                runes:[9],               runeStr:'FUL',
      effect:'Creates a magic torch in hand',
      skill:'Wizard', manaBase:1,
      note:'Confirmed in dungeon text: "INVOKE FUL FOR A MAGIC TORCH"' },

    { name:'Darkness',             runes:[10,15,23],        runeStr:'DES IR SAR',
      effect:'Extinguishes all light sources nearby',
      skill:'Priest', manaBase:1 },

    { name:'Light',                runes:[8,15,22],         runeStr:'OH IR RA',
      effect:'Creates a powerful sustained light',
      skill:'Wizard', manaBase:4,
      note:'Confirmed: "LIGHT / OH IR RA"' },

    { name:'See Through Walls',    runes:[8,13,22],         runeStr:'OH EW RA',
      effect:'Lets the party see through walls while keeping them solid',
      skill:'Wizard', manaBase:3,
      note:'Confirmed: "OH EW RA BESTOWS MAGIC VISION"' },

    { name:'Invisibility',         runes:[8,13,23],         runeStr:'OH EW SAR',
      effect:'Makes the party invisible to monsters',
      skill:'Wizard', manaBase:3,
      note:'Confirmed: "INVISIBILITY / OH EW SAR"' },

    // ── FIRE & OFFENSIVE ────────────────────────────────────────────────────
    { name:'Fireball',             runes:[9,15],            runeStr:'FUL IR',
      effect:'Launches a fireball projectile',
      skill:'Wizard', manaBase:3,
      note:'Confirmed: "FIREBALL / FUL IR"' },

    { name:'Fire Shield',          runes:[9,16,21],         runeStr:'FUL BRO NETA',
      effect:'Surrounds the party with a protective fire shield',
      skill:'Priest', manaBase:4,
      note:'Confirmed: "FIRE SHIELD / FUL BRO NETA"' },

    { name:'Lightning Bolt',       runes:[8,14,22],         runeStr:'OH KATH RA',
      effect:'Launches a lightning bolt',
      skill:'Wizard', manaBase:4,
      note:'Confirmed: "LIGHTNING BOLT / OH KATH RA"' },

    // ── POISON & STATUS ─────────────────────────────────────────────────────
    { name:'Poison Cloud',         runes:[8,12],            runeStr:'OH VEN',
      effect:'Casts a cloud of poison in front of party',
      skill:'Wizard', manaBase:3,
      note:'Confirmed: "OH VEN CAST A CLOUD OF POISON"' },

    { name:'Poison Bolt',          runes:[10,12],           runeStr:'DES VEN',
      effect:'Conjures a poison bolt projectile',
      skill:'Wizard', manaBase:1,
      note:'Confirmed: "DES VEN WILL CONJURE A POISON SPELL"' },

    { name:'Magic Footprints',     runes:[6,16,19],         runeStr:'YA BRO ROS',
      effect:'Creates glowing footprints to mark your path',
      skill:'Wizard', manaBase:1,
      note:'Confirmed: "YA BRO ROS LEAVES A TRAIL OF MAGIC FOOTPRINTS"' },

    // ── DOORS & ENVIRONMENT ─────────────────────────────────────────────────
    { name:'Open Door',            runes:[11],              runeStr:'ZO',
      effect:'Opens certain locked doors',
      skill:'Wizard', manaBase:1,
      note:'Confirmed: "SOME DOORS CAN BE OPENED WITH A ZO SPELL"' },

    // ── HEALING & SUPPORT ───────────────────────────────────────────────────
    { name:'Weaken Nonmaterial Beings', runes:[10,13],      runeStr:'DES EW',
      effect:'Launches a magical projectile effective against nonmaterial beings',
      skill:'Wizard', manaBase:1,
      note:'Confirmed: "THE SPELL DES EW WEAKENS NONMATERIAL BEINGS"' },

    // ── POTIONS (cast into flask) ───────────────────────────────────────────
    // Cast these with an empty flask in the other hand to create potions
    { name:'Vi Potion',            runes:[7],               runeStr:'VI',
      effect:'Creates a Vi potion (cast into empty flask)',
      skill:'Priest', manaBase:1,
      note:'Confirmed: "CASTING VI / INTO A FLASK CREATES A SERUM THAT HEALS WOUNDS"' },

    { name:'Antivenin',            runes:[7,16],            runeStr:'VI BRO',
      effect:'Creates an antivenin potion (cast into empty flask)',
      skill:'Priest', manaBase:1,
      note:'Confirmed: "CASTING VI BRO INTO A FLASK CREATES A SERUM FOR CURING POISON"' },

    { name:'Ya Potion',            runes:[6],               runeStr:'YA',
      effect:'Creates a Ya potion (cast into empty flask)',
      skill:'Priest', manaBase:2,
      note:'Confirmed: "YA WILL CREATE A STAMINA POTION"' },

    { name:'Mon Potion',           runes:[6,16],            runeStr:'YA BRO',
      effect:'Creates a Mon potion (cast into empty flask)',
      skill:'Priest', manaBase:2,
      note:'Confirmed: "SHIELD POTION / YA BRO" and "YA BRO CREATES A MAGICAL SHIELD POTION"' },

    { name:'Ee Potion',            runes:[11,16,22],        runeStr:'ZO BRO RA',
      effect:'Creates an Ee potion (cast into empty flask)',
      skill:'Priest', manaBase:3,
      note:'Confirmed: "ZO BRO RA CREATES A PURE MANA POTION"' },

    { name:'Ven Potion',           runes:[11,12],           runeStr:'ZO VEN',
      effect:'Creates a Ven potion (cast into empty flask)',
      skill:'Wizard', manaBase:2 },

    // ── SKILL BOOST POTIONS ─────────────────────────────────────────────────
    // "FOUR POTIONS FOR BOOSTING SKILLS / FUL BRO KU / OH BRO ROS / YA BRO DAIN / YA BRO NETA"
    { name:'Ku Potion',            runes:[9,16,18],         runeStr:'FUL BRO KU',
      effect:'Creates a Ku potion (cast into empty flask)',
      skill:'Priest', manaBase:4,
      note:'Confirmed in dungeon text' },

    { name:'Ros Potion',           runes:[8,16,19],         runeStr:'OH BRO ROS',
      effect:'Creates a Ros potion (cast into empty flask)',
      skill:'Priest', manaBase:4,
      note:'Confirmed in dungeon text' },

    { name:'Dane Potion',          runes:[6,16,20],         runeStr:'YA BRO DAIN',
      effect:'Creates a Dane potion (cast into empty flask)',
      skill:'Priest', manaBase:4,
      note:'Confirmed in dungeon text' },

    { name:'Neta Potion',          runes:[6,16,21],         runeStr:'YA BRO NETA',
      effect:'Creates a Neta potion (cast into empty flask)',
      skill:'Priest', manaBase:4,
      note:'Confirmed in dungeon text' },

    { name:'Party Shield',         runes:[6,15],            runeStr:'YA IR',
      effect:'Surrounds party with a defensive magical shield',
      skill:'Priest', manaBase:2,
      note:'Confirmed: "MAGIC SHIELD / YA IR"' },

    // ── SPECIAL ─────────────────────────────────────────────────────────────
    { name:'Zokathra',             runes:[11,14,22],        runeStr:'ZO KATH RA',
      effect:'Creates a plasma bolt that can melt certain magical barriers (needed for Gem)',
      skill:'Wizard', manaBase:0,
      note:'Confirmed: "ZOKATHRA MIGHT CREATE A PLASMA THAT COULD BURN THROUGH THE AMALGAM"' },
  ],

  // Mana cost formula: totalMana = floor(spell.manaBase * powerRune.manaFactor / 8)
  // e.g. Fireball (manaBase:3) with PAL (manaFactor:24) costs 9 mana
  // A champion needs the corresponding skill to cast effectively.
  // Any champion CAN attempt any spell but needs the skill for best effect.
  spellCastingRules: {
    castingOrder: 'Power rune first, then 1-3 additional runes in the exact spell order',
    maxRunes: 4,
    failureIfNoMana: true,
    skillEffect: 'Higher skill level increases damage/duration/effect and reduces mana waste',
    classBonus: {
      Fighter: 'Bonus to YA-based spells and physical enhancement potions',
      Ninja:   'Bonus to thrown-projectile spells and stealth magic',
      Priest:  'Bonus to OH-based healing, VI potions, and ZO utility',
      Wizard:  'Bonus to FUL fire, DES darkness, and complex multi-rune spells',
    },
  },
};

// ─── OUTPUT ───────────────────────────────────────────────────────────────────

if (atariI559Stats || atariI560Stats || atariI561Stats || atariI562Stats || weaponAttackReference) {
  GAME_DB.originalAtari = {
    provenance: 'Canonical extracted Atari reference payloads. These fields preserve source-truth descriptors and formulas, not necessarily the remake runtime interpretation layer.',
    i559: atariI559Stats ? {
      foodValues: atariI559Stats.foodValues,
      miscWeightsKg: atariI559Stats.miscWeightsKg,
      creatures: atariI559Stats.creatures,
      weapons: atariI559Stats.weapons,
      cloths: atariI559Stats.cloths,
      objectInfo: atariI559Stats.objectInfo,
      doorInfo: atariI559Decoded?.doorCharacteristics ?? null,
    } : null,
    i560: atariI560Stats ? {
      attacks: atariI560Stats.attacks,
      legalAttackClasses: atariI560Stats.legalAttackClasses,
      spells: atariI560Stats.spells,
    } : null,
    i561: atariI561Stats ? {
      moveButtons18496: atariI561Stats.moveButtons18496,
      dropAreas: atariI561Stats.dropAreas,
      directionalDeltaX: atariI561Stats.directionalDeltaX,
      directionalDeltaY: atariI561Stats.directionalDeltaY,
      keyTranslationGroups: atariI561Stats.keyTranslationGroups,
      buttonGroups: atariI561Stats.buttonGroups,
    } : null,
    i562: atariI562Stats ? {
      woundDefenseFactors: atariI562Stats.woundDefenseFactors,
      underscoreCharacterString: atariI562Stats.underscoreCharacterString,
      renameChampionInputCharacterString: atariI562Stats.renameChampionInputCharacterString,
      reincarnateSpecialCharacters: atariI562Stats.reincarnateSpecialCharacters,
      dropOrder: atariI562Stats.dropOrder,
      carryLocationMasks: atariI562Stats.carryLocationMasks,
      defaultGraphicList: atariI562Stats.defaultGraphicList,
      specialChars: atariI562Stats.specialChars,
      sounds: atariI562Stats.sounds,
      iconDisplay: atariI562Stats.iconDisplay,
      paletteBrightness: atariI562Stats.paletteBrightness,
      identityColorMap: atariI562Stats.identityColorMap,
    } : null,
    weaponAttackReference: weaponAttackReference?.weapons?.map((entry) => ({
      ...entry,
      provenance: normalizeWeaponReferenceProvenance(entry.provenance),
    })) ?? null,
  };
}

const dungeon = {
  meta: {
    source: {
      file: 'EUDATA/DUNGEON.DAT',
      format: loadedDungeon.format,
      extractor: 'assets/OriginalDataExtraction/parse_full.js',
    },
    compression: loadedDungeon.compression,
    fileLength: data.length,
    hasChecksum: HAS_CHECKSUM,
    checksumWord: CHECKSUM_WORD,
    computedChecksum: COMPUTED_CHECKSUM,
    checksumValid: CHECKSUM_VALID,
    dungeonId,
    numMaps,
    mapDataSize,
    textDataWordCount: textWords,
    objectListWordCount: objListWords,
    sectionOffsets: {
      mapDefs: OFF_MAP_DEFS,
      columnIndex: OFF_COL_IDX,
      objectList: OFF_OBJ_LIST,
      textData: OFF_TEXT_DATA,
      doors: OFF_DOORS,
      teleporters: OFF_TELE,
      texts: OFF_TEXTS,
      sensors: OFF_SENSORS,
      creatures: OFF_CREATURES,
      weapons: OFF_WEAPONS,
      armor: OFF_ARMOR,
      scrolls: OFF_SCROLLS,
      potions: OFF_POTIONS,
      containers: OFF_CONTAINERS,
      misc: OFF_MISC,
      projectiles: OFF_PROJECTILES,
      clouds: OFF_CLOUDS,
      mapData: OFF_MAP_DATA,
    },
    sectionSizes: {
      projectiles: PROJECTILE_SECTION_BYTES,
      clouds: CLOUD_SECTION_BYTES,
    },
    objectPoolLayout: {
      doors: { offset: OFF_DOORS, recordSize: 4, count: NUM_DOORS, byteLength: NUM_DOORS * 4 },
      teleporters: { offset: OFF_TELE, recordSize: 6, count: NUM_TELE, byteLength: NUM_TELE * 6 },
      wallTexts: { offset: OFF_TEXTS, recordSize: 4, count: NUM_TEXTS, byteLength: NUM_TEXTS * 4 },
      sensors: { offset: OFF_SENSORS, recordSize: 8, count: NUM_SENSORS, byteLength: NUM_SENSORS * 8 },
      creatures: { offset: OFF_CREATURES, recordSize: 16, count: NUM_CREATURES, byteLength: NUM_CREATURES * 16 },
      weapons: { offset: OFF_WEAPONS, recordSize: 4, count: NUM_WEAPONS, byteLength: NUM_WEAPONS * 4 },
      armor: { offset: OFF_ARMOR, recordSize: 4, count: NUM_ARMOR, byteLength: NUM_ARMOR * 4 },
      scrolls: { offset: OFF_SCROLLS, recordSize: 4, count: NUM_SCROLLS, byteLength: NUM_SCROLLS * 4 },
      potions: { offset: OFF_POTIONS, recordSize: 4, count: NUM_POTIONS, byteLength: NUM_POTIONS * 4 },
      containers: { offset: OFF_CONTAINERS, recordSize: 8, count: NUM_CONTAINERS, byteLength: NUM_CONTAINERS * 8 },
      misc: { offset: OFF_MISC, recordSize: 4, count: NUM_MISC, byteLength: NUM_MISC * 4 },
      projectiles: { offset: OFF_PROJECTILES, recordSize: 8, count: projectiles.length, byteLength: PROJECTILE_SECTION_BYTES },
      clouds: { offset: OFF_CLOUDS, recordSize: 4, count: clouds.length, byteLength: CLOUD_SECTION_BYTES },
    },
    sectionPresence: {
      projectileSectionStored: PROJECTILE_SECTION_BYTES > 0,
      cloudSectionStored: CLOUD_SECTION_BYTES > 0,
      projectileRecordsParsed: projectiles.length,
      cloudRecordsParsed: clouds.length,
      note: (PROJECTILE_SECTION_BYTES === 0 && CLOUD_SECTION_BYTES === 0)
        ? 'This PC DOS DUNGEON.DAT stores no persistent projectile/cloud records between misc data and raw map data.'
        : 'Projectile/cloud bytes are present between misc data and raw map data.',
    },
    objectCounts: {
      doors: NUM_DOORS, teleporters: NUM_TELE, wallTexts: NUM_TEXTS,
      sensors: NUM_SENSORS, creatures: NUM_CREATURES, weapons: NUM_WEAPONS,
      armor: NUM_ARMOR, scrolls: NUM_SCROLLS, potions: NUM_POTIONS,
      containers: NUM_CONTAINERS, misc: NUM_MISC,
      projectiles: projectiles.length,
      clouds: clouds.length,
    },
    extractionCoverage: {
      coordinates: 'complete',
      mapDefinitions: 'complete from DUNGEON.DAT',
      tileGrid: 'complete from DUNGEON.DAT',
      objectPools: 'complete from DUNGEON.DAT',
      objectInfoFromGraphicsDat: atariI559Stats?.objectInfo ? 'available via GAME_DB.originalAtari.i559.objectInfo reference extract' : 'missing',
      weaponInfoFromGraphicsDat: atariI559Stats?.weapons ? 'available via GAME_DB.originalAtari.i559.weapons reference extract' : 'missing',
      armourInfoFromGraphicsDat: atariI559Stats?.cloths ? 'available via GAME_DB.originalAtari.i559.cloths reference extract' : 'missing',
      doorInfoFromGraphicsDat: atariI559Decoded?.doorCharacteristics ? 'available via GAME_DB.originalAtari.i559.doorInfo reference extract' : 'missing',
      namesAndStatsInGameDb: 'reference export without invented placeholders; prefer dungeon.json + originalAtari for source-truth',
    },
  },
  rawIndexTables: {
    columnIndexWords: colIndex,
    objectListWords: objectListWordValues,
  },
  startPosition: {
    map: 0, x: startPosWord & 0x1F,
    y: (startPosWord >> 5) & 0x1F,
    direction: DIRS[(startPosWord >> 10) & 0x03],
  },
  champions,
  objectDatabase,
  projectileDatabase: projectiles,
  cloudDatabase: clouds,
  maps,
};

const MAP_RUNTIME_KEYS = new Set([
  'index',
  'name',
  'level',
  'width',
  'height',
  'difficulty',
  'mapOffset',
  'tiles',
]);

const TILE_RUNTIME_KEYS = new Set([
  'x',
  'y',
  'type',
  'orientation',
  'open',
  'visible',
  'objects',
]);

const OBJECT_RUNTIME_KEYS = new Set([
  'category',
  'index',
  'tilePos',
  'type',
  'power',
  'name',
  'text',
  'visible',
  'hp',
  'sound',
  'destX',
  'destY',
  'destMap',
  'data',
  'isLocal',
  'delay',
  'revert',
  'action',
  'onceOnly',
  'multipleValue',
  'kineticEnergy',
  'stepEnergy',
  'targetY',
  'targetX',
  'targetDir',
  'requiredObjectName',
  'destructChop',
  'destructFire',
  'hasButton',
  'doorType',
]);
const MAP_RUNTIME_SUMMARY_KEYS = new Set(
  Array.from(MAP_RUNTIME_KEYS).filter((key) => key !== 'tiles'),
);

function pickKeys(source, allowedKeys) {
  const result = {};
  for (const key of allowedKeys) {
    if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}

function compactRuntimeChampion(champion) {
  return {
    portraitId: champion.portraitId,
    name: champion.name,
    title: champion.title,
    gender: champion.gender,
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
    skills: champion.skills,
    x: champion.x,
    y: champion.y,
    wallFace: champion.wallFace,
    map: champion.map ?? champion.mapIndex ?? 0,
  };
}

function compactRuntimeMap(map) {
  return {
    ...pickKeys(map, MAP_RUNTIME_KEYS),
    tiles: (map.tiles ?? []).map((tile) => ({
      ...pickKeys(tile, TILE_RUNTIME_KEYS),
      objects: (tile.objects ?? []).map((object) => pickKeys(object, OBJECT_RUNTIME_KEYS)),
    })),
  };
}

function buildRuntimeDungeonBootstrap(fullDungeon) {
  const defaultOpenPits = [];
  const defaultOpenTeleporters = [];
  const defaultVisibleTexts = [];

  for (const map of fullDungeon.maps ?? []) {
    for (const tile of map.tiles ?? []) {
      if (tile.type === 'Pit' && tile.open) {
        defaultOpenPits.push(`${map.index},${tile.y},${tile.x}`);
      }
      if (tile.type === 'Teleporter' && tile.open) {
        defaultOpenTeleporters.push(`${map.index},${tile.y},${tile.x}`);
      }
      for (const object of tile.objects ?? []) {
        if (object.category === 'Text' && object.visible) {
          defaultVisibleTexts.push(`${map.index}_${tile.x}_${tile.y}_${object.index}`);
        }
      }
    }
  }

  return {
    startPosition: fullDungeon.startPosition,
    champions: (fullDungeon.champions ?? []).map(compactRuntimeChampion),
    defaultOpenPits,
    defaultOpenTeleporters,
    defaultVisibleTexts,
    maps: (fullDungeon.maps ?? []).map((map) => ({
      ...pickKeys(map, MAP_RUNTIME_SUMMARY_KEYS),
      file: `maps/${buildRuntimeDungeonMapFileName(map.index)}`,
    })),
  };
}

function compactRuntimeDungeon(fullDungeon) {
  return {
    startPosition: fullDungeon.startPosition,
    champions: (fullDungeon.champions ?? []).map(compactRuntimeChampion),
    maps: (fullDungeon.maps ?? []).map(compactRuntimeMap),
  };
}

function buildRuntimeTeleporterReference(fullDungeon) {
  const runtimeTeleporters = [];
  for (const map of fullDungeon.maps ?? []) {
    for (const tile of map.tiles ?? []) {
      for (const object of tile.objects ?? []) {
        if (object.category !== 'Teleporter') continue;
        runtimeTeleporters.push({
          mapIndex: map.index,
          x: tile.x,
          y: tile.y,
          index: object.index,
          rotationType: object.rotationType,
          rotation: object.rotation,
          destMap: object.destMap,
          destX: object.destX,
          destY: object.destY,
        });
      }
    }
  }
  return runtimeTeleporters;
}

function buildRuntimeItemsGameDb(fullGameDb) {
  return {
    itemTypeNames: fullGameDb.itemTypeNames ?? null,
    weaponAttackReference: (fullGameDb.originalAtari?.weaponAttackReference ?? fullGameDb.weaponAttackReference ?? []).map((entry) => ({
      weaponIndex: entry.weaponIndex,
      allowedSlotsMask: entry.allowedSlotsMask,
      allowedSlots: entry.allowedSlots ?? null,
    })),
    originalAtari: {
      i559: {
        weapons: fullGameDb.originalAtari?.i559?.weapons ?? [],
        cloths: fullGameDb.originalAtari?.i559?.cloths ?? [],
        miscWeightsKg: fullGameDb.originalAtari?.i559?.miscWeightsKg ?? [],
        foodValues: fullGameDb.originalAtari?.i559?.foodValues ?? [],
        objectInfo: fullGameDb.originalAtari?.i559?.objectInfo ?? [],
      },
      i562: {
        woundDefenseFactors: fullGameDb.originalAtari?.i562?.woundDefenseFactors ?? [],
      },
    },
  };
}

function buildRuntimeWeaponAttacksGameDb(fullGameDb) {
  return {
    originalAtari: {
      i560: {
        attacks: fullGameDb.originalAtari?.i560?.attacks ?? [],
        legalAttackClasses: fullGameDb.originalAtari?.i560?.legalAttackClasses ?? [],
      },
      weaponAttackReference: fullGameDb.originalAtari?.weaponAttackReference ?? [],
    },
  };
}

function buildRuntimeCreaturesGameDb(fullGameDb) {
  return {
    originalAtari: {
      i559: {
        creatures: fullGameDb.originalAtari?.i559?.creatures ?? [],
      },
    },
  };
}

const runtimeDungeonBootstrap = buildRuntimeDungeonBootstrap(dungeon);
const runtimeDungeon = compactRuntimeDungeon(dungeon);
const runtimeTeleporterReference = buildRuntimeTeleporterReference(dungeon);
const runtimeItemsGameDb = buildRuntimeItemsGameDb(GAME_DB);
const runtimeWeaponAttacksGameDb = buildRuntimeWeaponAttacksGameDb(GAME_DB);
const runtimeCreaturesGameDb = buildRuntimeCreaturesGameDb(GAME_DB);
const extractionReferenceFiles = listExtractionReferenceFiles();
const runtimeReferenceFiles = listRuntimeReferenceFiles();
const supportAssetFiles = listSupportAssetFiles();

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(RUNTIME_ROOT_DIR, { recursive: true });
fs.mkdirSync(RUNTIME_DUNGEON_DIR, { recursive: true });
fs.mkdirSync(RUNTIME_DUNGEON_MAPS_DIR, { recursive: true });
fs.mkdirSync(RUNTIME_DB_DIR, { recursive: true });
fs.mkdirSync(RUNTIME_REFERENCE_DIR, { recursive: true });
fs.mkdirSync(RUNTIME_SUPPORT_DIR, { recursive: true });
fs.mkdirSync(RUNTIME_WALL_OVERLAY_MAPS_DIR, { recursive: true });
cleanupRuntimeDirectoryEntries(RUNTIME_DUNGEON_DIR, new Set(['bootstrap.json', 'maps']));
cleanupRuntimeDirectoryEntries(
  RUNTIME_DUNGEON_MAPS_DIR,
  new Set((runtimeDungeonBootstrap.maps ?? []).map((map) => buildRuntimeDungeonMapFileName(map.index))),
);
cleanupRuntimeDirectoryEntries(
  RUNTIME_DB_DIR,
  new Set([
    'game_db.json',
    'game_db_items.json',
    'game_db_weapon_attacks.json',
    'game_db_creatures.json',
  ]),
);
cleanupRuntimeDirectoryEntries(RUNTIME_REFERENCE_DIR, new Set(runtimeReferenceFiles));
cleanupRuntimeDirectoryEntries(RUNTIME_SUPPORT_DIR, new Set(['original_wall_overlay_positions.json', 'wall_overlays']));
fs.writeFileSync(path.join(OUTPUT_DIR, 'dungeon.json'), JSON.stringify(dungeon, null, 2));
fs.writeFileSync(path.join(OUTPUT_DIR, 'runtime_dungeon.json'), JSON.stringify(runtimeDungeon, null, 2));
fs.writeFileSync(
  path.join(OUTPUT_DIR, 'runtime_dungeon_bootstrap.json'),
  JSON.stringify(runtimeDungeonBootstrap, null, 2),
);
fs.writeFileSync(path.join(OUTPUT_DIR, 'game_db.json'), JSON.stringify(GAME_DB, null, 2));
fs.writeFileSync(
  RUNTIME_DUNGEON_BOOTSTRAP_FILE,
  JSON.stringify(runtimeDungeonBootstrap, null, 2),
);
for (const map of runtimeDungeon.maps ?? []) {
  fs.writeFileSync(buildRuntimeDungeonMapFile(map.index), JSON.stringify(map, null, 2));
}
fs.writeFileSync(RUNTIME_GAME_DB_FILE, JSON.stringify(GAME_DB, null, 2));
fs.writeFileSync(RUNTIME_GAME_DB_ITEMS_FILE, JSON.stringify(runtimeItemsGameDb, null, 2));
fs.writeFileSync(RUNTIME_GAME_DB_WEAPON_ATTACKS_FILE, JSON.stringify(runtimeWeaponAttacksGameDb, null, 2));
fs.writeFileSync(RUNTIME_GAME_DB_CREATURES_FILE, JSON.stringify(runtimeCreaturesGameDb, null, 2));

execFileSync(process.execPath, ['export_mechanisms.cjs'], {
  cwd: __dirname,
  stdio: 'inherit',
});
for (const fileName of extractionReferenceFiles) {
  const referencePath = fs.existsSync(path.join(REFERENCE_EXPORTS_DIR, fileName))
    ? path.join(REFERENCE_EXPORTS_DIR, fileName)
    : path.join(PUBLIC_DIR, fileName);
  const outputPath = path.join(OUTPUT_DIR, fileName);
  if (fs.existsSync(referencePath)) {
    fs.copyFileSync(referencePath, outputPath);
  }
}
cleanupLegacyRuntimePaths(runtimeReferenceFiles, SUPPORT_ASSET_FILES);
for (const fileName of runtimeReferenceFiles) {
  const runtimePath = path.join(RUNTIME_REFERENCE_DIR, fileName);
  if (fileName === 'original_teleporters_runtime.json') {
    fs.writeFileSync(runtimePath, JSON.stringify(runtimeTeleporterReference, null, 2));
    continue;
  }

  const publicPath = path.join(PUBLIC_DIR, fileName);
  if (fs.existsSync(publicPath)) {
    fs.copyFileSync(publicPath, runtimePath);
  }
}

const syncedSupportAssetFiles = [];
const runtimeWallOverlayMapFiles = [];
for (const fileName of supportAssetFiles) {
  const publicPath = path.join(PUBLIC_DIR, fileName);
  const runtimePath = path.join(RUNTIME_SUPPORT_DIR, fileName);
  if (fs.existsSync(publicPath)) {
    if (fileName === 'original_wall_overlay_positions.json') {
      const fullOverlayData = JSON.parse(fs.readFileSync(publicPath, 'utf8'));
      const runtimeOverlayData = buildRuntimeWallOverlaySnapshot(fullOverlayData);
      const runtimeOverlayMaps = buildRuntimeWallOverlayMapSnapshots(runtimeOverlayData);
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'runtime_wall_overlay_positions.json'),
        JSON.stringify(runtimeOverlayData, null, 2),
      );
      fs.writeFileSync(RUNTIME_WALL_OVERLAY_FILE, JSON.stringify(runtimeOverlayData, null, 2));
      cleanupRuntimeDirectoryEntries(
        RUNTIME_WALL_OVERLAY_MAPS_DIR,
        new Set(runtimeOverlayMaps.map((entry) => buildRuntimeWallOverlayMapFileName(entry.mapIndex))),
      );
      for (const entry of runtimeOverlayMaps) {
        fs.writeFileSync(buildRuntimeWallOverlayMapFile(entry.mapIndex), JSON.stringify(entry, null, 2));
        runtimeWallOverlayMapFiles.push(`support/${entry.file}`);
      }
    } else {
      fs.copyFileSync(publicPath, runtimePath);
    }
    syncedSupportAssetFiles.push(fileName);
  }
}

const runtimeManifest = {
  generatedAt: new Date().toISOString(),
  parser: 'parse_full',
  canonicalRuntimeRootDir: 'src/assets/runtime',
  canonicalRuntimeDungeonDir: 'src/assets/runtime/dungeon',
  canonicalRuntimeReferenceDir: 'src/assets/runtime/reference',
  canonicalRuntimeSupportDir: 'src/assets/runtime/support',
  canonicalReferenceExportsDir: 'assets/OriginalDataExtraction/reference_exports',
  files: {
    generatedDirectly: [
      'dungeon.json',
      'runtime_dungeon.json',
      'runtime_dungeon_bootstrap.json',
      'game_db.json',
    ],
    generatedReferenceOnly: [
      'mechanisms.json',
    ],
    runtimePackage: {
      dungeonBootstrap: 'src/assets/runtime/dungeon/bootstrap.json',
      dungeonMapsDir: 'src/assets/runtime/dungeon/maps',
      dungeonMapFiles: (runtimeDungeonBootstrap.maps ?? []).map((map) => map.file),
      gameDb: 'src/assets/runtime/db/game_db.json',
      gameDbItems: 'src/assets/runtime/db/game_db_items.json',
      gameDbWeaponAttacks: 'src/assets/runtime/db/game_db_weapon_attacks.json',
      gameDbCreatures: 'src/assets/runtime/db/game_db_creatures.json',
      wallOverlayPositions: 'src/assets/runtime/support/original_wall_overlay_positions.json',
      wallOverlayMapsDir: 'src/assets/runtime/support/wall_overlays',
      wallOverlayMapFiles: runtimeWallOverlayMapFiles,
      runtimeManifest: 'src/assets/runtime/runtime_data_manifest.json',
    },
    syncedExtractionReferences: extractionReferenceFiles,
    syncedRuntimeReferences: runtimeReferenceFiles,
    syncedSupportAssets: syncedSupportAssetFiles,
  },
};

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'runtime_data_manifest.json'),
  JSON.stringify(runtimeManifest, null, 2),
);
fs.writeFileSync(RUNTIME_MANIFEST_FILE, JSON.stringify(runtimeManifest, null, 2));

// ─── STATS ────────────────────────────────────────────────────────────────────
let totalObjects = 0, totalCreatures = 0, totalItems = 0, totalTexts = 0;
for (const map of maps) {
  for (const tile of map.tiles) {
    totalObjects += tile.objects.length;
    for (const obj of tile.objects) {
      if (obj.category === 'Creature') totalCreatures++;
      else if (['Weapon','Armor','Scroll','Potion','Container','Misc'].includes(obj.category)) totalItems++;
      else if (obj.category === 'Text' && obj.text) totalTexts++;
    }
  }
}

console.log('✓ output/dungeon.json written');
console.log('✓ output/runtime_dungeon.json written');
console.log('✓ output/game_db.json written');
console.log('✓ output/mechanisms.json written');
console.log('✓ output/runtime_data_manifest.json written');
console.log('✓ output/runtime_dungeon_bootstrap.json written');
console.log('✓ src/assets/runtime/dungeon/bootstrap.json written');
console.log(`✓ src/assets/runtime/dungeon/maps split files written (${runtimeDungeon.maps.length})`);
console.log('✓ src/assets/runtime/db/game_db.json written');
console.log('✓ src/assets/runtime/db/game_db_items.json written');
console.log('✓ src/assets/runtime/db/game_db_weapon_attacks.json written');
console.log('✓ src/assets/runtime/db/game_db_creatures.json written');
console.log(`✓ src/assets/runtime/support/wall_overlays split files written (${runtimeWallOverlayMapFiles.length})`);
console.log(`✓ src/assets/runtime/reference files synced (${runtimeReferenceFiles.length})`);
console.log(`✓ src/assets/runtime/support files synced (${syncedSupportAssetFiles.length})`);
console.log();
console.log('  Maps:         ', numMaps);
console.log('  Champions:    ', champions.length,
  champions.filter(c=>c.name).map(c=>c.name).join(', '));
console.log('  Creatures:    ', totalCreatures, `(instances in dungeon)`);
console.log('  Items:        ', totalItems);
console.log('  Texts decoded:', totalTexts);
console.log('  Scrolls:      ', NUM_SCROLLS);
console.log();

// Print champion stats
if (champions.length) {
  console.log('── Champions ──');
  for (const c of champions) {
    if (c.name) {
      console.log(`  [${c.portraitId}] ${c.name} – ${c.title ?? ''}`);
      if (c.health) console.log(`      HP:${c.health} STM:${c.stamina} MANA:${c.mana} STR:${c.strength} DEX:${c.dexterity} WIS:${c.wisdom} VIT:${c.vitality}`);
    }
  }
  console.log();
}

// Print first few scrolls
console.log('── Scroll texts (sample) ──');
for (const s of scrolls.slice(0, 5)) {
  if (s.text) console.log(`  Scroll: "${s.text.replace(/\n/g,' / ')}"`);
}


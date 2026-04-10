/**
 * analyze_fires_exe.cjs
 *
 * Scans FIRES_decompressed.bin (167,584 bytes) for:
 *   - Printable ASCII string tables
 *   - Potential gameplay constant blocks (repeated patterns, structured arrays)
 *   - Any data that does NOT appear in DUNGEON.DAT or the Atari GRAPHICS.DAT tables
 *
 * FIRES.EXE is the PC DOS executable for Dungeon Master, compressed with LZEXE v0.91.
 * The decompressed image starts with a standard MZ DOS EXE header, followed by the
 * code and data segments.
 *
 * Output:
 *   output/fires_exe_analysis.json
 *   output/fires_exe_strings.txt  (human-readable string dump)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const FIRES_BIN  = path.join(__dirname, 'generated/decompressed/FIRES_decompressed.bin');
const OUTPUT_DIR = path.join(__dirname, 'output');
const OUT_JSON   = path.join(OUTPUT_DIR, 'fires_exe_analysis.json');
const OUT_TXT    = path.join(OUTPUT_DIR, 'fires_exe_strings.txt');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract all printable ASCII runs of at least minLen characters */
function extractStrings(buf, minLen = 5) {
  const results = [];
  let start = -1;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    const printable = (b >= 0x20 && b <= 0x7E) || b === 0x09 || b === 0x0A || b === 0x0D;
    if (printable) {
      if (start === -1) start = i;
    } else {
      if (start !== -1 && (i - start) >= minLen) {
        results.push({ offset: start, length: i - start, text: buf.toString('ascii', start, i) });
      }
      start = -1;
    }
  }
  if (start !== -1 && (buf.length - start) >= minLen) {
    results.push({ offset: start, length: buf.length - start, text: buf.toString('ascii', start) });
  }
  return results;
}

/** Read a little-endian uint16 */
function readU16(buf, off) { return buf.readUInt16LE(off); }

/** Read a little-endian uint32 */
function readU32(buf, off) { return buf.readUInt32LE(off); }

/** Hex string helper */
function hex(n, width = 4) { return '0x' + n.toString(16).toUpperCase().padStart(width, '0'); }

/** Scan for a specific byte pattern and return all offsets */
function findPattern(buf, pattern) {
  const hits = [];
  const len = pattern.length;
  outer: for (let i = 0; i <= buf.length - len; i++) {
    for (let j = 0; j < len; j++) {
      if (pattern[j] !== null && buf[i + j] !== pattern[j]) continue outer;
    }
    hits.push(i);
  }
  return hits;
}

/** Guess if a block looks like a structured array of fixed-size records */
function analyzeBlock(buf, offset, recordSize, count) {
  const records = [];
  for (let i = 0; i < count; i++) {
    const base = offset + i * recordSize;
    if (base + recordSize > buf.length) break;
    const bytes = [...buf.slice(base, base + recordSize)];
    records.push({ index: i, offset: hex(base, 6), bytes: bytes.map(b => b.toString(16).padStart(2, '0')).join(' ') });
  }
  return records;
}

// ---------------------------------------------------------------------------
// MZ EXE header parsing
// ---------------------------------------------------------------------------
function parseMZHeader(buf) {
  if (buf[0] !== 0x4D || buf[1] !== 0x5A) {
    return { valid: false, note: 'No MZ signature — raw decompressed image or segment dump' };
  }
  const lastPageBytes  = readU16(buf, 0x02);
  const totalPages     = readU16(buf, 0x04);
  const relocCount     = readU16(buf, 0x06);
  const headerParas    = readU16(buf, 0x08);
  const minAlloc       = readU16(buf, 0x0A);
  const maxAlloc       = readU16(buf, 0x0C);
  const initSS         = readU16(buf, 0x0E);
  const initSP         = readU16(buf, 0x10);
  const checksum       = readU16(buf, 0x12);
  const initIP         = readU16(buf, 0x14);
  const initCS         = readU16(buf, 0x16);
  const relocTableOff  = readU16(buf, 0x18);
  const overlayNum     = readU16(buf, 0x1A);
  const headerBytes    = headerParas * 16;
  const codeStart      = headerBytes;
  const imageSize      = totalPages * 512 - (lastPageBytes ? (512 - lastPageBytes) : 0);

  return {
    valid: true,
    signature: 'MZ',
    lastPageBytes,
    totalPages,
    relocCount,
    headerParas,
    headerBytes: hex(headerBytes),
    minAlloc,
    maxAlloc,
    initSS: hex(initSS),
    initSP: hex(initSP),
    initIP: hex(initIP),
    initCS: hex(initCS),
    relocTableOffset: hex(relocTableOff),
    overlayNumber: overlayNum,
    codeSegmentStart: hex(codeStart),
    imageSize: hex(imageSize),
  };
}

// ---------------------------------------------------------------------------
// Categorise strings by likely content
// ---------------------------------------------------------------------------
const ITEM_KEYWORDS    = /shield|sword|torch|boots|helm|armor|mail|tunic|potion|scroll|staff|axe|knife|dagger|bow|arrow|cloak|glove|ring|amulet|flask/i;
const SPELL_KEYWORDS   = /fireball|lightning|poison|dispell|open|magic|mana|stamina|spell|rune|vi|bro|ful|des|ew|kath|gor|ros|neta|dain|ku|ya|zo|oh|ir|lo|sar|chu|goh|ven|ral/i;
const CREATURE_KEYWORDS= /troll|skeleton|dragon|ant|ghost|mummy|demon|lord|chaos|knight|wizard|eye|fly|bat|rat|giant|animated|giggler|stone|couatl|oitu|pain|materializer|zytaz|deth/i;
const LEVEL_KEYWORDS   = /level|floor|dungeon|room|corridor|hall|champions|chaos|lair/i;
const CREDIT_KEYWORDS  = /ftl|games|copyright|doug bell|andy beckett|wayne holder|r\.j\.|dennis|1987|1988/i;
const ERROR_KEYWORDS   = /error|cannot|invalid|not found|failed|abort|exit/i;

function categorizeStrings(strings) {
  const categories = {
    credits:   [],
    items:     [],
    spells:    [],
    creatures: [],
    levels:    [],
    errors:    [],
    other:     [],
  };
  for (const s of strings) {
    const t = s.text;
    if (CREDIT_KEYWORDS.test(t))   categories.credits.push(s);
    else if (ITEM_KEYWORDS.test(t))    categories.items.push(s);
    else if (SPELL_KEYWORDS.test(t))   categories.spells.push(s);
    else if (CREATURE_KEYWORDS.test(t)) categories.creatures.push(s);
    else if (LEVEL_KEYWORDS.test(t))   categories.levels.push(s);
    else if (ERROR_KEYWORDS.test(t))   categories.errors.push(s);
    else categories.other.push(s);
  }
  return categories;
}

// ---------------------------------------------------------------------------
// Statistical scan: look for blocks with repeated fixed-size structure
// Common DM1 record sizes from known Atari tables:
//   Creature descriptors: 14 bytes each, 27 entries
//   Weapon descriptors:   10 bytes each, 46 entries
//   Clothing descriptors: 4 bytes each,  58 entries
//   ObjDesc:              4 bytes each, 180 entries
//   Attack descriptors:   8 bytes each,  44 entries
//   Spell descriptors:    4 bytes each,  25 entries
// ---------------------------------------------------------------------------
const KNOWN_TABLES = [
  { name: 'MonsterDescriptor[27]', recordSize: 14, count: 27,  totalBytes: 378 },
  { name: 'WeaponDesc[46]',        recordSize: 10, count: 46,  totalBytes: 460 },
  { name: 'ClothingDesc[58]',      recordSize:  4, count: 58,  totalBytes: 232 },
  { name: 'ObjDesc[180]',          recordSize:  4, count: 180, totalBytes: 720 },
  { name: 'AttackDesc[44]',        recordSize:  8, count: 44,  totalBytes: 352 },
  { name: 'SpellDesc[25]',         recordSize:  4, count: 25,  totalBytes: 100 },
  { name: 'FoodValue[8]',          recordSize:  2, count:  8,  totalBytes:  16 },
  { name: 'MiscWeights[54]',       recordSize:  1, count: 54,  totalBytes:  54 },
];

/**
 * Compare a candidate block in FIRES against the known Atari table bytes.
 * We load atari_i559_stats.json and atari_i560_stats.json to get reference values.
 */
function buildAtariReferenceBytes() {
  const i559path = path.join(__dirname, 'output/atari_i559_stats.json');
  const i560path = path.join(__dirname, 'output/atari_i560_stats.json');
  const refs = {};

  try {
    const i559 = JSON.parse(fs.readFileSync(i559path, 'utf8'));
    refs.i559 = i559;
  } catch (e) { /* skip */ }

  try {
    const i560 = JSON.parse(fs.readFileSync(i560path, 'utf8'));
    refs.i560 = i560;
  } catch (e) { /* skip */ }

  return refs;
}

// ---------------------------------------------------------------------------
// Scan for candidate block matching known Atari creature table byte signature
// The first creature (Giggler) in Atari i559 starts with known values.
// We search for a similar byte sequence in FIRES_decompressed.bin.
// ---------------------------------------------------------------------------
function scanForCreatureTable(buf, atariRefs) {
  const hits = [];

  if (!atariRefs.i559?.creatures?.length) return hits;

  // Get first few creatures' raw byte patterns from Atari
  // MonsterDescriptor fields (14 bytes):
  //   [0]   baseHP     uint8
  //   [1]   armor      uint8
  //   [2]   hitProb    uint8
  //   [3]   defense    uint8
  //   [4]   atkSpd     uint8 (ticks)
  //   [5]   moveSpd    uint8 (ticks)
  //   [6]   dexterity  uint8
  //   [7]   fireRes    uint8
  //   [8]   poisonRes  uint8
  //   [9]   viewRange  uint8
  //   [10]  smellRange uint8
  //   [11]  attackRange uint8
  //   [12-13] exp      uint16 LE
  const creatures = atariRefs.i559.creatures;
  if (creatures.length < 3) return hits;

  // Build a signature from the first 3 creature records (42 bytes total)
  // Use only values likely to be invariant across PC/Atari versions
  const c0 = creatures[0]; // Giggler
  const c1 = creatures[1]; // Trolin (AntMan)
  const c2 = creatures[2]; // Screamer

  // We use baseHP as a loose anchor (values typically 1-50 for first creatures)
  const anchor0 = c0.baseHP ?? c0.hp ?? 0;
  const anchor1 = c1.baseHP ?? c1.hp ?? 0;
  const anchor2 = c2.baseHP ?? c2.hp ?? 0;

  if (!anchor0 && !anchor1 && !anchor2) return hits;

  // Search for a sequence: [anchor0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, anchor1, ...]
  const RECORD_SIZE = 14;
  for (let i = 0; i <= buf.length - RECORD_SIZE * 3; i++) {
    if (buf[i] !== anchor0) continue;
    if (buf[i + RECORD_SIZE] !== anchor1) continue;
    if (anchor2 && buf[i + RECORD_SIZE * 2] !== anchor2) continue;
    hits.push({
      offset: hex(i, 6),
      offsetDec: i,
      note: `Candidate creature table (first 3 baseHP match: ${anchor0},${anchor1},${anchor2})`,
    });
  }

  return hits;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function run() {
  if (!fs.existsSync(FIRES_BIN)) {
    console.error('ERROR: FIRES_decompressed.bin not found at', FIRES_BIN);
    process.exit(1);
  }

  const buf = fs.readFileSync(FIRES_BIN);
  console.log(`Loaded FIRES_decompressed.bin: ${buf.length} bytes`);

  // 1. MZ Header
  console.log('\n--- MZ EXE header ---');
  const mzHeader = parseMZHeader(buf);
  console.log(JSON.stringify(mzHeader, null, 2));

  // 2. String extraction
  console.log('\n--- String scan (min length 5) ---');
  const strings = extractStrings(buf, 5);
  console.log(`Total printable string runs found: ${strings.length}`);

  const categorized = categorizeStrings(strings);
  for (const [cat, list] of Object.entries(categorized)) {
    if (list.length) console.log(`  ${cat}: ${list.length} strings`);
  }

  // 3. Atari reference
  const atariRefs = buildAtariReferenceBytes();

  // 4. Creature table scan
  console.log('\n--- Scanning for creature table ---');
  const creatureHits = scanForCreatureTable(buf, atariRefs);
  if (creatureHits.length === 0) {
    console.log('No exact creature table match found (PC DOS may use different layout or values)');
  } else {
    for (const h of creatureHits) console.log(`  Hit at ${h.offset}: ${h.note}`);
  }

  // 5. Known table size scan (look for entropy regions)
  console.log('\n--- Scanning for known table footprints ---');
  const tableSizeHits = [];
  for (const table of KNOWN_TABLES) {
    // A structured block of (count x recordSize) bytes tends to have lower
    // variance than random code. We do a simple sliding window entropy check.
    const size = table.totalBytes;
    let bestOffset = -1;
    let bestVariance = Infinity;
    // Sample every 256 bytes for performance
    for (let i = 512; i <= buf.length - size; i += 256) {
      // Compute mean and variance of the block
      let sum = 0;
      for (let j = 0; j < size; j++) sum += buf[i + j];
      const mean = sum / size;
      let vsum = 0;
      for (let j = 0; j < size; j++) { const d = buf[i + j] - mean; vsum += d * d; }
      const variance = vsum / size;
      if (variance < bestVariance) {
        bestVariance = variance;
        bestOffset = i;
      }
    }
    tableSizeHits.push({
      table: table.name,
      bestCandidateOffset: hex(bestOffset, 6),
      bestCandidateOffsetDec: bestOffset,
      variance: Math.round(bestVariance),
      note: bestVariance < 200 ? 'LOW variance - likely structured data' : 'high variance - likely code',
    });
    console.log(`  ${table.name}: best candidate at ${hex(bestOffset, 6)} (variance ${Math.round(bestVariance)})`);
  }

  // 6. Notable string samples (first 20 of each category)
  const stringReport = {};
  for (const [cat, list] of Object.entries(categorized)) {
    stringReport[cat] = list.slice(0, 20).map(s => ({
      offset: hex(s.offset, 6),
      text: s.text.slice(0, 120).replace(/[\r\n\t]/g, ' '),
    }));
  }

  // 7. Full string dump to .txt
  const lines = [
    `FIRES_decompressed.bin string dump`,
    `Generated by analyze_fires_exe.cjs`,
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    `Total strings: ${strings.length}`,
    '',
    '=== ALL STRINGS ===',
    '',
  ];
  for (const s of strings) {
    lines.push(`${hex(s.offset, 6)}  [${s.length.toString().padStart(4)}]  ${s.text.replace(/[\r\n]/g, '↵').slice(0, 200)}`);
  }
  fs.writeFileSync(OUT_TXT, lines.join('\n'), 'utf8');
  console.log(`\nString dump written to: ${OUT_TXT}`);

  // 8. JSON output
  const output = {
    _meta: {
      source: 'analyze_fires_exe.cjs',
      date: new Date().toISOString().slice(0, 10),
      inputFile: 'generated/decompressed/FIRES_decompressed.bin',
      fileSize: buf.length,
      description: 'Analysis of the decompressed FIRES.EXE PC DOS executable for Dungeon Master',
    },
    mzHeader,
    stringScanSummary: {
      total: strings.length,
      byCategory: Object.fromEntries(Object.entries(categorized).map(([k, v]) => [k, v.length])),
    },
    stringsByCategory: stringReport,
    creatureTableCandidates: creatureHits,
    knownTableSizeScan: tableSizeHits,
    notes: [
      'String categories are heuristic; overlap is possible.',
      'Creature table scan uses Atari baseHP as anchor - PC DOS values may differ slightly.',
      'Low-variance blocks may be structured data tables not covered by DUNGEON.DAT + GRAPHICS.DAT.',
      'The MZ header code segment start indicates where runnable x86 code begins; data tables typically sit after.',
      'Full string list is in fires_exe_strings.txt.',
    ],
  };

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2), 'utf8');
  console.log(`JSON analysis written to: ${OUT_JSON}`);
}

run();

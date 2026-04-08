const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const GRAPHICS_PATH = path.join(ROOT_DIR, 'EUDATA', 'GRAPHICS.DAT');
const OUTPUT_PATH = path.join(ROOT_DIR, 'output', 'graphics_analysis.json');

const OBJECT_NAME_COUNT = 199;
const OBJECT_INFO_COUNT = 180;
const OBJECT_INFO_SIZE = 6;
const OBJECT_INFO_TOTAL_BYTES = OBJECT_INFO_COUNT * OBJECT_INFO_SIZE;
const OBJECT_ALLOWED_SLOTS_MASK = 0x07ff;
const OBJECT_ASPECT_COUNT = 85;
const ACTION_SET_COUNT = 44;
const TOP_CANDIDATE_COUNT = 20;

const KNOWN_OBJECT_INFO_ENTRIES = [
  { index: 0, expected: [30, 31], label: 'scroll' },
  { index: 25, expected: [4, 5, 6, 7], label: 'torch weapon' },
  { index: 31, expected: [32], label: 'dagger' },
  { index: 50, expected: [51], label: 'arrow' },
  { index: 51, expected: [52], label: 'slayer' },
  { index: 53, expected: [54], label: 'rock' },
  { index: 54, expected: [55], label: 'poison dart' },
  { index: 55, expected: [56], label: 'throwing star' },
];

function readWordBE(buf, offset) {
  return buf.readUInt16BE(offset);
}

function readWordLE(buf, offset) {
  return buf.readUInt16LE(offset);
}

function sumWords(buf, start, count, littleEndian) {
  let sum = 0;
  const reader = littleEndian ? readWordLE : readWordBE;
  for (let i = 0; i < count; i++) {
    const offset = start + i * 2;
    if (offset + 1 >= buf.length) break;
    sum += reader(buf, offset);
  }
  return sum;
}

function parseObjectNameBlock(buf, startOffset) {
  const names = [];
  let offset = startOffset;
  for (let i = 0; i < OBJECT_NAME_COUNT; i++) {
    const end = buf.indexOf(0x00, offset);
    if (end === -1) {
      return null;
    }
    const name = buf.slice(offset, end).toString('latin1');
    if (!name || /[^\x20-\x7e]/.test(name)) {
      return null;
    }
    names.push({ index: i, name, offset });
    offset = end + 1;
  }
  return {
    startOffset,
    endOffsetExclusive: offset,
    byteLength: offset - startOffset,
    names,
  };
}

function findObjectNameBlocks(buf) {
  const seed = Buffer.from('COMPASS\x00COMPASS\x00COMPASS\x00COMPASS\x00', 'latin1');
  const candidates = [];
  let searchFrom = 0;
  while (searchFrom < buf.length) {
    const hit = buf.indexOf(seed, searchFrom);
    if (hit === -1) break;
    const parsed = parseObjectNameBlock(buf, hit);
    if (parsed) {
      candidates.push(parsed);
    }
    searchFrom = hit + 1;
  }
  return candidates;
}

function scoreObjectInfoCandidate(buf, offset, littleEndian) {
  const reader = littleEndian ? readWordLE : readWordBE;
  const entries = [];
  let score = 0;
  let invalid = 0;
  let knownMatches = 0;
  let uniqueTypes = new Set();
  let nonZeroActions = 0;

  for (let i = 0; i < OBJECT_INFO_COUNT; i++) {
    const base = offset + i * OBJECT_INFO_SIZE;
    if (base + OBJECT_INFO_SIZE > buf.length) {
      return null;
    }
    const type = reader(buf, base);
    const objectAspectIndex = buf[base + 2];
    const actionSetIndex = buf[base + 3];
    const allowedSlots = reader(buf, base + 4);

    const typeValid = type < OBJECT_NAME_COUNT;
    const aspectValid = objectAspectIndex < OBJECT_ASPECT_COUNT;
    const actionValid = actionSetIndex < ACTION_SET_COUNT;
    const slotValid = (allowedSlots & ~OBJECT_ALLOWED_SLOTS_MASK) === 0;

    if (!typeValid) invalid += 1;
    if (!aspectValid) invalid += 1;
    if (!actionValid) invalid += 1;
    if (!slotValid) invalid += 1;

    if (typeValid) score += 2;
    if (aspectValid) score += 1;
    if (actionValid) score += 1;
    if (slotValid) score += 2;
    if (actionSetIndex !== 0) {
      nonZeroActions += 1;
      score += 0.25;
    }

    uniqueTypes.add(type);
    entries.push({
      index: i,
      type,
      objectAspectIndex,
      actionSetIndex,
      allowedSlots,
    });
  }

  for (const rule of KNOWN_OBJECT_INFO_ENTRIES) {
    const value = entries[rule.index].type;
    if (rule.expected.includes(value)) {
      score += 12;
      knownMatches += 1;
    } else {
      score -= 8;
    }
  }

  if (uniqueTypes.size > 100) score += 8;
  if (uniqueTypes.size < 40) score -= 24;
  if (nonZeroActions > 8) score += 4;
  if (nonZeroActions > 150) score -= 10;
  if (invalid > 0) score -= invalid * 6;

  return {
    offset,
    endianness: littleEndian ? 'LE' : 'BE',
    score,
    invalid,
    knownMatches,
    uniqueTypeCount: uniqueTypes.size,
    nonZeroActions,
    entries,
  };
}

function getCandidatePreview(candidate, namesByIndex) {
  const previewIndices = [0, 1, 2, 23, 25, 31, 50, 51, 53, 54, 55, 69, 127];
  return previewIndices
    .filter((index) => index < candidate.entries.length)
    .map((index) => {
      const entry = candidate.entries[index];
      return {
        index,
        type: entry.type,
        typeName: namesByIndex[entry.type] ?? null,
        aspect: entry.objectAspectIndex,
        actionSetIndex: entry.actionSetIndex,
        allowedSlotsHex: `0x${entry.allowedSlots.toString(16).padStart(4, '0')}`,
      };
    });
}

function analyzeLayoutNearCandidate(buf, candidate) {
  const start = candidate.offset;
  const afterObjectInfo = start + OBJECT_INFO_TOTAL_BYTES;
  const thingDataByteCount = Array.from(buf.slice(start - 32, start - 16));
  const additionalThingCounts = Array.from(buf.slice(start - 16, start));

  const weaponBytes = Array.from(buf.slice(afterObjectInfo, afterObjectInfo + 24));
  const armourBytes = Array.from(buf.slice(afterObjectInfo + 276, afterObjectInfo + 276 + 24));
  const doorBytes = Array.from(buf.slice(afterObjectInfo + 276 + 232 + 2 + 53 + 16 + 594 + 2 + 74, afterObjectInfo + 276 + 232 + 2 + 53 + 16 + 594 + 2 + 74 + 8));

  return {
    expectedPrecedingArrays: {
      directionToStepBytes: Array.from(buf.slice(start - 16 - 16 - 16, start - 16 - 16)),
      thingDataByteCount,
      additionalThingCounts,
    },
    firstBytesAfterObjectInfo: weaponBytes,
    firstBytesAtExpectedArmourInfo: armourBytes,
    firstBytesAtExpectedDoorInfo: doorBytes,
  };
}

function analyzeGraphicsDat() {
  const buf = fs.readFileSync(GRAPHICS_PATH);
  const graphicCountBE = readWordBE(buf, 0);
  const graphicCountLE = readWordLE(buf, 0);

  const objectNameBlocks = findObjectNameBlocks(buf);
  const namesByIndex = {};
  if (objectNameBlocks[0]) {
    for (const entry of objectNameBlocks[0].names) {
      namesByIndex[entry.index] = entry.name;
    }
  }

  const candidatePool = [];
  for (let offset = 0; offset <= buf.length - OBJECT_INFO_TOTAL_BYTES; offset++) {
    const be = scoreObjectInfoCandidate(buf, offset, false);
    if (be && be.score > 180) {
      candidatePool.push(be);
    }
    const le = scoreObjectInfoCandidate(buf, offset, true);
    if (le && le.score > 180) {
      candidatePool.push(le);
    }
  }

  candidatePool.sort((a, b) => b.score - a.score);
  const topCandidates = [];
  const seen = new Set();
  for (const candidate of candidatePool) {
    const key = `${candidate.offset}:${candidate.endianness}`;
    if (seen.has(key)) continue;
    seen.add(key);
    topCandidates.push({
      offset: candidate.offset,
      offsetHex: `0x${candidate.offset.toString(16)}`,
      endianness: candidate.endianness,
      score: candidate.score,
      invalid: candidate.invalid,
      knownMatches: candidate.knownMatches,
      uniqueTypeCount: candidate.uniqueTypeCount,
      nonZeroActions: candidate.nonZeroActions,
      preview: getCandidatePreview(candidate, namesByIndex),
      nearbyLayout: analyzeLayoutNearCandidate(buf, candidate),
    });
    if (topCandidates.length >= TOP_CANDIDATE_COUNT) break;
  }

  return {
    generatedAt: new Date().toISOString(),
    graphicsDat: {
      path: GRAPHICS_PATH,
      byteLength: buf.length,
      firstWord: {
        be: graphicCountBE,
        le: graphicCountLE,
      },
      headerChecks: {
        be384CompressedSum: sumWords(buf, 2, 384, false),
        le384CompressedSum: sumWords(buf, 2, 384, true),
        be384DecompressedSum: sumWords(buf, 2 + 384 * 2, 384, false),
        le384DecompressedSum: sumWords(buf, 2 + 384 * 2, 384, true),
      },
    },
    objectNames: objectNameBlocks.map((block) => ({
      startOffset: block.startOffset,
      startOffsetHex: `0x${block.startOffset.toString(16)}`,
      byteLength: block.byteLength,
      firstTenNames: block.names.slice(0, 10),
      lastTenNames: block.names.slice(-10),
    })),
    topObjectInfoCandidates: topCandidates,
    notes: [
      'GRAPHICS.DAT (PC DOS) does not match the simple Atari ST header interpretation used by ReDMCSB.',
      'Object names are still clearly present as an ASCII block in the PC DOS file.',
      'ObjectInfo candidates are heuristic and need confirmation before being promoted into parse_full.js exports.',
    ],
  };
}

const result = analyzeGraphicsDat();
fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(`Wrote ${OUTPUT_PATH}`);
console.log(`Found ${result.objectNames.length} object-name block(s)`);
console.log(`Found ${result.topObjectInfoCandidates.length} high-scoring ObjectInfo candidate(s)`);

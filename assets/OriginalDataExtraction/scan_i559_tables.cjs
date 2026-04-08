const fs = require("fs");
const path = require("path");

const rawPath = path.join(
  __dirname,
  "EUDATA",
  "out_GRAPHICS.DAT",
  "0696.RAW1 [Unknown - Unknown Content (Words of data)].dat"
);

const raw = fs.readFileSync(rawPath);

const OBJECT_RECORD_SIZE = 6;
const OBJECT_COUNT = 180;
const WEAPON_RECORD_SIZE = 6;
const WEAPON_COUNT = 46;
const ARMOUR_RECORD_SIZE = 4;
const ARMOUR_COUNT = 58;

const EXPECTED_OBJECT_TYPES = [
  7,
  9,
  ...Array(21).fill(8),
  ...Array(46).fill(5),
  ...Array(58).fill(6),
  ...Array(53).fill(10),
];

function readWord(buf, offset, littleEndian) {
  return littleEndian ? buf.readUInt16LE(offset) : buf.readUInt16BE(offset);
}

function scoreObjectWindow(buf, offset, littleEndian) {
  let exactTypeMatches = 0;
  let allowedSlotMaskMatches = 0;
  let smallAspectIndexCount = 0;
  let smallActionSetCount = 0;
  let highByteZeroCount = 0;
  const uniqueTypeWords = new Set();
  const firstRecords = [];

  for (let i = 0; i < OBJECT_COUNT; i++) {
    const recOffset = offset + i * OBJECT_RECORD_SIZE;
    const typeWord = readWord(buf, recOffset, littleEndian);
    const aspect = buf[recOffset + 2];
    const actionSet = buf[recOffset + 3];
    const allowedSlots = readWord(buf, recOffset + 4, littleEndian);
    const lowType = typeWord & 0xff;
    const highType = (typeWord >> 8) & 0xff;

    if (lowType === EXPECTED_OBJECT_TYPES[i] && highType === 0) exactTypeMatches += 1;
    if (highType === 0) highByteZeroCount += 1;
    if ((allowedSlots & ~0x07ff) === 0) allowedSlotMaskMatches += 1;
    if (aspect <= 220) smallAspectIndexCount += 1;
    if (actionSet <= 80) smallActionSetCount += 1;
    uniqueTypeWords.add(typeWord);

    if (i < 8) {
      firstRecords.push({
        index: i,
        typeWord,
        lowType,
        aspect,
        actionSet,
        allowedSlots,
      });
    }
  }

  const score =
    exactTypeMatches * 5 +
    allowedSlotMaskMatches * 2 +
    highByteZeroCount * 2 +
    smallAspectIndexCount * 0.5 +
    smallActionSetCount * 0.25 -
    Math.max(0, uniqueTypeWords.size - 8) * 1.5;

  return {
    offset,
    endian: littleEndian ? "LE" : "BE",
    score,
    exactTypeMatches,
    allowedSlotMaskMatches,
    highByteZeroCount,
    smallAspectIndexCount,
    smallActionSetCount,
    uniqueTypeWordCount: uniqueTypeWords.size,
    firstRecords,
  };
}

function scoreWeaponWindow(buf, offset, littleEndian) {
  let plausibleClassCount = 0;
  let plausibleProjectileCount = 0;
  let nonZeroWeightCount = 0;
  let lowUnusedBitsCount = 0;
  const firstRecords = [];

  for (let i = 0; i < WEAPON_COUNT; i++) {
    const recOffset = offset + i * WEAPON_RECORD_SIZE;
    const weight = buf[recOffset];
    const cls = buf[recOffset + 1];
    const strength = buf[recOffset + 2];
    const energy = buf[recOffset + 3];
    const attrs = readWord(buf, recOffset + 4, littleEndian);
    const projectileAspect = (attrs >> 8) & 0x1f;
    const unusedBits = (attrs >> 13) & 0x7;

    if (
      cls === 0 ||
      (cls >= 1 && cls <= 15) ||
      (cls >= 16 && cls <= 47) ||
      (cls >= 112 && cls <= 255)
    ) plausibleClassCount += 1;
    if (projectileAspect <= 10) plausibleProjectileCount += 1;
    if (unusedBits <= 1) lowUnusedBitsCount += 1;
    if (weight > 0) nonZeroWeightCount += 1;

    if (i < 8) {
      firstRecords.push({ index: i, weight, cls, strength, energy, attrs, projectileAspect, unusedBits });
    }
  }

  const score =
    plausibleClassCount * 3 +
    plausibleProjectileCount * 2 +
    lowUnusedBitsCount * 1.5 +
    nonZeroWeightCount * 0.5;

  return {
    offset,
    endian: littleEndian ? "LE" : "BE",
    score,
    plausibleClassCount,
    plausibleProjectileCount,
    lowUnusedBitsCount,
    nonZeroWeightCount,
    firstRecords,
  };
}

function scoreArmourWindow(buf, offset) {
  let lowAttrCount = 0;
  let nonZeroWeightCount = 0;
  let plausibleDefenseCount = 0;
  const firstRecords = [];

  for (let i = 0; i < ARMOUR_COUNT; i++) {
    const recOffset = offset + i * ARMOUR_RECORD_SIZE;
    const weight = buf[recOffset];
    const defense = buf[recOffset + 1];
    const attrs = buf[recOffset + 2];
    const pad = buf[recOffset + 3];
    const sharpDefense = attrs & 0x07;
    const isShield = (attrs >> 7) & 1;
    const midUnused = (attrs >> 3) & 0x0f;

    if (midUnused === 0 && (isShield === 0 || isShield === 1)) lowAttrCount += 1;
    if (defense <= 200) plausibleDefenseCount += 1;
    if (weight > 0) nonZeroWeightCount += 1;

    if (i < 8) {
      firstRecords.push({ index: i, weight, defense, attrs, sharpDefense, isShield, pad });
    }
  }

  const score = lowAttrCount * 3 + plausibleDefenseCount * 1.5 + nonZeroWeightCount * 0.5;

  return {
    offset,
    score,
    lowAttrCount,
    plausibleDefenseCount,
    nonZeroWeightCount,
    firstRecords,
  };
}

function topCandidates(candidates, count = 12) {
  return candidates.sort((a, b) => b.score - a.score).slice(0, count);
}

const objectCandidates = [];
for (let offset = 0; offset <= raw.length - OBJECT_RECORD_SIZE * OBJECT_COUNT; offset += 2) {
  objectCandidates.push(scoreObjectWindow(raw, offset, true));
  objectCandidates.push(scoreObjectWindow(raw, offset, false));
}

const weaponCandidates = [];
for (let offset = 0; offset <= raw.length - WEAPON_RECORD_SIZE * WEAPON_COUNT; offset += 2) {
  weaponCandidates.push(scoreWeaponWindow(raw, offset, true));
  weaponCandidates.push(scoreWeaponWindow(raw, offset, false));
}

const armourCandidates = [];
for (let offset = 0; offset <= raw.length - ARMOUR_RECORD_SIZE * ARMOUR_COUNT; offset += 2) {
  armourCandidates.push(scoreArmourWindow(raw, offset));
}

const report = {
  rawPath,
  topObjectCandidates: topCandidates(objectCandidates),
  topWeaponCandidates: topCandidates(weaponCandidates),
  topArmourCandidates: topCandidates(armourCandidates),
};

console.log(JSON.stringify(report, null, 2));

const fs = require("fs");
const path = require("path");
const { decodeI559, I559_DECODED_LENGTH } = require("./decode_i559_blob.cjs");

const candidateFiles = [
  path.join(__dirname, "EUDATA", "out_GRAPHICS.DAT", "0696.RAW1 [Unknown - Unknown Content (Words of data)].dat"),
  path.join(__dirname, "generated", "decompressed", "DM_decompressed.bin"),
  path.join(__dirname, "generated", "decompressed", "FIRES_decompressed.bin"),
];

const EXPECTED_OBJECT_TYPES = [
  7,
  9,
  ...Array(21).fill(8),
  ...Array(46).fill(5),
  ...Array(58).fill(6),
  ...Array(53).fill(10),
];

function scoreCandidate(decoded) {
  let score = 0;

  const smallDeltas =
    decoded.deltaY.every((v) => Math.abs(v) <= 4) &&
    decoded.deltaX.every((v) => Math.abs(v) <= 4);
  if (smallDeltas) score += 80;

  const saneCreatureFlags = decoded.creatures.filter(
    (c) => c.byte13 === 0 && c.byte25 === 0
  ).length;
  score += saneCreatureFlags * 2;

  const saneAttackTypes = decoded.creatures.filter((c) => c.attackType >= 0 && c.attackType <= 7).length;
  score += saneAttackTypes * 2;

  const saneAttackSounds = decoded.creatures.filter(
    (c) => c.attackSoundOrdinal >= 0 && c.attackSoundOrdinal <= 31
  ).length;
  score += saneAttackSounds;

  const saneObjectTypes = decoded.objects.filter((o) => o.type >= 0 && o.type <= 255).length;
  score += saneObjectTypes;

  const exactObjectTypeMatches = decoded.objects.filter((o, index) => o.type === EXPECTED_OBJECT_TYPES[index]).length;
  score += exactObjectTypeMatches * 4;

  const saneAllowedSlots = decoded.objects.filter((o) => (o.allowedSlots & ~0x07ff) === 0).length;
  score += saneAllowedSlots;

  const saneWeaponClasses = decoded.weapons.filter((w) => w.weaponClass >= 0 && w.weaponClass <= 255).length;
  score += saneWeaponClasses;

  const saneFoodValues = decoded.foodValues.filter((v) => v >= 0 && v <= 2048).length;
  score += saneFoodValues * 2;

  const nonZeroFoodValues = decoded.foodValues.filter((v) => v !== 0).length;
  const distinctFoodValues = new Set(decoded.foodValues).size;
  score += nonZeroFoodValues * 3;
  score += distinctFoodValues * 2;

  const nonZeroMiscWeights = decoded.miscWeights.filter((v) => v !== 0).length;
  score += nonZeroMiscWeights * 0.5;

  if (decoded.foodValues.every((v) => v === 0)) score -= 200;
  if (decoded.miscWeights.every((v) => v === 0)) score -= 80;
  if (decoded.deltaY.every((v) => v === 0) && decoded.deltaX.every((v) => v === 0)) score -= 60;

  return {
    score,
    saneCreatureFlags,
    saneAttackTypes,
    saneAttackSounds,
    saneObjectTypes,
    exactObjectTypeMatches,
    saneAllowedSlots,
    saneWeaponClasses,
    saneFoodValues,
    nonZeroFoodValues,
    distinctFoodValues,
    nonZeroMiscWeights,
    deltaY: decoded.deltaY,
    deltaX: decoded.deltaX,
    firstFoodValues: decoded.foodValues.slice(0, 8),
  };
}

function scanFile(filePath) {
  const raw = fs.readFileSync(filePath);
  const candidates = [];

  for (const endian of ["be", "le"]) {
    for (let start = 0; start <= raw.length - I559_DECODED_LENGTH; start += 2) {
      try {
        const decoded = decodeI559(raw, { start, endian });
        candidates.push({
          start,
          endian,
          ...scoreCandidate(decoded),
        });
      } catch {
        // ignore impossible windows
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return {
    filePath,
    fileSize: raw.length,
    candidateCount: candidates.length,
    topCandidates: candidates.slice(0, 12),
  };
}

function main() {
  const existingFiles = candidateFiles.filter((filePath) => fs.existsSync(filePath));
  const results = existingFiles.map(scanFile);
  console.log(JSON.stringify({ decodedLength: I559_DECODED_LENGTH, results }, null, 2));
}

if (require.main === module) {
  main();
}

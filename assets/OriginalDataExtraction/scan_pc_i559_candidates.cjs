const fs = require("fs");
const path = require("path");
const { decodeI559, I559_DECODED_LENGTH } = require("./decode_i559_blob.cjs");

const rawPath = path.join(
  __dirname,
  "EUDATA",
  "out_GRAPHICS.DAT",
  "0696.RAW1 [Unknown - Unknown Content (Words of data)].dat"
);

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

  const deltaScore =
    decoded.deltaY.every((v) => Math.abs(v) <= 1) &&
    decoded.deltaX.every((v) => Math.abs(v) <= 1);
  if (deltaScore) score += 80;

  const zeroCreaturePads = decoded.creatures.filter(
    (c) => c.byte13 === 0 && c.byte25 === 0
  ).length;
  score += zeroCreaturePads * 2;

  const saneAttackTypes = decoded.creatures.filter((c) => c.attackType >= 0 && c.attackType <= 7).length;
  score += saneAttackTypes * 2;

  const saneAttackSounds = decoded.creatures.filter(
    (c) => c.attackSoundOrdinal >= 0 && c.attackSoundOrdinal <= 8
  ).length;
  score += saneAttackSounds;

  const saneObjectTypes = decoded.objects.filter((o, index) => {
    if (index === 0) return o.type === 7 || o.type === 30 || o.type === 31;
    if (index === 1) return o.type === 9 || o.type === 8;
    if (index >= 23 && index < 69) return o.type === 5;
    if (index >= 69 && index < 127) return o.type === 6;
    if (index >= 127) return o.type === 10;
    return o.type >= 0 && o.type <= 10;
  }).length;
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

  if (decoded.foodValues.every((v) => v === 0)) score -= 200;
  if (decoded.miscWeights.every((v) => v === 0)) score -= 80;
  if (decoded.deltaY.every((v) => v === 0) && decoded.deltaX.every((v) => v === 0)) score -= 60;

  const saneMiscWeights = decoded.miscWeights.filter((v) => v >= 0 && v <= 255).length;
  score += saneMiscWeights * 0.5;

  return {
    score,
    zeroCreaturePads,
    saneAttackTypes,
    saneAttackSounds,
    saneObjectTypes,
    exactObjectTypeMatches,
    saneAllowedSlots,
    saneWeaponClasses,
    saneFoodValues,
    nonZeroFoodValues,
    distinctFoodValues,
    saneMiscWeights,
    deltaY: decoded.deltaY,
    deltaX: decoded.deltaX,
    extraDBEntries: decoded.extraDBEntries,
    sizeDBEntries: decoded.sizeDBEntries,
  };
}

function main() {
  const raw = fs.readFileSync(rawPath);
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
  console.log(
    JSON.stringify(
      {
        rawPath,
        candidateCount: candidates.length,
        topCandidates: candidates.slice(0, 24),
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  main();
}

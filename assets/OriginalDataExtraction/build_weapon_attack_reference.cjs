const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function main() {
  const i559Path = process.argv[2];
  const i560Path = process.argv[3];
  const statsRefPath = process.argv[4];
  const outputPath = process.argv[5];

  if (!i559Path || !i560Path || !statsRefPath || !outputPath) {
    console.error("Usage: node build_weapon_attack_reference.cjs <atari_i559_stats.json> <atari_i560_stats.json> <stats_reference.json> <output.json>");
    process.exit(1);
  }

  const i559 = readJson(i559Path);
  const i560 = readJson(i560Path);
  const statsRef = readJson(statsRefPath);

  const weapons = statsRef.weapons.map((entry) => {
    const weaponIndex = entry.index;
    const objectInfoIndex = 23 + weaponIndex;
    const objectInfo = i559.objectInfo[objectInfoIndex];
    const descriptor = i559.weapons[weaponIndex];
    const legalAttackClass = objectInfo?.attackClass != null
      ? i560.legalAttackClasses[objectInfo.attackClass] ?? null
      : null;

    return {
      weaponIndex,
      objectInfoIndex,
      displayName: entry.displayName,
      symbol: entry.symbol,
      provenance: entry.provenance,
      graphicClass: objectInfo?.graphicClass ?? null,
      attackClass: objectInfo?.attackClass ?? null,
      allowedSlotsMask: objectInfo?.allowedSlotsMask ?? null,
      rawDescriptor: descriptor ?? null,
      legalAttacks: legalAttackClass ?? null,
    };
  });

  fs.writeFileSync(path.resolve(outputPath), JSON.stringify({
    _meta: {
      source: "Joined Atari I559/I560 data with current weapon name alignment",
      generatedAt: new Date().toISOString(),
    },
    weapons,
  }, null, 2), "utf8");

  console.log(`Wrote ${path.resolve(outputPath)}`);
}

if (require.main === module) {
  main();
}

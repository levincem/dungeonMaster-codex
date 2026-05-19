const fs = require("fs");
const path = require("path");
const { decodeI560 } = require("./decode_i560_blob.cjs");

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath || !outputPath) {
    console.error("Usage: node export_i560_stats.cjs <inputRaw1> <outputJson>");
    process.exit(1);
  }

  const buffer = fs.readFileSync(path.resolve(inputPath));
  const decoded = decodeI560(buffer, { endian: "be" });

  const compact = {
    _meta: {
      source: "I560 decoded payload",
      endian: decoded.endian,
      start: decoded.start,
      consumedBytes: decoded.consumedBytes,
    },
    attacks: decoded.attacks,
    legalAttackClasses: decoded.legalAttackClasses,
    spells: decoded.spells,
    byte19016: decoded.byte19016,
    byte19010: decoded.byte19010,
    powerSymbolManaCostMultipliers: decoded.powerSymbolManaCostMultipliers,
    symbolBaseManaCosts: decoded.symbolBaseManaCosts,
    powerSymbols: decoded.powerSymbols,
    symbolBaseManaTable: decoded.symbolBaseManaTable,
  };

  fs.writeFileSync(path.resolve(outputPath), JSON.stringify(compact, null, 2), "utf8");
  console.log(`Wrote ${path.resolve(outputPath)}`);
}

if (require.main === module) {
  main();
}

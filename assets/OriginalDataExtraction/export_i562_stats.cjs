#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { decodeI562 } = require('./decode_i562_blob.cjs');

const DEFAULT_CARRY_SLOT_NOTES = [
  'Index 0 is used during SHOOT reload logic as the temporary ammo hand slot.',
  'Index 1 is the weapon hand.',
  'Index 10 is the neck slot.',
  'Indices 30-37 are chest contents and are not part of CarryLocation[38].',
];

function main() {
  const [inputPath, outputPathArg] = process.argv.slice(2);
  if (!inputPath) {
    console.error('Usage: node export_i562_stats.cjs <inputFile> [outputFile]');
    process.exit(1);
  }

  const outputPath = outputPathArg
    ? path.resolve(outputPathArg)
    : path.resolve(__dirname, 'output', 'atari_i562_stats.json');

  const buffer = fs.readFileSync(inputPath);
  const decoded = decodeI562(buffer, { endian: 'be' });

  const exportData = {
    _meta: decoded._meta,
    provenance: {
      source: 'Canonical Atari graphics payload 0x232 / 0562',
      note: 'Fields here are exported exactly from the original structured table when proven. Unknown arrays stay raw and explicitly unnamed.',
    },
    dropOrder: decoded.dropOrder,
    carryLocationMasks: decoded.carryLocation.map((mask, index) => ({ index, mask })),
    carryLocationNotes: DEFAULT_CARRY_SLOT_NOTES,
    defaultGraphicList: decoded.defaultGraphicList,
    specialChars: decoded.specialChars,
    paletteBrightness: decoded.paletteBrightness,
    identityColorMap: decoded.identityColorMap,
    colorMapA: decoded.colorMapA,
    colorMapB: decoded.colorMapB,
    sounds: decoded.sounds,
    iconDisplay: decoded.iconDisplay,
    rects: {
      rect1796: decoded.rect1796,
      rect1788: decoded.rect1788,
      rect1780: decoded.rect1780,
      rect1454: decoded.rect1454,
      rect966: decoded.rect966,
      rect958: decoded.rect958,
      rect950: decoded.rect950,
      rect942: decoded.rect942,
      rect934: decoded.rect934,
      rect926: decoded.rect926,
      rect624: decoded.rect624,
    },
    palettes: {
      palette552: decoded.palette552,
      palette360: decoded.palette360,
      palette328: decoded.palette328,
    },
    rawTables: {
      textMasksA: decoded.textMasksA,
      textMasksB: decoded.textMasksB,
      byte1596: decoded.byte1596,
      word1588: decoded.word1588,
      word1526: decoded.word1526,
      word1502: decoded.word1502,
      byte1416: decoded.byte1416,
      byte1414: decoded.byte1414,
      byte1412: decoded.byte1412,
      word1406: decoded.word1406,
      word1398: decoded.word1398,
      byte1390: decoded.byte1390,
      byte1386: decoded.byte1386,
      byte1350: decoded.byte1350,
      arrowCursor: decoded.arrowCursor,
      byte1094: decoded.byte1094,
      word1074: decoded.word1074,
      byte640: decoded.byte640,
      fill639_624: decoded.fill639_624,
      fill616_612: decoded.fill616_612,
      word612: decoded.word612,
      uByte590: decoded.uByte590,
      byte586: decoded.byte586,
      unused554: decoded.unused554,
      word140: decoded.word140,
      word132: decoded.word132,
      word124: decoded.word124,
      word116: decoded.word116,
      word108: decoded.word108,
      word100: decoded.word100,
      word92: decoded.word92,
      word84: decoded.word84,
      word76: decoded.word76,
      word68: decoded.word68,
      word60: decoded.word60,
      word52: decoded.word52,
      word44: decoded.word44,
      word36: decoded.word36,
      word28: decoded.word28,
      word20: decoded.word20,
      word12: decoded.word12,
      trailingRawBytes: decoded.trailingRawBytes,
    },
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf8');
  console.log(`wrote ${outputPath}`);
}

if (require.main === module) {
  main();
}

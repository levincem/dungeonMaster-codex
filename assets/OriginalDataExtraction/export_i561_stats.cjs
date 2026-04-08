#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { decodeI561 } = require('./decode_i561_blob.cjs');

function main() {
  const [inputPath, outputPathArg] = process.argv.slice(2);
  if (!inputPath) {
    console.error('Usage: node export_i561_stats.cjs <inputFile> [outputFile]');
    process.exit(1);
  }

  const outputPath = outputPathArg
    ? path.resolve(outputPathArg)
    : path.resolve(__dirname, 'output', 'atari_i561_stats.json');

  const buffer = fs.readFileSync(inputPath);
  const decoded = decodeI561(buffer, { endian: 'be', shortAtariVariant: buffer.length === 0x7d4 });

  const exportData = {
    _meta: decoded._meta,
    provenance: {
      source: 'Canonical Atari graphics payload 0x231 / 0561',
      note: 'This block is predominantly UI/input infrastructure. The short Atari variant omits the final four Buttons16932 entries; those are restored exactly from the fallback constants used by the original source.',
    },
    moveButtons18496: decoded.moveButtons18496,
    dropAreas: decoded.dropAreas,
    directionalDeltaX: decoded.word18568,
    directionalDeltaY: decoded.word18560,
    keyTranslationGroups: {
      keyXlate18448: decoded.keyXlate18448,
      keyXlate18440: decoded.keyXlate18440,
      keyXlate18428: decoded.keyXlate18428,
      keyXlate18400: decoded.keyXlate18400,
    },
    buttonGroups: {
      buttons18936: decoded.buttons18936,
      buttons18876: decoded.buttons18876,
      buttons18828: decoded.buttons18828,
      buttons18792: decoded.buttons18792,
      buttons18768: decoded.buttons18768,
      buttons18708: decoded.buttons18708,
      buttons18660: decoded.buttons18660,
      buttons18624: decoded.buttons18624,
      buttons18372: decoded.buttons18372,
      buttons18324: decoded.buttons18324,
      buttons18216: decoded.buttons18216,
      buttons18060: decoded.buttons18060,
      buttons17952: decoded.buttons17952,
      buttons17892: decoded.buttons17892,
      buttons17832: decoded.buttons17832,
      buttons17796: decoded.buttons17796,
      buttons17760: decoded.buttons17760,
      buttons17304: decoded.buttons17304,
      buttons17196: decoded.buttons17196,
      buttons16956: decoded.buttons16956,
      buttons16932: decoded.buttons16932,
    },
    rawTables: {
      byte18938: decoded.byte18938,
      byte18600: decoded.byte18600,
      byte18592: decoded.byte18592,
      byte18584: decoded.byte18584,
      byte18576: decoded.byte18576,
      word18552: decoded.word18552,
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

#!/usr/bin/env node
'use strict';

const fs = require('fs');

function createReader(buffer, endian = 'be', startOffset = 0) {
  let offset = startOffset;
  const readInt16 = endian === 'be'
    ? () => { const v = buffer.readInt16BE(offset); offset += 2; return v; }
    : () => { const v = buffer.readInt16LE(offset); offset += 2; return v; };
  const readUInt16 = endian === 'be'
    ? () => { const v = buffer.readUInt16BE(offset); offset += 2; return v; }
    : () => { const v = buffer.readUInt16LE(offset); offset += 2; return v; };
  const readInt32 = endian === 'be'
    ? () => { const v = buffer.readInt32BE(offset); offset += 4; return v; }
    : () => { const v = buffer.readInt32LE(offset); offset += 4; return v; };
  return {
    get offset() { return offset; },
    readUInt8() { const v = buffer.readUInt8(offset); offset += 1; return v; },
    readInt8() { const v = buffer.readInt8(offset); offset += 1; return v; },
    readUInt16,
    readInt16,
    readInt32,
  };
}

function readArray(count, fn) {
  return Array.from({ length: count }, () => fn());
}

function readRectPosWords(r) {
  return { x1: r.readInt16(), x2: r.readInt16(), y1: r.readInt16(), y2: r.readInt16() };
}

function readSound(r) {
  return {
    soundGraphic: r.readInt16(),
    byte2: r.readUInt8(),
    byte3: r.readUInt8(),
    priorityFlags: r.readUInt8(),
    byte5: r.readUInt8(),
    byte6: r.readUInt8(),
    byte7: r.readUInt8(),
  };
}

function readIconDisplay(r) {
  return {
    pixelX: r.readInt16(),
    pixelY: r.readInt16(),
    objectType: r.readInt16(),
  };
}

function decodeI562(buffer, { endian = 'be', startOffset = 0 } = {}) {
  const r = createReader(buffer, endian, startOffset);
  const start = r.offset;

  const byte1830 = readArray(2, () => r.readInt8());
  const textMasksA = readArray(4, () => r.readInt32());
  const textMasksB = readArray(4, () => r.readInt32());
  const rect1796 = readRectPosWords(r);
  const rect1788 = readRectPosWords(r);
  const rect1780 = readRectPosWords(r);
  const sounds = readArray(22, () => readSound(r));
  const byte1596 = readArray(8, () => r.readInt8());
  const word1588 = r.readInt16();
  const dropOrder = readArray(30, () => r.readInt16());
  const word1526 = readArray(4, () => readArray(3, () => r.readInt16()));
  const word1502 = readArray(4, () => readArray(6, () => r.readInt16()));
  const rect1454 = readArray(4, () => readRectPosWords(r));
  const specialChars = readArray(6, () => r.readUInt8());
  const byte1416 = readArray(2, () => r.readInt8());
  const byte1414 = readArray(2, () => r.readInt8());
  const byte1412 = readArray(6, () => r.readInt8());
  const word1406 = readArray(4, () => r.readInt16());
  const word1398 = readArray(4, () => r.readInt16());
  const byte1390 = readArray(4, () => r.readInt8());
  const byte1386 = readArray(4, () => r.readInt8());
  const colorMapA = readArray(16, () => r.readUInt8());
  const colorMapB = readArray(16, () => r.readUInt8());
  const byte1350 = readArray(128, () => r.readInt8());
  const arrowCursor = readArray(128, () => r.readInt8());
  const byte1094 = readArray(8, () => r.readInt8());
  const paletteBrightness = readArray(6, () => r.readInt16());
  const word1074 = readArray(16, () => r.readInt16());
  const carryLocation = readArray(38, () => r.readInt16());
  const rect966 = readRectPosWords(r);
  const rect958 = readRectPosWords(r);
  const rect950 = readRectPosWords(r);
  const rect942 = readRectPosWords(r);
  const rect934 = readRectPosWords(r);
  const rect926 = readRectPosWords(r);
  const unused918 = r.readInt16();
  const iconDisplay = readArray(46, () => readIconDisplay(r));
  const byte640 = r.readInt8();
  const fill639_624 = readArray(15, () => r.readUInt8());
  const rect624 = readRectPosWords(r);
  const fill616_612 = readArray(4, () => r.readUInt8());
  const word612 = readArray(7, () => r.readInt16());
  const uByte590 = readArray(4, () => r.readUInt8());
  const byte586 = readArray(8, () => readArray(4, () => r.readInt8()));
  const unused554 = r.readInt16();
  const palette552 = readArray(6, () => readArray(16, () => r.readInt16()));
  const palette360 = readArray(16, () => r.readInt16());
  const palette328 = readArray(16, () => r.readInt16());
  const defaultGraphicList = readArray(70, () => r.readUInt16());
  const identityColorMap = readArray(16, () => r.readUInt8());
  const word140 = readArray(4, () => r.readInt16());
  const word132 = readArray(4, () => r.readInt16());
  const word124 = readArray(4, () => r.readInt16());
  const word116 = readArray(4, () => r.readInt16());
  const word108 = readArray(4, () => r.readInt16());
  const word100 = readArray(4, () => r.readInt16());
  const word92 = readArray(4, () => r.readInt16());
  const word84 = readArray(4, () => r.readInt16());
  const word76 = readArray(4, () => r.readInt16());
  const word68 = readArray(4, () => r.readInt16());
  const word60 = readArray(4, () => r.readInt16());
  const word52 = readArray(4, () => r.readInt16());
  const word44 = readArray(4, () => r.readInt16());
  const word36 = readArray(4, () => r.readInt16());
  const word28 = readArray(4, () => r.readInt16());
  const word20 = readArray(4, () => r.readInt16());
  const word12 = readArray(4, () => r.readInt16());
  const trailingRawBytes = readArray(buffer.length - r.offset, () => r.readUInt8());

  return {
    _meta: {
      sourceGraphic: '0x232 / 0562',
      endian,
      startOffset,
      structuredBytes: r.offset - start - trailingRawBytes.length,
      trailingRawByteCount: trailingRawBytes.length,
      consumedBytes: r.offset - start,
      fileBytes: buffer.length - startOffset,
    },
    byte1830,
    textMasksA,
    textMasksB,
    rect1796,
    rect1788,
    rect1780,
    sounds,
    byte1596,
    word1588,
    dropOrder,
    word1526,
    word1502,
    rect1454,
    specialChars,
    byte1416,
    byte1414,
    byte1412,
    word1406,
    word1398,
    byte1390,
    byte1386,
    colorMapA,
    colorMapB,
    byte1350,
    arrowCursor,
    byte1094,
    paletteBrightness,
    word1074,
    carryLocation,
    rect966,
    rect958,
    rect950,
    rect942,
    rect934,
    rect926,
    unused918,
    iconDisplay,
    byte640,
    fill639_624,
    rect624,
    fill616_612,
    word612,
    uByte590,
    byte586,
    unused554,
    palette552,
    palette360,
    palette328,
    defaultGraphicList,
    identityColorMap,
    word140,
    word132,
    word124,
    word116,
    word108,
    word100,
    word92,
    word84,
    word76,
    word68,
    word60,
    word52,
    word44,
    word36,
    word28,
    word20,
    word12,
    trailingRawBytes,
  };
}

if (require.main === module) {
  const [inputPath, startArg = '0', endian = 'be'] = process.argv.slice(2);
  if (!inputPath) {
    console.error('Usage: node decode_i562_blob.cjs <file> [startOffset] [be|le]');
    process.exit(1);
  }
  const buffer = fs.readFileSync(inputPath);
  const decoded = decodeI562(buffer, { startOffset: Number(startArg) || 0, endian });
  process.stdout.write(`${JSON.stringify(decoded, null, 2)}\n`);
}

module.exports = { decodeI562 };

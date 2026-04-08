#!/usr/bin/env node
'use strict';

const fs = require('fs');

function createReader(buffer, endian = 'be', startOffset = 0) {
  let offset = startOffset;
  const readInt16 = endian === 'be'
    ? () => { const v = buffer.readInt16BE(offset); offset += 2; return v; }
    : () => { const v = buffer.readInt16LE(offset); offset += 2; return v; };
  return {
    get offset() { return offset; },
    readUInt8() { const v = buffer.readUInt8(offset); offset += 1; return v; },
    readInt8() { const v = buffer.readInt8(offset); offset += 1; return v; },
    readUInt16() { const v = endian === 'be' ? buffer.readUInt16BE(offset) : buffer.readUInt16LE(offset); offset += 2; return v; },
    readInt16,
  };
}

function readArray(count, fn) {
  return Array.from({ length: count }, () => fn());
}

function readButton(r) {
  return {
    word0: r.readInt16(),
    xMin: r.readInt16(),
    xMax: r.readInt16(),
    yMin: r.readInt16(),
    yMax: r.readInt16(),
    button: r.readInt16(),
  };
}

function readMoveButton(r) {
  return {
    x1: r.readUInt16(),
    x2: r.readUInt16(),
    y1: r.readUInt16(),
    y2: r.readUInt16(),
  };
}

function readKeyXlate(r) {
  return {
    mouse: r.readUInt16(),
    keyscan: r.readUInt16(),
  };
}

function decodeI561(buffer, { endian = 'be', startOffset = 0, shortAtariVariant = false } = {}) {
  const r = createReader(buffer, endian, startOffset);
  const start = r.offset;

  const byte18938 = null;
  const buttons18936 = readArray(5, () => readButton(r));
  const buttons18876 = readArray(4, () => readButton(r));
  const buttons18828 = readArray(3, () => readButton(r));
  const buttons18792 = readArray(2, () => readButton(r));
  const buttons18768 = readArray(5, () => readButton(r));
  const buttons18708 = readArray(4, () => readButton(r));
  const buttons18660 = readArray(3, () => readButton(r));
  const buttons18624 = readArray(2, () => readButton(r));
  const byte18600 = readArray(8, () => r.readInt8());
  const byte18592 = readArray(8, () => r.readInt8());
  const byte18584 = readArray(8, () => r.readInt8());
  const byte18576 = readArray(8, () => r.readInt8());
  const word18568 = readArray(4, () => r.readInt16());
  const word18560 = readArray(4, () => r.readInt16());
  const word18552 = readArray(28, () => r.readInt16());
  const moveButtons18496 = readArray(4, () => readMoveButton(r));
  const dropAreas = readArray(16, () => r.readUInt8());
  const keyXlate18448 = readArray(2, () => readKeyXlate(r));
  const keyXlate18440 = readArray(3, () => readKeyXlate(r));
  const keyXlate18428 = readArray(7, () => readKeyXlate(r));
  const keyXlate18400 = readArray(7, () => readKeyXlate(r));
  const buttons18372 = readArray(4, () => readButton(r));
  const buttons18324 = readArray(9, () => readButton(r));
  const buttons18216 = readArray(13, () => readButton(r));
  const buttons18060 = readArray(9, () => readButton(r));
  const buttons17952 = readArray(5, () => readButton(r));
  const buttons17892 = readArray(5, () => readButton(r));
  const buttons17832 = readArray(3, () => readButton(r));
  const buttons17796 = readArray(3, () => readButton(r));
  const buttons17760 = readArray(38, () => readButton(r));
  const buttons17304 = readArray(9, () => readButton(r));
  const buttons17196 = readArray(20, () => readButton(r));
  const buttons16956 = readArray(2, () => readButton(r));
  let buttons16932 = [];
  if (!shortAtariVariant) {
    buttons16932 = readArray(4, () => readButton(r));
  } else {
    buttons16932 = [
      { word0: 0x00c8, xMin: 0x00f4, xMax: 0x012a, yMin: 0x002d, yMax: 0x003a, button: 0x0002 },
      { word0: 0x00c9, xMin: 0x00f4, xMax: 0x012a, yMin: 0x004c, yMax: 0x005d, button: 0x0002 },
      { word0: 0x00ca, xMin: 0x00f8, xMax: 0x0125, yMin: 0x00bb, yMax: 0x00c7, button: 0x0002 },
      { word0: 0x0000, xMin: 0x0000, xMax: 0x0000, yMin: 0x0000, yMax: 0x0000, button: 0x0000 },
    ];
  }

  const trailingRawBytes = readArray(buffer.length - r.offset, () => r.readUInt8());

  return {
    _meta: {
      sourceGraphic: '0x231 / 0561',
      endian,
      startOffset,
      fileBytes: buffer.length - startOffset,
      shortAtariVariant,
      omittedRuntimePrefixBytes: 2,
      structuredBytes: r.offset - start - trailingRawBytes.length,
      trailingRawByteCount: trailingRawBytes.length,
      consumedBytes: r.offset - start,
    },
    byte18938,
    buttons18936,
    buttons18876,
    buttons18828,
    buttons18792,
    buttons18768,
    buttons18708,
    buttons18660,
    buttons18624,
    byte18600,
    byte18592,
    byte18584,
    byte18576,
    word18568,
    word18560,
    word18552,
    moveButtons18496,
    dropAreas,
    keyXlate18448,
    keyXlate18440,
    keyXlate18428,
    keyXlate18400,
    buttons18372,
    buttons18324,
    buttons18216,
    buttons18060,
    buttons17952,
    buttons17892,
    buttons17832,
    buttons17796,
    buttons17760,
    buttons17304,
    buttons17196,
    buttons16956,
    buttons16932,
    trailingRawBytes,
  };
}

if (require.main === module) {
  const [inputPath, startArg = '0', endian = 'be'] = process.argv.slice(2);
  if (!inputPath) {
    console.error('Usage: node decode_i561_blob.cjs <file> [startOffset] [be|le]');
    process.exit(1);
  }
  const buffer = fs.readFileSync(inputPath);
  const decoded = decodeI561(buffer, {
    startOffset: Number(startArg) || 0,
    endian,
    shortAtariVariant: buffer.length === 0x7d4,
  });
  process.stdout.write(`${JSON.stringify(decoded, null, 2)}\n`);
}

module.exports = { decodeI561 };

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readU16LE(buf, off) {
  return buf.readUInt16LE(off);
}

function readU16BE(buf, off) {
  return buf.readUInt16BE(off);
}

function readU32LE(buf, off) {
  return buf.readUInt32LE(off);
}

function readU32BE(buf, off) {
  return buf.readUInt32BE(off);
}

function parseMap(mapPath) {
  if (!mapPath) return null;
  const lines = fs.readFileSync(mapPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('ENDIAN='));
  return lines.map((line) => {
    const parts = line.split(',');
    return {
      num: parts[0] ?? '',
      type: parts[1] ?? '',
      info: parts[2] ?? '',
      name1: parts[3] ?? '',
      name2: parts[4] ?? '',
      comments: parts.slice(5).join(','),
    };
  });
}

function detectHeader(buf) {
  const variants = [
    { endian: 'LE', u16: readU16LE, u32: readU32LE },
    { endian: 'BE', u16: readU16BE, u32: readU32BE },
  ];

  for (const variant of variants) {
    const first = variant.u16(buf, 0);
    let type = null;
    let numItems = null;
    let cursor = 0;
    if (first > 0 && first <= 1000) {
      type = 'DMCSB1';
      numItems = first;
      cursor = 2;
    } else if (first === 0x8001) {
      type = 'DMCSB2';
      numItems = variant.u16(buf, 2);
      cursor = 4;
    } else if (first === 0x8005) {
      type = 'DM2';
      numItems = variant.u16(buf, 2);
      cursor = 4;
    }

    if (!type || !numItems || numItems <= 0) continue;

    const compressedSizes = new Array(numItems).fill(0);
    const expandedSizes = new Array(numItems).fill(0);
    const widths = new Array(numItems).fill(0);
    const heights = new Array(numItems).fill(0);

    if (type === 'DM2') {
      if (cursor + 4 > buf.length) continue;
      compressedSizes[0] = variant.u32(buf, cursor);
      cursor += 4;
      for (let i = 1; i < numItems; i += 1) {
        if (cursor + 2 > buf.length) return null;
        compressedSizes[i] = variant.u16(buf, cursor);
        cursor += 2;
      }
      for (let i = 0; i < numItems; i += 1) {
        expandedSizes[i] = compressedSizes[i];
      }
    } else {
      for (let i = 0; i < numItems; i += 1) {
        if (cursor + 2 > buf.length) continue;
        compressedSizes[i] = variant.u16(buf, cursor);
        cursor += 2;
      }
      for (let i = 0; i < numItems; i += 1) {
        if (cursor + 2 > buf.length) continue;
        expandedSizes[i] = variant.u16(buf, cursor);
        cursor += 2;
      }
    }

    if (type === 'DMCSB2') {
      for (let i = 0; i < numItems; i += 1) {
        if (cursor + 4 > buf.length) continue;
        widths[i] = variant.u16(buf, cursor);
        heights[i] = variant.u16(buf, cursor + 2);
        cursor += 4;
      }
    }

    const totalCompressed = compressedSizes.reduce((a, b) => a + b, 0);
    if (cursor + totalCompressed > buf.length) continue;

    return {
      endian: variant.endian,
      type,
      numItems,
      headerSize: cursor,
      compressedSizes,
      expandedSizes,
      widths,
      heights,
    };
  }
  return null;
}

function lzwDecompress(input) {
  const stringTable = new Array(1024 * 32);
  const lengths = new Uint16Array(1024 * 32);
  for (let i = 0; i < 256; i += 1) {
    stringTable[i] = Buffer.from([i]);
    lengths[i] = 1;
  }
  lengths[256] = 0;
  let stringNum = 257;
  let bits = 9;
  let bitBuffer = 0;
  let bitsInBuffer = 0;
  let inputLoc = 0;
  const output = [];

  const getCode = () => {
    while (bitsInBuffer < bits && inputLoc < input.length) {
      bitBuffer += input[inputLoc++] << bitsInBuffer;
      bitsInBuffer += 8;
    }
    if (bitsInBuffer < bits) return -1;
    const next = bitBuffer & ((1 << bits) - 1);
    bitBuffer = Math.floor(bitBuffer / (2 ** bits));
    bitsInBuffer -= bits;
    return next;
  };

  const outputBuffer = (buf) => {
    for (const byte of buf) output.push(byte);
  };

  let oldCode = getCode();
  if (oldCode < 0) return Buffer.alloc(0);
  outputBuffer(stringTable[oldCode]);
  let lzwChar = oldCode & 0xff;

  let newCode = getCode();
  while (newCode !== -1) {
    if (newCode === 256) {
      stringNum = 257;
      lengths[256] = 0;
      bits = 9;
    } else {
      let cur;
      if (newCode < stringNum) {
        cur = stringTable[newCode];
      } else {
        cur = Buffer.concat([stringTable[oldCode], Buffer.from([lzwChar])]);
      }
      outputBuffer(cur);
      lzwChar = cur[0];
      const nextString = Buffer.concat([stringTable[oldCode], Buffer.from([lzwChar])]);
      stringTable[stringNum] = nextString;
      lengths[stringNum] = nextString.length;
      stringNum += 1;
      if (bits < 12 && stringNum === (1 << bits)) bits += 1;
      oldCode = newCode;
    }
    newCode = getCode();
  }

  // Post-pass for the 0x90 RLE quirk copied from DMExtract.
  const fixed = Array.from(output);
  for (let i = 0; i < fixed.length; i += 1) {
    if (fixed[i] !== 0x90) continue;
    const count = fixed[i + 1];
    if (count === 0) {
      fixed.splice(i, 2, 0x90);
      continue;
    }
    if (i === 0) continue;
    const prev = fixed[i - 1];
    fixed.splice(i, 2, ...new Array(count).fill(prev));
    i += count - 1;
  }

  return Buffer.from(fixed);
}

function sanitizeName(input) {
  return input.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim();
}

function extractEntry(graphicsPath, entryIndex, mapPath, outDir) {
  const buf = fs.readFileSync(graphicsPath);
  const header = detectHeader(buf);
  if (!header) {
    throw new Error(`Unrecognized graphics.dat format: ${graphicsPath}`);
  }
  if (entryIndex < 0 || entryIndex >= header.numItems) {
    throw new Error(`Entry ${entryIndex} out of range 0..${header.numItems - 1}`);
  }

  const maps = parseMap(mapPath);
  let offset = header.headerSize;
  for (let i = 0; i < entryIndex; i += 1) offset += header.compressedSizes[i];
  const compressed = buf.subarray(offset, offset + header.compressedSizes[entryIndex]);
  const expanded = header.compressedSizes[entryIndex] === header.expandedSizes[entryIndex]
    ? Buffer.from(compressed)
    : lzwDecompress(compressed);

  if (outDir) fs.mkdirSync(outDir, { recursive: true });
  const mapEntry = maps?.[entryIndex] ?? null;
  const type = mapEntry?.type || 'BIN';
  const name = mapEntry
    ? `${String(entryIndex).padStart(4, '0')}.${type} [${mapEntry.name1 || 'Unknown'}${mapEntry.name2 ? ` - ${mapEntry.name2}` : ''}]`
    : `${String(entryIndex).padStart(4, '0')}.${type}`;
  const fileName = `${sanitizeName(name)}.dat`;
  const target = outDir ? path.join(outDir, fileName) : null;
  if (target) fs.writeFileSync(target, expanded);

  const meta = {
    graphicsPath,
    entryIndex,
    endian: header.endian,
    fileType: header.type,
    numItems: header.numItems,
    headerSize: header.headerSize,
    compressedSize: header.compressedSizes[entryIndex],
    expandedSize: header.expandedSizes[entryIndex],
    offset,
    width: header.widths[entryIndex] || null,
    height: header.heights[entryIndex] || null,
    map: mapEntry,
    outputPath: target,
  };
  console.log(JSON.stringify(meta, null, 2));
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node extract_graphics_entry.cjs <graphics.dat> <entryIndex> [mapfile] [outDir]');
    process.exit(1);
  }
  const [graphicsPath, entryIndexRaw, mapPath, outDir] = args;
  extractEntry(graphicsPath, Number(entryIndexRaw), mapPath, outDir);
}

main();

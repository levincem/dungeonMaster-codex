// ESM utility script kept runnable inside the repo's `type: module` setup.
// PKLITE/LZ91 decompressor for DM.EXE
// Based on x86 stub analysis: compressed data at file offset 0x20
// Bit stream: 16-bit words, LSB first. Bit=1→literal, Bit=0→back-ref.
// Short ref: bit=0 → 2-bit count (2-5), 8-bit offset (BX=0xFF00|byte)
// Long ref:  bit=1 → LODSW W; W[10:8]=lenField, BX=0xE000|(W[15:11]<<8)|(W[7:0])
//   lenField=0 → read extra byte (count=extra+1); lenField!=0 → count=lenField+2

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.join(__dirname, 'original-pc-runtime', 'DM.EXE');
const outputDir = path.join(__dirname, 'generated', 'decompressed');
const outputPath = path.join(outputDir, 'DM_decompressed.bin');
const buf = fs.readFileSync(inputPath);

// Verify MZ + LZ91
if (buf[0] !== 0x4D || buf[1] !== 0x5A) throw new Error('Not MZ');
const sig = buf.slice(0x1C, 0x20).toString('ascii');
console.log(`Signature at 0x1C: "${sig}" (${buf.slice(0x1C,0x20).toString('hex')})`);

// Decompress from start of load module (file offset 0x20)
let srcPos = 0x20;
const out = [];

// Initialize bit buffer with first 16-bit word
let bp = buf.readUInt16LE(srcPos); srcPos += 2;
let dx = 16; // bits remaining in bp

function nextBit() {
  const cf = bp & 1;
  bp = (bp >>> 1) & 0x7FFF; // logical SHR, no sign extension
  dx--;
  if (dx === 0) {
    bp = buf.readUInt16LE(srcPos); srcPos += 2;
    dx = 16;
  }
  return cf;
}

function lodsb() { return buf[srcPos++]; }
function lodsw() { const w = buf.readUInt16LE(srcPos); srcPos += 2; return w; }

let iters = 0;
mainLoop: while (srcPos < buf.length && iters++ < 5000000) {
  const bit = nextBit();

  if (bit === 1) {
    // Literal byte
    out.push(lodsb());
    continue;
  }

  // Back-reference: next bit determines short vs long
  const isLong = nextBit();

  if (isLong === 0) {
    // Short reference: 2 bits count + 8-bit offset
    // RCL CX,1 twice: reads bits into CX LSB-first
    const b1 = nextBit(); // first count bit
    const b2 = nextBit(); // second count bit
    const count = (b1 << 1 | b2) + 2; // 2..5

    const offsetByte = lodsb();
    // BX = 0xFF00 | offsetByte  (signed 16-bit: -256..-1)
    const bx = (0xFF00 | offsetByte) - 0x10000;

    const startPos = out.length + bx; // fixed source start
    if (startPos < 0) { console.error(`Short ref underflow at output ${out.length}`); break mainLoop; }
    for (let i = 0; i < count; i++) out.push(out[startPos + i]);
  } else {
    // Long reference: read 16-bit word W with LODSW (bypasses bit buffer)
    const W = lodsw();
    if (W === 0) {
      console.log('EOF marker W=0 at srcPos=0x' + srcPos.toString(16));
      break;
    }

    // lenField = bits [10:8] of W = (W>>8)&7
    const lenField = (W >> 8) & 7;

    // BX = 0xE000 | (W[15:11]<<8) | W[7:0]  (signed: -8192..-1)
    const high5 = (W >> 11) & 0x1F;
    const low8  = W & 0xFF;
    const bxU   = 0xE000 | (high5 << 8) | low8;
    const bx    = bxU - 0x10000; // signed

    let count;
    if (lenField === 0) {
      const extra = lodsb();
      if (extra === 0) { console.log('EOF extra=0 at srcPos=0x' + srcPos.toString(16)); break; }
      if (extra === 1) {
        // Segment adjustment (real-mode DOS artifact) - skip and continue
        continue mainLoop;
      }
      count = extra + 1; // MOV CL,AL; INC CX → CX = extra+1
    } else {
      count = lenField + 2; // 3..9
    }

    const startPos = out.length + bx; // fixed source start
    if (startPos < 0) {
      console.error(`Long ref underflow: out.length=${out.length}, bx=${bx}, W=0x${W.toString(16)}`);
      break mainLoop;
    }
    for (let i = 0; i < count; i++) out.push(out[startPos + i]);
  }
}

console.log(`Decompressed ${out.length} bytes (${iters} iterations, srcPos=0x${srcPos.toString(16)})`);
const result = Buffer.from(out);
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, result);

// Extract printable strings (length >= 4)
console.log('\n--- Strings found ---');
let s = '', sStart = 0;
const strings = [];
for (let i = 0; i <= result.length; i++) {
  const c = i < result.length ? result[i] : 0;
  if (c >= 0x20 && c < 0x7F) {
    if (!s) sStart = i;
    s += String.fromCharCode(c);
  } else {
    if (s.length >= 4) strings.push({ offset: sStart, str: s });
    s = '';
  }
}

strings.forEach(({ offset, str }) => {
  console.log(`  0x${offset.toString(16).padStart(5,'0')}: ${str}`);
});
console.log(`\nTotal strings: ${strings.length}`);

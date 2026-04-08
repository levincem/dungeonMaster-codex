const fs = require("fs");
const path = require("path");

const I559_DECODED_LENGTH = 3086;

function readU8(buffer, offset) {
  return buffer[offset] & 0xff;
}

function readU16(buffer, offset, endian = "be") {
  return endian === "le" ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
}

function readS16(buffer, offset, endian = "be") {
  const value = readU16(buffer, offset, endian);
  return value === 0xffff ? -1 : (value & 0x8000 ? value - 0x10000 : value);
}

function decodeI559(buffer, options = {}) {
  const endian = options.endian === "le" ? "le" : "be";
  const start = options.start ?? 0;
  const end = start + I559_DECODED_LENGTH;
  if (end > buffer.length) {
    throw new Error(`Not enough bytes to decode I559: need ${I559_DECODED_LENGTH}, have ${buffer.length - start}`);
  }

  let off = start;
  const takeU8 = () => readU8(buffer, off++);
  const takeU16 = () => {
    const value = readU16(buffer, off, endian);
    off += 2;
    return value;
  };
  const takeS16 = () => {
    const value = readS16(buffer, off, endian);
    off += 2;
    return value;
  };

  const creatureFacings = Array.from({ length: 4 }, () => takeU8());
  const wallTextEncoding = Array.from({ length: 32 }, () =>
    Array.from({ length: 8 }, () => takeU8()).filter(Boolean)
  );
  const characterEncoding = Array.from({ length: 32 }, () => {
    const low = takeU8();
    takeU8();
    return String.fromCharCode(low);
  });
  const textEncoding = Array.from({ length: 32 }, () =>
    Array.from({ length: 8 }, () => takeU8()).filter(Boolean)
  );
  const doorCharacteristics = Array.from({ length: 4 }, () => takeU16());
  const creatureDroppings = Array.from({ length: 40 }, () => takeU16());
  const sounds = Array.from({ length: 8 }, () => takeU8());
  const creatures = Array.from({ length: 27 }, () => ({
    creatureAspectIndex: takeU8(),
    attackSoundOrdinal: takeU8(),
    attributes: takeU16(),
    graphicInfo: takeU16(),
    movementTicks: takeU8(),
    attackTicks: takeU8(),
    defense: takeU8(),
    baseHealth: takeU8(),
    attack: takeU8(),
    poisonAttack: takeU8(),
    dexterity: takeU8(),
    byte13: takeU8(),
    ranges: takeU16(),
    properties: takeU16(),
    resistances: takeU16(),
    word20: takeU16(),
    byte22: Array.from({ length: 4 }, () => takeU8()),
  }));
  const foodValues = Array.from({ length: 8 }, () => takeU16());
  const miscWeights = Array.from({ length: 54 }, () => takeU8());
  const protection = takeU16();
  const cloths = Array.from({ length: 58 }, () => ({
    weight: takeU8(),
    defense: takeU8(),
    attributes: takeU8(),
    padding: takeU8(),
  }));
  const weapons = Array.from({ length: 46 }, () => ({
    weight: takeU8(),
    weaponClass: takeU8(),
    strength: takeU8(),
    kineticEnergy: takeU8(),
    attributes: takeU16(),
  }));
  const objects = Array.from({ length: 180 }, () => ({
    type: takeU16(),
    objectAspectIndex: takeU8(),
    actionSetIndex: takeU8(),
    allowedSlots: takeU16(),
  }));
  const extraDBEntries = Array.from({ length: 16 }, () => takeU8());
  const sizeDBEntries = Array.from({ length: 16 }, () => takeU8());
  const deltaY = Array.from({ length: 4 }, () => takeS16());
  const deltaX = Array.from({ length: 4 }, () => takeS16());

  return {
    start,
    end,
    consumedBytes: off - start,
    expectedBytes: I559_DECODED_LENGTH,
    endian,
    creatureFacings,
    wallTextEncoding,
    characterEncoding,
    textEncoding,
    doorCharacteristics,
    creatureDroppings,
    sounds,
    creatures,
    foodValues,
    miscWeights,
    protection,
    cloths,
    weapons,
    objects,
    extraDBEntries,
    sizeDBEntries,
    deltaY,
    deltaX,
  };
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node decode_i559_blob.cjs <file> [startOffset] [be|le]");
    process.exit(1);
  }

  const start = Number(process.argv[3] ?? 0);
  const endian = (process.argv[4] ?? "be").toLowerCase();
  const buffer = fs.readFileSync(path.resolve(inputPath));
  const decoded = decodeI559(buffer, { start, endian });
  console.log(JSON.stringify(decoded, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  I559_DECODED_LENGTH,
  decodeI559,
};

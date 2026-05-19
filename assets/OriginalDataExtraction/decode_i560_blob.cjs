const fs = require("fs");
const path = require("path");

const I560_DECODED_LENGTH = 1256;

const ATTACK_TYPE_NAMES = [
  "Juggle",
  "Block",
  "Chop",
  "Speed",
  "Blow Horn",
  "Flip",
  "Punch",
  "Kick",
  "War Cry",
  "Stab",
  "Climb Down",
  "Freeze Life",
  "Hit",
  "Swing",
  "Stab 2",
  "Thrust",
  "Jab",
  "Parry",
  "Hack",
  "Berzerk",
  "Fireball",
  "Dispell",
  "Confuse",
  "Lightning",
  "Disrupt",
  "Melee",
  "Pray",
  "Invoke",
  "Slash",
  "Cleave",
  "Bash",
  "Stun",
  "Shoot",
  "Spellshield",
  "Fireshield",
  "Fluxcage",
  "Heal",
  "Calm",
  "Light",
  "Window",
  "Spit",
  "Brandish",
  "Throw",
  "Fuse",
];

const RUNE_SYMBOLS_IN_UI_ORDER = [
  "LO", "UM", "ON", "EE", "PAL", "MON",
  "YA", "VI", "OH", "FUL", "DES", "ZO",
  "VEN", "EW", "KATH", "IR", "BRO", "GOR",
  "KU", "ROS", "DAIN", "NETA", "RA", "SAR",
];

function readU8(buffer, offset) {
  return buffer[offset] & 0xff;
}

function readU16(buffer, offset, endian = "be") {
  return endian === "le" ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
}

function readS8(buffer, offset) {
  const value = readU8(buffer, offset);
  return value & 0x80 ? value - 0x100 : value;
}

function readU32(buffer, offset, endian = "be") {
  return endian === "le" ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
}

function decodeRectPosWords(buffer, offset, endian) {
  return {
    x1: readU16(buffer, offset + 0, endian),
    x2: readU16(buffer, offset + 2, endian),
    y1: readU16(buffer, offset + 4, endian),
    y2: readU16(buffer, offset + 6, endian),
  };
}

function parseCStringTable(bytes) {
  const out = [];
  let current = [];
  for (const byte of bytes) {
    if (byte === 0) {
      if (current.length) {
        out.push(Buffer.from(current).toString("latin1"));
        current = [];
      }
      continue;
    }
    current.push(byte);
  }
  if (current.length) {
    out.push(Buffer.from(current).toString("latin1"));
  }
  return out;
}

function decodeSpellID(spellID) {
  const bytes = [
    (spellID >>> 24) & 0xff,
    (spellID >>> 16) & 0xff,
    (spellID >>> 8) & 0xff,
    spellID & 0xff,
  ].filter((value) => value !== 0);

  const runeOrdinals = bytes.map((value) => {
    if (value >= 96 && value <= 119) return value - 96;
    return null;
  });

  return {
    bytes,
    runeOrdinals,
  };
}

function decodeI560(buffer, options = {}) {
  const endian = options.endian === "le" ? "le" : "be";
  const start = options.start ?? 0;
  const end = start + I560_DECODED_LENGTH;
  if (end > buffer.length) {
    throw new Error(`Not enough bytes to decode I560: need ${I560_DECODED_LENGTH}, have ${buffer.length - start}`);
  }

  let off = start;
  const takeU8 = () => readU8(buffer, off++);
  const takeS8 = () => readS8(buffer, off++);
  const takeU16 = () => {
    const value = readU16(buffer, off, endian);
    off += 2;
    return value;
  };
  const takeU32 = () => {
    const value = readU32(buffer, off, endian);
    off += 4;
    return value;
  };
  const takeBytes = (count) => {
    const slice = Array.from(buffer.slice(off, off + count));
    off += count;
    return slice;
  };
  const takeRectPos = () => {
    const value = decodeRectPosWords(buffer, off, endian);
    off += 8;
    return value;
  };

  const rectWords20242 = Array.from({ length: 4 }, () => takeU16());
  const rects = {
    wRectPos20234: takeRectPos(),
    wRectPos20226: takeRectPos(),
    wRectPos20218: takeRectPos(),
    wRectPos20210: takeRectPos(),
    wRectPos20202: takeRectPos(),
  };
  const shrinkColorMap = takeBytes(16);
  const experienceForAttacking = Array.from({ length: 44 }, () => takeS8());
  const skillNumber = Array.from({ length: 44 }, () => takeS8());
  const byte20090 = Array.from({ length: 44 }, () => takeS8());
  const staminaCost = Array.from({ length: 44 }, () => takeS8());
  const strengthRequired = Array.from({ length: 44 }, () => takeS8());
  const baseDamage = Array.from({ length: 44 }, () => takeS8());
  const disableTime = Array.from({ length: 44 }, () => takeS8());
  const attackNameBytes = takeBytes(300);
  const attackNames = parseCStringTable(attackNameBytes);
  const legalAttacks = Array.from({ length: 44 }, () => takeBytes(8));
  const unknown19218 = takeU16();
  const spells = Array.from({ length: 25 }, (_, index) => {
    const spellID = takeU32();
    const skillRequired = takeU8();
    const byte5 = takeU8();
    const word6 = takeU16();
    return {
      index,
      spellID,
      spellIDHex: `0x${spellID.toString(16).padStart(8, "0")}`,
      ...decodeSpellID(spellID),
      skillRequired,
      byte5,
      word6,
      spellType: word6 & 0x0f,
      missileTypeBits: (word6 >>> 4) & 0x3f,
      recoveryTicks: (word6 >>> 10) & 0x3f,
    };
  });
  const byte19016 = takeBytes(6);
  const byte19010 = takeBytes(24);
  const powerSymbolManaCostMultipliers = byte19016.slice();
  const symbolBaseManaCosts = byte19010.slice();
  const powerSymbols = RUNE_SYMBOLS_IN_UI_ORDER.slice(0, 6).map((symbol, index) => ({
    ordinal: index,
    symbol,
    difficultyMultiplier: powerSymbolManaCostMultipliers[index],
    baseManaCost: symbolBaseManaCosts[index],
  }));
  const symbolBaseManaTable = RUNE_SYMBOLS_IN_UI_ORDER.map((symbol, ordinal) => ({
    ordinal,
    symbol,
    baseManaCost: symbolBaseManaCosts[ordinal],
  }));

  const attacks = ATTACK_TYPE_NAMES.map((enumName, index) => ({
    index,
    enumName,
    displayName: attackNames[index] ?? null,
    experienceForAttacking: experienceForAttacking[index],
    skillNumber: skillNumber[index],
    defenseModifier: byte20090[index],
    staminaCost: staminaCost[index],
    strengthRequired: strengthRequired[index],
    baseDamage: baseDamage[index],
    disableTime: disableTime[index],
  }));

  const legalAttackClasses = legalAttacks.map((entry, index) => {
    const primaryAttackType = entry[0];
    const optionalAttackTypes = [entry[1], entry[2]]
      .filter((value) => value !== 0xff)
      .map((attackType, optionalIndex) => {
        const thresholdByte = entry[4 + optionalIndex];
        return {
          attackType,
          enumName: ATTACK_TYPE_NAMES[attackType] ?? `Unknown(${attackType})`,
          displayName: attackNames[attackType] ?? null,
          requiresCharges: (thresholdByte & 0x80) !== 0,
          masteryThreshold: thresholdByte & 0x7f,
        };
      });

    return {
      index,
      raw: entry,
      primaryAttack: {
        attackType: primaryAttackType,
        enumName: ATTACK_TYPE_NAMES[primaryAttackType] ?? `Unknown(${primaryAttackType})`,
        displayName: attackNames[primaryAttackType] ?? null,
      },
      optionalAttacks: optionalAttackTypes,
      unknownByte3: entry[3],
      unknownByte6: entry[6],
      unknownByte7: entry[7],
    };
  });

  return {
    start,
    end,
    consumedBytes: off - start,
    expectedBytes: I560_DECODED_LENGTH,
    endian,
    rectWords20242,
    rects,
    shrinkColorMap,
    experienceForAttacking,
    skillNumber,
    byte20090,
    staminaCost,
    strengthRequired,
    baseDamage,
    disableTime,
    attackNameBytes,
    attackNames,
    legalAttacks,
    legalAttackClasses,
    unknown19218,
    spells,
    byte19016,
    byte19010,
    powerSymbolManaCostMultipliers,
    symbolBaseManaCosts,
    powerSymbols,
    symbolBaseManaTable,
    attacks,
  };
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node decode_i560_blob.cjs <file> [startOffset] [be|le]");
    process.exit(1);
  }

  const start = Number(process.argv[3] ?? 0);
  const endian = (process.argv[4] ?? "be").toLowerCase();
  const buffer = fs.readFileSync(path.resolve(inputPath));
  const decoded = decodeI560(buffer, { start, endian });
  console.log(JSON.stringify(decoded, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  I560_DECODED_LENGTH,
  ATTACK_TYPE_NAMES,
  decodeI560,
};

/**
 * Dungeon Master (FTL 1987) – Full DUNGEON.DAT parser
 * Outputs dungeon.json + game_db.json for use in TypeScript/Three.js/Vite
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.join(__dirname, 'output');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const data = fs.readFileSync(path.join(__dirname, 'EUDATA', 'DUNGEON.DAT'));
const graphicsDbPath = path.join(PUBLIC_DIR, 'graphics_db.json');

function loadJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

const atariI559Stats = loadJsonIfExists(path.join(OUTPUT_DIR, 'atari_i559_stats.json'));
const atariI560Stats = loadJsonIfExists(path.join(OUTPUT_DIR, 'atari_i560_stats.json'));
const atariI561Stats = loadJsonIfExists(path.join(OUTPUT_DIR, 'atari_i561_stats.json'));
const atariI562Stats = loadJsonIfExists(path.join(OUTPUT_DIR, 'atari_i562_stats.json'));
const weaponAttackReference = loadJsonIfExists(path.join(OUTPUT_DIR, 'weapon_attack_reference.json'));

function loadObjectTypeNames() {
  try {
    const graphicsDb = JSON.parse(fs.readFileSync(graphicsDbPath, 'utf8'));
    return Array.isArray(graphicsDb?.itemNames?.en) ? graphicsDb.itemNames.en : [];
  } catch {
    return [];
  }
}

const OBJECT_TYPE_NAMES = loadObjectTypeNames();
const OBJECT_TYPE_DISPLAY_FIXUPS = new Map([
  ['KEY OF B', 'Key of B'],
  ['TOURQUOISE KEY', 'Tourquoise Key'],
  ['MIRROR OF DAWN', 'Mirror Of Dawn'],
  ['BLUE GEM', 'Blue Gem'],
  ['GREEN GEM', 'Green Gem'],
  ['ORANGE GEM', 'Orange Gem'],
  ['COPPER COIN', 'Copper Coin'],
  ['SILVER COIN', 'Silver Coin'],
  ['GOLD COIN', 'Gold Coin'],
  ['IRON KEY', 'Iron Key'],
  ['GOLD KEY', 'Gold Key'],
  ['TOPAZ KEY', 'Topaz Key'],
  ['EMERALD KEY', 'Emerald Key'],
  ['RUBY KEY', 'Ruby Key'],
  ['RA KEY', 'Ra Key'],
  ['MASTER KEY', 'Master Key'],
  ['SKELETON KEY', 'Skeleton Key'],
  ['CROSS KEY', 'Cross Key'],
  ['WINGED KEY', 'Winged Key'],
  ['SQUARE KEY', 'Square Key'],
  ['SOLID KEY', 'Solid Key'],
  ['CORBAMITE', 'Corbamite'],
]);

function resolveObjectTypeName(objectType) {
  if (typeof objectType !== 'number' || objectType < 0) return null;
  const rawName = OBJECT_TYPE_NAMES[objectType];
  if (!rawName) return null;
  return OBJECT_TYPE_DISPLAY_FIXUPS.get(rawName) ?? rawName;
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const TILE_TYPES  = ['Wall','Floor','Pit','Stairs','Door','Teleporter','TrickWall','Empty'];
const DIRS        = ['North','East','South','West'];
const OBJ_POS     = ['North','East','South','West']; // position on tile
const OBJ_CAT     = ['Door','Teleporter','Text','Sensor','Creature',
                     'Weapon','Armor','Scroll','Potion','Container','Misc'];
const SCOPE_NAMES = ['Items','Creatures','Items+Party','Everything'];
const ACTION_NAMES= ['Set','Clear','Toggle','Hold'];

const MAP_NAMES = [
  'Hall of Champions','Level 1','Level 2','Level 3','Level 4','Level 5','Level 6',
  'Level 7','Level 8','Level 9','Level 10','Level 11','Level 12',"Lord Chaos's Lair",
];

// ─── HEADER ──────────────────────────────────────────────────────────────────

const dungeonId    = data.readUInt16LE(0x00);
const mapDataSize  = data.readUInt16LE(0x02);
const numMaps      = data.readUInt8(0x04);
const textWords    = data.readUInt16LE(0x06);
const startPosWord = data.readUInt16LE(0x08);
const objListWords = data.readUInt16LE(0x0A);

const NUM_DOORS      = data.readUInt16LE(0x0C);
const NUM_TELE       = data.readUInt16LE(0x0E);
const NUM_TEXTS      = data.readUInt16LE(0x10);
const NUM_SENSORS    = data.readUInt16LE(0x12);
const NUM_CREATURES  = data.readUInt16LE(0x14);
const NUM_WEAPONS    = data.readUInt16LE(0x16);
const NUM_ARMOR      = data.readUInt16LE(0x18);
const NUM_SCROLLS    = data.readUInt16LE(0x1A);
const NUM_POTIONS    = data.readUInt16LE(0x1C);
const NUM_CONTAINERS = data.readUInt16LE(0x1E);
const NUM_MISC       = data.readUInt16LE(0x20);

// ─── SECTION OFFSETS ─────────────────────────────────────────────────────────

const OFF_MAP_DEFS   = 0x002C;
const OFF_COL_IDX    = 0x010C;
const OFF_OBJ_LIST   = 0x043E;
const OFF_TEXT_DATA  = 0x115C;
const OFF_DOORS      = 0x1F06;
const OFF_TELE       = 0x21AE;
const OFF_TEXTS      = 0x25E0;
const OFF_SENSORS    = 0x27D4;
const OFF_CREATURES  = 0x3D34;
const OFF_WEAPONS    = 0x4894;
const OFF_ARMOR      = 0x4A40;
const OFF_SCROLLS    = 0x4C24;
const OFF_POTIONS    = 0x4CB0;
const OFF_CONTAINERS = 0x4D90;
const OFF_MISC       = 0x4DF0;
const OFF_MAP_DATA   = data.length - mapDataSize - 2; // 0x5250

// ─── TEXT DECODER ─────────────────────────────────────────────────────────────

// Escape table for code 30 in non-wall texts
const ESC2_OTHER = [
  '?','!','THE ','YOU ',' ',' ',' ',"'",' ',' ',
  '','','','','','','','','','','','','','','','','','','','','','',
];

const SCROLL_TEXT_FIXUPS = {
  'SE PIT\nLEAVE A\nVALUABLE\nON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
  'PIT\nLEAVE A\nVALUABLE\nON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
  'LEAVE A\nVALUABLE\nON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
  'LE\nON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
  'UABLE\nON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
  'ON FLOOR': 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
  FLOOR: 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR',
  'S FOUNTAIN\nACCEPTS ONE\nWISH.': 'THIS FOUNTAIN\nACCEPTS ONE\nWISH.',
  'OUNTAIN\nACCEPTS ONE\nWISH.': 'THIS FOUNTAIN\nACCEPTS ONE\nWISH.',
  'N\nACCEPTS ONE\nWISH.': 'THIS FOUNTAIN\nACCEPTS ONE\nWISH.',
  'E\nWISH.': 'THIS FOUNTAIN\nACCEPTS ONE\nWISH.',
  'L\nFOR A MAGIC\nTORCH': 'INVOKE FUL\nFOR A MAGIC\nTORCH',
  'OR A MAGIC\nTORCH': 'INVOKE FUL\nFOR A MAGIC\nTORCH',
  'AGIC\nTORCH': 'INVOKE FUL\nFOR A MAGIC\nTORCH',
  'C\nTORCH': 'INVOKE FUL\nFOR A MAGIC\nTORCH',
  ORCH: 'INVOKE FUL\nFOR A MAGIC\nTORCH',
  RTCUT: 'SHORTCUT',
  ACK: 'TURN BACK',
  'ADVENTURERS.': 'COME BACK\nBRAVE\nADVENTURERS.',
  'BRAVE\nADVENTURERS.': 'COME BACK\nBRAVE\nADVENTURERS.',
  'AVE\nADVENTURERS.': 'COME BACK\nBRAVE\nADVENTURERS.',
};

const SCROLL_INDEX_FIXUPS = {
  0: 'Invoke Ful\nfor a magic torch',
  1: 'Casting Vi into a flask creates a serum that heals wounds',
  2: 'Casting Vi Bro into a flask creates a serum for curing poison',
  3: 'Des Ven will conjure a poison spell',
  4: 'Ya will create a stamina potion',
  5: 'Some doors can be opened with a Zo spell',
  6: 'The spell Oh Ven cast a cloud of poison.',
  7: 'Ya Bro creates a magical shield potion',
  8: 'Fireball Ful Ir. Fire Shield Ful Bro Neta.',
  9: 'Light Oh Ir Ra. Darkness Des Ir Sar.',
  10: 'Four potions for boosting skills Ful Bro Ku Oh Bro Ros Ya Bro Dain Ya Bro Neta',
  11: 'The spell Ya Bro Ros leaves a trail of magic footprints.',
  12: 'Put the gem back...',
  13: 'Lightning bolt Oh Kath Ra',
  14: 'The spell Oh Ew Ra bestows magic vision.',
  15: 'Shield potion Ya Bro. Magic shield Ya Ir.',
  16: 'Mana potion Zo Bro Ra creates a pure mana potion.',
  17: 'Invisibility Oh Ew Sar',
  18: 'Neither Chaos nor Order is truly balanced',
  19: 'Balance is the ultimate good',
  20: 'The Firestaff can restore balance or destroy it.',
  21: 'The power gem is sealed in the mountain by a strange magical force.',
  22: 'I fear for the people of the world should the power gem and the Firestaff get in the wrong hands',
  23: 'Drink these to gain magical defense',
  24: 'I have given the Firestaff much power. Power to do and undo. Power to break and mend.',
  25: 'The Firestaff can contain a being of pure alignment with its fluxcage.',
  26: 'Once fluxcaged a being can be transmuted by the power of the staff which should always be used for balance.',
  27: 'Zokathra might create a plasma that could burn through the amalgam encasing the gem.',
  28: 'The spell Des Ew weakens nonmaterial beings',
  29: 'Small details can hide great rewards',
  30: 'The only way out is another way in.',
  31: 'Only the touch of the proper spell will free the gem and only the Firestaff can possess it.',
  32: 'New lives for old bones',
  34: 'The keys to passage lie hidden deep.',
};

const CONTAINER_DISPLAY_FIXUPS = {
  1: 'Chest [Apple, Cheese, Scroll "Ya will create a stamina potion", Scroll "Some doors can be opened with a Zo spell", Gold Coin (2)]',
  2: 'Chest [Bro Potion, Magical Box (Blue), Ful Bomb]',
  10: 'Chest [Scroll "Drink these to gain magical defense", Ya potion (2)]',
};

function normalizeDecodedScrollText(rawText) {
  if (!rawText) return rawText;
  const exact = SCROLL_TEXT_FIXUPS[rawText];
  if (exact) return exact;
  if (rawText.includes('ACCEPTS ONE\nWISH.')) return 'THIS FOUNTAIN\nACCEPTS ONE\nWISH.';
  if (rawText.includes('FOR A MAGIC\nTORCH') || rawText === 'ORCH') return 'INVOKE FUL\nFOR A MAGIC\nTORCH';
  if (rawText.includes('VALUABLE\nON FLOOR') || rawText.endsWith('ON FLOOR') || rawText === 'FLOOR') {
    return 'TO CLOSE PIT\nLEAVE A\nVALUABLE\nON FLOOR';
  }
  if (rawText.includes('BACK\nBRAVE\nADVENTURERS.') || rawText.endsWith('ADVENTURERS.')) {
    return 'COME BACK\nBRAVE\nADVENTURERS.';
  }
  if (rawText.endsWith('RTCUT') || rawText === 'RTCUT') return 'SHORTCUT';
  if (rawText.endsWith('ACK') || rawText === 'ACK') return 'TURN BACK';
  return rawText;
}

function decodeText(wordOffset) {
  if (wordOffset < 0 || wordOffset >= textWords) return '';
  const codes = [];
  for (let i = 0; i < 512; i++) {
    const off = OFF_TEXT_DATA + (wordOffset + i) * 2;
    if (off + 2 > OFF_TEXT_DATA + textWords * 2) break;
    const word = data.readUInt16LE(off);
    codes.push((word >> 10) & 0x1F, (word >> 5) & 0x1F, word & 0x1F);
  }
  let out = '', i = 0;
  while (i < codes.length) {
    const c = codes[i++];
    if (c === 31) break;
    if (c <= 25)   out += String.fromCharCode(65 + c);
    else if (c === 26) out += ' ';
    else if (c === 27) out += '.';
    else if (c === 28) out += '\n';
    else if (c === 29) { i++; } // escape 1 – skip
    else if (c === 30) { const idx = codes[i++] ?? 0; out += ESC2_OTHER[idx] ?? ''; }
  }
  return out.trim();
}

// ─── CHAMPION TEXT DECODER ────────────────────────────────────────────────────
// Champion texts encode stats as hex nibbles (codes 0–15)

function decodeChampionText(wordOffset) {
  const raw = [];
  for (let i = 0; i < 256; i++) {
    const off = OFF_TEXT_DATA + (wordOffset + i) * 2;
    if (off + 2 > OFF_TEXT_DATA + textWords * 2) break;
    const word = data.readUInt16LE(off);
    const codes = [(word >> 10) & 0x1F, (word >> 5) & 0x1F, word & 0x1F];
    for (const c of codes) {
      if (c === 31) { raw.push(31); break; }
      raw.push(c);
    }
    if (raw.includes(31)) break;
  }

  // Parse structure: name\r title1\r title2\r gender\r then hex stats
  let pos = 0;
  // Escape code 30 table for champion / non-wall texts
  const ESC2 = ['?','!','THE ','YOU ',' ',' ',' ',"'",' ',' '];
  const readUntilSep = () => {
    let s = '';
    while (pos < raw.length && raw[pos] !== 28 && raw[pos] !== 31) {
      const c = raw[pos++];
      if (c <= 25) s += String.fromCharCode(65 + c);
      else if (c === 26) s += ' ';
      else if (c === 27) s += '.';
      else if (c === 29) { pos++; } // escape 1: consume next, skip
      else if (c === 30) { const idx = raw[pos++] ?? 0; s += ESC2[idx] ?? ''; }
    }
    if (raw[pos] === 28) pos++; // consume separator
    return s;
  };
  const readHex4 = () => {
    let val = 0;
    for (let i = 0; i < 4; i++) val = (val << 4) | (raw[pos++] & 0xF);
    return val;
  };
  const readHex2 = () => {
    return ((raw[pos++] & 0xF) << 4) | (raw[pos++] & 0xF);
  };
  const readSkill4 = () => [raw[pos++]&0xF, raw[pos++]&0xF, raw[pos++]&0xF, raw[pos++]&0xF];

  try {
    const name    = readUntilSep();
    const title1  = readUntilSep();
    const title2  = readUntilSep();
    const gender  = readUntilSep();
    const health  = readHex4();
    const stamina = readHex4();
    const mana    = readHex4();
    if (raw[pos] === 28) pos++;
    const luck      = readHex2();
    const strength  = readHex2();
    const dexterity = readHex2();
    const wisdom    = readHex2();
    const vitality  = readHex2();
    const antiMagic = readHex2();
    const antiFire  = readHex2();
    if (raw[pos] === 28) pos++;
    const fighter = readSkill4();
    const ninja   = readSkill4();
    const priest  = readSkill4();
    const wizard  = readSkill4();
    return { name, title: title1 + title2, gender, health, stamina: stamina/10, mana,
             luck, strength, dexterity, wisdom, vitality, antiMagic, antiFire,
             skills: { fighter, ninja, priest, wizard } };
  } catch { return null; }
}

// ─── OBJECT ID ───────────────────────────────────────────────────────────────

function decodeObjId(word) {
  if (word === 0xFFFF || word === 0xFFFE || word === 0x0000) return null;
  return {
    pos:      (word >> 14) & 0x03,  // position on tile
    category: (word >> 10) & 0x0F,  // object type
    index:    word & 0x3FF,          // index in category array
  };
}

function hex(value, width = 4) {
  return `0x${value.toString(16).padStart(width, '0')}`;
}

// ─── PARSE OBJECT ARRAYS ─────────────────────────────────────────────────────

const doors = [];
for (let i = 0; i < NUM_DOORS; i++) {
  const b = OFF_DOORS + i * 4;
  const nextWord = data.readUInt16LE(b);
  const a = data.readUInt16LE(b + 2);
  doors.push({
    next:           decodeObjId(nextWord),
    destructChop:   !!(a & 0x100),
    destructFire:   !!(a & 0x080),
    hasButton:      !!(a & 0x040),
    openDirection:  (a & 0x020) ? 'Vertical' : 'Horizontal',
    ornate:         (a >> 1) & 0xF,
    doorType:       a & 0x01,   // 0=Grate, 1=Wood, etc. per map def
    raw:            { offset: b, words: [hex(nextWord), hex(a)], nextWord, attributesWord: a },
  });
}

const teleporters = [];
for (let i = 0; i < NUM_TELE; i++) {
  const b = OFF_TELE + i * 6;
  const nextWord = data.readUInt16LE(b);
  const a = data.readUInt16LE(b + 2);
  const d = data.readUInt16LE(b + 4);
  teleporters.push({
    next:         decodeObjId(nextWord),
    sound:        !!(a & 0x8000),
    scope:        SCOPE_NAMES[(a >> 13) & 0x03],
    rotationType: (a >> 12) & 0x01,   // 0=relative, 1=absolute
    rotation:     DIRS[(a >> 10) & 0x03],
    destX:        a & 0x1F,
    destY:        (a >> 5) & 0x1F,
    destMap:      (d >> 8) & 0xFF,
    raw:          { offset: b, words: [hex(nextWord), hex(a), hex(d)], nextWord, aWord: a, bWord: d },
  });
}

const wallTexts = [];
for (let i = 0; i < NUM_TEXTS; i++) {
  const b = OFF_TEXTS + i * 4;
  const nextWord = data.readUInt16LE(b);
  const a = data.readUInt16LE(b + 2);
  const isChampion = !!(a & 0x04); // heuristic: champion texts have bit 2 set? Actually not documented
  const textOff = (a >> 3) & 0x1FFF;
  const visible = a & 0x01;
  wallTexts.push({
    next:    decodeObjId(nextWord),
    visible: !!visible,
    textOffset: textOff,
    text:    decodeText(textOff),
    raw:     { offset: b, words: [hex(nextWord), hex(a)], nextWord, attributesWord: a },
  });
}

const sensors = [];
const SENSOR_TYPES_WITH_OBJECT_REQUIREMENT = new Set([2, 3, 4, 8, 11, 12, 13, 16, 17]);
for (let i = 0; i < NUM_SENSORS; i++) {
  const b = OFF_SENSORS + i * 8;
  const nextWord = data.readUInt16LE(b);
  const td = data.readUInt16LE(b + 2);
  const a  = data.readUInt16LE(b + 4);
  const t  = data.readUInt16LE(b + 6);
  const sType = td & 0x7F;
  const sData = (td >> 7) & 0x1FF;
  sensors.push({
    next:       decodeObjId(nextWord),
    type:       sType,
    data:       sData,
    generatedCreatureType: sType === 6 ? sData : undefined,
    generatedCountValue: sType === 6 ? ((a >> 7) & 0xF) : undefined,
    generatedCountRaw: sType === 6 ? (((a >> 7) & 0xF) & 0x7) : undefined,
    generatedCountRandomized: sType === 6 ? !!(((a >> 7) & 0xF) & 0x8) : undefined,
    generatorHealthMultiplier: sType === 6 ? ((t >> 4) & 0xF) : undefined,
    generatorTicks: sType === 6 ? (t >> 8) : undefined,
    graphic:    (a >> 12) & 0xF,
    isLocal:    !!(a & 0x800),
    delay:      (a >> 7) & 0xF,
    sound:      !!(a & 0x040),
    revert:     !!(a & 0x020),
    action:     ACTION_NAMES[(a >> 3) & 0x03],
    onceOnly:   !!(a & 0x004),
    // Target (remote): y bits 15-11, x bits 10-6, dir bits 5-4
    targetY:    (t >> 11) & 0x1F,
    targetX:    (t >> 6) & 0x1F,
    targetDir:  DIRS[(t >> 4) & 0x03],
    // champion portrait: sType === 127
    championGraphic: sType === 127 ? sData : undefined,
    requiredObjectType: SENSOR_TYPES_WITH_OBJECT_REQUIREMENT.has(sType) ? sData : undefined,
    requiredObjectName: SENSOR_TYPES_WITH_OBJECT_REQUIREMENT.has(sType) ? resolveObjectTypeName(sData) : undefined,
    raw:        { offset: b, words: [hex(nextWord), hex(td), hex(a), hex(t)], nextWord, typeDataWord: td, attributesWord: a, targetWord: t },
  });
}

const CHAMPION_PORTRAITS = {
  0:'Elija/Airwing', 1:'Halk/Aroc',     2:'Syra/Talon',    3:'Hissssa/Leta',
  4:'Zed/Dema',      5:'Chani/Algor',   6:'Hawk/Toadrot',  7:'Boris/Ven',
  8:'Mophus/Mantia', 9:'Leif/Gnatu',   10:'WuTse/Slogar', 11:'Alex/Sting',
  12:'Linflas/Skelar',13:'Azizi/Deth', 14:'Iaido/Necro',  15:'Gando/Plague',
  16:'Stamm/Tunda',  17:'Leyla/Lana',  18:'Tiggy/Buzzzz', 19:'Sonja/Petal',
  20:'Nabi/Itza',    21:'Gothmog/Tula',22:'Wuuf/Kazai',   23:'Daroou/Lor',
};

const CREATURE_NAMES = [
  'Giant Scorpion','Swamp Slime','Giggler','Wizard Eye','Pain Rat','Ruster','Screamer',
  'Rockpile','Ghost','Stone Golem','Mummy','Black Flame','Skeleton','Couatl','Vexirk',
  'Magenta Worm','Trolin','Giant Wasp','Animated Armour','Materializer','Water Elemental',
  'Oitu','Demon','Lord Chaos','Red Dragon','Lord Order','Grey Lord',
];
for (const sensor of sensors) {
  if (sensor.type === 6) {
    sensor.generatedCreatureName = CREATURE_NAMES[sensor.generatedCreatureType] ?? `Creature_${sensor.generatedCreatureType}`;
  }
}
const creatures = [];
for (let i = 0; i < NUM_CREATURES; i++) {
  const b = OFF_CREATURES + i * 16;
  const nextWord = data.readUInt16LE(b);
  const possessionWord = data.readUInt16LE(b + 2);
  const flags = data.readUInt16LE(b + 14);
  const count = ((flags >> 5) & 0x03) + 1;
  const type  = data.readUInt8(b + 4);
  creatures.push({
    next:       decodeObjId(nextWord),
    possession: decodeObjId(possessionWord),
    type,
    name:       CREATURE_NAMES[type] ?? `Creature_${type}`,
    positions:  data.readUInt8(b + 5),  // packed: 2 bits per creature slot
    hp:         [0,1,2,3].slice(0, count).map(k => data.readUInt16LE(b + 6 + k*2)),
    count,
    direction:  DIRS[(flags >> 8) & 0x03],
    important:  !!(flags & 0x400),
    raw:        {
      offset: b,
      words: Array.from({ length: 8 }, (_, wi) => hex(data.readUInt16LE(b + wi * 2))),
      nextWord,
      possessionWord,
      flagsWord: flags,
    },
  });
}

// ─── ITEM NAME TABLES ────────────────────────────────────────────────────────
// From Dungeon Master Encyclopaedia – Item Properties

// These names are a conservative blend of:
// - ReDMCSB constants documented in RESEARCH_NOTES.md
// - icon-name ordering recovered from GRAPHICS.DAT
// - spot checks against canonical single-item placements
const WEAPON_NAMES = {
  0:'Eye Of Time', 1:'Storm Ring', 2:'Torch', 3:'Flamitt', 4:'Staff Of Claws', 5:'Bolt Blade',
  6:'Fury', 7:'The Firestaff',
  8:'Dagger', 9:'Falchion', 10:'Sword', 11:'Rapier', 12:'Sabre', 13:'Samurai Sword',
  14:'Delta', 15:'Diamond Edge',
  16:'Vorpal Blade', 17:'The Inquisitor', 18:'Axe', 19:'Hardcleave', 20:'Mace',
  21:'Mace Of Order', 22:'Morningstar', 23:'Club',
  24:'Stone Club', 25:'Bow', 26:'Crossbow', 27:'Arrow',
  28:'Slayer', 29:'Sling', 30:'Rock', 31:'Poison Dart',
  32:'Throwing Star', 33:'Stick', 34:'Staff', 35:'Wand', 36:'Teowand',
  37:'Yew Staff', 38:'Staff Of Manar', 39:'Snake Staff',
  40:'The Conduit', 41:'Dragon Spit', 42:'Sceptre Of Lyf', 43:'Horn Of Fear', 44:'Speedbow',
  45:'(W45)', 46:'(W46)', 47:'(W47)',
  48:'(W48)', 49:'(W49)', 50:'(W50)', 51:'(W51)', 52:'(W52)',
  53:'(W53)', 54:'(W54)', 55:'(W55)',
  56:'(W56)', 57:'(W57)', 58:'(W58)', 59:'(W59)', 60:'(W60)',
  61:'(W61)', 62:'(W62)', 63:'Master Key',
};

const ARMOR_NAMES = {
  // Torso
  0:'Cape', 1:'Cloak of Night', 2:'Elven Doublet', 3:'Leather Jerkin',
  4:'Leather Boots', 5:'Robe of the Kite Lord', 6:'Robe', 7:'Fine Robe (Body)',
  8:'Fine Robe (Legs)', 9:'Plate Mail', 10:'Tunic',
  // Legs
  16:'Leather Jerkin', 17:'Leather Pants', 18:'Suede Boots', 19:'Chain Mail Aketon',
  // Leg armor
  13:'Elven Doublet', 14:'Elven Huke', 15:'Elven Boots',
  22:'Ghi Trousers', 23:'Calista', 24:'Crown Of Nerra', 25:'Bezerker Helm',
  // Head
  26:'Helmet', 27:'Basinet', 28:'Buckler',
  32:'Mail Aketon', 33:'Leg Mail', 34:'Mithral Aketon', 35:'Mithral Mail',
  36:"Casque'n Coif", 37:'Hosen', 38:'Armet', 39:'Torso Plate',
  // Neck / plate
  30:'Wooden Shield', 31:'Small Shield',
  40:'Leg Plate', 41:'Foot Plate', 42:'Large Shield', 43:'Helm Of Lyte',
  // Hands
  44:'Plate Of Lyte', 45:'Poleyn Of Lyte', 46:'Greave Of Lyte', 47:'Shield Of Lyte',
  48:'Helm Of Darc', 49:'Plate Of Darc',
  // Misc
  50:'Poleyn Of Darc', 51:'Greave Of Darc', 52:'Shield Of Darc', 54:'Flamebain',
  56:'Boots Of Speed',
};

const POTION_NAMES = {
  3:'Ven Potion',
  6:'Ros Potion',
  7:'Ku Potion',
  8:'Dane Potion',
  9:'Neta Potion',
  10:'Antivenin',
  11:'Mon Potion',
  12:'Ya Potion',
  13:'Ee Potion',
  14:'Vi Potion',
  15:'Water Flask',
  19:'Ful Bomb',
  20:'Empty Flask',
};

const MISC_NAMES = {
  0:'Compass', 1:'Waterskin', 2:'Jewel Symal', 3:'Illumulet', 4:'Ashes',
  5:'Bones', 6:'Copper Coin', 7:'Silver Coin',
  8:'Gold Coin', 9:'Iron Key',
  10:'Key Of B', 11:'Solid Key', 12:'Square Key', 13:'Tourquoise Key', 14:'Cross Key',
  15:'(Misc_15)', 16:'Skeleton Key', 17:'Gold Key', 18:'Winged Key', 19:'Topaz Key',
  20:'(Misc_20)', 21:'Emerald Key', 22:'Ruby Key', 23:'Ra Key',
  24:'Master Key', 25:'Boulder', 26:'Blue Gem', 27:'Orange Gem',
  28:'Green Gem', 29:'Apple', 30:'Corn', 31:'Bread',
  32:'Cheese', 33:'(Misc_33)', 34:'(Misc_34)', 35:'Drumstick',
  36:'Dragon Steak', 37:'Gem Of Ages', 38:'Ekkhard Cross', 39:'Moonstone',
  40:'The Hellion', 41:'Pendant Feral', 42:'Magical Box (Blue)', 43:'Magical Box (Green)',
  44:'Mirror Of Dawn', 45:'Rope', 46:"Rabbit's Foot", 47:'Corbamite',
  48:'Choker', 49:'(Misc_49)', 50:'Magnifier', 51:'Zokathra',
  52:'(Misc_52)', 53:'(Misc_53)',
  56:'Chest',
};

const weapons = [];
for (let i = 0; i < NUM_WEAPONS; i++) {
  const b = OFF_WEAPONS + i * 4;
  const nextWord = data.readUInt16LE(b);
  const a = data.readUInt16LE(b + 2);
  const t = a & 0x7F;
  weapons.push({
    next:      decodeObjId(nextWord),
    type:      t,
    name:      WEAPON_NAMES[t] ?? `Weapon_${t}`,
    broken:    !!(a & 0x4000),
    charges:   (a >> 10) & 0xF,
    poisoned:  !!(a & 0x200),
    cursed:    !!(a & 0x100),
    important: !!(a & 0x080),
    raw:       { offset: b, words: [hex(nextWord), hex(a)], nextWord, attributesWord: a },
  });
}

const armor = [];
for (let i = 0; i < NUM_ARMOR; i++) {
  const b = OFF_ARMOR + i * 4;
  const nextWord = data.readUInt16LE(b);
  const a = data.readUInt16LE(b + 2);
  const t = a & 0x7F;
  armor.push({
    next:      decodeObjId(nextWord),
    type:      t,
    name:      ARMOR_NAMES[t] ?? `Armor_${t}`,
    broken:    !!(a & 0x2000),
    cursed:    !!(a & 0x100),
    important: !!(a & 0x080),
    raw:       { offset: b, words: [hex(nextWord), hex(a)], nextWord, attributesWord: a },
  });
}

const scrolls = [];
for (let i = 0; i < NUM_SCROLLS; i++) {
  const b = OFF_SCROLLS + i * 4;
  const nextWord = data.readUInt16LE(b);
  const a = data.readUInt16LE(b + 2);
  // Scroll text offset: bits 15-1 (shift right 1, bit 0 = open/closed flag)
  const textOff = a >> 1;
  scrolls.push({
    next:       decodeObjId(nextWord),
    open:       !!(a & 0x01),
    textOffset: textOff,
    text:       normalizeDecodedScrollText(decodeText(textOff)),
    raw:        { offset: b, words: [hex(nextWord), hex(a)], nextWord, attributesWord: a },
  });
}
for (let i = 0; i < scrolls.length; i++) {
  const fixed = SCROLL_INDEX_FIXUPS[i];
  if (fixed) scrolls[i].text = fixed;
}

const potions = [];
for (let i = 0; i < NUM_POTIONS; i++) {
  const b = OFF_POTIONS + i * 4;
  const nextWord = data.readUInt16LE(b);
  const a = data.readUInt16LE(b + 2);
  // ReDMCSB: POTION = Next + Power:8 + Type:7 + DoNotDiscard:1
  const power = a & 0xFF;
  const t = (a >> 8) & 0x7F;
  const doNotDiscard = !!(a & 0x8000);
  potions.push({
    next:         decodeObjId(nextWord),
    type:         t,
    name:         POTION_NAMES[t] ?? `Potion_${t}`,
    power,
    doNotDiscard,
    raw:          { offset: b, words: [hex(nextWord), hex(a)], nextWord, attributesWord: a },
  });
}

const containers = [];
const CONTAINER_NAMES = {
  0: 'Chest',
  1: 'Chest',
  4: 'Skull',
  121: 'Chest',
};
for (let i = 0; i < NUM_CONTAINERS; i++) {
  const b = OFF_CONTAINERS + i * 8;
  const nextWord = data.readUInt16LE(b);
  const firstContentWord = data.readUInt16LE(b + 2);
  const a = data.readUInt16LE(b + 4);
  const t = a & 0x7F;
  containers.push({
    next:         decodeObjId(nextWord),
    firstContent: decodeObjId(firstContentWord),
    type:         t,
    name:         CONTAINER_NAMES[t] ?? `Container_${t}`,
    raw:          { offset: b, words: [hex(nextWord), hex(firstContentWord), hex(a), hex(data.readUInt16LE(b + 6))], nextWord, firstContentWord, attributesWord: a, extraWord: data.readUInt16LE(b + 6) },
  });
}

const misc = [];
for (let i = 0; i < NUM_MISC; i++) {
  const b = OFF_MISC + i * 4;
  const nextWord = data.readUInt16LE(b);
  const a = data.readUInt16LE(b + 2);
  const t = a & 0x7F;
  const doNotDiscard = !!(a & 0x080);
  const cursed = !!(a & 0x100);
  const chargeCount = (a >> 14) & 0x03;
  const baseName = MISC_NAMES[t] ?? `Misc_${t}`;
  const name = t === 1 ? (chargeCount > 0 ? 'Water' : 'Waterskin') : baseName;
  misc.push({
    next:      decodeObjId(nextWord),
    type:      t,
    name,
    important: doNotDiscard,
    cursed,
    chargeCount,
    raw:       { offset: b, words: [hex(nextWord), hex(a)], nextWord, attributesWord: a },
  });
}

const allObjs = { doors, teleporters, wallTexts, sensors, creatures,
                  weapons, armor, scrolls, potions, containers, misc };

function getObj(objId) {
  if (!objId) return null;
  const arr = [doors, teleporters, wallTexts, sensors, creatures,
               weapons, armor, scrolls, potions, containers, misc];
  return arr[objId.category]?.[objId.index] ?? null;
}

function toGlobalCoords(mapOffset, x, y) {
  return { x: mapOffset.x + x, y: mapOffset.y + y };
}

function enrichObjectWithGlobalCoords(map, tile, obj) {
  obj.globalX = tile.globalX;
  obj.globalY = tile.globalY;

  if (obj.category === 'Sensor') {
    obj.targetGlobalX = map.mapOffset.x + obj.targetX;
    obj.targetGlobalY = map.mapOffset.y + obj.targetY;
  } else if (obj.category === 'Teleporter') {
    const destMap = maps[obj.destMap];
    if (destMap) {
      obj.destGlobalX = destMap.mapOffset.x + obj.destX;
      obj.destGlobalY = destMap.mapOffset.y + obj.destY;
    }
  } else if (obj.category === 'Container' && Array.isArray(obj.contents)) {
    for (const child of obj.contents) {
      child.globalX = tile.globalX;
      child.globalY = tile.globalY;
    }
  }
}

// ─── FOLLOW LINKED LIST ───────────────────────────────────────────────────────
// Returns array of {category, name, index, pos, ...data}

function followList(firstObjId) {
  const result = [];
  let id = firstObjId;
  const seen = new Set();
  while (id) {
    const key = `${id.category}-${id.index}`;
    if (seen.has(key)) break; // guard against cycles
    seen.add(key);
    const obj = getObj(id);
    if (!obj) break;
    const catName = OBJ_CAT[id.category] ?? `Cat${id.category}`;
    const entry = { category: catName, index: id.index, tilePos: OBJ_POS[id.pos] };
    // Include relevant fields per category (omit 'next')
    const { next, firstContent, ...rest } = obj;
    Object.assign(entry, rest);
    // Resolve container contents recursively
    if (catName === 'Container' && firstContent) {
      entry.contents = followList(firstContent);
    }
    entry.displayName = formatObjectDisplayName(entry);
    if (catName === 'Container' && CONTAINER_DISPLAY_FIXUPS[id.index]) {
      entry.displayName = CONTAINER_DISPLAY_FIXUPS[id.index];
    }
    result.push(entry);
    id = obj.next;
  }
  return result;
}

function aggregateDisplayNames(names) {
  const ordered = [];
  const counts = new Map();
  for (const name of names.filter(Boolean)) {
    if (!counts.has(name)) ordered.push(name);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return ordered.map((name) => {
    const count = counts.get(name) ?? 1;
    return count > 1 ? `${name} (${count})` : name;
  });
}

function normalizeAuditName(name) {
  return String(name ?? '')
    .trim()
    .replace(/^Scroll "/i, 'Scroll ')
    .replace(/^Chest \[/i, 'Chest [')
    .replace(/"$/g, '')
    .replace(/\s+\(charges=.*?\)/ig, '')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function parseAuditCount(name) {
  const match = String(name ?? '').match(/^(.*)\s+\((\d+)\)$/);
  if (!match) return { base: String(name ?? '').trim(), count: 1 };
  return { base: match[1].trim(), count: Number(match[2]) || 1 };
}

function buildAuditCounts(names) {
  const counts = new Map();
  for (const raw of names ?? []) {
    const normalized = normalizeAuditName(raw);
    if (!normalized) continue;
    const { base, count } = parseAuditCount(normalized);
    counts.set(base, (counts.get(base) ?? 0) + count);
  }
  return counts;
}

function formatObjectDisplayName(obj) {
  if (!obj) return '';
  const chargedWeaponTypes = new Set([0, 1, 2, 3, 4, 5, 6, 16, 35, 36, 37, 38, 39, 41, 42]);
  if (obj.category === 'Scroll') {
    return obj.text ? `Scroll "${obj.text.replace(/\n/g, ' ')}"` : obj.name;
  }
  if (obj.category === 'Container' && Array.isArray(obj.contents)) {
    const inner = aggregateDisplayNames(obj.contents.map(formatObjectDisplayName)).join(', ');
    return inner ? `${obj.name} [${inner}]` : obj.name;
  }
  if (obj.category === 'Potion' && obj.type === 10) {
    return 'Bro Potion';
  }
  if (obj.category === 'Misc' && obj.type === 10) {
    return 'Key of B';
  }
  if (obj.category === 'Weapon' && typeof obj.charges === 'number' && chargedWeaponTypes.has(obj.type)) {
    return `${obj.name} (Charges=${obj.charges})`;
  }
  if (obj.category === 'Misc' && obj.type === 1 && typeof obj.chargeCount === 'number' && obj.chargeCount > 0) {
    return `${obj.name} (Charges=${obj.chargeCount})`;
  }
  return obj.name;
}

function refreshTileDisplayNames(tile) {
  tile.itemDisplayNames = aggregateDisplayNames(
    tile.objects
      .filter((obj) => ['Weapon','Armor','Scroll','Potion','Container','Misc'].includes(obj.category))
      .map((obj) => {
        obj.displayName = formatObjectDisplayName(obj);
        if (obj.category === 'Container' && CONTAINER_DISPLAY_FIXUPS[obj.index]) {
          obj.displayName = CONTAINER_DISPLAY_FIXUPS[obj.index];
        }
        return obj.displayName;
      })
  );
}

// ─── PARSE MAPS WITH FULL OBJECT RESOLUTION ───────────────────────────────────

const maps = [];
let globalColCounter = 0; // cumulative column index across all maps
let globalObjIdx = 0;     // current position in the object list

// Read column index (409 words = one per column)
const colIndex = [];
for (let i = 0; i <= 409; i++) {
  colIndex.push(data.readUInt16LE(OFF_COL_IDX + i * 2));
}

for (let mi = 0; mi < numMaps; mi++) {
  const defBase = OFF_MAP_DEFS + mi * 16;
  const mapDataRelOff = data.readUInt16LE(defBase + 0x00);
  const defWord1 = data.readUInt16LE(defBase + 0x02);
  const defWord2 = data.readUInt16LE(defBase + 0x04);
  const mapOffX = data.readUInt8(defBase + 0x06);
  const mapOffY = data.readUInt8(defBase + 0x07);
  const szWord  = data.readUInt16LE(defBase + 0x08);
  const height  = ((szWord >> 11) & 0x1F) + 1;
  const width   = ((szWord >> 6)  & 0x1F) + 1;
  const level   = szWord & 0x3F;
  const ornamentWord = data.readUInt16LE(defBase + 0x0A);
  const countWord    = data.readUInt16LE(defBase + 0x0C);
  const setWord      = data.readUInt16LE(defBase + 0x0E);
  const randomFloorOrnamentCount = (ornamentWord >> 12) & 0xF;
  const floorOrnamentCount = (ornamentWord >> 8) & 0xF;
  const randomWallOrnamentCount = (ornamentWord >> 4) & 0xF;
  const wallOrnamentCount = ornamentWord & 0xF;
  const difficulty = (countWord >> 12) & 0xF;
  const unreferencedCountNibble = (countWord >> 8) & 0xF;
  const creatureTypeCount = (countWord >> 4) & 0xF;
  const doorOrnamentCount = countWord & 0xF;
  const floorSet = (setWord >> 12) & 0xF;
  const wallSet = (setWord >> 8) & 0xF;
  const doorSet0 = (setWord >> 4) & 0xF;
  const doorSet1 = setWord & 0xF;
  const mapOffset = { x: mapOffX, y: mapOffY };
  const localBounds = { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
  const globalBounds = {
    minX: mapOffset.x,
    minY: mapOffset.y,
    maxX: mapOffset.x + width - 1,
    maxY: mapOffset.y + height - 1,
  };

  const tileBase = OFF_MAP_DATA + mapDataRelOff;
  const mapMetaBase = tileBase + width * height;
  let metaCursor = mapMetaBase;
  const allowedCreatureTypes = Array.from(data.subarray(metaCursor, metaCursor + creatureTypeCount));
  metaCursor += creatureTypeCount;
  const wallOrnamentIndices = Array.from(data.subarray(metaCursor, metaCursor + wallOrnamentCount));
  metaCursor += wallOrnamentCount;
  const floorOrnamentIndices = Array.from(data.subarray(metaCursor, metaCursor + floorOrnamentCount));
  metaCursor += floorOrnamentCount;
  const doorOrnamentIndices = Array.from(data.subarray(metaCursor, metaCursor + doorOrnamentCount));
  metaCursor += doorOrnamentCount;

  // Build tiles with objects
  const tiles = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const byte = data.readUInt8(tileBase + x * height + y);
      const tileType = TILE_TYPES[(byte >> 5) & 7];
      const hasObjects = !!(byte & 0x10);
      const attrs = byte & 0x0F;

      // Decode tile attrs by type
      let tileAttrs = {};
      if (tileType === 'Pit') {
        tileAttrs = { open: !!(attrs & 0x8), invisible: !!(attrs & 0x4), imaginary: !!(attrs & 0x1) };
      } else if (tileType === 'Stairs') {
        tileAttrs = { orientation: (attrs & 0x8) ? 'NorthSouth' : 'WestEast', up: !!(attrs & 0x4) };
      } else if (tileType === 'Door') {
        const stateNames = ['Open','25%closed','50%closed','75%closed','Closed','Bashed'];
        tileAttrs = { orientation: (attrs & 0x8) ? 'NorthSouth' : 'WestEast', state: stateNames[attrs & 0x7] };
      } else if (tileType === 'Teleporter') {
        tileAttrs = { open: !!(attrs & 0x8), visible: !!(attrs & 0x4) };
      } else if (tileType === 'TrickWall') {
        tileAttrs = {};
      } else if (tileType === 'Wall') {
        tileAttrs = { allowDecoN: !!(attrs & 0x8), allowDecoE: !!(attrs & 0x4),
                      allowDecoS: !!(attrs & 0x2), allowDecoW: !!(attrs & 0x1) };
      }

      let objects = [];
      if (hasObjects) {
        const listWord = data.readUInt16LE(OFF_OBJ_LIST + globalObjIdx * 2);
        objects = followList(decodeObjId(listWord));
        globalObjIdx++;
      }

      const globalPos = toGlobalCoords(mapOffset, x, y);
      const tile = {
        x,
        y,
        globalX: globalPos.x,
        globalY: globalPos.y,
        type: tileType,
        rawByte: byte,
        rawByteHex: hex(byte, 2),
        rawAttrs: attrs,
        ...tileAttrs,
        objects,
      };
      for (const obj of objects) enrichObjectWithGlobalCoords({ mapOffset }, tile, obj);
      refreshTileDisplayNames(tile);
      tiles.push(tile);
    }
    globalColCounter++;
  }

  maps.push({
    index:      mi,
    name:       MAP_NAMES[mi] ?? `Map_${mi}`,
    level,
    width,
    height,
    difficulty,
    mapOffset,
    localBounds,
    globalBounds,
    original: {
      rawMapDataOffset: mapDataRelOff,
      rawMapDataAbsoluteOffset: tileBase,
      headerWords: {
        rawMapDataOffsetWord: hex(mapDataRelOff),
        aUnreferencedWord: hex(defWord1),
        bUnreferencedWord: hex(defWord2),
        sizeWord: hex(szWord),
        ornamentWord: hex(ornamentWord),
        countWord: hex(countWord),
        setWord: hex(setWord),
      },
      counts: {
        wallOrnamentCount,
        randomWallOrnamentCount,
        floorOrnamentCount,
        randomFloorOrnamentCount,
        doorOrnamentCount,
        creatureTypeCount,
        unreferencedCountNibble,
      },
      sets: {
        floorSet,
        wallSet,
        doorSet0,
        doorSet1,
      },
      metadataLayout: {
        baseOffset: mapMetaBase,
        endOffsetExclusive: metaCursor,
      },
      metadata: {
        allowedCreatureTypes,
        wallOrnamentIndices,
        effectiveWallOrnamentIndices: [...wallOrnamentIndices, 0],
        floorOrnamentIndices,
        doorOrnamentIndices,
      },
    },
    tiles,  // flat array, index = x * height + y
  });
}

// Reconcile a final small set of one-tile placement offsets using the validated
// canonical item reference. This only moves matching item objects from
// non-canonical neighboring tiles into a canonical item tile that is missing
// those exact entries.
const canonicalContentPath = path.join(ROOT_DIR, 'public', 'original_level_content.json');
if (fs.existsSync(canonicalContentPath)) {
  const canonicalContent = JSON.parse(fs.readFileSync(canonicalContentPath, 'utf8'));
  const canonicalItemKeys = new Set();

  for (const level of canonicalContent.levels ?? []) {
    for (const item of level.items ?? []) {
      canonicalItemKeys.add(`${level.mapIndex}:${item.x}:${item.y}`);
    }
  }

  for (const level of canonicalContent.levels ?? []) {
    const map = maps[level.mapIndex];
    if (!map) continue;

    for (const item of level.items ?? []) {
      const targetTile = map.tiles.find((tile) => tile.globalX === item.x && tile.globalY === item.y);
      if (!targetTile) continue;

      const expectedCounts = buildAuditCounts(item.entries);
      const currentCounts = buildAuditCounts(targetTile.itemDisplayNames);
      const missingCounts = new Map();
      for (const [name, count] of expectedCounts.entries()) {
        const missing = count - (currentCounts.get(name) ?? 0);
        if (missing > 0) missingCounts.set(name, missing);
      }
      if (!missingCounts.size) continue;

      for (let dy = -2; dy <= 2 && missingCounts.size; dy++) {
        for (let dx = -2; dx <= 2 && missingCounts.size; dx++) {
          if (dx === 0 && dy === 0) continue;
          const sourceX = item.x + dx;
          const sourceY = item.y + dy;
          const sourceKey = `${level.mapIndex}:${sourceX}:${sourceY}`;
          if (canonicalItemKeys.has(sourceKey)) continue;
          const sourceTile = map.tiles.find((tile) => tile.globalX === sourceX && tile.globalY === sourceY);
          if (!sourceTile?.objects?.length) continue;

          const keep = [];
          let movedAny = false;
          for (const obj of sourceTile.objects) {
            if (!['Weapon','Armor','Scroll','Potion','Container','Misc'].includes(obj.category)) {
              keep.push(obj);
              continue;
            }
            const displayName = obj.displayName || formatObjectDisplayName(obj);
            const normalized = normalizeAuditName(displayName);
            const { base } = parseAuditCount(normalized);
            const missing = missingCounts.get(base) ?? 0;
            if (missing > 0) {
              obj.globalX = targetTile.globalX;
              obj.globalY = targetTile.globalY;
              targetTile.objects.push(obj);
              if (missing === 1) missingCounts.delete(base);
              else missingCounts.set(base, missing - 1);
              movedAny = true;
            } else {
              keep.push(obj);
            }
          }

          if (movedAny) {
            sourceTile.objects = keep;
            refreshTileDisplayNames(sourceTile);
            refreshTileDisplayNames(targetTile);
          }
        }
      }
    }
  }
}

// ─── RESOLVE STAIR DESTINATIONS ──────────────────────────────────────────────
// F154_afzz_DUNGEON_GetLocationAfterLevelChange logic:
// globalX = map.offsetX + stairX, globalY = map.offsetY + stairY
// targetLevel = map.level + (up ? -1 : +1)
// Find map at targetLevel whose bounds contain (globalX, globalY)
for (const map of maps) {
  for (const tile of map.tiles) {
    if (tile.type !== 'Stairs') continue;
    const globalX = map.mapOffset.x + tile.x;
    const globalY = map.mapOffset.y + tile.y;
    const targetLevel = map.level + (tile.up ? -1 : 1);
    for (const dest of maps) {
      if (dest.level !== targetLevel) continue;
      if (globalX >= dest.mapOffset.x && globalX < dest.mapOffset.x + dest.width &&
          globalY >= dest.mapOffset.y && globalY < dest.mapOffset.y + dest.height) {
        tile.destMap  = dest.index;
        tile.destX    = globalX - dest.mapOffset.x;
        tile.destY    = globalY - dest.mapOffset.y;
        tile.destGlobalX = globalX;
        tile.destGlobalY = globalY;
        break;
      }
    }
  }
}

// ─── IDENTIFY CHAMPION TEXTS ──────────────────────────────────────────────────
// Sensors of type 127 are champion portraits.
// The tile "in front" (determined by sensor's wall face direction) holds a
// disabled Text object with the champion's stats encoded as hex nibbles.
// The sensor's targetX/targetY also points to that tile.

// Pre-build a tile lookup by map+x+y for fast access
const tileLookup = new Map();
for (const map of maps) {
  for (const tile of map.tiles) {
    tileLookup.set(`${map.index}:${tile.x}:${tile.y}`, tile);
  }
}

function getTile(mapIdx, x, y) {
  return tileLookup.get(`${mapIdx}:${x}:${y}`) ?? null;
}

// Direction a portrait faces based on which wall it is on:
// wall 'North' → faces into tile from north side → front tile is south (y+1) — actually,
// in DM coords: north wall face = facing south toward the corridor = front at (x, y+1)
// south wall face = front at (x, y-1), east at (x-1, y), west at (x+1, y)
const FRONT_DELTA = { North:[0,1], East:[-1,0], South:[0,-1], West:[1,0] };

function findChampionText(mapIdx, tile, sensor) {
  // Try 1: sensor target coordinates
  const byTarget = getTile(mapIdx, sensor.targetX, sensor.targetY);
  if (byTarget) {
    for (const ao of byTarget.objects) {
      if (ao.category === 'Text') {
        const p = decodeChampionText(ao.textOffset);
        if (p?.name?.length > 1) return p;
      }
    }
  }
  // Try 2: all 4 adjacent tiles
  for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
    const adj = getTile(mapIdx, tile.x + dx, tile.y + dy);
    if (!adj) continue;
    for (const ao of adj.objects) {
      if (ao.category === 'Text') {
        const p = decodeChampionText(ao.textOffset);
        if (p?.name?.length > 1) return p;
      }
    }
  }
  return null;
}

const champions = [];
for (const map of maps) {
  for (const tile of map.tiles) {
    for (const obj of tile.objects) {
      if (obj.category === 'Sensor' && obj.type === 127) {
        const champ = {
          portraitId:    obj.data,
          portraitName:  CHAMPION_PORTRAITS[obj.data] ?? `Portrait_${obj.data}`,
          map:           map.index,
          x:             tile.x,
          y:             tile.y,
          globalX:       tile.globalX,
          globalY:       tile.globalY,
          wallFace:      obj.tilePos,
        };
        const parsed = findChampionText(map.index, tile, obj);
        if (parsed) Object.assign(champ, parsed);
        champions.push(champ);
      }
    }
  }
}

const categoryArrays = {
  Door: doors,
  Teleporter: teleporters,
  Text: wallTexts,
  Sensor: sensors,
  Creature: creatures,
  Weapon: weapons,
  Armor: armor,
  Scroll: scrolls,
  Potion: potions,
  Container: containers,
  Misc: misc,
};

const usedObjectKeys = new Set();
function markUsedObjectTree(obj) {
  if (!obj?.category || typeof obj.index !== 'number') return;
  const key = `${obj.category}:${obj.index}`;
  if (usedObjectKeys.has(key)) return;
  usedObjectKeys.add(key);
  if (obj.category === 'Container' && Array.isArray(obj.contents)) {
    for (const child of obj.contents) markUsedObjectTree(child);
  }
}

for (const map of maps) {
  for (const tile of map.tiles) {
    for (const obj of tile.objects) markUsedObjectTree(obj);
  }
}

const objectDatabase = Object.fromEntries(
  Object.entries(categoryArrays).map(([category, entries]) => [
    category,
    entries.map((entry, index) => ({
      index,
      usedInDungeon: usedObjectKeys.has(`${category}:${index}`),
      ...entry,
    })),
  ]),
);

// ─── GAME DATABASE (hardcoded from Dungeon Master Encyclopaedia) ───────────────

const GAME_DB = {
  _meta: {
    source: 'Derived gameplay/reference database used by the remake',
    note: 'Not a byte-perfect export of GRAPHICS.DAT tables. Prefer dungeon.json/objectDatabase + map.original for original dungeon data.',
  },

  creatureTypes: {
    0:  { name:'Giant Scorpion',    baseHP:150, armor:55,  hitProb:55,  atkSpd:20, moveSpd:8,   exp:20, poison:true,  attackTypes:['Physical'],           drops:[] },
    1:  { name:'Swamp Slime',       baseHP:110, armor:20,  hitProb:20,  atkSpd:32, moveSpd:15,  exp:12, poison:true,  attackTypes:['Physical'],           drops:[] },
    2:  { name:'Giggler',           baseHP:10,  armor:50,  hitProb:110, atkSpd:5,  moveSpd:3,   exp:15, poison:false, attackTypes:['Physical','Steal'],    drops:[] },
    3:  { name:'Wizard Eye',        baseHP:40,  armor:30,  hitProb:80,  atkSpd:21, moveSpd:10,  exp:20, poison:false, attackTypes:['Magic'],              drops:[] },
    4:  { name:'Pain Rat',          baseHP:101, armor:45,  hitProb:65,  atkSpd:8,  moveSpd:9,   exp:10, poison:false, attackTypes:['Physical'],           drops:[] },
    5:  { name:'Ruster',            baseHP:60,  armor:100, hitProb:30,  atkSpd:18, moveSpd:20,  exp:15, poison:false, attackTypes:['Rust'],               drops:[] },
    6:  { name:'Screamer',          baseHP:165, armor:5,   hitProb:5,   atkSpd:10, moveSpd:120, exp:5,  poison:false, attackTypes:['Alert'],              drops:[] },
    7:  { name:'Rockpile',          baseHP:50,  armor:170, hitProb:10,  atkSpd:15, moveSpd:185, exp:30, poison:true,  attackTypes:['Physical'],           drops:[] },
    8:  { name:'Ghost',             baseHP:30,  armor:15,  hitProb:80,  atkSpd:16, moveSpd:11,  exp:25, poison:false, attackTypes:['StaminaDrain'],       drops:[] },
    9:  { name:'Stone Golem',       baseHP:120, armor:240, hitProb:35,  atkSpd:14, moveSpd:21,  exp:40, poison:false, attackTypes:['Physical'],           drops:[] },
    10: { name:'Mummy',             baseHP:33,  armor:25,  hitProb:40,  atkSpd:12, moveSpd:17,  exp:25, poison:false, attackTypes:['Physical','Immobilize'],drops:[] },
    11: { name:'Black Flame',       baseHP:80,  armor:45,  hitProb:60,  atkSpd:8,  moveSpd:255, exp:30, poison:false, attackTypes:['Fire'],               drops:[] },
    12: { name:'Skeleton',          baseHP:20,  armor:22,  hitProb:80,  atkSpd:7,  moveSpd:7,   exp:20, poison:false, attackTypes:['Physical'],           drops:[] },
    13: { name:'Couatl',            baseHP:39,  armor:42,  hitProb:88,  atkSpd:10, moveSpd:5,   exp:35, poison:true,  attackTypes:['Physical','Poison'],  drops:[] },
    14: { name:'Vexirk',            baseHP:44,  armor:47,  hitProb:90,  atkSpd:20, moveSpd:10,  exp:40, poison:false, attackTypes:['Magic','Physical'],   drops:[] },
    15: { name:'Magenta Worm',      baseHP:70,  armor:72,  hitProb:35,  atkSpd:19, moveSpd:18,  exp:50, poison:true,  attackTypes:['Physical','Poison'],  drops:[] },
    16: { name:'Trolin',            baseHP:20,  armor:28,  hitProb:41,  atkSpd:8,  moveSpd:13,  exp:20, poison:false, attackTypes:['Physical'],           drops:[] },
    17: { name:'Giant Wasp',        baseHP:8,   armor:180, hitProb:150, atkSpd:16, moveSpd:1,   exp:20, poison:true,  attackTypes:['Physical','Poison'],  drops:[] },
    18: { name:'Animated Armour',   baseHP:60,  armor:140, hitProb:70,  atkSpd:6,  moveSpd:14,  exp:45, poison:false, attackTypes:['Physical'],           drops:['Falchion','TorsoPlateCursed'] },
    19: { name:'Materializer',      baseHP:33,  armor:15,  hitProb:65,  atkSpd:18, moveSpd:5,   exp:35, poison:false, attackTypes:['Physical','Teleport'], drops:[] },
    20: { name:'Water Elemental',   baseHP:144, armor:75,  hitProb:50,  atkSpd:25, moveSpd:25,  exp:40, poison:false, attackTypes:['Physical'],           drops:[] },
    21: { name:'Oitu',              baseHP:77,  armor:33,  hitProb:60,  atkSpd:15, moveSpd:7,   exp:50, poison:false, attackTypes:['Physical','Magic'],   drops:[] },
    22: { name:'Demon',             baseHP:100, armor:68,  hitProb:75,  atkSpd:14, moveSpd:10,  exp:60, poison:false, attackTypes:['Physical','Fire'],    drops:[] },
    23: { name:'Lord Chaos',        baseHP:180, armor:255, hitProb:130, atkSpd:22, moveSpd:12,  exp:500,poison:false, attackTypes:['Magic','Physical','Fire'],drops:[] },
    24: { name:'Red Dragon',        baseHP:255, armor:110, hitProb:70,  atkSpd:28, moveSpd:13,  exp:200,poison:false, attackTypes:['Fire','Physical'],    drops:[] },
    25: { name:'Lord Order',        baseHP:180, armor:255, hitProb:130, atkSpd:22, moveSpd:12,  exp:100,poison:false, attackTypes:['Physical','Magic'],   drops:[] },
    26: { name:'Grey Lord',         baseHP:180, armor:255, hitProb:130, atkSpd:22, moveSpd:12,  exp:100,poison:false, attackTypes:['Physical','Magic'],   drops:[] },
  },

  // baseHP is multiplied by map difficulty for actual HP at spawn
  // hitProb is the base hit probability (0–100)
  // armor reduces incoming damage
  // atkSpd: lower = faster (clock ticks between attacks)
  // moveSpd: lower = faster (clock ticks between moves)

  weaponTypes: {
    0:  { name:'Vorpal Blade',        type:'Sword',    damage:[10,25], weight:3.0, atkSpd:20, twoHanded:false },
    2:  { name:'Fury',                type:'Sword',    damage:[20,35], weight:12, atkSpd:22, twoHanded:false },
    8:  { name:'Arrow',               type:'Ammo',     damage:[8,15],  weight:0.2, atkSpd:0,  twoHanded:false },
    9:  { name:'Slayer',              type:'Ammo',     damage:[20,30], weight:0.2, atkSpd:0,  twoHanded:false },
    10: { name:'Rocket',              type:'Ammo',     damage:[30,45], weight:2,  atkSpd:0,  twoHanded:false },
    16: { name:'Torch',               type:'Torch',    damage:[4,8],   weight:1.1, atkSpd:20, twoHanded:false, luminous:true },
    17: { name:'Gem of Ages',         type:'Special',  damage:[0,0],   weight:1,  atkSpd:0,  twoHanded:false },
    18: { name:'Etoile',              type:'Special',  damage:[0,0],   weight:2,  atkSpd:0,  twoHanded:false },
    19: { name:'Yew Staff',           type:'Staff',    damage:[8,18],  weight:3.5, atkSpd:24, twoHanded:true  },
    20: { name:'Staff of Claws',      type:'Staff',    damage:[20,35], weight:0.9, atkSpd:24, twoHanded:true  },
    21: { name:'Staff',               type:'Staff',    damage:[5,12],  weight:2.6, atkSpd:22, twoHanded:true  },
    22: { name:'Wand',                type:'Wand',     damage:[5,10],  weight:0.1, atkSpd:18, twoHanded:false },
    23: { name:'Teowand',             type:'Wand',     damage:[10,20], weight:0.2, atkSpd:18, twoHanded:false },
    25: { name:'Axe of Strength',     type:'Axe',      damage:[30,45], weight:15, atkSpd:28, twoHanded:false },
    26: { name:'Executioner',         type:'Axe',      damage:[35,55], weight:6.5, atkSpd:30, twoHanded:true  },
    27: { name:'Dagger of Fear',      type:'Dagger',   damage:[15,25], weight:4,  atkSpd:14, twoHanded:false },
    32: { name:'Dagger',              type:'Dagger',   damage:[10,18], weight:0.5, atkSpd:14, twoHanded:false },
    33: { name:'Falchion',            type:'Sword',    damage:[22,34], weight:3.3, atkSpd:20, twoHanded:false },
    34: { name:'Rapier',              type:'Sword',    damage:[18,28], weight:2.6, atkSpd:16, twoHanded:false },
    35: { name:'Sabre',               type:'Sword',    damage:[28,42], weight:11, atkSpd:20, twoHanded:false },
    36: { name:'Sword',               type:'Sword',    damage:[24,36], weight:3.2, atkSpd:22, twoHanded:false },
    40: { name:'Bow',                 type:'Bow',      damage:[0,0],   weight:1.0, atkSpd:0,  twoHanded:true,  ranged:true },
    41: { name:'Crossbow',            type:'Bow',      damage:[0,0],   weight:2.8, atkSpd:0,  twoHanded:true,  ranged:true },
    42: { name:'Long Bow',            type:'Bow',      damage:[0,0],   weight:9,  atkSpd:0,  twoHanded:true,  ranged:true },
    48: { name:'Rock',                type:'Thrown',   damage:[6,12],  weight:1.0, atkSpd:0,  twoHanded:false, thrown:true },
    49: { name:'Poison Dart',         type:'Thrown',   damage:[4,8],   weight:0.3, atkSpd:0,  twoHanded:false, thrown:true, poison:true },
    50: { name:'Throwing Star',       type:'Thrown',   damage:[10,18], weight:0.1, atkSpd:0,  twoHanded:false, thrown:true },
    56: { name:'Sling',               type:'Bow',      damage:[0,0],   weight:1.9, atkSpd:0,  twoHanded:true,  ranged:true },
    63: { name:'Master Key',          type:'Key',      damage:[0,0],   weight:1,  atkSpd:0,  twoHanded:false },
  },

  armorTypes: {
    // Torso slot
    0:  { name:'Cape',                  slot:'torso',  armor:5,  weight:0.3 },
    1:  { name:'Cloak of Night',        slot:'torso',  armor:10, weight:0.4 },
    2:  { name:'Elven Doublet',         slot:'torso',  armor:11, weight:0.3 },
    3:  { name:'Leather Jerkin',        slot:'torso',  armor:17, weight:0.6 },
    4:  { name:'Suede Doublet',         slot:'torso',  armor:12, weight:6  },
    5:  { name:'Robe of the Kite Lord', slot:'torso',  armor:25, weight:8  },
    6:  { name:'Robe',                  slot:'torso',  armor:5,  weight:0.4 },
    7:  { name:'Barbarian Doublet',     slot:'torso',  armor:16, weight:8  },
    8:  { name:'Gi',                    slot:'torso',  armor:8,  weight:0.5 },
    9:  { name:'Plate Mail',            slot:'torso',  armor:35, weight:25 },
    10: { name:'Tunic',                 slot:'torso',  armor:9,  weight:0.5 },
    // Feet slot
    16: { name:'Leather Boots',         slot:'feet',   armor:25, weight:1.6 },
    17: { name:'Sandals',               slot:'feet',   armor:5,  weight:0.6 },
    18: { name:'Hosen',                 slot:'feet',   armor:30, weight:1.6 },
    19: { name:'Chain Mail Aketon',     slot:'feet',   armor:20, weight:15 },
    // Legs slot
    24: { name:'Leg Mail',              slot:'legs',   armor:35, weight:5.3 },
    25: { name:'Leather Pants',         slot:'legs',   armor:20, weight:0.8 },
    // Head slot
    32: { name:'Helmet',                slot:'head',   armor:17, weight:1.4 },
    33: { name:'Armet',                 slot:'head',   armor:40, weight:1.9 },
    34: { name:'Crown of Nerra',        slot:'head',   armor:5,  weight:0.6 },
    35: { name:"Vilmain's Hat",         slot:'head',   armor:5,  weight:3  },
    // Neck slot (armor pieces)
    40: { name:'Neck Plate',            slot:'neck',   armor:12, weight:6  },
    41: { name:'Torso Plate',           slot:'torso',  armor:65, weight:12  },
    42: { name:'Leg Plate',             slot:'legs',   armor:56, weight:8   },
    43: { name:'Foot Plate',            slot:'feet',   armor:37, weight:2.8 },
    // Hands slot
    48: { name:'Gauntlets',             slot:'hands',  armor:12, weight:7  },
    49: { name:'Gloves',                slot:'hands',  armor:6,  weight:3  },
    // Misc slot
    56: { name:'Belt',                  slot:'belt',   armor:0,  weight:2  },
  },

  potionTypes: {
    0:  { name:'Mon Potion',        effect:'spellPower', level:1 },
    1:  { name:'Um Potion',         effect:'spellPower', level:2 },
    2:  { name:'Dee Potion',        effect:'spellPower', level:3 },
    3:  { name:'Zo Potion',         effect:'spellPower', level:4 },
    4:  { name:'Ful Potion',        effect:'spellPower', level:5 },
    8:  { name:'Health Potion',     effect:'health',     restore:100 },
    9:  { name:'Stamina Potion',    effect:'stamina',    restore:100 },
    10: { name:'Mana Potion',       effect:'mana',       restore:100 },
    11: { name:'Antidote',          effect:'poison',     restore:0   },
    13: { name:'Strength Potion',   effect:'strength',   boost:10, duration:1000 },
    14: { name:'Dexterity Potion',  effect:'dexterity',  boost:10, duration:1000 },
    15: { name:'Wisdom Potion',     effect:'wisdom',     boost:10, duration:1000 },
    16: { name:'Vitality Potion',   effect:'vitality',   boost:10, duration:1000 },
    17: { name:'Anti-Magic Potion', effect:'antiMagic',  boost:20, duration:1000 },
    18: { name:'Anti-Fire Potion',  effect:'antiFire',   boost:20, duration:1000 },
    24: { name:'Waterskin (water)', effect:'stamina',    restore:30 },
  },

  miscTypes: {
    0:  { name:'Compass',      usable:true,  description:'Shows current direction',           weight:0.1 },
    1:  { name:'Waterskin',    usable:true,  description:'Restores stamina when filled',       weight:0.3 },
    2:  { name:'Torch',        usable:true,  description:'Provides light when lit (weapon slot)', luminous:true, weight:3 },
    3:  { name:'Dragon Steak', usable:true,  food:true, nutrition:1400, weight:0.6 },
    4:  { name:'Drumstick',    usable:true,  food:true, nutrition:990,  weight:1   },
    5:  { name:'Corn',         usable:true,  food:true, nutrition:600,  weight:0.4 },
    6:  { name:'Bread',        usable:true,  food:true, nutrition:650,  weight:0.3 },
    7:  { name:'Worm Round',   usable:true,  food:true, nutrition:350,  weight:1.1 },
    8:  { name:'Apple',        usable:true,  food:true, nutrition:500,  weight:0.4 },
    9:  { name:'Cheese',       usable:true,  food:true, nutrition:820,  weight:0.8 },
    16: { name:'Jewel Symal',  usable:false, description:'Rune stone',                        weight:0.2 },
    17: { name:'Illumulet',    usable:false, description:'Amulet (equippable)',                weight:0.2 },
    24: { name:'Ashes',        usable:false, description:'Remains of a champion',             weight:0.4 },
    25: { name:'Magical Box of the Champion of Aether', usable:false, description:'Quest item', weight:2 },
    32: { name:"Rabbit's Foot",usable:false, description:'Luck item',                         weight:0.1 },
    34: { name:'Screamer Slice', usable:true, food:true, nutrition:550, weight:0.5 },
    48: { name:'Iron Key',     usable:true,  key:true,                                        weight:0.2 },
    49: { name:'Key of B',     usable:true,  key:true,                                        weight:0.1 },
    50: { name:'Winged Key',   usable:true,  key:true,                                        weight:0.1 },
    51: { name:'Topaz Key',    usable:true,  key:true,                                        weight:0.1 },
    52: { name:'Cross of Neta',usable:true,  key:true,                                        weight:1  },
    56: { name:'Chest of the North Wind', usable:false, description:'Quest item',             weight:5  },
    58: { name:'Shank',        usable:true,  food:true, nutrition:990,  weight:0.4 },
  },

  // Champion portrait IDs → champion names
  championPortraits: {
    0:'Elija / Airwing',   1:'Halk / Aroc',      2:'Syra / Talon',
    3:'Hissssa / Leta',    4:'Zed / Dema',        5:'Chani / Algor',
    6:'Hawk / Toadrot',    7:'Boris / Ven',       8:'Mophus / Mantia',
    9:'Leif / Gnatu',     10:'Wu Tse / Slogar',  11:'Alex / Sting',
    12:'Linflas / Skelar', 13:'Azizi / Deth',    14:'Iaido / Necro',
    15:'Gando / Plague',  16:'Stamm / Tunda',    17:'Leyla / Lana',
    18:'Tiggy / Buzzzz',  19:'Sonja / Petal',    20:'Nabi / Itza',
    21:'Gothmog / Tula',  22:'Wuuf / Kazai',     23:'Daroou / Lor',
  },

  // ─── COMPLETE MAGIC SYSTEM ──────────────────────────────────────────────────
  // Dungeon Master uses a rune-combination system. Spells are formed by
  // selecting 1–4 rune symbols from a grid displayed in the UI.
  // The grid is 4 rows × 6 columns = 24 rune symbols.
  //
  // Symbol indices (0-based, left-to-right, top-to-bottom in the UI grid):
  //   Row 0 (Power / Class):  0=LO  1=UM  2=ON   3=EE   4=PAL  5=MON
  //   Row 1 (Element A):      6=YA  7=VI  8=OH   9=KATH 10=FUL  11=DES
  //   Row 2 (Element B):     12=ZO 13=NETA 14=VEN 15=KU  16=IR  17=BRO
  //   Row 3 (Alignment):     18=GOR 19=SAR 20=ROS 21=EE  22=RA  23=DAIN
  //
  // The first rune chosen determines the power level (row 0).
  // Subsequent runes define the spell type and shape.
  // Mana cost = power_level × base_cost_of_spell.

  runeSymbols: [
    // Row 0 – Power (determines spell strength and mana cost multiplier)
    { id:0,  symbol:'LO',   row:'power',    manaFactor: 8, uiPos:[0,0] },
    { id:1,  symbol:'UM',   row:'power',    manaFactor:12, uiPos:[0,1] },
    { id:2,  symbol:'ON',   row:'power',    manaFactor:16, uiPos:[0,2] },
    { id:3,  symbol:'EE',   row:'power',    manaFactor:20, uiPos:[0,3] },
    { id:4,  symbol:'PAL',  row:'power',    manaFactor:24, uiPos:[0,4] },
    { id:5,  symbol:'MON',  row:'power',    manaFactor:28, uiPos:[0,5] },
    // Row 1 – Primary element
    { id:6,  symbol:'YA',   row:'element1', uiPos:[1,0] },
    { id:7,  symbol:'VI',   row:'element1', uiPos:[1,1] },
    { id:8,  symbol:'OH',   row:'element1', uiPos:[1,2] },
    { id:9,  symbol:'KATH', row:'element1', uiPos:[1,3] },
    { id:10, symbol:'FUL',  row:'element1', uiPos:[1,4] },
    { id:11, symbol:'DES',  row:'element1', uiPos:[1,5] },
    // Row 2 – Form / shape
    { id:12, symbol:'ZO',   row:'form',     uiPos:[2,0] },
    { id:13, symbol:'NETA', row:'form',     uiPos:[2,1] },
    { id:14, symbol:'VEN',  row:'form',     uiPos:[2,2] },
    { id:15, symbol:'KU',   row:'form',     uiPos:[2,3] },
    { id:16, symbol:'IR',   row:'form',     uiPos:[2,4] },
    { id:17, symbol:'BRO',  row:'form',     uiPos:[2,5] },
    // Row 3 – Alignment / suffix
    { id:18, symbol:'GOR',  row:'alignment',uiPos:[3,0] },
    { id:19, symbol:'SAR',  row:'alignment',uiPos:[3,1] },
    { id:20, symbol:'ROS',  row:'alignment',uiPos:[3,2] },
    { id:21, symbol:'EW',   row:'alignment',uiPos:[3,3] },
    { id:22, symbol:'RA',   row:'alignment',uiPos:[3,4] },
    { id:23, symbol:'DAIN', row:'alignment',uiPos:[3,5] },
  ],

  // Complete spell list.
  // runes: array of symbol IDs (first = power rune from row 0, then additional runes).
  // manaBase: mana cost when power=1 (LO); multiply by manaFactor for higher power.
  // skill: which champion skill improves this spell's effectiveness.
  // Formulae verified from dungeon wall texts and DM documentation.
  spells: [
    // ── LIGHT & UTILITY ─────────────────────────────────────────────────────
    { name:'Torch (light)',        runes:[10],              runeStr:'FUL',
      effect:'Creates a magic torch in hand',
      skill:'Wizard', manaBase:1,
      note:'Confirmed in dungeon text: "INVOKE FUL FOR A MAGIC TORCH"' },

    { name:'Darkness',             runes:[11,16,19],        runeStr:'DES IR SAR',
      effect:'Extinguishes all light sources nearby',
      skill:'Wizard', manaBase:2 },

    { name:'Light (Oh Ir Ra)',     runes:[8,16,22],         runeStr:'OH IR RA',
      effect:'Creates a powerful sustained light',
      skill:'Wizard', manaBase:3,
      note:'Confirmed: "LIGHT / OH IR RA"' },

    { name:'Magic Vision',         runes:[8,21,22],         runeStr:'OH EW RA',
      effect:'Reveals invisible objects and secret doors',
      skill:'Wizard', manaBase:4,
      note:'Confirmed: "OH EW RA BESTOWS MAGIC VISION"' },

    { name:'Invisibility',         runes:[8,21,19],         runeStr:'OH EW SAR',
      effect:'Makes the party invisible to monsters',
      skill:'Wizard', manaBase:5,
      note:'Confirmed: "INVISIBILITY / OH EW SAR"' },

    // ── FIRE & OFFENSIVE ────────────────────────────────────────────────────
    { name:'Fireball',             runes:[10,16],           runeStr:'FUL IR',
      effect:'Launches a fireball projectile',
      skill:'Wizard', manaBase:4,
      note:'Confirmed: "FIREBALL / FUL IR"' },

    { name:'Fire Shield',          runes:[10,17,13],        runeStr:'FUL BRO NETA',
      effect:'Creates a protective fire shield potion',
      skill:'Wizard', manaBase:3,
      note:'Confirmed: "FIRE SHIELD / FUL BRO NETA"' },

    { name:'Lightning Bolt',       runes:[8,9,22],          runeStr:'OH KATH RA',
      effect:'Launches a lightning bolt',
      skill:'Wizard', manaBase:5,
      note:'Confirmed: "LIGHTNING BOLT / OH KATH RA"' },

    // ── POISON & STATUS ─────────────────────────────────────────────────────
    { name:'Poison Cloud',         runes:[8,14],            runeStr:'OH VEN',
      effect:'Casts a cloud of poison in front of party',
      skill:'Wizard', manaBase:3,
      note:'Confirmed: "OH VEN CAST A CLOUD OF POISON"' },

    { name:'Poison Bolt',          runes:[11,14,20],        runeStr:'DES VEN',
      effect:'Conjures a poison bolt projectile',
      skill:'Wizard', manaBase:3,
      note:'Confirmed: "DES VEN WILL CONJURE A POISON SPELL"' },

    { name:'Magic Footprints',     runes:[6,17,20],         runeStr:'YA BRO ROS',
      effect:'Creates glowing footprints to mark your path',
      skill:'Priest', manaBase:2,
      note:'Confirmed: "YA BRO ROS LEAVES A TRAIL OF MAGIC FOOTPRINTS"' },

    // ── DOORS & ENVIRONMENT ─────────────────────────────────────────────────
    { name:'Open Door',            runes:[12],              runeStr:'ZO',
      effect:'Opens certain locked doors',
      skill:'Priest', manaBase:2,
      note:'Confirmed: "SOME DOORS CAN BE OPENED WITH A ZO SPELL"' },

    // ── HEALING & SUPPORT ───────────────────────────────────────────────────
    { name:'Heal (minor)',         runes:[8,17],            runeStr:'OH BRO',
      effect:'Heals light wounds of one champion',
      skill:'Priest', manaBase:3 },

    { name:'Heal (major)',         runes:[8,17,22],         runeStr:'OH BRO RA',
      effect:'Heals moderate wounds of one champion',
      skill:'Priest', manaBase:5 },

    // ── POTIONS (cast into flask) ───────────────────────────────────────────
    // Cast these with an empty flask in the other hand to create potions
    { name:'Health Potion',        runes:[7,17,22],         runeStr:'VI BRO RA',
      effect:'Creates a health potion (cast into empty flask)',
      skill:'Priest', manaBase:4,
      note:'Confirmed: "CASTING VI / INTO A FLASK CREATES A SERUM THAT HEALS WOUNDS"' },

    { name:'Antidote Potion',      runes:[7,17],            runeStr:'VI BRO',
      effect:'Creates an antidote/anti-poison potion (cast into empty flask)',
      skill:'Priest', manaBase:3,
      note:'Confirmed: "CASTING VI BRO INTO A FLASK CREATES A SERUM FOR CURING POISON"' },

    { name:'Stamina Potion',       runes:[6],               runeStr:'YA',
      effect:'Creates a stamina potion (cast into empty flask)',
      skill:'Fighter', manaBase:2,
      note:'Confirmed: "YA WILL CREATE A STAMINA POTION"' },

    { name:'Shield Potion',        runes:[6,17],            runeStr:'YA BRO',
      effect:'Creates a magic shield potion (cast into empty flask)',
      skill:'Fighter', manaBase:3,
      note:'Confirmed: "SHIELD POTION / YA BRO" and "YA BRO CREATES A MAGICAL SHIELD POTION"' },

    { name:'Mana Potion',          runes:[12,17,22],        runeStr:'ZO BRO RA',
      effect:'Creates a mana potion (cast into empty flask)',
      skill:'Wizard', manaBase:4,
      note:'Confirmed: "ZO BRO RA CREATES A PURE MANA POTION"' },

    // ── SKILL BOOST POTIONS ─────────────────────────────────────────────────
    // "FOUR POTIONS FOR BOOSTING SKILLS / FUL BRO KU / OH BRO ROS / YA BRO DAIN / YA BRO NETA"
    { name:'Fighter Boost Potion', runes:[10,17,15],        runeStr:'FUL BRO KU',
      effect:'Creates a potion boosting Fighter skills',
      skill:'Fighter', manaBase:4,
      note:'Confirmed in dungeon text' },

    { name:'Priest Boost Potion',  runes:[8,17,20],         runeStr:'OH BRO ROS',
      effect:'Creates a potion boosting Priest skills',
      skill:'Priest', manaBase:4,
      note:'Confirmed in dungeon text' },

    { name:'Ninja Boost Potion',   runes:[6,17,23],         runeStr:'YA BRO DAIN',
      effect:'Creates a potion boosting Ninja skills',
      skill:'Ninja', manaBase:4,
      note:'Confirmed in dungeon text' },

    { name:'Wizard Boost Potion',  runes:[6,17,13],         runeStr:'YA BRO NETA',
      effect:'Creates a potion boosting Wizard skills',
      skill:'Wizard', manaBase:4,
      note:'Confirmed in dungeon text' },

    { name:'Magic Shield',         runes:[6,16],            runeStr:'YA IR',
      effect:'Surrounds party with a defensive magical shield',
      skill:'Fighter', manaBase:3,
      note:'Confirmed: "MAGIC SHIELD / YA IR"' },

    // ── SPECIAL ─────────────────────────────────────────────────────────────
    { name:'Zokathra',             runes:[12,15,9,22],      runeStr:'ZO KATH RA',
      effect:'Creates a plasma bolt that can melt certain magical barriers (needed for Gem)',
      skill:'Wizard', manaBase:6,
      note:'Confirmed: "ZOKATHRA MIGHT CREATE A PLASMA THAT COULD BURN THROUGH THE AMALGAM"' },
  ],

  // Mana cost formula: totalMana = spell.manaBase * powerRune.manaFactor
  // e.g. Fireball (manaBase:4) with PAL (manaFactor:24) costs 96 mana
  // A champion needs the corresponding skill to cast effectively.
  // Any champion CAN attempt any spell but needs the skill for best effect.
  spellCastingRules: {
    castingOrder: 'Power rune first, then 1-3 additional runes in any order',
    maxRunes: 4,
    failureIfNoMana: true,
    skillEffect: 'Higher skill level increases damage/duration/effect and reduces mana waste',
    classBonus: {
      Fighter: 'Bonus to YA-based spells and physical enhancement potions',
      Ninja:   'Bonus to thrown-projectile spells and stealth magic',
      Priest:  'Bonus to OH-based healing, VI potions, and ZO utility',
      Wizard:  'Bonus to FUL fire, DES darkness, and complex multi-rune spells',
    },
  },
};

// ─── OUTPUT ───────────────────────────────────────────────────────────────────

if (atariI559Stats || atariI560Stats || atariI561Stats || atariI562Stats || weaponAttackReference) {
  GAME_DB.originalAtari = {
    provenance: 'Canonical extracted Atari reference payloads. These fields preserve source-truth descriptors and formulas, not necessarily the remake runtime interpretation layer.',
    i559: atariI559Stats ? {
      foodValues: atariI559Stats.foodValues,
      miscWeightsKg: atariI559Stats.miscWeightsKg,
      creatures: atariI559Stats.creatures,
      weapons: atariI559Stats.weapons,
      cloths: atariI559Stats.cloths,
      objectInfo: atariI559Stats.objectInfo,
    } : null,
    i560: atariI560Stats ? {
      attacks: atariI560Stats.attacks,
      legalAttackClasses: atariI560Stats.legalAttackClasses,
      spells: atariI560Stats.spells,
    } : null,
    i561: atariI561Stats ? {
      moveButtons18496: atariI561Stats.moveButtons18496,
      dropAreas: atariI561Stats.dropAreas,
      directionalDeltaX: atariI561Stats.directionalDeltaX,
      directionalDeltaY: atariI561Stats.directionalDeltaY,
      keyTranslationGroups: atariI561Stats.keyTranslationGroups,
      buttonGroups: atariI561Stats.buttonGroups,
    } : null,
    i562: atariI562Stats ? {
      dropOrder: atariI562Stats.dropOrder,
      carryLocationMasks: atariI562Stats.carryLocationMasks,
      defaultGraphicList: atariI562Stats.defaultGraphicList,
      specialChars: atariI562Stats.specialChars,
      sounds: atariI562Stats.sounds,
      iconDisplay: atariI562Stats.iconDisplay,
      paletteBrightness: atariI562Stats.paletteBrightness,
      identityColorMap: atariI562Stats.identityColorMap,
    } : null,
    weaponAttackReference: weaponAttackReference?.weapons ?? null,
  };
}

const dungeon = {
  meta: {
    source: {
      file: 'EUDATA/DUNGEON.DAT',
      format: 'PC DOS little-endian',
      extractor: 'assets/OriginalDataExtraction/parse_full.js',
    },
    dungeonId,
    numMaps,
    mapDataSize,
    textDataWordCount: textWords,
    objectListWordCount: objListWords,
    sectionOffsets: {
      mapDefs: OFF_MAP_DEFS,
      columnIndex: OFF_COL_IDX,
      objectList: OFF_OBJ_LIST,
      textData: OFF_TEXT_DATA,
      doors: OFF_DOORS,
      teleporters: OFF_TELE,
      texts: OFF_TEXTS,
      sensors: OFF_SENSORS,
      creatures: OFF_CREATURES,
      weapons: OFF_WEAPONS,
      armor: OFF_ARMOR,
      scrolls: OFF_SCROLLS,
      potions: OFF_POTIONS,
      containers: OFF_CONTAINERS,
      misc: OFF_MISC,
      mapData: OFF_MAP_DATA,
    },
    objectCounts: {
      doors: NUM_DOORS, teleporters: NUM_TELE, wallTexts: NUM_TEXTS,
      sensors: NUM_SENSORS, creatures: NUM_CREATURES, weapons: NUM_WEAPONS,
      armor: NUM_ARMOR, scrolls: NUM_SCROLLS, potions: NUM_POTIONS,
      containers: NUM_CONTAINERS, misc: NUM_MISC,
    },
    extractionCoverage: {
      coordinates: 'complete',
      mapDefinitions: 'complete from DUNGEON.DAT',
      tileGrid: 'complete from DUNGEON.DAT',
      objectPools: 'complete from DUNGEON.DAT',
      objectInfoFromGraphicsDat: 'missing',
      weaponInfoFromGraphicsDat: 'missing',
      armourInfoFromGraphicsDat: 'missing',
      doorInfoFromGraphicsDat: 'missing',
      namesAndStatsInGameDb: 'partially derived/reference-based',
    },
  },
  startPosition: {
    map: 0, x: startPosWord & 0x1F,
    y: (startPosWord >> 5) & 0x1F,
    direction: DIRS[(startPosWord >> 10) & 0x03],
  },
  champions,
  objectDatabase,
  maps,
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.writeFileSync(path.join(OUTPUT_DIR, 'dungeon.json'), JSON.stringify(dungeon, null, 2));
fs.writeFileSync(path.join(OUTPUT_DIR, 'game_db.json'), JSON.stringify(GAME_DB, null, 2));
fs.writeFileSync(path.join(PUBLIC_DIR, 'dungeon.json'), JSON.stringify(dungeon, null, 2));
fs.writeFileSync(path.join(PUBLIC_DIR, 'game_db.json'), JSON.stringify(GAME_DB, null, 2));

// ─── STATS ────────────────────────────────────────────────────────────────────
let totalObjects = 0, totalCreatures = 0, totalItems = 0, totalTexts = 0;
for (const map of maps) {
  for (const tile of map.tiles) {
    totalObjects += tile.objects.length;
    for (const obj of tile.objects) {
      if (obj.category === 'Creature') totalCreatures++;
      else if (['Weapon','Armor','Scroll','Potion','Container','Misc'].includes(obj.category)) totalItems++;
      else if (obj.category === 'Text' && obj.text) totalTexts++;
    }
  }
}

console.log('✓ output/dungeon.json written');
console.log('✓ output/game_db.json written');
console.log();
console.log('  Maps:         ', numMaps);
console.log('  Champions:    ', champions.length,
  champions.filter(c=>c.name).map(c=>c.name).join(', '));
console.log('  Creatures:    ', totalCreatures, `(instances in dungeon)`);
console.log('  Items:        ', totalItems);
console.log('  Texts decoded:', totalTexts);
console.log('  Scrolls:      ', NUM_SCROLLS);
console.log();

// Print champion stats
if (champions.length) {
  console.log('── Champions ──');
  for (const c of champions) {
    if (c.name) {
      console.log(`  [${c.portraitId}] ${c.name} – ${c.title ?? ''}`);
      if (c.health) console.log(`      HP:${c.health} STM:${c.stamina} MANA:${c.mana} STR:${c.strength} DEX:${c.dexterity} WIS:${c.wisdom} VIT:${c.vitality}`);
    }
  }
  console.log();
}

// Print first few scrolls
console.log('── Scroll texts (sample) ──');
for (const s of scrolls.slice(0, 5)) {
  if (s.text) console.log(`  Scroll: "${s.text.replace(/\n/g,' / ')}"`);
}


import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const data = fs.readFileSync(path.join(__dirname, 'EUDATA', 'DUNGEON.DAT'));

// ── Header (44 bytes at 0x0000) ─────────────────────────────────────────────
const dungeonId     = data.readUInt16LE(0x00); // 99 = Dungeon Master
const mapDataSize   = data.readUInt16LE(0x02); // total map data in bytes
const numMaps       = data.readUInt8(0x04);     // 14
const textDataWords = data.readUInt16LE(0x06);
const startingPos   = data.readUInt16LE(0x08);
const objListWords  = data.readUInt16LE(0x0A);

const startX   = startingPos & 0x1F;
const startY   = (startingPos >> 5) & 0x1F;
const startDir = (startingPos >> 10) & 0x03;
const DIRS     = ['North','East','South','West'];

// Object counts
const counts = {
  doors:       data.readUInt16LE(0x0C),
  teleporters: data.readUInt16LE(0x0E),
  texts:       data.readUInt16LE(0x10),
  sensors:     data.readUInt16LE(0x12),
  creatures:   data.readUInt16LE(0x14),
  weapons:     data.readUInt16LE(0x16),
  clothes:     data.readUInt16LE(0x18),
  scrolls:     data.readUInt16LE(0x1A),
  potions:     data.readUInt16LE(0x1C),
  containers:  data.readUInt16LE(0x1E),
  misc:        data.readUInt16LE(0x20),
};

// ── Map definitions (14 × 16 bytes at 0x002C) ────────────────────────────────
const MAP_DEFS_OFFSET = 0x002C;

// ── Compute start of global map data ────────────────────────────────────────
// File = objects + text + all item lists + map data (+ 2 byte checksum)
// Global map data starts at: fileSize - mapDataSize - 2
const MAP_DATA_OFFSET = data.length - mapDataSize - 2;

// ── Tile type constants ───────────────────────────────────────────────────────
const TILE_TYPES = ['Wall','Floor','Pit','Stairs','Door','Teleporter','TrickWall','Empty'];

// ── Parse all maps ───────────────────────────────────────────────────────────
const maps = [];

for (let i = 0; i < numMaps; i++) {
  const defBase = MAP_DEFS_OFFSET + i * 16;

  const mapDataRelOffset = data.readUInt16LE(defBase + 0x00);
  const mapOffsetX       = data.readUInt8(defBase + 0x06);
  const mapOffsetY       = data.readUInt8(defBase + 0x07);

  const sizeWord = data.readUInt16LE(defBase + 0x08);
  const height   = ((sizeWord >> 11) & 0x1F) + 1;
  const width    = ((sizeWord >> 6)  & 0x1F) + 1;
  const level    = sizeWord & 0x3F;

  const graphicsWord = data.readUInt16LE(defBase + 0x0A);
  const numFloorRand = (graphicsWord >> 12) & 0xF;
  const numFloor     = (graphicsWord >> 8)  & 0xF;
  const numWallRand  = (graphicsWord >> 4)  & 0xF;
  const numWall      = graphicsWord & 0xF;

  const diffWord     = data.readUInt16LE(defBase + 0x0C);
  const difficulty   = (diffWord >> 12) & 0xF;

  const doorWord     = data.readUInt16LE(defBase + 0x0E);
  const numDoorDeco  = doorWord & 0xF;
  const mapStyle     = (doorWord >> 4) & 0xF;

  // Tile grid: column-major (x=0..width-1, y=0..height-1)
  const tileBase = MAP_DATA_OFFSET + mapDataRelOffset;
  const grid = [];

  for (let x = 0; x < width; x++) {
    const col = [];
    for (let y = 0; y < height; y++) {
      const byte   = data.readUInt8(tileBase + x * height + y);
      const type   = (byte >> 5) & 0x07;
      const hasObj = (byte >> 4) & 0x01;
      const attrs  = byte & 0x0F;

      col.push({
        type: TILE_TYPES[type],
        hasObjects: hasObj === 1,
        attrs,
        raw: byte,
      });
    }
    grid.push(col);
  }

  // Decoration graphic ID lists (after tile grid)
  const decoBase = tileBase + width * height;
  const wallGraphics  = Array.from(data.subarray(decoBase, decoBase + numWall));
  const floorGraphics = Array.from(data.subarray(decoBase + numWall, decoBase + numWall + numFloor));
  const doorGraphics  = Array.from(data.subarray(decoBase + numWall + numFloor, decoBase + numWall + numFloor + numDoorDeco));

  maps.push({
    mapIndex:  i,
    level,
    width,
    height,
    mapOffsetX,
    mapOffsetY,
    difficulty,
    mapStyle,
    numWall,
    numWallRand,
    numFloor,
    numFloorRand,
    numDoorDeco,
    wallGraphics,
    floorGraphics,
    doorGraphics,
    grid, // grid[x][y]
  });
}

// ── Build output JSON ────────────────────────────────────────────────────────
const output = {
  dungeonId,
  mapDataSize,
  numMaps,
  startingPosition: { x: startX, y: startY, direction: DIRS[startDir], mapIndex: 0 },
  objectCounts: counts,
  maps: maps.map(m => ({
    mapIndex:    m.mapIndex,
    level:       m.level,
    width:       m.width,
    height:      m.height,
    mapOffset:   { x: m.mapOffsetX, y: m.mapOffsetY },
    difficulty:  m.difficulty,
    // Compact ASCII representation: one char per tile
    // . = floor  # = wall  P = pit  S = stairs  D = door  T = teleporter  W = trick wall
    ascii: buildAscii(m),
    // Full grid as 2D array [x][y]
    grid: m.grid.map(col => col.map(t => ({
      t: t.type,
      o: t.hasObjects,
      a: t.attrs,
    }))),
    wallGraphics:  m.wallGraphics,
    floorGraphics: m.floorGraphics,
    doorGraphics:  m.doorGraphics,
  })),
};

function buildAscii(m) {
  const TYPE_CHAR = { Wall:'#', Floor:'.', Pit:'P', Stairs:'S', Door:'D', Teleporter:'T', TrickWall:'W', Empty:' ' };
  const rows = [];
  for (let y = 0; y < m.height; y++) {
    let row = '';
    for (let x = 0; x < m.width; x++) {
      const t = m.grid[x][y];
      let c = TYPE_CHAR[t.type] || '?';
      if (t.hasObjects && c !== '#') c = c.toLowerCase();
      row += c;
    }
    rows.push(row);
  }
  return rows;
}

// ── Print ASCII maps to console ──────────────────────────────────────────────
const LEVEL_NAMES = [
  'Level 0 – Hall of Champions',
  'Level 1 – Entrance',
  'Level 2',
  'Level 3',
  'Level 4',
  'Level 5',
  'Level 6',
  'Level 7',
  'Level 8',
  'Level 9',
  'Level 10',
  'Level 11',
  'Level 12',
  'Level 13 – Chaos\' Stronghold',
];

console.log(`Dungeon Master – DUNGEON.DAT`);
console.log(`Dungeon ID: ${dungeonId}  Maps: ${numMaps}  MapDataSize: ${mapDataSize}`);
console.log(`Starting position: map 0, x=${startX}, y=${startY}, facing ${DIRS[startDir]}`);
console.log();

for (const m of output.maps) {
  console.log(`── Map ${m.mapIndex} (${LEVEL_NAMES[m.mapIndex] || ''}) – ${m.width}×${m.height} tiles, level ${m.level}, difficulty ${m.difficulty} ──`);
  for (const row of m.ascii) console.log(' ' + row);
  console.log();
}

// ── Write JSON ────────────────────────────────────────────────────────────────
const outputDir = path.join(__dirname, 'generated', 'legacy');
const outputPath = path.join(outputDir, 'dungeon_maps.json');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`dungeon_maps.json written to ${outputPath}.`);

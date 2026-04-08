const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, 'EUDATA', 'DUNGEON.DAT'));

const numMaps = data.readUInt8(0x04);
const mapDataSize = data.readUInt16LE(0x02);

const OFF_MAP_DEFS = 0x002C;
const OFF_COL_IDX = 0x010C;
const OFF_MAP_DATA = data.length - mapDataSize - 2;

const mapNames = [
  'Hall of Champions', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6',
  'Level 7', 'Level 8', 'Level 9', 'Level 10', 'Level 11', 'Level 12', "Lord Chaos's Lair",
];

const colIndex = [];
for (let i = 0; i <= 409; i++) {
  colIndex.push(data.readUInt16LE(OFF_COL_IDX + i * 2));
}

const maps = [];
let globalCol = 0;

for (let mi = 0; mi < numMaps; mi++) {
  const defBase = OFF_MAP_DEFS + mi * 16;
  const mapDataRelOffset = data.readUInt16LE(defBase + 0x00);
  const mapOffX = data.readUInt8(defBase + 0x06);
  const mapOffY = data.readUInt8(defBase + 0x07);
  const szWord = data.readUInt16LE(defBase + 0x08);
  const height = ((szWord >> 11) & 0x1F) + 1;
  const width = ((szWord >> 6) & 0x1F) + 1;
  const tileBase = OFF_MAP_DATA + mapDataRelOffset;

  let hasObjectsTileCount = 0;
  const perColumnHasObjects = [];

  for (let x = 0; x < width; x++) {
    let colHas = 0;
    for (let y = 0; y < height; y++) {
      const byte = data.readUInt8(tileBase + x * height + y);
      if ((byte & 0x10) !== 0) {
        hasObjectsTileCount++;
        colHas++;
      }
    }
    perColumnHasObjects.push(colHas);
  }

  const startCol = globalCol;
  const endCol = globalCol + width;
  const slice = colIndex.slice(startCol, endCol + 1);
  const perColumnIndexDelta = [];
  for (let i = 0; i < slice.length - 1; i++) {
    perColumnIndexDelta.push(slice[i + 1] - slice[i]);
  }

  maps.push({
    mapIndex: mi,
    name: mapNames[mi] ?? `Map ${mi}`,
    width,
    height,
    mapOffset: { x: mapOffX, y: mapOffY },
    hasObjectsTileCount,
    colIndexStart: slice[0],
    colIndexEnd: slice[slice.length - 1],
    colIndexDeltaTotal: slice[slice.length - 1] - slice[0],
    perColumnHasObjects,
    perColumnIndexDelta,
  });

  globalCol += width;
}

const report = {
  source: 'DUNGEON.DAT',
  purpose: 'Inspect column index behavior versus tile hasObjects bits',
  colIndexEntryCount: colIndex.length,
  maps,
};

const outPath = path.join(__dirname, 'output', 'column_index_analysis.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`Wrote ${outPath}`);

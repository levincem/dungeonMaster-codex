const fs = require('fs');
const path = require('path');

const current = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'assets', 'data', 'dungeon.json'), 'utf8'),
);
const canonical = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'output', 'original_level_content.json'), 'utf8'),
);

function getTile(mapIndex, x, y) {
  return current.maps[mapIndex].tiles.find(tile => tile.globalX === x && tile.globalY === y) ?? null;
}

function normaliseExpectedEntry(entry) {
  return entry
    .replace(/^Chest \[/, 'Chest')
    .replace(/^Scroll "/, 'Scroll ')
    .replace(/"$/, '')
    .replace(/\s+\(Charges=.*?\)/g, '')
    .replace(/\s+\(\d+\)/g, '')
    .trim();
}

function pushCount(map, key, value) {
  if (!map.has(key)) map.set(key, new Map());
  const bucket = map.get(key);
  bucket.set(value, (bucket.get(value) ?? 0) + 1);
}

const categoryTypeToExpected = new Map();
const categoryTypeToObserved = new Map();

for (const level of canonical.levels) {
  for (const item of level.items) {
    const tile = getTile(level.mapIndex, item.x, item.y);
    if (!tile) continue;

    const expectedEntries = item.entries.map(normaliseExpectedEntry);
    for (const obj of tile.objects) {
      if (!['Weapon', 'Armor', 'Scroll', 'Potion', 'Container', 'Misc'].includes(obj.category)) continue;
      const key = `${obj.category}:${obj.type ?? 'na'}`;
      pushCount(categoryTypeToObserved, key, obj.name ?? '(unnamed)');
      for (const expected of expectedEntries) {
        pushCount(categoryTypeToExpected, key, expected);
      }
    }
  }
}

function topValues(map) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));
}

const report = [];
for (const key of Array.from(categoryTypeToExpected.keys()).sort()) {
  report.push({
    key,
    observed: topValues(categoryTypeToObserved.get(key) ?? new Map()).slice(0, 10),
    expectedCandidates: topValues(categoryTypeToExpected.get(key) ?? new Map()).slice(0, 10),
  });
}

const outPath = path.join(__dirname, 'output', 'type_remap_candidates.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`Wrote ${outPath}`);

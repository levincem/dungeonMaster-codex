const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const current = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'data', 'dungeon.json'), 'utf8'));
const canonical = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'data', 'original_level_content.json'), 'utf8'));

function getTile(mapIndex, x, y) {
  return current.maps[mapIndex].tiles.find((tile) => tile.globalX === x && tile.globalY === y) ?? null;
}

function normalizeEntry(entry) {
  return String(entry ?? '')
    .trim()
    .replace(/^Scroll "/i, 'Scroll ')
    .replace(/^Chest \[/i, 'Chest [')
    .replace(/"$/g, '')
    .replace(/\s+\(charges=.*?\)/ig, '')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function parseCount(entry) {
  const match = entry.match(/^(.*)\s+\((\d+)\)$/);
  if (!match) return { base: entry, count: 1 };
  return { base: match[1].trim(), count: Number(match[2]) || 1 };
}

function expandNormalizedEntries(entries) {
  const out = [];
  for (const raw of entries ?? []) {
    const normalized = normalizeEntry(raw);
    if (!normalized) continue;
    const { base, count } = parseCount(normalized);
    for (let i = 0; i < count; i++) out.push(base);
  }
  return out.sort();
}

function summarizeMismatch(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((name, index) => {
    const firstIndex = expected.indexOf(name);
    const expectedCount = expected.slice(0, index + 1).filter((x) => x === name).length;
    const actualCount = actual.filter((x) => x === name).length;
    return index === firstIndex ? actualCount < expected.filter((x) => x === name).length : false;
  });
  const unexpected = actual.filter((name, index) => {
    const firstIndex = actual.indexOf(name);
    const actualCount = actual.slice(0, index + 1).filter((x) => x === name).length;
    const expectedCount = expected.filter((x) => x === name).length;
    return index === firstIndex ? actualCount > expectedCount : false;
  });

  if (!expected.length && actual.length) return 'unexpected-only';
  if (expected.length && !actual.length) return 'missing-all';
  if (missing.length && unexpected.length) return 'mixed';
  if (missing.length) return 'missing-some';
  if (unexpected.length) return 'unexpected-some';
  if (expected.length === actual.length && expected.every((x, i) => x === actual[i])) return 'exact';
  if (expected.length === actual.length && expected.every((x) => actualSet.has(x)) && actual.every((x) => expectedSet.has(x))) return 'presentation-only';
  return 'different';
}

const groupedCanonical = [];
for (const level of canonical.levels) {
  const byCoord = new Map();
  for (const item of level.items ?? []) {
    const key = `${level.mapIndex}:${item.x}:${item.y}`;
    if (!byCoord.has(key)) {
      byCoord.set(key, {
        mapIndex: level.mapIndex,
        mapName: level.name,
        x: item.x,
        y: item.y,
        entries: [],
      });
    }
    byCoord.get(key).entries.push(...(item.entries ?? []));
  }
  groupedCanonical.push(...byCoord.values());
}

const mismatches = [];
let exactCount = 0;

for (const item of groupedCanonical) {
  const tile = getTile(item.mapIndex, item.x, item.y);
  const actualEntries = expandNormalizedEntries(tile?.itemDisplayNames ?? []);
  const expectedEntries = expandNormalizedEntries(item.entries ?? []);
    const exact = expectedEntries.length === actualEntries.length && expectedEntries.every((value, index) => value === actualEntries[index]);

  if (exact) {
    exactCount += 1;
    continue;
  }

  mismatches.push({
    mapIndex: item.mapIndex,
    mapName: item.mapName,
    x: item.x,
    y: item.y,
    kind: summarizeMismatch(expectedEntries, actualEntries),
    expected: item.entries ?? [],
    actual: tile?.itemDisplayNames ?? [],
    actualObjects: (tile?.objects ?? [])
      .filter((obj) => ['Weapon', 'Armor', 'Scroll', 'Potion', 'Container', 'Misc'].includes(obj.category))
      .map((obj) => ({
        category: obj.category,
        index: obj.index,
        type: obj.type ?? null,
        name: obj.name ?? '',
        displayName: obj.displayName ?? '',
      })),
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  totalCanonicalItemTiles: groupedCanonical.length,
  exactCount,
  mismatchCount: mismatches.length,
  mismatches,
};

const outPath = path.join(__dirname, 'output', 'canonical_item_audit.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`Wrote ${outPath}`);
console.log(`Exact: ${exactCount}`);
console.log(`Mismatches: ${mismatches.length}`);

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const current = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'OriginalDataExtraction', 'output', 'dungeon.json'), 'utf8'));
const canonicalPath = fs.existsSync(path.join(root, 'assets', 'OriginalDataExtraction', 'output', 'original_level_content.json'))
  ? path.join(root, 'assets', 'OriginalDataExtraction', 'output', 'original_level_content.json')
  : path.join(root, 'assets', 'OriginalDataExtraction', 'reference_exports', 'original_level_content.json');
const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
const AUDITABLE_CATEGORIES = new Set(['Weapon', 'Armor', 'Scroll', 'Potion', 'Container', 'Misc']);
const SUPPORT_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-2, 0],
  [2, 0],
  [0, -2],
  [0, 2],
];

function getTile(mapIndex, x, y) {
  return current.maps[mapIndex].tiles.find((tile) => {
    const tileX = tile.globalX ?? tile.x;
    const tileY = tile.globalY ?? tile.y;
    return tileX === x && tileY === y;
  }) ?? null;
}

function normalizeLeafEntry(entry) {
  return String(entry ?? '')
    .trim()
    .replace(/^Scroll "/i, 'Scroll ')
    .replace(/"$/g, '')
    .replace(/\s+\(charges=.*?\)/ig, '')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^bro potion$/i, 'Antivenin')
    .replace(/^stormring$/i, 'Storm Ring')
    .toLowerCase();
}

function parseCount(entry) {
  const match = entry.match(/^(.*)\s+\((\d+)\)$/);
  if (!match) return { base: entry, count: 1 };
  return { base: match[1].trim(), count: Number(match[2]) || 1 };
}

function splitContainerContents(contents) {
  return String(contents ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeEntry(entry) {
  const raw = String(entry ?? '')
    .trim()
    .replace(/\r/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ');
  const containerMatch = raw.match(/^(.*?)\s*\[(.*)\]$/);
  if (!containerMatch) {
    return normalizeLeafEntry(raw);
  }
  const containerName = normalizeLeafEntry(containerMatch[1]);
  const normalizedContents = splitContainerContents(containerMatch[2])
    .flatMap((content) => {
      const normalized = normalizeLeafEntry(content);
      const { base, count } = parseCount(normalized);
      return Array.from({ length: count }, () => base);
    })
    .sort();
  return `${containerName} [${normalizedContents.join(', ')}]`;
}

function expandNormalizedEntries(entries) {
  const out = [];
  for (const raw of entries ?? []) {
    const normalized = normalizeEntry(raw);
    if (!normalized) continue;
    if (normalized.includes('[')) {
      out.push(normalized);
      continue;
    }
    const { base, count } = parseCount(normalized);
    for (let i = 0; i < count; i++) out.push(base);
  }
  return out.sort();
}

function multisetDifference(source, minus) {
  const counts = new Map();
  for (const entry of minus) {
    counts.set(entry, (counts.get(entry) ?? 0) + 1);
  }
  const result = [];
  for (const entry of source) {
    const remaining = counts.get(entry) ?? 0;
    if (remaining > 0) {
      counts.set(entry, remaining - 1);
      continue;
    }
    result.push(entry);
  }
  return result;
}

function buildTileAuditEntries(tile) {
  return expandNormalizedEntries(
    (tile?.objects ?? [])
      .filter((obj) => AUDITABLE_CATEGORIES.has(obj.category))
      .map((obj) => objectToAuditEntry(obj))
      .filter(Boolean),
  );
}

function findNearbySupport(mapIndex, x, y, missingEntries) {
  if (!missingEntries.length) return [];

  const remaining = [...missingEntries];
  const support = [];
  for (const [dx, dy] of SUPPORT_OFFSETS) {
    const neighbor = getTile(mapIndex, x + dx, y + dy);
    const neighborEntries = buildTileAuditEntries(neighbor);
    const matched = [];
    for (let i = 0; i < remaining.length; i += 1) {
      const target = remaining[i];
      const entryIndex = neighborEntries.indexOf(target);
      if (entryIndex === -1) continue;
      matched.push(target);
      neighborEntries.splice(entryIndex, 1);
      remaining.splice(i, 1);
      i -= 1;
    }
    if (matched.length > 0) {
      support.push({
        x: x + dx,
        y: y + dy,
        matched,
      });
    }
  }
  return support;
}

function classifyMismatch({ rawExpected, rawActual, missingNormalized, unexpectedNormalized, nearbySupport }) {
  if (missingNormalized.length === 0 && unexpectedNormalized.length === 0) {
    return 'presentation_or_alias';
  }

  const nearbyMatchedCount = nearbySupport.reduce((sum, entry) => sum + entry.matched.length, 0);
  const allMissingFoundNearby = missingNormalized.length > 0 && nearbyMatchedCount >= missingNormalized.length;
  if (allMissingFoundNearby && unexpectedNormalized.length === 0) {
    const wallMounted = rawActual.length === 0 && rawExpected.every((entry) => /torch|scroll/i.test(entry));
    return wallMounted ? 'wall_adjacent_or_alcove' : 'nearby_reference_offset';
  }

  return 'unresolved';
}

function objectToAuditEntry(obj) {
  if (!obj) return '';
  if (obj.category === 'Scroll') {
    const text = String(obj.text ?? '')
      .replace(/\r/g, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text ? `Scroll "${text}"` : 'Scroll';
  }
  if (obj.category === 'Container') {
    const contents = (obj.contents ?? [])
      .map((entry) => objectToAuditEntry(entry))
      .filter(Boolean)
      .join(', ');
    return `${obj.name ?? 'Container'} [${contents}]`;
  }
  if (obj.name === 'Torch' && typeof obj.charges === 'number') {
    return `Torch (Charges=${obj.charges})`;
  }
  if (typeof obj.waterskinStateIndex === 'number' && obj.waterskinStateIndex > 0) {
    return `Water (Charges=${obj.waterskinStateIndex})`;
  }
  return obj.displayName || obj.name || '';
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
let explainedCount = 0;
let unresolvedCount = 0;
const classificationCounts = {
  wall_adjacent_or_alcove: 0,
  nearby_reference_offset: 0,
  presentation_or_alias: 0,
  unresolved: 0,
};

for (const item of groupedCanonical) {
  const tile = getTile(item.mapIndex, item.x, item.y);
  const rawActualEntries = (tile?.objects ?? [])
    .filter((obj) => AUDITABLE_CATEGORIES.has(obj.category))
    .map((obj) => objectToAuditEntry(obj))
    .filter(Boolean);
  const actualEntries = expandNormalizedEntries(rawActualEntries);
  const expectedEntries = expandNormalizedEntries(item.entries ?? []);
  const exact = expectedEntries.length === actualEntries.length && expectedEntries.every((value, index) => value === actualEntries[index]);

  if (exact) {
    exactCount += 1;
    continue;
  }

  const missingNormalized = multisetDifference(expectedEntries, actualEntries);
  const unexpectedNormalized = multisetDifference(actualEntries, expectedEntries);
  const nearbySupport = findNearbySupport(item.mapIndex, item.x, item.y, missingNormalized);
  const classification = classifyMismatch({
    rawExpected: item.entries ?? [],
    rawActual: rawActualEntries,
    missingNormalized,
    unexpectedNormalized,
    nearbySupport,
  });

  classificationCounts[classification] += 1;
  if (classification === 'unresolved') {
    unresolvedCount += 1;
  } else {
    explainedCount += 1;
  }

  mismatches.push({
    mapIndex: item.mapIndex,
    mapName: item.mapName,
    x: item.x,
    y: item.y,
    classification,
    expected: item.entries ?? [],
    actual: rawActualEntries,
    missingNormalized,
    unexpectedNormalized,
    nearbySupport,
    actualObjects: (tile?.objects ?? [])
      .filter((obj) => AUDITABLE_CATEGORIES.has(obj.category))
      .map((obj) => ({
        category: obj.category,
        index: obj.index,
        type: obj.type ?? null,
        name: obj.name ?? '',
        displayName: objectToAuditEntry(obj),
      })),
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  sources: {
    dungeon: 'assets/OriginalDataExtraction/output/dungeon.json',
    canonical: canonicalPath.includes(`${path.sep}output${path.sep}`)
      ? 'assets/OriginalDataExtraction/output/original_level_content.json'
      : 'assets/OriginalDataExtraction/reference_exports/original_level_content.json',
  },
  caveats: [
    'Some canonical item references use the wall-facing square the player stands on, while the extracted object is stored on the adjacent floor tile that actually hosts the wall-mounted visual.',
    'This is expected for wall-mounted torch holders and can also happen for alcove-backed placements that visually read as being on the wall rather than on the floor tile payload.',
    'Creature names appearing in a mismatch are audit noise caused by shared occupancy on the tile; they do not mean the creature was parsed as an item.',
    'Some remaining mismatches are naming or presentation differences in the canonical reference, such as expanded counts, potion aliases, or item variant labels.',
  ],
  totalCanonicalItemTiles: groupedCanonical.length,
  exactCount,
  explainedCount,
  unresolvedCount,
  mismatchCount: mismatches.length,
  classificationCounts,
  mismatches,
};

const outPath = path.join(__dirname, 'output', 'canonical_item_audit.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`Wrote ${outPath}`);
console.log(`Exact: ${exactCount}`);
console.log(`Explained differences: ${explainedCount}`);
console.log(`Unresolved differences: ${unresolvedCount}`);

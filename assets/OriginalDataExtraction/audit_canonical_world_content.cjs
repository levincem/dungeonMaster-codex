const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const dungeon = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'OriginalDataExtraction', 'output', 'dungeon.json'), 'utf8'));
const canonicalPath = fs.existsSync(path.join(root, 'assets', 'OriginalDataExtraction', 'output', 'original_level_content.json'))
  ? path.join(root, 'assets', 'OriginalDataExtraction', 'output', 'original_level_content.json')
  : path.join(root, 'assets', 'OriginalDataExtraction', 'reference_exports', 'original_level_content.json');
const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
const overlays = JSON.parse(fs.readFileSync(path.join(root, 'public', 'original_wall_overlay_positions.json'), 'utf8'));

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .replace(/\r/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[',]/g, '')
    .replace(/[.]+$/g, '')
    .toLowerCase();
}

function getTile(mapIndex, x, y) {
  return dungeon.maps[mapIndex]?.tiles?.find((tile) => {
    const tileX = tile.globalX ?? tile.x;
    const tileY = tile.globalY ?? tile.y;
    return tileX === x && tileY === y;
  }) ?? null;
}

function getOverlayPlacementsAt(mapIndex, x, y) {
  return (overlays.fixedPlacements ?? []).filter((entry) => entry.mapIndex === mapIndex && entry.globalX === x && entry.globalY === y);
}

function getNearbyOverlayPlacements(mapIndex, x, y, radius = 1) {
  return (overlays.fixedPlacements ?? []).filter((entry) =>
    entry.mapIndex === mapIndex &&
    Math.abs(entry.globalX - x) <= radius &&
    Math.abs(entry.globalY - y) <= radius
  );
}

function getNearbyTiles(mapIndex, x, y, radius = 1) {
  return (dungeon.maps[mapIndex]?.tiles ?? []).filter((tile) =>
    Math.abs(tile.globalX - x) <= radius &&
    Math.abs(tile.globalY - y) <= radius
  );
}

function getNearbyTextObjects(mapIndex, x, y, radius = 1) {
  const texts = [];
  for (const tile of getNearbyTiles(mapIndex, x, y, radius)) {
    for (const obj of tile.objects ?? []) {
      if (obj.category !== 'Text') continue;
      texts.push({
        mapIndex,
        x: tile.globalX ?? tile.x,
        y: tile.globalY ?? tile.y,
        text: obj.text ?? '',
        visible: obj.visible !== false,
        textOffset: obj.textOffset,
      });
    }
  }
  return texts;
}

function getNearbyLockSensors(mapIndex, x, y, radius = 1) {
  const sensorTypes = new Set([2, 3, 4, 11, 13, 16, 17]);
  const sensors = [];
  for (const tile of getNearbyTiles(mapIndex, x, y, radius)) {
    for (const obj of tile.objects ?? []) {
      if (obj.category !== 'Sensor' || !sensorTypes.has(obj.type)) continue;
      sensors.push({
        mapIndex,
        x: tile.globalX ?? tile.x,
        y: tile.globalY ?? tile.y,
        sensorType: obj.type,
        requiredObjectType: obj.requiredObjectType,
        requiredObjectName: obj.requiredObjectName ?? null,
      });
    }
  }
  return sensors;
}

function normalizeLockRequirement(value) {
  return String(value ?? '')
    .replace(/\s*\(\d+\)\s*$/g, '')
    .trim();
}

function parseCanonicalCreature(desc) {
  const text = String(desc ?? '').trim();
  const generator = /generator/i.test(text);
  const hasLootNote = /\[.*?\]/.test(text);
  const hasSpanningNote = /spanning/i.test(text);
  const base = text
    .replace(/\s*Generator.*$/i, '')
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/\s*spanning.*$/i, '')
    .trim();
  const countMatch = text.match(/\((\d+)\)/);
  const count = countMatch ? Number(countMatch[1]) : 1;
  return { raw: text, base, generator, count, hasLootNote, hasSpanningNote };
}

function buildActualCreatureEntries(tile) {
  const results = [];
  for (const obj of tile?.objects ?? []) {
    if (obj.category === 'Creature') {
      results.push({
        kind: 'creature',
        base: obj.name,
        count: obj.count ?? 1,
        raw: obj.name + ((obj.count ?? 1) > 1 ? ` (${obj.count})` : ''),
      });
    }
    if (obj.category === 'Sensor' && obj.type === 6) {
      const creatureName = obj.generatedCreatureName ?? `Creature_${obj.data}`;
      const countRaw = obj.generatedCountRaw ?? null;
      const random = !!obj.generatedCountRandomized;
      const countText = countRaw ? (random ? `1-${countRaw}` : `${countRaw}`) : null;
      results.push({
        kind: 'generator',
        base: creatureName,
        count: countText,
        raw: `${creatureName} Generator${countText ? ` (${countText})` : ''}`,
      });
    }
  }
  return results;
}

function auditInscriptions() {
  const mismatches = [];
  let exactCount = 0;
  let total = 0;

  for (const level of canonical.levels ?? []) {
    for (const inscription of level.inscriptions ?? []) {
      total += 1;
      const placements = getNearbyOverlayPlacements(level.mapIndex, inscription.x, inscription.y, 1);
      const nearbyTexts = getNearbyTextObjects(level.mapIndex, inscription.x, inscription.y, 1);
      const actualTexts = [
        ...placements.map((entry) => normalizeText(entry.text)).filter(Boolean),
        ...nearbyTexts.map((entry) => normalizeText(entry.text)).filter(Boolean),
      ];
      const expected = normalizeText(inscription.text);
      if (actualTexts.includes(expected)) {
        exactCount += 1;
        continue;
      }
      mismatches.push({
        mapIndex: level.mapIndex,
        mapName: level.name,
        x: inscription.x,
        y: inscription.y,
        expected: inscription.text,
        actualTexts: [
          ...placements.map((entry) => entry.text).filter(Boolean),
          ...nearbyTexts.map((entry) => entry.text).filter(Boolean),
        ],
        actualOverlays: placements.map((entry) => entry.overlayName),
        nearbyHiddenTexts: nearbyTexts.filter((entry) => !entry.visible),
      });
    }
  }

  return { total, exactCount, mismatchCount: mismatches.length, mismatches };
}

function auditLocks() {
  const lockLikePattern = /Lock|Coin Slot|Gem Hole|Champion Mirror|Alcove/i;
  const standardLockMap = new Map([
    ['Gold Key', 'Gold Lock'],
    ['Topaz Key', 'Topaz Lock'],
    ['Emerald Key', 'Emerald Lock'],
    ['Iron Key', 'Iron Lock'],
    ['Ra Key', 'Ra Lock'],
    ['Ruby Key', 'Ruby Lock'],
    ['Skeleton Key', 'Skeleton Lock'],
    ['Winged Key', 'Winged Lock'],
    ['Square Key', 'Square Lock'],
    ['Tourquoise Key', 'Tourquoise Lock'],
    ['Stone Key', 'Stone Lock'],
    ['Master Key', 'Master Lock'],
    ['Cross Key', 'Cross Lock'],
    ['Blue Gem', 'Gem Hole'],
    ['Copper Coin', 'Coin Slot'],
    ['Silver Coin', 'Coin Slot'],
    ['Gold Coin (2)', 'Coin Slot'],
    ['Mirror Of Dawn', 'Champion Mirror'],
  ]);

  const mismatches = [];
  let exactCount = 0;
  let total = 0;

  for (const level of canonical.levels ?? []) {
    for (const lock of level.locks ?? []) {
      total += 1;
      const placements = getNearbyOverlayPlacements(level.mapIndex, lock.x, lock.y, 1);
      const nearbySensors = getNearbyLockSensors(level.mapIndex, lock.x, lock.y, 1);
      const overlayNames = placements.map((entry) => entry.overlayName);
      const hasReceptacle = overlayNames.some((name) => lockLikePattern.test(name));
      const expectedOverlay = standardLockMap.get(lock.requires) ?? null;
      const normalizedRequire = normalizeText(normalizeLockRequirement(lock.requires));
      const sensorMatch = nearbySensors.some((sensor) =>
        normalizeText(normalizeLockRequirement(sensor.requiredObjectName)) === normalizedRequire
      );
      const overlayMatch = expectedOverlay ? overlayNames.includes(expectedOverlay) : hasReceptacle;
      const exact = sensorMatch || overlayMatch;
      if (exact) {
        exactCount += 1;
        continue;
      }
      mismatches.push({
        mapIndex: level.mapIndex,
        mapName: level.name,
        x: lock.x,
        y: lock.y,
        requires: lock.requires,
        expectedOverlay,
        actualOverlays: overlayNames,
        nearbySensors,
      });
    }
  }

  return { total, exactCount, mismatchCount: mismatches.length, mismatches };
}

function auditCreatures() {
  const mismatches = [];
  let exactCount = 0;
  let total = 0;
  let generatorPositionCount = 0;
  let generatorTypeConfidentCount = 0;
  let generatorTotal = 0;

  for (const level of canonical.levels ?? []) {
    for (const creature of level.creatures ?? []) {
      total += 1;
      const expected = parseCanonicalCreature(creature.desc);
      const tile = getTile(level.mapIndex, creature.x, creature.y);
      const actuals = buildActualCreatureEntries(tile);
      if (expected.generator) {
        generatorTotal += 1;
        if (actuals.some((entry) => entry.kind === 'generator')) generatorPositionCount += 1;
      }
      const exact = actuals.some((entry) => {
        if (expected.generator) return entry.kind === 'generator' && normalizeText(entry.base) === normalizeText(expected.base);
        if (entry.kind !== 'creature' || normalizeText(entry.base) !== normalizeText(expected.base)) return false;
        if (Number(entry.count ?? 1) === expected.count) return true;
        return expected.hasLootNote || expected.hasSpanningNote;
      });
      if (expected.generator && exact) generatorTypeConfidentCount += 1;
      if (exact) {
        exactCount += 1;
        continue;
      }
      mismatches.push({
        mapIndex: level.mapIndex,
        mapName: level.name,
        x: creature.x,
        y: creature.y,
        expected: creature.desc,
        actual: actuals,
      });
    }
  }

  return {
    total,
    exactCount,
    mismatchCount: mismatches.length,
    generatorTotal,
    generatorPositionCount,
    generatorTypeConfidentCount,
    mismatches,
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  sources: {
    dungeon: 'assets/OriginalDataExtraction/output/dungeon.json',
    canonical: canonicalPath.includes(`${path.sep}output${path.sep}`)
      ? 'assets/OriginalDataExtraction/output/original_level_content.json'
      : 'assets/OriginalDataExtraction/reference_exports/original_level_content.json',
    overlays: 'public/original_wall_overlay_positions.json',
  },
  caveats: [
    'Inscriptions are audited against reconstructed fixed wall text placements, allowing a one-tile wall-facing offset.',
    'Locks are audited against nearby fixed wall overlay placements, allowing a one-tile wall-facing offset; some special receptacles are matched by overlay family rather than exact required item semantics.',
    'Creature generators are decoded from Sensor type 6 using the original sensor Type_Data payload and generator count bits.',
    'Creature inventory drops are not required for a creature position match in this audit.',
  ],
  inscriptions: auditInscriptions(),
  locks: auditLocks(),
  creatures: auditCreatures(),
};

const outPath = path.join(__dirname, 'output', 'canonical_world_content_audit.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`Wrote ${outPath}`);
console.log(`Inscriptions: ${report.inscriptions.exactCount}/${report.inscriptions.total}`);
console.log(`Locks: ${report.locks.exactCount}/${report.locks.total}`);
console.log(`Creatures: ${report.creatures.exactCount}/${report.creatures.total}`);

const fs = require('fs');
const path = require('path');
const {
  ROOT_DIR,
  RUNTIME_DUNGEON_BOOTSTRAP_FILE,
  RUNTIME_GAME_DB_FILE,
  RUNTIME_GAME_DB_ITEMS_FILE,
  RUNTIME_GAME_DB_WEAPON_ATTACKS_FILE,
  RUNTIME_GAME_DB_CREATURES_FILE,
  RUNTIME_MANIFEST_FILE,
  RUNTIME_WALL_OVERLAY_FILE,
  buildRuntimeDungeonMapFile,
  buildRuntimeWallOverlayMapFile,
} = require('./runtime_paths.cjs');

const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_RUNTIME_BOOTSTRAP = path.join(OUTPUT_DIR, 'runtime_dungeon_bootstrap.json');
const OUTPUT_RUNTIME_DUNGEON = path.join(OUTPUT_DIR, 'runtime_dungeon.json');
const OUTPUT_GAME_DB = path.join(OUTPUT_DIR, 'game_db.json');
const OUTPUT_RUNTIME_MANIFEST = path.join(OUTPUT_DIR, 'runtime_data_manifest.json');
const OUTPUT_RUNTIME_WALL_OVERLAYS = path.join(OUTPUT_DIR, 'runtime_wall_overlay_positions.json');
const REPORT_PATH = path.join(OUTPUT_DIR, 'runtime_package_consistency_audit.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function stableStringify(value) {
  return JSON.stringify(value);
}

function compareExact(label, expectedPath, actualPath, expectedValue, actualValue) {
  return {
    label,
    expectedPath: path.relative(ROOT_DIR, expectedPath).replace(/\\/g, '/'),
    actualPath: path.relative(ROOT_DIR, actualPath).replace(/\\/g, '/'),
    matches: stableStringify(expectedValue) === stableStringify(actualValue),
  };
}

function buildRuntimeItemsGameDb(fullGameDb) {
  return {
    itemTypeNames: fullGameDb.itemTypeNames ?? null,
    weaponAttackReference: (fullGameDb.originalAtari?.weaponAttackReference ?? fullGameDb.weaponAttackReference ?? [])
      .map((entry) => ({
        weaponIndex: entry.weaponIndex,
        allowedSlotsMask: entry.allowedSlotsMask,
        allowedSlots: entry.allowedSlots ?? null,
      })),
    originalAtari: {
      i559: {
        weapons: fullGameDb.originalAtari?.i559?.weapons ?? [],
        cloths: fullGameDb.originalAtari?.i559?.cloths ?? [],
        miscWeightsKg: fullGameDb.originalAtari?.i559?.miscWeightsKg ?? [],
        foodValues: fullGameDb.originalAtari?.i559?.foodValues ?? [],
        objectInfo: fullGameDb.originalAtari?.i559?.objectInfo ?? [],
      },
      i562: {
        woundDefenseFactors: fullGameDb.originalAtari?.i562?.woundDefenseFactors ?? [],
      },
    },
  };
}

function buildRuntimeWeaponAttacksGameDb(fullGameDb) {
  return {
    originalAtari: {
      i560: {
        attacks: fullGameDb.originalAtari?.i560?.attacks ?? [],
        legalAttackClasses: fullGameDb.originalAtari?.i560?.legalAttackClasses ?? [],
      },
      weaponAttackReference: fullGameDb.originalAtari?.weaponAttackReference ?? [],
    },
  };
}

function buildRuntimeCreaturesGameDb(fullGameDb) {
  return {
    originalAtari: {
      i559: {
        creatures: fullGameDb.originalAtari?.i559?.creatures ?? [],
      },
    },
  };
}

function buildRuntimeWallOverlayMapSnapshots(runtimeOverlayData) {
  const fixedFaces = Array.isArray(runtimeOverlayData?.fixedFaces) ? runtimeOverlayData.fixedFaces : [];
  const fixedFacesByMap = new Map();

  for (const face of fixedFaces) {
    const list = fixedFacesByMap.get(face.mapIndex) ?? [];
    list.push(face);
    fixedFacesByMap.set(face.mapIndex, list);
  }

  return Array.from(fixedFacesByMap.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([mapIndex, mapFixedFaces]) => ({
      mapIndex,
      file: `wall_overlays/map-${String(mapIndex).padStart(2, '0')}.json`,
      fixedFaces: mapFixedFaces,
    }));
}

function main() {
  const outputRuntimeBootstrap = readJson(OUTPUT_RUNTIME_BOOTSTRAP);
  const runtimeBootstrap = readJson(RUNTIME_DUNGEON_BOOTSTRAP_FILE);
  const outputRuntimeDungeon = readJson(OUTPUT_RUNTIME_DUNGEON);
  const outputGameDb = readJson(OUTPUT_GAME_DB);
  const runtimeGameDb = readJson(RUNTIME_GAME_DB_FILE);
  const runtimeItemsGameDb = readJson(RUNTIME_GAME_DB_ITEMS_FILE);
  const runtimeWeaponAttacksGameDb = readJson(RUNTIME_GAME_DB_WEAPON_ATTACKS_FILE);
  const runtimeCreaturesGameDb = readJson(RUNTIME_GAME_DB_CREATURES_FILE);
  const outputRuntimeManifest = readJson(OUTPUT_RUNTIME_MANIFEST);
  const runtimeManifest = readJson(RUNTIME_MANIFEST_FILE);
  const outputRuntimeWallOverlays = readJson(OUTPUT_RUNTIME_WALL_OVERLAYS);
  const runtimeWallOverlays = readJson(RUNTIME_WALL_OVERLAY_FILE);

  const checks = [];
  checks.push(compareExact(
    'dungeon bootstrap',
    OUTPUT_RUNTIME_BOOTSTRAP,
    RUNTIME_DUNGEON_BOOTSTRAP_FILE,
    outputRuntimeBootstrap,
    runtimeBootstrap,
  ));
  checks.push(compareExact(
    'game_db monolith',
    OUTPUT_GAME_DB,
    RUNTIME_GAME_DB_FILE,
    outputGameDb,
    runtimeGameDb,
  ));
  checks.push(compareExact(
    'runtime manifest',
    OUTPUT_RUNTIME_MANIFEST,
    RUNTIME_MANIFEST_FILE,
    outputRuntimeManifest,
    runtimeManifest,
  ));
  checks.push(compareExact(
    'runtime wall overlays snapshot',
    OUTPUT_RUNTIME_WALL_OVERLAYS,
    RUNTIME_WALL_OVERLAY_FILE,
    outputRuntimeWallOverlays,
    runtimeWallOverlays,
  ));

  const expectedItemsSlice = buildRuntimeItemsGameDb(outputGameDb);
  checks.push(compareExact(
    'game_db items slice',
    OUTPUT_GAME_DB,
    RUNTIME_GAME_DB_ITEMS_FILE,
    expectedItemsSlice,
    runtimeItemsGameDb,
  ));

  const expectedWeaponAttacksSlice = buildRuntimeWeaponAttacksGameDb(outputGameDb);
  checks.push(compareExact(
    'game_db weapon attacks slice',
    OUTPUT_GAME_DB,
    RUNTIME_GAME_DB_WEAPON_ATTACKS_FILE,
    expectedWeaponAttacksSlice,
    runtimeWeaponAttacksGameDb,
  ));

  const expectedCreaturesSlice = buildRuntimeCreaturesGameDb(outputGameDb);
  checks.push(compareExact(
    'game_db creatures slice',
    OUTPUT_GAME_DB,
    RUNTIME_GAME_DB_CREATURES_FILE,
    expectedCreaturesSlice,
    runtimeCreaturesGameDb,
  ));

  const expectedMapCount = Array.isArray(outputRuntimeDungeon.maps) ? outputRuntimeDungeon.maps.length : 0;
  const mapChecks = [];
  for (const map of outputRuntimeDungeon.maps ?? []) {
    const runtimeMapPath = buildRuntimeDungeonMapFile(map.index);
    const runtimeMap = readJson(runtimeMapPath);
    mapChecks.push(compareExact(
      `runtime dungeon map ${map.index}`,
      OUTPUT_RUNTIME_DUNGEON,
      runtimeMapPath,
      map,
      runtimeMap,
    ));
  }

  const expectedOverlayMaps = buildRuntimeWallOverlayMapSnapshots(outputRuntimeWallOverlays);
  const overlayMapChecks = [];
  for (const entry of expectedOverlayMaps) {
    const runtimeMapPath = buildRuntimeWallOverlayMapFile(entry.mapIndex);
    const runtimeMap = readJson(runtimeMapPath);
    overlayMapChecks.push(compareExact(
      `runtime wall overlay map ${entry.mapIndex}`,
      OUTPUT_RUNTIME_WALL_OVERLAYS,
      runtimeMapPath,
      entry,
      runtimeMap,
    ));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      topLevelChecks: checks.length,
      topLevelFailures: checks.filter((entry) => !entry.matches).length,
      runtimeDungeonMapsCompared: mapChecks.length,
      runtimeDungeonMapFailures: mapChecks.filter((entry) => !entry.matches).length,
      runtimeWallOverlayMapsCompared: overlayMapChecks.length,
      runtimeWallOverlayMapFailures: overlayMapChecks.filter((entry) => !entry.matches).length,
      expectedMapCount,
      expectedOverlayMapCount: expectedOverlayMaps.length,
    },
    checks,
    mapChecks,
    overlayMapChecks,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${REPORT_PATH}`);

  const hasFailures =
    report.summary.topLevelFailures > 0 ||
    report.summary.runtimeDungeonMapFailures > 0 ||
    report.summary.runtimeWallOverlayMapFailures > 0;

  if (hasFailures) {
    console.error('Runtime package consistency audit found mismatches.');
    process.exit(1);
  }

  console.log(`Top-level checks: ${report.summary.topLevelChecks}/${report.summary.topLevelChecks}`);
  console.log(`Runtime dungeon maps: ${mapChecks.length}/${expectedMapCount}`);
  console.log(`Runtime wall overlay maps: ${overlayMapChecks.length}/${expectedOverlayMaps.length}`);
}

main();

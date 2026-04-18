'use strict';

const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

const RUNTIME_ROOT_DIR = path.join(ROOT_DIR, 'src', 'assets', 'runtime');
const RUNTIME_DUNGEON_DIR = path.join(RUNTIME_ROOT_DIR, 'dungeon');
const RUNTIME_DUNGEON_MAPS_DIR = path.join(RUNTIME_DUNGEON_DIR, 'maps');
const RUNTIME_DB_DIR = path.join(RUNTIME_ROOT_DIR, 'db');
const RUNTIME_REFERENCE_DIR = path.join(RUNTIME_ROOT_DIR, 'reference');
const RUNTIME_SUPPORT_DIR = path.join(RUNTIME_ROOT_DIR, 'support');
const RUNTIME_WALL_OVERLAY_MAPS_DIR = path.join(RUNTIME_SUPPORT_DIR, 'wall_overlays');

const RUNTIME_DUNGEON_BOOTSTRAP_FILE = path.join(RUNTIME_DUNGEON_DIR, 'bootstrap.json');
const RUNTIME_GAME_DB_FILE = path.join(RUNTIME_DB_DIR, 'game_db.json');
const RUNTIME_GAME_DB_ITEMS_FILE = path.join(RUNTIME_DB_DIR, 'game_db_items.json');
const RUNTIME_GAME_DB_WEAPON_ATTACKS_FILE = path.join(RUNTIME_DB_DIR, 'game_db_weapon_attacks.json');
const RUNTIME_GAME_DB_CREATURES_FILE = path.join(RUNTIME_DB_DIR, 'game_db_creatures.json');
const RUNTIME_MANIFEST_FILE = path.join(RUNTIME_ROOT_DIR, 'runtime_data_manifest.json');
const RUNTIME_WALL_OVERLAY_FILE = path.join(
  RUNTIME_SUPPORT_DIR,
  'original_wall_overlay_positions.json',
);

const LEGACY_RUNTIME_DATA_DIR = path.join(ROOT_DIR, 'src', 'assets', 'data');
const LEGACY_RUNTIME_SUPPORT_DIR = path.join(ROOT_DIR, 'src', 'assets');

function buildRuntimeDungeonMapFileName(mapIndex) {
  return `level-${String(mapIndex).padStart(2, '0')}.json`;
}

function buildRuntimeDungeonMapFile(mapIndex) {
  return path.join(RUNTIME_DUNGEON_MAPS_DIR, buildRuntimeDungeonMapFileName(mapIndex));
}

function buildRuntimeWallOverlayMapFileName(mapIndex) {
  return `map-${String(mapIndex).padStart(2, '0')}.json`;
}

function buildRuntimeWallOverlayMapFile(mapIndex) {
  return path.join(RUNTIME_WALL_OVERLAY_MAPS_DIR, buildRuntimeWallOverlayMapFileName(mapIndex));
}

module.exports = {
  ROOT_DIR,
  RUNTIME_ROOT_DIR,
  RUNTIME_DUNGEON_DIR,
  RUNTIME_DUNGEON_MAPS_DIR,
  RUNTIME_DB_DIR,
  RUNTIME_REFERENCE_DIR,
  RUNTIME_SUPPORT_DIR,
  RUNTIME_WALL_OVERLAY_MAPS_DIR,
  RUNTIME_DUNGEON_BOOTSTRAP_FILE,
  RUNTIME_GAME_DB_FILE,
  RUNTIME_GAME_DB_ITEMS_FILE,
  RUNTIME_GAME_DB_WEAPON_ATTACKS_FILE,
  RUNTIME_GAME_DB_CREATURES_FILE,
  RUNTIME_MANIFEST_FILE,
  RUNTIME_WALL_OVERLAY_FILE,
  LEGACY_RUNTIME_DATA_DIR,
  LEGACY_RUNTIME_SUPPORT_DIR,
  buildRuntimeDungeonMapFile,
  buildRuntimeDungeonMapFileName,
  buildRuntimeWallOverlayMapFile,
  buildRuntimeWallOverlayMapFileName,
};

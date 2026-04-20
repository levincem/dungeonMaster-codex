# Data Pipeline

Current data pipeline status as of `2026-04-18`.

## Canonical flow

The project now separates three distinct roles:

- extraction output / proof data
- generated runtime package
- browser-served reference inputs

## Extraction output

The extraction scripts under [assets/OriginalDataExtraction](/D:/DungeonMaster-codex/assets/OriginalDataExtraction) write their audit and proof outputs to:

- [assets/OriginalDataExtraction/output](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output)

Important files there:

- [output/dungeon.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/dungeon.json): full extraction / audit dump
- [output/runtime_dungeon.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/runtime_dungeon.json): compact runtime-oriented snapshot kept for comparison
- [output/runtime_dungeon_bootstrap.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/runtime_dungeon_bootstrap.json): compact bootstrap-only snapshot
- [output/game_db.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/game_db.json): regenerated runtime database
- [output/runtime_data_manifest.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/runtime_data_manifest.json): packaging summary
- [output/runtime_package_consistency_audit.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/runtime_package_consistency_audit.json): exact comparison between extraction-side runtime outputs and the shipped runtime package under `src/assets/runtime`

This directory remains the source of truth for audits that need full coordinates, raw proof fields, or extraction-side comparisons.

## Runtime package

The canonical runtime package consumed by the app now lives under:

- [src/assets/runtime](/D:/DungeonMaster-codex/src/assets/runtime)

Layout:

- [src/assets/runtime/dungeon/bootstrap.json](/D:/DungeonMaster-codex/src/assets/runtime/dungeon/bootstrap.json)
- [src/assets/runtime/dungeon/maps](/D:/DungeonMaster-codex/src/assets/runtime/dungeon/maps)
- [src/assets/runtime/db/game_db.json](/D:/DungeonMaster-codex/src/assets/runtime/db/game_db.json)
- [src/assets/runtime/db/game_db_items.json](/D:/DungeonMaster-codex/src/assets/runtime/db/game_db_items.json)
- [src/assets/runtime/db/game_db_weapon_attacks.json](/D:/DungeonMaster-codex/src/assets/runtime/db/game_db_weapon_attacks.json)
- [src/assets/runtime/db/game_db_creatures.json](/D:/DungeonMaster-codex/src/assets/runtime/db/game_db_creatures.json)
- [src/assets/runtime/reference](/D:/DungeonMaster-codex/src/assets/runtime/reference)
- [src/assets/runtime/support/original_wall_overlay_positions.json](/D:/DungeonMaster-codex/src/assets/runtime/support/original_wall_overlay_positions.json)
- [src/assets/runtime/support/wall_overlays](/D:/DungeonMaster-codex/src/assets/runtime/support/wall_overlays)
- [src/assets/runtime/runtime_data_manifest.json](/D:/DungeonMaster-codex/src/assets/runtime/runtime_data_manifest.json)

Important runtime distinction:

- the dungeon payload is no longer shipped as one runtime JSON blob under `src/assets/data/`
- the app boots from `bootstrap.json`
- each map now has its own generated file `maps/level-XX.json`
- `game_db` is still emitted as one canonical monolithic file for audits and transition safety, but the app now consumes smaller generated slices for items, attacks, and creatures
- wall overlay positions are now also emitted one file per map under `support/wall_overlays/map-XX.json`, while the compact monolithic support snapshot is kept for audits and transition safety
- the bootstrap now also carries default open pits, teleporters, and visible texts so lightweight world markers can be restored without forcing all map payloads
- this keeps the package compatible with per-level preload and avoids forcing the parser to recreate the old flat layout

## Parser contract

The runtime packaging entry point remains:

- [assets/OriginalDataExtraction/parse_full.cjs](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/parse_full.cjs)
- [assets/OriginalDataExtraction/parse_full.js](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/parse_full.js)

Runtime path constants are now centralized in:

- [assets/OriginalDataExtraction/runtime_paths.cjs](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/runtime_paths.cjs)

`parse_full` now:

- generates the full extraction outputs in `output/`
- generates the runtime bootstrap in `src/assets/runtime/dungeon/bootstrap.json`
- generates one runtime map file per level in `src/assets/runtime/dungeon/maps/`
- writes the canonical runtime `game_db.json` to `src/assets/runtime/db/`
- writes the runtime `game_db` slices `game_db_items.json`, `game_db_weapon_attacks.json`, and `game_db_creatures.json` to `src/assets/runtime/db/`
- synchronizes runtime reference JSON into `src/assets/runtime/reference/`
- synchronizes compact support assets into `src/assets/runtime/support/`
- writes one runtime wall-overlay snapshot per map under `src/assets/runtime/support/wall_overlays/`
- removes legacy generated files from the old flat runtime locations instead of regenerating them

## Runtime references and support assets

The runtime reference subset currently packaged is:

- `original_creatures_runtime.json`
- `original_doors_runtime.json`
- `original_teleporters_runtime.json`

Important note:

- `original_teleporters_runtime.json` is now part of the official generated runtime package and manifest
- it is generated directly from the parsed dungeon content instead of being left as an orphan file under the old runtime directory

For wall overlays:

- [public/original_wall_overlay_positions.json](/D:/DungeonMaster-codex/public/original_wall_overlay_positions.json) remains the full extracted/reference export
- [output/runtime_wall_overlay_positions.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/runtime_wall_overlay_positions.json) remains the compact runtime snapshot
- [src/assets/runtime/support/original_wall_overlay_positions.json](/D:/DungeonMaster-codex/src/assets/runtime/support/original_wall_overlay_positions.json) remains the compact runtime copy kept as the canonical support snapshot
- [src/assets/runtime/support/wall_overlays/map-XX.json](/D:/DungeonMaster-codex/src/assets/runtime/support/wall_overlays) are the per-map runtime slices consumed by the app

## Runtime loaders

The runtime package is consumed from:

- [src/data/dungeonData.ts](/D:/DungeonMaster-codex/src/data/dungeonData.ts)
- [src/data/mapLoader.ts](/D:/DungeonMaster-codex/src/data/mapLoader.ts)
- [src/data/gameDbData.ts](/D:/DungeonMaster-codex/src/data/gameDbData.ts)
- [src/data/originalWallOverlayData.ts](/D:/DungeonMaster-codex/src/data/originalWallOverlayData.ts)

Key behavior:

- `preloadDungeonData()` still loads the full runtime dungeon package for compatibility
- the loader now has an explicit `bootstrap + per-map` model internally
- the runtime now also combines that split with progressive `hydratedLevels` world materialization for creatures and floor items
- Vite chunking now preserves per-level dungeon map chunks instead of regrouping them into one monolith
- `gameDbData.ts` no longer proxies one raw runtime blob: it now preloads dedicated slices for items, weapon attacks, and creatures, while keeping `preloadGameDbData()` as the transition-safe entrypoint used by boot and title flow
- `originalWallOverlayData.ts` now mirrors that approach for overlays, with per-map runtime imports, neighborhood preload helpers, and a full warm-up path kept for background title loading

## Extraction-side scripts

Older extraction utilities that previously read `src/assets/data/dungeon.json` or `src/assets/data/game_db.json` have been realigned:

- extraction audits that need full world coordinates should read `output/dungeon.json`
- scripts that validate the current runtime database should read `src/assets/runtime/db/game_db.json`

This avoids mixing audit-only needs with the shipped runtime package.

Recommended quick validation after regeneration:

- `node assets/OriginalDataExtraction/compare_atari_stats_to_game_db.cjs`
- `node assets/OriginalDataExtraction/audit_runtime_package_consistency.cjs`

## Why this is cleaner

- one canonical generated runtime root
- bootstrap data is separated from level payloads
- wall overlay runtime data is separated into per-map slices instead of one large browser chunk
- the parser no longer recreates deprecated flat runtime files
- runtime references and support assets now have explicit homes
- the teleporter runtime export is finally tracked as part of the package instead of being an accidental extra file
- the build is now structurally compatible with future per-level preload work

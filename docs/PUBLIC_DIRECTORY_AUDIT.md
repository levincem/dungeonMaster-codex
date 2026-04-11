# Public Directory Audit

Status observed on `2026-04-11`.

## Goal

Classify files in [public](/D:/DungeonMaster-codex/public) into:

- still needed by the shipped app
- still needed by extraction / audit pipeline
- reference or documentation artifacts only

The canonical runtime package itself is described separately by:

- [src/assets/data/runtime_data_manifest.json](/D:/DungeonMaster-codex/src/assets/data/runtime_data_manifest.json)

Reference-only JSON exports that are no longer meant to live in `public/` are now stored under:

- [assets/OriginalDataExtraction/reference_exports](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/reference_exports)

## Still needed by the app

- [vite.svg](/D:/DungeonMaster-codex/public/vite.svg)
  Used by [index.html](/D:/DungeonMaster-codex/index.html:5) as favicon.

## Still needed by the extraction / audit pipeline

### Graphics reference inputs

- [public/graphics_db.json](/D:/DungeonMaster-codex/public/graphics_db.json)
- [public/graphics_helper_0696.json](/D:/DungeonMaster-codex/public/graphics_helper_0696.json)
- [public/graphics_layout_0696.json](/D:/DungeonMaster-codex/public/graphics_layout_0696.json)
- [public/graphics_panels_0696.json](/D:/DungeonMaster-codex/public/graphics_panels_0696.json)

These are still read by extraction-side scripts such as:

- `parse_full.cjs`
- `parse_sck_graphics.cjs`
- `export_graphics_helper_0696.cjs`
- `export_graphics_layout_0696.cjs`
- `export_graphics_panels_0696.cjs`
- `summarize_graphics_layout_0696.cjs`
- `analyze_raw_0696.cjs`

### Runtime reference exports still synced by `parse_full`

- [public/original_creatures_runtime.json](/D:/DungeonMaster-codex/public/original_creatures_runtime.json)
- [public/original_doors_runtime.json](/D:/DungeonMaster-codex/public/original_doors_runtime.json)
- [public/original_wall_overlay_positions.json](/D:/DungeonMaster-codex/public/original_wall_overlay_positions.json)

These are not canonical runtime locations anymore, but they still act as source exports for the packaging step.

At the moment, `parse_full` only syncs the runtime subset actually consumed by the app:

- `original_creatures_runtime.json`
- `original_doors_runtime.json`
- `original_wall_overlay_positions.json`

## Reference / documentation artifacts no longer kept in `public/`

The former reference-only JSON exports have been moved out of `public/` into:

- [assets/OriginalDataExtraction/reference_exports](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/reference_exports)

This includes former `public/` files such as:

- `dungeon.json`
- `game_db.json`
- `original_level_content.json`
- the larger `original_*.json` reference family that is not part of the active runtime or active pipeline subset

Note:

- `original_level_content.json` is still important to audits, but it is now copied by `parse_full` into [assets/OriginalDataExtraction/output/original_level_content.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/original_level_content.json) so audit scripts no longer need to read it directly from `public/`.

## Deletion guidance

### Safe to keep

Keeping these files is harmless and still useful for extraction history, audits, and docs.

### Not recommended to delete yet

Do not delete yet:

- `graphics_db.json`
- `graphics_helper_0696.json`
- `graphics_layout_0696.json`
- `graphics_panels_0696.json`
- `original_creatures_runtime.json`
- `original_doors_runtime.json`
- `original_wall_overlay_positions.json`
- `vite.svg`

### Already cleaned out of `public/`

These have already been moved to `reference_exports/`:

- `dungeon.json`
- `game_db.json`
- the reference-only `original_*.json` family that is not part of the active runtime/pipeline subset

## Current Recommendation

- keep `public/` focused on browser assets plus the small set of extraction-side reference inputs still in use
- treat `src/assets/data/` plus `runtime_data_manifest.json` as the runtime source of truth
- treat `assets/OriginalDataExtraction/reference_exports/` as the home for archived/reference JSON exports that should not clutter `public/`

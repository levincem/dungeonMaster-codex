# Extractor Diagnosis

Audit date: 2026-04-07

Audited files:
- [assets/OriginalDataExtraction/parse_full.js](D:\DungeonMaster-codex\assets\OriginalDataExtraction\parse_full.js)
- [assets/OriginalDataExtraction/parse_dungeon.js](D:\DungeonMaster-codex\assets\OriginalDataExtraction\parse_dungeon.js)
- [assets/OriginalDataExtraction/EUDATA/DUNGEON.DAT](D:\DungeonMaster-codex\assets\OriginalDataExtraction\EUDATA\DUNGEON.DAT)

Reference data:
- [public/original_level_content.json](D:\DungeonMaster-codex\public\original_level_content.json)
- [docs/DUNGEON_DATA_AUDIT.md](D:\DungeonMaster-codex\docs\DUNGEON_DATA_AUDIT.md)

## Short Version

The current extractor does not look like it invented content from nothing.

Instead, it appears to:

- parse the raw object pools reasonably well
- parse map geometry reasonably well
- reconstruct a large amount of spatial placement correctly
- still misidentify many items and lose some critical placements or texts

Important correction:

- an earlier hypothesis was that [parse_full.js](D:\DungeonMaster-codex\assets\OriginalDataExtraction\parse_full.js) was fundamentally wrong because it did not use the column index table
- after checking the original engine source, that claim is too strong
- the current sequential traversal of `hasObjects` squares is broadly consistent with the original `GetSquareFirstThingIndex` logic

So the root cause is not simply “the extractor ignores the column table”.

## What the extractor gets right

The current parser appears to extract these parts credibly:

- map count, offsets, map sizes, local/global bounds
- map tile bytes and tile types
- raw object pools:
  - doors
  - teleporters
  - texts
  - sensors
  - creatures
  - weapons
  - armor
  - scrolls
  - potions
  - containers
  - misc
- champion mirror detection and champion text decoding

This matches the shape of [public/dungeon.json](D:\DungeonMaster-codex\public\dungeon.json), whose `objectDatabase` still contains large raw pools.

## Where the current reconstruction is likely wrong

### 1. The column index table confirms the square-first-thing layout

The original engine source in [DUNGEON.C](D:\DungeonMaster-codex\assets\OriginalDataExtraction\ReDMCSB\SOURCE\ENGINE\DUNGEON.C) exposes:

- `G280_pui_DungeonColumnsCumulativeSquareThingCount`
- `G281_pi_DungeonMapsFirstColumnIndex`
- `F160_xxxx_DUNGEON_GetSquareFirstThingIndex`

The original formula is:

- start from the cumulative thing count for the square's column
- then add one for each earlier square in the same column that has a thing list

This is compatible with the current parser walking tiles column-major and consuming one `OFF_OBJ_LIST` entry per square with the `hasObjects` bit set.

So the square-first-thing indexing logic is not obviously the main bug.

### 2. Evidence from `colIndex`

The `colIndex` table behaves like cumulative per-column boundaries.

Examples:

- map 0 `Hall of Champions`
  - width: 18 columns
  - `colIndex` slice: `[0, 1, 6, 9, 11, 14, 18, 20, 26, 30, 36, 42, 47, 50, 53, 59, 61, 68, 70]`
  - this implies 70 object-bearing records across the map columns

- map 1 `Level 1`
  - width: 32 columns
  - `colIndex` range grows from `70` to `196`
  - this implies 126 additional column-linked records

- map 2 `Level 2`
  - `196 -> 346`
  - 150 additional records

These deltas are large and plausible for full dungeon content, and they match the original engine model of cumulative first-thing indices.

### 3. The runtime export is spatially incomplete or misidentified in targeted places

The corrected audit in [docs/DUNGEON_DATA_AUDIT.md](D:\DungeonMaster-codex\docs\DUNGEON_DATA_AUDIT.md) shows a more precise picture:

- many creature placements are already correct
- many item coordinates contain item objects on the expected square
- but many identities are wrong, especially among misc/key-like objects
- some critical placements are still missing, such as `The Firestaff`
- several scroll and wall texts are truncated or shifted

So the extraction problem is real, but narrower than “all spatial reconstruction is broken”.

## What this means about the old export

The current evidence points to:

- real raw data parsed from original files
- incorrect reconstruction of where that data belongs in the dungeon
- approximate fallback naming for some object types
- fragmentary text decoding for some scrolls and wall texts

This does not look like deliberate fabrication.

It looks much more like:

- a genuine reverse-engineering attempt
- with several partially correct systems
- but incomplete or inaccurate decoding of some thing payloads, names, and texts

## Secondary issues

### Text decoding is sometimes fragmentary

Several scroll texts in the raw object database are shifted fragments rather than canonical full strings.

Examples previously observed:

- `RTCUT` instead of `SHORTCUT`
- partial fountain text instead of `THIS FOUNTAIN ACCEPTS ONE WISH.`
- truncated `TO CLOSE PIT...`

This means the text-decoding stage also needs validation against canonical placement/text data.

### Hardcoded item naming is partly heuristic

[assets/OriginalDataExtraction/docs/RESEARCH_NOTES.md](D:\DungeonMaster-codex\assets\OriginalDataExtraction\docs\RESEARCH_NOTES.md) already documents that:

- `GRAPHICS.DAT` item tables are not fully resolved
- some item naming/stat lookup is derived rather than byte-perfect

So some wrong names likely come from heuristic mapping, not from the original dungeon file itself.

## Practical next step

The safest path is:

1. Keep [public/original_level_content.json](D:\DungeonMaster-codex\public\original_level_content.json) as the canonical reference.
2. Compare the reconstructed placements and identities against the canonical reference.
3. Focus on the remaining failure classes:
   - wrong item type/name decoding
   - missing critical placements
   - truncated text decoding
4. Reconstruct corrected output from original data again.

## Progress on 2026-04-07

After introducing a first conservative remap pass in
[assets/OriginalDataExtraction/parse_full.js](D:\DungeonMaster-codex\assets\OriginalDataExtraction\parse_full.js):

- weapon names are much closer to the original game data
- many `Misc` items and key-like objects now decode correctly
- generic container variants now decode as `Chest` instead of opaque `Container_*` names

Using [public/original_level_content.json](D:\DungeonMaster-codex\public\original_level_content.json)
as the canonical reference for placed items:

- `259 / 300` canonical item squares now contain at least one extracted item object
- `234 / 300` canonical item squares now contain at least one correctly named extracted item

The remaining mismatches are much narrower than before and mostly fall into these buckets:

- a reduced set of chests whose content strings still differ from the canonical phrasing
- `Water` versus `Waterskin` presentation, which appears to depend on original icon semantics
- quantity-bearing items such as `Apple (2)` or `Drumstick (2)` where the base name is now correct
- scroll text fragments that still need reconstruction to match the canonical user-facing wording exactly

This is a meaningful improvement over the earlier state, and it confirms that the
most productive next work is no longer broad spatial reconstruction, but object-payload decoding.

## Working hypothesis to test next

The next technical questions to answer are:

- why several `Misc` / key-like objects decode to the wrong identities
- why some squares with valid canonical content are still empty in the export
- why some scroll and wall texts are truncated or shifted

Until that is resolved, [public/dungeon.json](D:\DungeonMaster-codex\public\dungeon.json) should still not be considered authoritative for placed dungeon content.



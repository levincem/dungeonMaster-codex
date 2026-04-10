# External Reference Import Audit

Date: 2026-04-10

This note records what the four user-provided Dungeon Master Encyclopaedia pages add to the project, what was already known locally, and what should be used next to push extraction closer to 100% original-data coverage.

## Sources reviewed

- `D:\Dungeon Files - File formats - Documentation - Community - Dungeon Master Encyclopaedia.htm`
- `D:\Hint Oracle Files - File formats - Documentation - Community - Dungeon Master Encyclopaedia.htm`
- `D:\Layout coordinates - File formats - Documentation - Community - Dungeon Master Encyclopaedia.htm`
- `D:\Portrait Files - File formats - Documentation - Community - Dungeon Master Encyclopaedia.htm`

## Short answer

No, we did not already have all of this in an equally explicit and directly usable form.

The most important addition is the `Dungeon Files` page. It gives several binary-structure details that are actionable for validating and improving the core dungeon parser. The other three pages are useful too, but mostly for adjacent or later extraction work:

- `Hint Oracle Files`: useful for CSB hints support and dungeon-ID cross-checking
- `Layout coordinates`: useful for UI/layout extraction from item 696 / DMCOORD
- `Portrait Files`: useful for exact `.CMP` import/export support

## What this adds beyond the current repo

### 1. Dungeon file format details we should treat as high-value

The `Dungeon Files` page adds or confirms several parser-critical facts:

- Compressed dungeon signature is `0x8104`
- The compressed header contains:
  - uncompressed size
  - dungeon ID
  - 4 most common bytes
  - 16 less common bytes
- Compression bitstream rules are explicit:
  - `0xx` for one of the 4 most common bytes
  - `10xxxx` for one of the 16 less common bytes
  - `11xxxxxxxx` for literal byte
  - bits are read MSB first within each source byte
- Dungeon checksum handling is clarified:
  - checksum may be absent
  - wrong checksum triggers "The game is damaged!"
- Tile bytes are ordered by columns, top to bottom:
  - `(x=0,y=0)`, `(x=0,y=1)`, then next column
- Tile bit layout is fully specified:
  - bits `7-5`: tile type
  - bit `4`: object-list present
  - bits `3-0`: type-specific attributes
- Type-specific tile attributes are explicitly documented for:
  - wall
  - floor
  - pit
  - stairs
  - door
  - teleporter
  - trick wall
- Wall, floor and door ornament IDs are listed for DM
- Misc item bitfields are clarified:
  - bits `15-14`: waterskin fullness / compass direction / bones champion index
  - same high bits also reused for Illumulet / Jewel Symal worn state
  - bit `7`: important-item flag
  - bits `6-0`: item type
- Projectile structure is explicit:
  - 8 bytes
  - next object ID
  - projectile object
  - range energy remaining
  - damage energy remaining
  - event index
- Cloud structure is explicit:
  - 4 bytes
  - next object ID
  - value in bits `15-8`
  - type in bits `6-0`
- Hard limits are documented:
  - maps
  - map dimensions
  - max object counts by category
  - text data limit

These points are directly useful for validating `parse_full.js` and for splitting "raw extraction truth" from runtime interpretation.

### 2. Hint Oracle file format details

The `Hint Oracle Files` page adds useful information, mostly for CSB support:

- `.HTC` / `.HCT` structure is fully described
- files are big endian
- dungeon ID in hint files matches the dungeon ID in the compressed dungeon header
- location records are `(X, Y, Level, 00, HintNumber)`
- special wildcard behavior exists for `X=255` and `Y=255`
- hint records store:
  - 22-byte uppercase title
  - first-page index
  - page count
- hint content block lengths and packed LZW details are described

This is not core DM item extraction, but it is still valuable if we want full archival/extraction coverage of the original data ecosystem.

### 3. Layout coordinates format details

The `Layout coordinates` page is useful for item 696 / DMCOORD extraction:

- signature `0xFC0D`
- count of index ranges
- record ranges with non-overlapping `[first..last]` intervals
- 8-byte record structure:
  - type
  - parent record index
  - two data words
- known record types for anchors, alignment and dimensions
- endian rules across platforms

This is especially relevant if we want to replace guessed UI coordinates with extracted coordinates from original PC/Amiga data.

### 4. Portrait file format details

The `Portrait Files` page gives exact `.CMP` structure:

- file size `508` bytes
- signature `0x91A7`
- reserved header words and one Atari marker pattern
- name field: 8 bytes, uppercase only
- title field: 20 bytes, uppercase only
- portrait image:
  - 32x29 pixels
  - 16 colors
  - Atari planar format
  - 464 bytes
- fixed palette table with Atari / Amiga RGB equivalents

This is useful if we want exact portrait extraction/import, but it is not on the critical path for dungeon/object truth.

## What we already had locally

Before these references, the repo already had substantial extraction work:

- dungeon and object exports in `public/dungeon.json`
- extracted Atari tables in `game_db.json`
- many audit notes in `docs/`
- item 559 and 560 decoding work
- source-assisted verification from CSBwin / FTL code

However, these external pages still add value because they provide a clean, explicit binary contract for several areas where our parser or audits were still partly inferred.

## Immediate extraction tasks unlocked by these references

### Priority 1: dungeon parser validation

Use the `Dungeon Files` page to verify and, if needed, correct:

- compressed dungeon decoder
- checksum handling
- tile-map traversal order
- tile bit decoding
- ornament tables
- projectile record decoding
- cloud record decoding
- misc high-bit decoding for:
  - waterskins
  - compasses
  - bones
  - Illumulet
  - Jewel Symal

This is the highest-value next step because it improves the raw extraction layer directly.

### Priority 2: eliminate remaining parser approximations

Use the same source to make sure `parse_full.js` exports only raw truth for:

- tile definitions
- object bitfields
- projectile state
- cloud state
- map metadata

Interpretive gameplay tables should remain outside the raw parser.

### Priority 3: future extraction expansions

Once the core dungeon/object parser is fully locked:

- add `.HTC` extractor for CSB hint files
- add item 696 / DMCOORD extractor
- add `.CMP` portrait reader/writer

These are worthwhile, but they are second-order compared to dungeon/object truth.

## Recommended project rule

For this project, source priority should be:

1. Original extracted binary data
2. External technical references that describe the original files
3. Runtime interpretation layers inside the remake
4. Legacy project fallbacks or hand-maintained tables

If a local table disagrees with extracted binary data or with a precise file-format specification for the original files, the local table should be considered suspect until proven otherwise.

## Proposed follow-up checklist

- Validate the current dungeon decompressor against the documented `0x8104` format
- Audit tile decoding against the documented bit layout and column-major ordering
- Audit misc item high bits and important-item flag
- Audit projectile and cloud extraction structures
- Record which parts of `parse_full.js` are still inferred instead of extracted
- Add separate future tasks for `.HTC`, item 696 / DMCOORD, and `.CMP`

## Bottom line

The four pages are useful, but not equally so.

If the goal is "extract 100% of the original game data as faithfully as possible", the `Dungeon Files` page is the one that immediately helps the most. The other three should be kept as reference material for later completeness work, especially for CSB hints, original UI coordinates, and champion portrait tooling.

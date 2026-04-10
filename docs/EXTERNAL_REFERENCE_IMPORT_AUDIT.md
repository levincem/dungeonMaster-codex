# External Reference Import Audit

Date: 2026-04-10

This note records what the four user-provided Dungeon Master Encyclopaedia pages add to the project, what was already known locally, and what should be used next to push extraction closer to 100% original-data coverage.

## Sources reviewed

- `D:\Dungeon Files - File formats - Documentation - Community - Dungeon Master Encyclopaedia.htm`
- `D:\Hint Oracle Files - File formats - Documentation - Community - Dungeon Master Encyclopaedia.htm`
- `D:\Layout coordinates - File formats - Documentation - Community - Dungeon Master Encyclopaedia.htm`
- `D:\Portrait Files - File formats - Documentation - Community - Dungeon Master Encyclopaedia.htm`
- user-provided notes about the generic animation file format used by many DM / CSB / DM2 versions

## Short answer

No, we did not already have all of this in an equally explicit and directly usable form.

The most important addition is the `Dungeon Files` page. It gives several binary-structure details that are actionable for validating and improving the core dungeon parser. The other three pages are useful too, but mostly for adjacent or later extraction work:

- `Hint Oracle Files`: useful for CSB hints support and dungeon-ID cross-checking
- `Layout coordinates`: useful for UI/layout extraction from item 696 / DMCOORD
- `Portrait Files`: useful for exact `.CMP` import/export support

## Working reference version

Current extraction target for completeness:

- primary working reference: PC DOS
- secondary cross-check reference: Atari ST

Reasoning:

- the current parser and fixture files are already centered on PC DOS
- PC DOS is easier to iterate on quickly for structural extraction work
- Atari ST remains valuable as a gameplay and fidelity cross-check when a behavior or table differs

This means "100% complete" currently means "100% for the PC DOS data path first", not "all platform variants at once".

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

Confirmed in the repo after parser validation work:

- for the current PC DOS `DUNGEON.DAT`, when a trailing checksum is present, it matches the low 16 bits of the sum of all prior bytes in the file
- this matches the checksum accumulation logic present in `ReDMCSB/SOURCE/ENGINE/SAVEUTIL.C`

Also now exported directly in `dungeon.json` for the PC DOS path:

- `checksumWord`
- `computedChecksum`
- `checksumValid`
- full `rawIndexTables` for:
  - `columnIndexWords`
  - `objectListWords`
- per-map raw structures:
  - `rawDefinitionBytes`
  - `rawTileBytes`
  - `rawMetadataBytes`
- per-map linkage back to raw index tables:
  - `columnIndexStart`
  - `columnIndexValues`
- per-tile object-list tracing:
  - `objectListIndex`
  - `objectListWord`
  - `objectListWordHex`
- per-object raw byte arrays in addition to raw words for:
  - doors
  - teleporters
  - wall texts
  - sensors
  - creatures
  - weapons
  - armor
  - scrolls
  - potions
  - containers
  - misc
  - projectiles
  - clouds
- explicit section-state reporting:
  - `sectionPresence`
  - `projectileDatabase`
  - `cloudDatabase`

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

### 5. Animation file format notes

The additional animation notes are useful for a future extractor, but they are not on the critical path for `DUNGEON.DAT`.

Useful points recorded from that reference:

- many animation files use a generic item stream format
- each item has:
  - 2-byte ASCII type
  - big-endian size word
  - big-endian attribute word
  - payload
- important item kinds include:
  - `AN` animation header
  - `EN` full encoded frame
  - `DL` delta frame
  - `PL` palette
  - `SD` / `SO` sound data and playback
  - `MD` / `MF` / `MI` / `TR` music-related items
  - `FO` / `NE` / `BN` loop-control items
- `DL` depends on the previous `EN` plus prior deltas
- Sega CD and some DM2 variants use different image/audio item families
- several platform/version exceptions are explicitly listed, which is important to avoid assuming one universal animation parser

This reference should be used later if we want:

- an original animation extractor/viewer
- exact intro/cutscene archival
- platform-specific animation support

For now, it should remain a secondary task behind dungeon/object extraction.

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

Use the PC DOS format doc and `ReDMCSB` struct names to replace vague parser labels with honest low-level names wherever possible:

- prefer `unreferenced` / `unused` over invented semantics
- expose raw bytes / words / fields for every object family
- avoid placeholder item names when the source does not prove them

## Current parser status

This is the current practical status after the latest parser cleanup and validation pass.

### What is now effectively complete for the PC DOS parser

- dungeon header
- checksum detection and validation
- compressed dungeon detection and decoding
- map definitions
- column index table
- object-list table
- raw map bytes
- tile-grid decoding
- tile attribute decoding for:
  - wall
  - floor
  - pit
  - stairs
  - door
  - teleporter
  - trick wall
- object pools for:
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
  - projectiles
  - clouds
- raw bytes / words / bitfields for the parsed object families
- explicit pool offsets, sizes and section presence in `dungeon.json`

### What is now considered proven enough for faithful cloning

The remaining unknowns are no longer of the “missing game logic data” kind. They are mostly:

- fields explicitly called `Unreferenced` in the original structs
- container padding / random-content bits that the original docs also describe as not meaningfully used
- one still-unknown cloud bit (`unknownBit7`)

These do not block a faithful clone of the original PC DOS dungeon data.

### Reference payloads now exposed alongside the parser output

`game_db.json` now exposes extracted Atari reference payloads that are useful for cross-checking or completing runtime data:

- `GAME_DB.originalAtari.i559.objectInfo`
- `GAME_DB.originalAtari.i559.weapons`
- `GAME_DB.originalAtari.i559.cloths`
- `GAME_DB.originalAtari.i559.doorInfo`

These are reference extracts, not direct `DUNGEON.DAT` fields, but they remove the previous false impression that those domains were still simply “missing”.

### Practical conclusion

For PC DOS, the parser and extraction layer are now sufficiently complete and trustworthy to serve as the source base for a faithful clone.

The next major fidelity work is no longer the parser itself. It is the runtime:

- projectiles
- thrown weapons
- combat formulas
- monster behavior
- spell behavior and timing

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
- add an animation item-stream extractor for the classic FTL animation format

These are worthwhile, but they are second-order compared to dungeon/object truth.

## Recommended project rule

For this project, source priority should be:

1. Original extracted binary data
2. External technical references that describe the original files
3. Runtime interpretation layers inside the remake
4. Legacy project fallbacks or hand-maintained tables

If a local table disagrees with extracted binary data or with a precise file-format specification for the original files, the local table should be considered suspect until proven otherwise.

## Reference version decision

For the current extraction effort, the working reference version should be:

- primary extraction reference: PC DOS
- secondary cross-check reference: Atari ST

Reasoning:

- the current parser and file coverage are already strongest on PC DOS
- PC DOS is easier to iterate on quickly for full dungeon extraction
- Atari ST remains extremely valuable as a truth source for original gameplay tables and historical fidelity

Practical rule:

- use PC DOS as the main target when the goal is "complete extraction of one version"
- use Atari ST extracted tables to verify gameplay-sensitive data and to flag meaningful divergences
- do not silently merge differences between versions without recording which version is being treated as authoritative for the specific field

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

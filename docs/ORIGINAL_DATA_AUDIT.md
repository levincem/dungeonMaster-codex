# Original Data Audit

## Goal

This document summarizes what has already been recovered from the original Dungeon Master data files, what is only partially understood, and what still needs to be decoded to reach a near-complete original-data export.

The current project now combines:

- dungeon extraction from `DUNGEON.DAT`
- graphics/text extraction from the PC DOS `GRAPHICS.DAT` through `sck`
- coordinate reconciliation with the original global map offsets

## Overall Status

The project is now in a strong state for:

- dungeon topology
- original map coordinates
- placed objects and champions
- visible resource naming
- door families
- several wall ornament families

The main missing layer is no longer the basic file extraction itself, but the deeper semantic interpretation of some binary tables, especially the `0696.RAW1` block extracted from `GRAPHICS.DAT`.

## New Reverse-Engineering Findings

### `0696.RAW1` is a cross-platform post-Atari data block

By inspecting the `sck` mapping database, `0696.RAW1` is not specific to the PC DOS release. The same unknown `RAW1` block is present in:

- `dm_pc43_en_gd`
- `dm_pc43_multi_gd`
- `csb_amiga_3x_gd`
- `csb_amiga_gd`
- `dm_amiga_36_gd`
- `csb_fmtowns_gd`
- `csb_pc98_gd`
- `csb_x68k_gd`

At the same time, Atari maps expose the old split structures:

- `0558 = I558`
- `0559 = I559`
- `0560/0561/0562 = RAW1 Various Data`

This strongly suggests that `0696` is a consolidated post-Atari data block used by several later ports, not a PC-only anomaly.

### `0696.RAW1` does not contain a contiguous Atari-style `I559`

Two independent checks now point in the same direction:

- signature searches for the well-known `I559` trailer fields (`extra_db_entries`, `delta_y`, `delta_x`) do not match in `0696`
- brute-force scanning for contiguous `OBJECT_INFO`, `WEAPON_INFO` and `ARMOUR_INFO` windows inside `0696` produces only false positives dominated by layout-like values

The best `OBJECT_INFO` candidates only matched `9` exact expected type entries out of `180`, which is far below what a real original object database would produce.

Assessment:

- `very unlikely that 0696 stores I559 as one contiguous block`
- `much more likely that post-Atari ports reorganized or merged several logical tables into a new format`

### `0696.RAW1` is now exported structurally

Even without full semantic decoding, the remaining raw data is no longer trapped in a black box. A structural export now exists in:

- [`public/graphics_layout_0696.json`](/D:/DungeonMaster-codex/public/graphics_layout_0696.json)

This export preserves:

- the first header words
- the current best section-pair boundaries
- all raw words per section range
- a normalized 4-word record interpretation with resource descriptions when the target word matches a known resource

Assessment:

- `complete as a structural export`
- `still partial as a semantic/gameplay export`

## Fully Recovered Data

### Dungeon structure

Source:

- [`public/dungeon.json`](/D:/DungeonMaster-codex/public/dungeon.json)

Recovered reliably:

- all maps
- local and global coordinates
- map offsets
- local and global bounds
- tiles and tile types
- pits, stairs, teleporters
- doors placed in the dungeon
- wall texts
- sensors / mechanisms
- champions in the Hall of Champions
- objects placed in the dungeon
- targets and destinations in original/global coordinates

Assessment:

- `complete enough for gameplay and map fidelity`

### Textual resource data

Source:

- [`public/graphics_db.json`](/D:/DungeonMaster-codex/public/graphics_db.json)

Recovered reliably:

- item names in English / French / German
- attack names
- miscellaneous in-game texts

Examples confirmed:

- `RESURRECTED`
- `REINCARNATED`
- item names such as `BLUE PANTS`, `SUEDE BOOTS`, `ELVEN BOOTS`

Assessment:

- `complete`

### Door family identification

Source:

- [`public/graphics_db.json`](/D:/DungeonMaster-codex/public/graphics_db.json)

Recovered reliably:

- `doorGraphics 0 = Porticullis`
- `doorGraphics 1 = Wooden Door`
- `doorGraphics 2 = Iron Door`
- `doorGraphics 3 = Ra Door`

Assessment:

- `complete at family/type level`

### Wall ornament identification

Source:

- [`public/graphics_db.json`](/D:/DungeonMaster-codex/public/graphics_db.json)

Recovered reliably for several important ornaments:

- `Grate`
- `Empty Torch Holder`
- `Full Torch Holder`
- `Champion Mirror`
- `Lever Up`
- `Lever Down`
- plus additional ornament names already indexed by `sck`

Assessment:

- `strong and directly usable`

## Partially Recovered Data

### PC DOS graphics resource index

Source:

- [`public/graphics_db.json`](/D:/DungeonMaster-codex/public/graphics_db.json)

Recovered:

- `748` indexed resources from `GRAPHICS.DAT`
- resource ids
- resource types such as `IMG3`, `TXT2`, `SND3`, `RAW1`
- descriptions
- dimensions for image resources

What is still partial:

- we know what many resources are
- we do not always know exactly how the original engine used each internal resource table

Assessment:

- `mostly extracted, partially interpreted`

### Render/composition metadata in `0696.RAW1`

Source:

- [`0696.RAW1 [Unknown - Unknown Content (Words of data)].dat`](/D:/DungeonMaster-codex/assets/DMDisquette/EUDATA/out_GRAPHICS.DAT/0696.RAW1%20%5BUnknown%20-%20Unknown%20Content%20%28Words%20of%20data%29%5D.dat)
- analysis script: [`analyze_raw_0696.cjs`](/D:/DungeonMaster-codex/assets/DMDisquette/analyze_raw_0696.cjs)
- analysis output: [`raw_0696_analysis.json`](/D:/DungeonMaster-codex/assets/DMDisquette/output/raw_0696_analysis.json)

What is known:

- size: `9160` bytes
- structure is word-based (`4580` 16-bit values)
- the beginning of the file contains a probable section header
- the header appears to define `11` pairs of ranges, including:
  - `[400..436]` and `[120..139]`
  - `[700..749]` and `[800..833]`
  - `[2900..2947]` and `[2500..2568]`
  - `[3000..3064]` and `[1000..1138]`
  - `[3200..3394]` and `[850..872]`
  - `[3700..3809]` and `[1950..1953]`
- many pairs in the data match real extracted resource dimensions
- many tuples reference valid resource ids for:
  - UI resources
  - doors
  - stairs
  - missiles
  - creatures
  - floor items
  - dungeon wall projections

Strong current hypothesis:

- `0696` is primarily a render/composition table
- it likely contains placement/offset/assembly metadata for projected graphics and UI composition
- sections `700..1510` and `2500..2568` are dominated by main-menu and interface composition data
- section `2900..2947` starts with stair side-view placement records, then transitions into internal template ids (`129+`)
- sections `3000..3064` and `3200..3394` contain regular grids for ids `129..139`, which are almost certainly internal placement templates rather than missing visible assets
- section `3700..3963` contains floor-item placement data
- that floor-item block includes single placements for `561`, `563`, `565`, `567`, `569`, `572`, `576`, `578`, `580`
- it also includes a repeated grid of `31` placements for `582` (`Item on floor 84 - Silver Coin`)
- sections after `3964` introduce additional `NULL` ids (`150+`, `171+`, `183+`, `191+`, `207+`, `220+`) in very regular patterns, strongly suggesting more internal UI/layout templates
- comparison with `ReDMCSB` now strongly suggests the PC block is not equivalent to a single Atari global-variables graphic
- it appears to mix data analogous to Atari `Graphic558` dungeon-view coordinate data and Atari `Graphic561` interface/layout data in one aggregated PC DOS block
- it does not currently look like a simple “object stats” table

What is still unknown:

- exact meaning of each opcode
- exact structure of each tuple family
- why some late sections appear to extend beyond the ranges named in the probable header
- whether the block is purely visual or also contains some gameplay-related metadata

Assessment:

- `important, extracted, not yet semantically decoded`

### Cross-check with `sck` internal structure decoders

Sources:

- [`DataI558.javap.txt`](/D:/DungeonMaster-codex/assets/DMDisquette/sck/_inspect/DataI558.javap.txt)
- [`DataI559.javap.txt`](/D:/DungeonMaster-codex/assets/DMDisquette/sck/_inspect/DataI559.javap.txt)
- [`dm_pc43_en_gd.map`](/D:/DungeonMaster-codex/assets/DMDisquette/sck/_inspect/db/map/dm_pc43_en_gd.map)

What is now confirmed:

- `sck` contains dedicated decoders for Atari-style global-variable blocks:
  - `DataI558`
  - `DataI559`
- the PC DOS map for `dm_pc43_en_gd` does **not** map any PC resource to `I558` or `I559`
- instead, the PC map labels only:
  - `0695 = FNT1`
  - `0696 = RAW1`
  - `0699 = TXT2`
  - `0700 = TXT2`

Important structural result:

- `DataI558.decode()` expects a contiguous block of exactly `1156` bytes:
  - lightning coordinates: `24`
  - cloud coordinates: `240`
  - creature coordinates: `330`
  - creature animation shifts: `24`
  - far-creature palette changes: `32`
  - 6 special-color tables + priority table: `182`
  - `27` creature graphic records of `12` bytes each: `324`
- `DataI559.decode()` expects a contiguous block of exactly `2924` bytes:
  - creature facings: `4`
  - wall text encoding: `256`
  - character encoding: `64`
  - text encoding: `256`
  - door characteristics: `8`
  - creature droppings: `80`
  - sound attack indirections: `8`
  - `27` creature records of `20` bytes each: `540`
  - food values: `16`
  - misc weights: `54`
  - protection: `2`
  - `58` cloth records of `4` bytes each: `232`
  - `46` weapon records of `6` bytes each: `276`
  - `180` object records of `6` bytes each: `1080`
  - extra DB entries: `16`
  - size DB entries: `16`
  - deltaY: `8`
  - deltaX: `8`

Most important implication:

- these exact Atari-style structures do **not** appear contiguously in:
  - [`0696.RAW1 [Unknown - Unknown Content (Words of data)].dat`](/D:/DungeonMaster-codex/assets/DMDisquette/EUDATA/out_GRAPHICS.DAT/0696.RAW1%20%5BUnknown%20-%20Unknown%20Content%20%28Words%20of%20data%29%5D.dat)
  - [`FIRES_decompressed.bin`](/D:/DungeonMaster-codex/assets/DMDisquette/FIRES_decompressed.bin)
- signature searches for the `DataI559` tail markers failed:
  - no `extra_db_entries` pattern
  - no `deltaY = -1,0,1,0` followed by `deltaX = 0,1,0,-1`

Working conclusion:

- the PC DOS version does not store the Atari `558/559` data as one simple contiguous block
- at least part of the original gameplay/system data is either:
  - reorganized inside PC-specific structures
  - split and interleaved with render/layout data
  - or embedded elsewhere in a form that does not match the Atari binary order

Assessment:

- `strong progress on format knowledge, but still no direct PC extraction of Atari-style gameplay tables`

## Missing or Not Yet Fully Reconstructed

### Original gameplay/system tables

Still missing in a reliable, source-proven way:

- exact object property tables
- exact allowed equipment slots from original data
- exact action-set mappings for all items
- exact weight and other internal flags when still inferred manually
- exact armour/weapon internal stat tables if they are present in binary data not yet decoded
- any door behaviour tables beyond what is already visible through resource families

Current status in the remake:

- some of this logic exists already in local project data structures
- but not all of it is yet backed by fully decoded original binary tables

Assessment:

- `partially reconstructed manually, not yet fully extracted from source data`

Clarification after the latest reverse-engineering pass:

- the missing layer is now less about file access and more about **PC-specific binary organization**
- `sck` proves the logical structures exist and are well understood for Atari-style data
- however, the PC DOS assets currently available do not expose an immediately decodable `I559` block
- this means the remaining work is genuine reverse engineering, not a simple missing export step

### Semantic decoding of unknown binary resources

Most important remaining target:

- `0696.RAW1`

Possible additional unknowns:

- other `NULL` / `RAW1` or structurally opaque resources that may still map to engine metadata

Assessment:

- `open reverse-engineering work remains`

## Practical Conclusion

For a playable and visually faithful remake, the project already has enough original data for:

- dungeon layout fidelity
- original coordinate fidelity
- correct object/champion placement
- text fidelity
- door family fidelity
- several important ornament families

For a “fully authoritative original data reconstruction”, the project still needs:

1. semantic decoding of `0696.RAW1`
2. confirmation of remaining gameplay/system tables from original binary data
3. replacement of remaining manual heuristics with source-backed extracted values where possible

## Recommended Next Steps

### Priority 1

Decode `0696.RAW1` by identifying tuple families and opcode meanings.

Why:

- it is the largest remaining structured unknown block
- it clearly references real extracted resources
- it is likely central to original render metadata

### Priority 2

Create a domain-by-domain checklist for original fidelity:

- maps
- doors
- wall ornaments
- items
- armour
- weapons
- champions
- UI
- system stats

Why:

- it makes the remaining unknowns explicit
- it prevents future repeated re-investigation

### Priority 3

Replace remaining project-local heuristics with extracted values when original tables are decoded.

Candidate areas:

- [`src/data/items.ts`](/D:/DungeonMaster-codex/src/data/items.ts)
- [`public/game_db.json`](/D:/DungeonMaster-codex/public/game_db.json)

## Reference Files

- [`public/dungeon.json`](/D:/DungeonMaster-codex/public/dungeon.json)
- [`public/game_db.json`](/D:/DungeonMaster-codex/public/game_db.json)
- [`public/graphics_db.json`](/D:/DungeonMaster-codex/public/graphics_db.json)
- [`assets/DMDisquette/parse_sck_graphics.cjs`](/D:/DungeonMaster-codex/assets/DMDisquette/parse_sck_graphics.cjs)
- [`assets/DMDisquette/analyze_raw_0696.cjs`](/D:/DungeonMaster-codex/assets/DMDisquette/analyze_raw_0696.cjs)
- [`assets/DMDisquette/output/raw_0696_analysis.json`](/D:/DungeonMaster-codex/assets/DMDisquette/output/raw_0696_analysis.json)
- [`assets/DMDisquette/SCK_NOTES.md`](/D:/DungeonMaster-codex/assets/DMDisquette/SCK_NOTES.md)

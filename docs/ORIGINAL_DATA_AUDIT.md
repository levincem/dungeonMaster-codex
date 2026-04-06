# Original Data Audit

## Goal

This document summarizes what has already been recovered from the original Dungeon Master data files, what is only partially understood, and what still needs to be decoded to reach a near-complete original-data export.

The current project now combines:

- dungeon extraction from `DUNGEON.DAT`
- graphics/text extraction from the PC DOS `GRAPHICS.DAT` through `sck`
- coordinate reconciliation with the original global map offsets
- external reverse-engineering documentation for `graphics.dat item 559` item and creature tables
- external reverse-engineering documentation for `graphics.dat item 560` actions/spells
- external reverse-engineering documentation for `graphics.dat item 562` UI/system tables

## Overall Status

The project is now in a strong state for:

- dungeon topology
- original map coordinates
- placed objects and champions
- visible resource naming
- door families
- several wall ornament families
- externally documented item carry/category tables
- externally documented creature descriptor tables

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

### `0696` section map is now clearer

By summarizing the exported section pairs, most of the file now falls into a few broad domains:

- `A`, `B`, `F`, `H`, `I`, `J`, `K`
  mostly `ui/layout`
- `C(850..872)`
  dungeon masks / wall-or-floor overlay fragments
- `D(2900..2947)`
  stairs side-view placement, then internal placement templates
- `E(3000..3064)` and `C(3200..3394)`
  internal placement templates only
- `G(3700..3809)` and the following contiguous block `3812..3963`
  dungeon wall anchors plus item-on-floor placement tables

This confirms that `0696` is not a single homogeneous table. It is a container of several layout/placement subsystems.

### Internal template ids `129..139` are almost certainly placement templates

The repeated records for `129..139`, all labelled `No Item Data` by `sck`, form strict coordinate grids:

- `129/131/132`
  base grid around `x = 6, 12, 18` and `y = 10, 20, 30`
- `136`
  grid around `x = 8, 16, 24` and `y = 16, 31, 46`
- `137/138/139`
  grid around `x = 12, 24, 36` and `y = 22, 44, 66`

Example:

- `3200..3352` contains repeated opcodes targeting `136..139` with regular axis and extent values
- `2900..2947` transitions from stair side images (`123/124/125`) directly into template `129`

Assessment:

- `very strong evidence that 129..139 are internal placement templates`
- `they are not missing visible art assets`

### `3812..3940` is a confirmed floor-item distribution block

The contiguous records at `3812..3940` provide the clearest semantic decoding obtained so far.

Confirmed examples:

- `582 = Silver Coin`
  repeated in a dense `11 x 3` grid:
  - `x = 27..127`
  - `y = 31, 41, 51`
- `580 = Boots of Speed`
  single placement at `127,41`
- nearby entries place other floor items such as:
  - `561 = key family`
  - `563 = Mirror of Dawn`
  - `565 = Dragon Steak`
  - `567 = bomb family`
  - `569 = Worm Round`
  - `572 = Rabbit's Foot`
  - `576 = Lock Picks`
  - `578 = Magical Box (Blue)`

Assessment:

- `3812..3940 is effectively decoded as a floor-item placement table`
- this is one of the first post-Atari `0696` sub-blocks with a near-complete semantic interpretation

### `3964..4247` behaves like a bank of anonymous UI templates

The next contiguous block after the confirmed floor-item table does not introduce new visible named resources. Instead, it is dominated by repeated `No Item Data` targets grouped in extremely regular families:

- `150`
  repeated four times at `x = 0, 69, 138, 207`
- `151..154`
  repeated with opcode `9` at four anchor positions:
  - `43,7`
  - `32,29`
  - `24,29`
  - `16,16`
- `155..158`
  repeated with opcode `1` at `0,0`
- `159..162`
  paired as:
  - opcode `18` at `1,0`
  - opcode `10` at `0,0`
- `171..174`
  repeated with opcode `1` at `7,0`
- `175..178`
  repeated with opcode `10` at `0,0`
- `183..186`
  repeated with opcode `1` at `43,0`
- `187..190`
  repeated with opcode `9` at `4,25`
- `191..194`
  repeated with opcode `7` at:
  - `5,26`
  - `12,26`
  - `19,26`
- `207..210`
  repeated with opcode `1` at:
  - `4,10`
  - `24,10`

This block also contains a few known UI references:

- `0 = Interface - Dialog Box` at `67,29`
- `13 = Interface - Movement Arrows` at `87,8`

Assessment:

- `3964..4247 is not a gameplay-stat block`
- `it is very likely a bank of anonymous UI/layout templates or sub-widgets`
- `the repeated 4-way families strongly suggest grouped variants or states, not missing art`

### `4248..4576` is a mixed composite block for UI and dungeon panels

The tail of the file shifts away from pure anonymous templates and starts mixing real dungeon/interface resources with internal helper ids.

The first half of this region is still heavily template-driven:

- `221..244`
  appear as anonymous helper groups with regular spacing rules
- `222` is anchored at `x = 0, 14, 28, 42`
- `223` fills the complementary positions between those anchors
- `224`, `230`, `236`, `242`
  all appear with opcode `18` at `2,1`
- `244`
  repeats six times at `x = 2, 16, 30, 44, 58, 72` and `y = 9`

But the second half contains directly identifiable composites:

- `246..250`
  base door graphics loaded with opcode `10` at `0,0`
- `251 = Door Graphics 1 (Front 1)` at `1,21`
- `252 = Door Graphics 2 (Front 3)`
  repeated four times at `x = 8, 17, 26, 35`
- `253 = Door Graphics 2 (Front 2)` at `72,21`
- `88 = Door Left Frame (Front 2)`
  repeated at `x = 0, 22, 44, 66` and `y = 9`
- `89..92`
  additional door-frame pieces loaded at `0,0`
- `65/66/67`
  ceiling-pit fragments arranged in a `2 x 3` panel:
  - top row at `y = 1`
  - bottom row at `y = 23`
- `110/111/112`
  stairs-up composites:
  - `111` anchored at `19,14`
  - `112` repeated as a `2 x 2` tile group
- `76`, `78`, `97`
  teleporter/floor/wall fragments all aligned at `x = 86, y = 0`
- UI pieces remain mixed in this same block:
  - `11 = Interface - Main Menu Switches States`
  - `13 = Interface - Movement Arrows`
  - `9 = Interface - Spell Casting Area`
  - `2 = Interface - Main Menu Left Door`

Assessment:

- `4248..4576 is a genuine mixed composite/layout section`
- `it combines anonymous helper templates with directly identifiable dungeon and interface panels`
- `this is strong evidence that post-Atari 0696 merges several formerly separate composition tables into one container`

### `0696` is the only remaining raw block in the extracted PC graphics database

The current `sck`-based PC graphics export exposes exactly one non-trivial `RAW1` resource:

- `696 = Unknown Content (Words of data)`

There is no second unidentified raw payload of comparable size waiting elsewhere in the extracted resource list.

Assessment:

- `the remaining reverse-engineering target inside GRAPHICS.DAT is concentrated in 0696`
- `if additional gameplay tables still exist in PC assets, they are likely hidden behind layout/template references rather than another obvious raw block`

### `graphics.dat item 559` documentation now covers large parts of the item domain

New project reference:

- [`ORIGINAL_ITEM_TABLES.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_ITEM_TABLES.md)

The newly supplied documentation of the `graphics.dat item 559` item table provides strong coverage for:

- global item index
- item category
- index in category
- index in table
- item-on-floor graphics index
- attack combo index
- carry-location bitmask
- authoritative naming across categories

Most important practical result:

- the carry-location bitmask can now replace a large part of the manual slot-placement logic currently maintained in the remake

Assessment:

- `strong external documentation for item identity and carry rules`
- `combat/protection stats still need companion tables`

### `graphics.dat item 559` documentation now covers large parts of the creature domain

New project reference:

- [`ORIGINAL_CREATURE_TABLES.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_CREATURE_TABLES.md)

The newly supplied creature-descriptor documentation provides strong coverage for:

- size and placement behavior
- movement / attack ticks
- defense
- base health
- base attack
- poison attack
- dexterity
- view / hearing / smell / attack range
- fear / fire / poison resistance
- experience
- intelligence
- special movement / visibility / non-material flags
- attack type
- several animation and presentation flags

Important nuance:

- some creature behaviors remain explicitly hardcoded in engine code, such as the Giggler steal ability

Assessment:

- `strong external documentation for creature descriptors`
- `not yet integrated as a structured source-backed runtime dataset`

### Actions, combos, defenses and skill progression are now externally documented

New project references:

- [`ORIGINAL_ACTIONS_AND_COMBOS.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_ACTIONS_AND_COMBOS.md)
- [`ORIGINAL_ATTACKS_AND_DEFENSES.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_ATTACKS_AND_DEFENSES.md)
- [`ORIGINAL_SKILLS_AND_EXPERIENCE.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_SKILLS_AND_EXPERIENCE.md)

The newly supplied documentation now gives strong external coverage for:

- the full action table
- combo composition and charge usage
- minimum skill gating of actions
- attack-type semantics and defense factors
- hidden/basic skill relationships
- experience gain rules
- dungeon-depth experience multipliers
- skill thresholds
- champion growth rules
- resurrect / reincarnate rules

Assessment:

- `large gameplay-system domains are now documented externally`
- `the remaining gap is increasingly integration-focused and item-stat-focused`

### Atari-style block structures `559`, `560` and `562` are now documented in-project

New project references:

- [`ORIGINAL_ITEM559_STRUCTURE.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_ITEM559_STRUCTURE.md)
- [`ORIGINAL_ITEM560_ACTIONS_SPELLS.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_ITEM560_ACTIONS_SPELLS.md)
- [`ORIGINAL_ITEM562_UI_SYSTEM.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_ITEM562_UI_SYSTEM.md)

These documents now consolidate the original logical homes of:

- item gameplay descriptors
- creature gameplay descriptors
- door characteristics
- creature droppings
- action arrays
- combo tables
- spell tables
- carry-location masks
- torch/luminance tables
- wound masks
- attack-position ordering

Assessment:

- `the original logical data model is now much more explicit inside the repository`
- `the main remaining challenge is no longer identification of the tables, but structured import and runtime replacement`

Structured JSON mirrors now also exist in `public/`:

- [`original_item559.json`](/D:/DungeonMaster-codex/public/original_item559.json)
- [`original_item560.json`](/D:/DungeonMaster-codex/public/original_item560.json)
- [`original_item562.json`](/D:/DungeonMaster-codex/public/original_item562.json)

### The helper-id band `126..245` is now confirmed as a major post-Atari companion range

The extracted PC resource index contains a very large continuous `NULL` band:

- `126..245 = No Item Data`

Only a subset of that band is currently referenced by `0696`, but the usage pattern is highly structured:

- `129..139`
  repeated as placement grids
- `150..194`
  repeated as anonymous UI/layout template families
- `207..245`
  used in mixed composite sections near door, pit, stairs and movement-arrow resources

This suggests that the post-Atari ports kept a large helper-id namespace inside the graphics database, even when those ids no longer corresponded to visible standalone assets.

Assessment:

- `126..245 is not noise`
- `it behaves like a companion template namespace for 0696`
- `this sharply reduces the likelihood that we are simply missing additional extracted image files`

### Helper families are now exported directly

The helper namespace is no longer only described in prose. A dedicated public export now exists in:

- [`public/graphics_helper_0696.json`](/D:/DungeonMaster-codex/public/graphics_helper_0696.json)

This file captures:

- all helper ids from `126..245` that are actually referenced by `0696`
- their opcode distributions
- observed `x` and `y` coordinate sets
- raw references back to word offsets in `0696`
- a first grouping into stable families such as:
  - `early screens`
  - `grid templates small / medium / large`
  - `ui anchors a / b / c / d / e`

Assessment:

- `useful as a stable machine-readable index even before final semantic naming`
- `gives the remake a source-backed reference for template ids instead of treating them as opaque nulls`

### The helper namespace used by `0696` is slightly broader than `126..245`

The new helper export confirms that `0696` does not only use the large `NULL` band `126..245`.
It also references a few smaller `NULL` ids outside that range:

- `12`
- `81..84`

These appear in short isolated runs:

- `96..96`
- `4448..4468`

while the major helper runs remain:

- `300..340`
- `2916..3352`
- `3968..4236`
- `4244..4332`
- `4340..4360`
- `4380..4380`

Interpretation:

- `12` and `81..84` should be treated as part of the same helper/template ecosystem, not as separate unrelated mysteries
- the broad `126..245` band remains the dominant post-Atari helper namespace, but not the whole one

### Opcode behavior is starting to stabilize

The latest pass over the whole file gives a more consistent picture of the main opcodes used by `0696`:

- `opcode 7`
  overwhelmingly UI-facing
  - used heavily in main-menu and interface layout clusters
  - also reused by helper ids `191..194`
- `opcode 10`
  behaves like a base-load or origin-anchor opcode
  - frequently appears at `0,0`
  - used for:
    - door base graphics
    - stairs side-view anchors
    - missile/front-back-side anchors
    - helper ids such as `159..162`, `175..178`, `245`
- `opcode 18`
  behaves like a repeated offset/increment opcode
  - helper ids `159..162` use `1,0`
  - helper ids `224/230/236/242` use `2,1`
  - door graphic `252` uses repeated horizontal offsets `8,17,26,35`
- `opcode 2`
  strongly associated with horizontal placement columns
  - especially in helper grid families `129..139`
  - also appears in a few dungeon composites such as teleporter/floor/wall/stairs
- `opcode 4`
  strongly associated with vertical placement rows
  - especially in helper grid families `129..139`
  - where it provides the stepped `y` values for the grid
- `opcode 1`
  the most generic placement opcode
  - used for real dungeon fragments, UI pieces and helper ids alike
  - likely represents a direct placement primitive
- `opcode 9`
  behaves like an absolute-size or absolute-anchor placement opcode
  - common on dialog/menu/interface resources
  - common on helper ids `151..154`, `187..190`, `221`
  - often carries positions that look like final layout anchors rather than incremental grid steps

Assessment:

- `we do not yet have engine-level names for the opcodes`
- `but we now have a useful behavioral model for 1/2/4/7/9/10/18`
- `this is enough to continue naming helper families by role instead of treating them as raw integers`

### Helper roles are now exported with provisional names

The helper export now includes conservative `roleGuess` values for the best-understood ids. Examples:

- `129..133`
  `small placement grid template`
- `134..136`
  `medium placement grid template`
- `137..139`
  `large placement grid template`
- `150`
  `four-column ui anchor set`
- `151..154`
  `absolute ui anchor variants`
- `159..162`
  `ui step/increment helpers`
- `191..194`
  `three-step ui sweep helpers`
- `207..210`
  `two-column panel anchors`
- `221`
  `panel absolute anchor pair`
- `222`
  `panel column anchors`
- `223`
  `panel fill-column helpers`
- `224/230/236/242`
  `panel incremental offset helper`
- `244`
  `six-column strip helper`
- `245`
  `panel base anchor`
- `81..84`
  `door-or-panel strip helper`

These names are intentionally descriptive rather than canonical. They reflect observed behavior in `0696`, not guaranteed original engine symbol names.

Assessment:

- `good enough to replace many opaque magic ids in future runtime code`
- `still intentionally provisional until more engine-level correspondence is proven`

### Front-view composite panels are now exported separately

A dedicated panel export now exists in:

- [`public/graphics_panels_0696.json`](/D:/DungeonMaster-codex/public/graphics_panels_0696.json)

It groups the clearest late-file contiguous composites into reusable descriptive blocks:

- `front-door-strip`
- `teleporter-floor-panel`
- `door-frame-wall-pit-panel`
- `stairs-front-panel`
- `floor-item-grid`

These are not meant as final original symbol names. Their purpose is to expose the fact that late `0696` ranges already behave like assembled front-view panels, not isolated random tuples.

Assessment:

- `very useful for runtime integration or renderer cleanup`
- `another strong sign that 0696 is primarily a composition/layout container`

### The remaining fidelity gap is now clearly visible in the remake code

A pass over the current runtime confirms that several important gameplay tables are still maintained manually in project code rather than being backed by a proven original-data extraction.

Most visible files:

- [`src/data/items.ts`](/D:/DungeonMaster-codex/src/data/items.ts)
  - manual weapon stats
  - manual armor slots and armor values
  - manual potion effects
  - manual food / misc item behavior
- [`src/data/creatures.ts`](/D:/DungeonMaster-codex/src/data/creatures.ts)
  - manual base HP / armor / hit chance / attack speed / move speed / drops
- [`public/game_db.json`](/D:/DungeonMaster-codex/public/game_db.json)
  - already marked as a derived reference database rather than a byte-perfect export

This matches the reverse-engineering picture:

- `0696` is giving us render/composition truth
- `graphics_db.json` is giving us names, families and assets
- but the deep gameplay layer is still not fully source-proven from the PC binaries

Assessment:

- `the project now has strong original-data coverage for map/render/resource fidelity`
- `the main unresolved gap is gameplay-stat fidelity, not graphics extraction`

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

- exact action-set mappings for all items
- exact weight and other internal flags when still inferred manually
- exact armour/weapon internal stat tables if they are present in binary data not yet decoded
- any door behaviour tables beyond what is already visible through resource families
- PC-native structured import of the externally documented item table
- PC-native structured import of the externally documented creature descriptor table
- PC-native structured import of the externally documented action/combo tables
- PC-native structured import of the externally documented spell tables
- PC-native structured import of the externally documented UI/system support tables

Current status in the remake:

- some of this logic exists already in local project data structures
- but not all of it is yet backed by fully decoded original binary tables
- item carry rules are now externally documented strongly enough to stop treating equipment-slot validity as fully unknown
- creature primary descriptor values are now externally documented strongly enough to stop treating creature stats as fully unknown
- action/combo/spell semantics are now externally documented strongly enough to stop treating that system as unknown
- several inventory/UI support tables are now externally documented strongly enough to stop treating them as unexplored

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

## Current Runtime Fidelity Gaps

The remaining fidelity gap is now easier to classify because the codebase splits cleanly between:

- places where the remake still uses placeholders even though original render/resource data is now available
- places where the remake still uses manual gameplay numbers because no authoritative PC DOS gameplay table has been recovered yet

### Gaps that are now replaceable with extracted original data

#### Door rendering still uses one generic texture

Current runtime:

- [`src/components/Dungeon/Cell.tsx`](/D:/DungeonMaster-codex/src/components/Dungeon/Cell.tsx) loads only `/textures/door.png`

Original data now available:

- [`public/graphics_db.json`](/D:/DungeonMaster-codex/public/graphics_db.json)
  confirms the four original door families:
  - `Porticullis`
  - `Wooden Door`
  - `Iron Door`
  - `Ra Door`
- [`public/graphics_panels_0696.json`](/D:/DungeonMaster-codex/public/graphics_panels_0696.json)
  exposes front-door composite strips and door-family front views

Assessment:

- `runtime simplification, no longer blocked by missing source data`

#### Wall-decoration fallback logic still uses placeholders

Current runtime:

- [`src/components/Dungeon/DungeonScene.tsx`](/D:/DungeonMaster-codex/src/components/Dungeon/DungeonScene.tsx)
  still maps:
  - `mech.kind.includes('Alcôve')`
  - `sensor.graphic === 5`
  to generic placeholder art such as `/misc/autel.png` and `/items/torch_unlit.png`

Original data now available:

- [`public/graphics_db.json`](/D:/DungeonMaster-codex/public/graphics_db.json)
  names major wall ornament families such as:
  - `Grate`
  - `Empty Torch Holder`
  - `Full Torch Holder`
  - `Champion Mirror`
  - `Lever Up`
  - `Lever Down`

Assessment:

- `runtime placeholder logic, no longer blocked by missing source data`

### Gaps still blocked on missing gameplay-table decoding

#### Item gameplay properties remain project-maintained

Current runtime:

- [`src/data/items.ts`](/D:/DungeonMaster-codex/src/data/items.ts)
  still hardcodes:
  - weapon damage
  - attack speed
  - armour values
  - allowed equipment slots
  - potion effects
  - nutrition values
  - several textual/item-behaviour assumptions

Source-backed state:

- names and many visible identities are now confirmed through [`public/graphics_db.json`](/D:/DungeonMaster-codex/public/graphics_db.json)
- dungeon placement/origin data is confirmed through [`public/dungeon.json`](/D:/DungeonMaster-codex/public/dungeon.json)
- item identity/category/carry semantics are now documented externally in [`ORIGINAL_ITEM_TABLES.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_ITEM_TABLES.md)
- but no PC DOS binary block equivalent to Atari `I559` has been recovered in a directly decodable form

Assessment:

- `partially blocked on companion stat-table recovery`

#### Creature gameplay properties remain project-maintained

Current runtime:

- [`src/data/creatures.ts`](/D:/DungeonMaster-codex/src/data/creatures.ts)
  still hardcodes:
  - base HP
  - armor
  - hit probability
  - attack speed
  - move speed
  - XP reward
  - attack-type tags
  - drop tables

Source-backed state:

- visible/render data is now strong
- creature descriptor fields are now documented externally in [`ORIGINAL_CREATURE_TABLES.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_CREATURE_TABLES.md)
- creature binary gameplay tables are still not isolated from the PC assets in a trustworthy way

Assessment:

- `documented externally, but not yet integrated structurally`

#### `public/game_db.json` remains a derived reference layer

Current runtime:

- [`public/game_db.json`](/D:/DungeonMaster-codex/public/game_db.json) explicitly declares:
  - `source = Derived gameplay/reference database used by the remake`
  - `note = Not a byte-perfect export of GRAPHICS.DAT tables`

Assessment:

- `honest and useful, but still not authoritative for all gameplay tables`

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

This is now partially fulfilled by:

- [`ORIGINAL_ITEM_TABLES.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_ITEM_TABLES.md)
- [`ORIGINAL_CREATURE_TABLES.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_CREATURE_TABLES.md)
- [`ORIGINAL_ACTIONS_AND_COMBOS.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_ACTIONS_AND_COMBOS.md)
- [`ORIGINAL_ATTACKS_AND_DEFENSES.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_ATTACKS_AND_DEFENSES.md)
- [`ORIGINAL_SKILLS_AND_EXPERIENCE.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_SKILLS_AND_EXPERIENCE.md)
- [`public/original_data_fidelity.json`](/D:/DungeonMaster-codex/public/original_data_fidelity.json)
- [`public/original_runtime_gap_map.json`](/D:/DungeonMaster-codex/public/original_runtime_gap_map.json)

### Priority 3

Replace remaining project-local heuristics with extracted values when original tables are decoded.

Candidate areas:

- [`src/data/items.ts`](/D:/DungeonMaster-codex/src/data/items.ts)
- [`public/game_db.json`](/D:/DungeonMaster-codex/public/game_db.json)
- [`src/components/Dungeon/Cell.tsx`](/D:/DungeonMaster-codex/src/components/Dungeon/Cell.tsx)
- [`src/components/Dungeon/DungeonScene.tsx`](/D:/DungeonMaster-codex/src/components/Dungeon/DungeonScene.tsx)

## Reference Files

- [`public/dungeon.json`](/D:/DungeonMaster-codex/public/dungeon.json)
- [`public/game_db.json`](/D:/DungeonMaster-codex/public/game_db.json)
- [`public/graphics_db.json`](/D:/DungeonMaster-codex/public/graphics_db.json)
- [`original_item559.json`](/D:/DungeonMaster-codex/public/original_item559.json)
- [`original_item560.json`](/D:/DungeonMaster-codex/public/original_item560.json)
- [`original_item562.json`](/D:/DungeonMaster-codex/public/original_item562.json)
- [`ORIGINAL_ITEM_TABLES.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_ITEM_TABLES.md)
- [`ORIGINAL_CREATURE_TABLES.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_CREATURE_TABLES.md)
- [`ORIGINAL_ACTIONS_AND_COMBOS.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_ACTIONS_AND_COMBOS.md)
- [`ORIGINAL_ATTACKS_AND_DEFENSES.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_ATTACKS_AND_DEFENSES.md)
- [`ORIGINAL_SKILLS_AND_EXPERIENCE.md`](/D:/DungeonMaster-codex/docs/ORIGINAL_SKILLS_AND_EXPERIENCE.md)
- [`assets/DMDisquette/parse_sck_graphics.cjs`](/D:/DungeonMaster-codex/assets/DMDisquette/parse_sck_graphics.cjs)
- [`assets/DMDisquette/analyze_raw_0696.cjs`](/D:/DungeonMaster-codex/assets/DMDisquette/analyze_raw_0696.cjs)
- [`assets/DMDisquette/output/raw_0696_analysis.json`](/D:/DungeonMaster-codex/assets/DMDisquette/output/raw_0696_analysis.json)
- [`assets/DMDisquette/SCK_NOTES.md`](/D:/DungeonMaster-codex/assets/DMDisquette/SCK_NOTES.md)

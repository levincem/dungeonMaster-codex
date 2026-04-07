# I559 Stats Extraction

Audit date: 2026-04-07

Useful files:
- [assets/DMDisquette/sck/_inspect/DataI559.javap.txt](D:\DungeonMaster-codex\assets\DMDisquette\sck\_inspect\DataI559.javap.txt)
- [assets/DMDisquette/ReDMCSB/SOURCE/ENGINE/DEFS.H](D:\DungeonMaster-codex\assets\DMDisquette\ReDMCSB\SOURCE\ENGINE\DEFS.H)
- [assets/DMDisquette/ReDMCSB/SOURCE/ENGINE/START.C](D:\DungeonMaster-codex\assets\DMDisquette\ReDMCSB\SOURCE\ENGINE\START.C)
- [assets/DMDisquette/ReDMCSB/SOURCE/ENGINE/INVNTORY.C](D:\DungeonMaster-codex\assets\DMDisquette\ReDMCSB\SOURCE\ENGINE\INVNTORY.C)
- [assets/DMDisquette/ReDMCSB/SOURCE/ENGINE/GROUP1.C](D:\DungeonMaster-codex\assets\DMDisquette\ReDMCSB\SOURCE\ENGINE\GROUP1.C)
- [assets/DMDisquette/ReDMCSB/SOURCE/ENGINE/PROJEXPL.C](D:\DungeonMaster-codex\assets\DMDisquette\ReDMCSB\SOURCE\ENGINE\PROJEXPL.C)
- [assets/DMDisquette/EUDATA/out_GRAPHICS.DAT/GRAPHICS.DAT.xml](D:\DungeonMaster-codex\assets\DMDisquette\EUDATA\out_GRAPHICS.DAT\GRAPHICS.DAT.xml)
- [assets/DMDisquette/sck/_inspect/db/map/dm_atari_en_gd.map](D:\DungeonMaster-codex\assets\DMDisquette\sck\_inspect\db\map\dm_atari_en_gd.map)
- [assets/DMDisquette/sck/_inspect/db/map/dm_pc43_en_gd.map](D:\DungeonMaster-codex\assets\DMDisquette\sck\_inspect\db\map\dm_pc43_en_gd.map)
- [assets/DMDisquette/decode_i559_blob.cjs](D:\DungeonMaster-codex\assets\DMDisquette\decode_i559_blob.cjs)
- [assets/DMDisquette/export_i559_stats.cjs](D:\DungeonMaster-codex\assets\DMDisquette\export_i559_stats.cjs)
- [assets/DMDisquette/scan_pc_i559_candidates.cjs](D:\DungeonMaster-codex\assets\DMDisquette\scan_pc_i559_candidates.cjs)
- [assets/DMDisquette/extract_graphics_entry.cjs](D:\DungeonMaster-codex\assets\DMDisquette\extract_graphics_entry.cjs)
- [assets/DMDisquette/output/scan_pc_i559_candidates.json](D:\DungeonMaster-codex\assets\DMDisquette\output\scan_pc_i559_candidates.json)
- [assets/DMDisquette/output/scan_i559_candidates_all.json](D:\DungeonMaster-codex\assets\DMDisquette\output\scan_i559_candidates_all.json)

## What Is Now Proven

The original runtime stat block is not a vague idea anymore.

`sck` contains a dedicated decoder class for `I559`, and the javap dump shows the exact decode order for the decompressed payload:

- 4 bytes: creature facings
- 32 x 8 bytes: wall-text encoding table
- 32 x 2 bytes: character encoding table
- 32 x 8 bytes: generic text encoding table
- 4 x 2 bytes: door characteristics
- 40 x 2 bytes: creature droppings
- 8 bytes: sound ordinals
- 27 creature records
- 8 x 2 bytes: food values
- 54 bytes: misc weights
- 2 bytes: protection
- 58 cloth records
- 46 weapon records
- 180 object records
- 16 bytes: extra DB entries
- 16 bytes: size DB entries
- 4 x 2 bytes: deltaY
- 4 x 2 bytes: deltaX

Total decoded length: `3086` bytes.

Important correction:

- an earlier local decoder version incorrectly assumed `3048`, then `3032`
- the real `CreatureData` record is `26` bytes, not `24`
- the missing detail was the final `uByte22[4]` tail in each monster descriptor
- with `27` creatures, that explains the exact `54`-byte discrepancy we kept seeing

This is confirmed both by:

- [DataI559.javap.txt](D:\DungeonMaster-codex\assets\DMDisquette\sck\_inspect\DataI559.javap.txt), which explicitly says `27 entries of 26 bytes`
- [CSB.h](D:\DungeonMaster-codex\assets\DMDisquette\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\CSB.h), where `MONSTERDESC` ends with `uByte22[4]`

This matches the original source-side globals in [DEFS.H](D:\DungeonMaster-codex\assets\DMDisquette\ReDMCSB\SOURCE\ENGINE\DEFS.H) and [Data.h](D:\DungeonMaster-codex\assets\DMDisquette\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\Data.h):

- `G237_as_Graphic559_ObjectInfo[180]`
- `G238_as_Graphic559_WeaponInfo[46]`
- `G239_as_Graphic559_ArmourInfo[58]`
- `G241_ac_Graphic559_JunkInfo[53]`
- `G242_ai_Graphic559_FoodAmounts[8]`
- `G243_as_Graphic559_CreatureInfo[27]`
- plus direction tables, sound tables, text escape tables, drop tables and small helper arrays

## Important PC DOS Caveat

The old assumption "`Graphic 559` == resource id `0559` in the PC extract" is false.

Confirmed by the extracted resource maps:

- Atari mapping:
  - [dm_atari_en_gd.map](D:\DungeonMaster-codex\assets\DMDisquette\sck\_inspect\db\map\dm_atari_en_gd.map)
  - `0559,I559,NULL,Various Data,Structure described in CSBwin source code,`

- PC DOS mapping:
  - [dm_pc43_en_gd.map](D:\DungeonMaster-codex\assets\DMDisquette\sck\_inspect\db\map\dm_pc43_en_gd.map)
  - `0559,IMG3,PAL1,Item on floor 61,Orange Gem,`
  - `0696,RAW1,NULL,Unknown,Unknown Content (Words of data),`

So the resource id `0559` in the PC export is only the Orange Gem floor image.

The best remaining PC candidate for the stat block is still [0696.RAW1 [Unknown - Unknown Content (Words of data)].dat](D:\DungeonMaster-codex\assets\DMDisquette\EUDATA\out_GRAPHICS.DAT\0696.RAW1%20%5BUnknown%20-%20Unknown%20Content%20(Words%20of%20data)%5D.dat), but it must not be treated as a trivial one-to-one alias of Atari `I559`.

## Exact Runtime Balance Constants Already Confirmed

These do not depend on recovering the final PC stat blob. They are directly visible in the original source:

- Champion initial food:
  - `1500 + random(256)`
  - [CHAMPION.C](D:\DungeonMaster-codex\assets\DMDisquette\ReDMCSB\SOURCE\ENGINE\CHAMPION.C)

- Champion initial water:
  - `1500 + random(256)`
  - [CHAMPION.C](D:\DungeonMaster-codex\assets\DMDisquette\ReDMCSB\SOURCE\ENGINE\CHAMPION.C)

- Food and water hard cap:
  - `2048`
  - [INVNTORY.C](D:\DungeonMaster-codex\assets\DMDisquette\ReDMCSB\SOURCE\ENGINE\INVNTORY.C)

- Drinking a water flask:
  - `+800`
  - [INVNTORY.C](D:\DungeonMaster-codex\assets\DMDisquette\ReDMCSB\SOURCE\ENGINE\INVNTORY.C)

- Drinking a waterskin:
  - `+1600`
  - [INVNTORY.C](D:\DungeonMaster-codex\assets\DMDisquette\ReDMCSB\SOURCE\ENGINE\INVNTORY.C)

- Eating food:
  - `+ G242_ai_Graphic559_FoodAmounts[item]`
  - [INVNTORY.C](D:\DungeonMaster-codex\assets\DMDisquette\ReDMCSB\SOURCE\ENGINE\INVNTORY.C)

- Creature spawn HP formula:
  - `BaseHealth * HealthMultiplier + random((BaseHealth >> 2) + 1)`
  - [GROUP1.C](D:\DungeonMaster-codex\assets\DMDisquette\ReDMCSB\SOURCE\ENGINE\GROUP1.C)

- Creature attack cooldown:
  - driven by `AttackTicks`, with extra random jitter in the scheduler
  - [GROUP1.C](D:\DungeonMaster-codex\assets\DMDisquette\ReDMCSB\SOURCE\ENGINE\GROUP1.C)

- Projectile weapon damage:
  - uses weapon `KineticEnergy`
  - [PROJEXPL.C](D:\DungeonMaster-codex\assets\DMDisquette\ReDMCSB\SOURCE\ENGINE\PROJEXPL.C)

## What The Current Remake Still Uses As Derived Data

[public/game_db.json](D:\DungeonMaster-codex\public\game_db.json) is still a derived gameplay layer for:

- creature stat values
- weapon stat values
- armour stat values
- item weights
- food nutrition values

It is useful, but it is not yet proven as a direct byte-perfect extraction of the original stat blob.

## New Local Tooling

[decode_i559_blob.cjs](D:\DungeonMaster-codex\assets\DMDisquette\decode_i559_blob.cjs) was added to decode any raw `I559`-layout payload once we have the correct byte window.

Current usage:

```powershell
node assets/DMDisquette/decode_i559_blob.cjs <file> [startOffset] [be|le]
```

It expects a `3086`-byte decoded payload and exposes:

- creature records
- food values
- misc weights
- cloth records
- weapon records
- object records
- helper arrays and delta tables

There is now a normalized exporter on top:

```powershell
node assets/DMDisquette/export_i559_stats.cjs <file> [startOffset] [be|le] [outputPath]
```

It rewrites a valid `I559` payload into a JSON structure with:

- creature combat stats
- weapon weight / damage / kinetic energy / throw-graphic info
- armour weight / protection / sharp-defense / shield flag
- food values
- misc weights
- object slot masks

There is also a coarse PC-side scanner:

```powershell
node assets/DMDisquette/scan_pc_i559_candidates.cjs
```

Current result:

- no convincing contiguous `I559` window was found inside `0696.RAW1`
- the best heuristic candidates still produce nonsense `deltaY/deltaX` tables
- so `0696` should currently be treated as "possible container", not "confirmed raw I559 bytes"

After widening the scan to the available PC binaries:

- [0696.RAW1](D:\DungeonMaster-codex\assets\DMDisquette\EUDATA\out_GRAPHICS.DAT\0696.RAW1%20%5BUnknown%20-%20Unknown%20Content%20(Words%20of%20data)%5D.dat) remains the only `RAW1` candidate in the shipped PC graphics map
- the copy extracted from [assets/DMDisquette/sck/db/anim/DM_PC/DATA/GRAPHICS.DAT](D:\DungeonMaster-codex\assets\DMDisquette\sck\db\anim\DM_PC\DATA\GRAPHICS.DAT) is byte-identical
- [DM_decompressed.bin](D:\DungeonMaster-codex\assets\DMDisquette\DM_decompressed.bin) and [FIRES_decompressed.bin](D:\DungeonMaster-codex\assets\DMDisquette\FIRES_decompressed.bin) also do not expose a clean contiguous `I559` payload under the corrected decoder
- the best `FIRES` candidates still look like mixed code/data windows rather than a direct stat block

So the current evidence points away from "there is a plain contiguous `I559` blob waiting to be found by scanning PC files".

## New Breakthrough From `sourceCode`

The newly added [assets/DMDisquette/sourceCode/Dungeon_Master_FTL_Games_1987_Source_Code](D:\DungeonMaster-codex\assets\DMDisquette\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code) gives a much stronger PC-side answer than blind scanning.

In [CSBCode.cpp](D:\DungeonMaster-codex\assets\DMDisquette\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\CSBCode.cpp), `ReadTablesFromGraphicsFile()` explicitly loads several late graphics entries into structured runtime tables:

- `0x22e` -> viewport/UI/helper tables
- `0x230` -> spells, legal attacks, attack names, attack tuning
- `0x22f` -> core gameplay stats
- `0x232` -> sound/drop/helper tables

The important part is `graphic 0x22f`, which is no longer hypothetical. In [Data.h](D:\DungeonMaster-codex\assets\DMDisquette\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\Data.h), the in-memory layout is documented directly:

- `MonsterDescriptor[27]`
- `FoodValue[8]`
- `Byte8946[54]` for misc weights
- `ClothingDesc[58]`
- `weapons[46]`
- `ObjDesc[180]`
- `DoorCharacteristics[4]`
- `MonsterDroppings[40]`
- `DeltaY[4]`
- `DeltaX[4]`

So the practical conclusion changes:

- we do not need to keep treating PC stats as a missing hidden blob only discoverable by brute-force scanning
- the PC runtime already exposes the same balance data as structured `graphics.dat` records
- the next productive step is to decode/export `graphics 0x22f` (and its neighboring `0x230` / `0x232` tables) directly, instead of searching for a standalone raw `I559` window

This also explains why `0696.RAW1` never looked right: it may be unrelated, or only an intermediate/container artifact, while the real PC gameplay tables are already being loaded from the `0x22e..0x232` region by the engine.

## DMExtract Breakthrough

The newly added [assets/DMDisquette/DMExtract v1.01 Source](D:\DungeonMaster-codex\assets\DMDisquette\DMExtract%20v1.01%20Source) is a very useful confirmation source.

Its `main.cpp` and `lzw.cpp` show that:

- `graphics.dat` entries are addressed through a compact header of item counts plus compressed/uncompressed sizes
- `RAW1` entries are extracted exactly like other resources, then optionally LZW-decompressed
- `.map` files are only labels, but they give reliable ids/types/names once the correct platform file is used

That matters because it confirms the practical workflow we want:

- get the correct DM1 Atari/Amiga `graphics.dat`
- use the matching Atari/Amiga `.map`
- extract entries `0558..0562`
- decode the resulting `RAW1` payloads against the proven `I559` layout

To avoid depending on the original DOS tool, there is now a local helper:

```powershell
node assets/DMDisquette/extract_graphics_entry.cjs <graphics.dat> <entryIndex> [mapfile] [outDir]
```

This helper is based directly on the `DMExtract` header/LZW logic and is already validated on the local PC `GRAPHICS.DAT` for entries like:

- `0559` -> `IMG3 Orange Gem`
- `0696` -> `RAW1 Unknown Content (Words of data)`

Current limitation:

- there is still no genuine DM1 Atari/Amiga `graphics.dat` present in this repo
- so we now have the extraction path, but not yet the canonical Atari/Amiga input file needed to dump `0558..0562`

Update: this limitation is now lifted.

We found a genuine Atari ST DM1 hard-disk install at:

- [OriginalAtariGame/HardDisk/2009-02-22 PP/GRAPHICS.DAT](D:\DungeonMaster-codex\assets\DMDisquette\OriginalAtariGame\HardDisk\2009-02-22%20PP\GRAPHICS.DAT)

Using [extract_graphics_entry.cjs](D:\DungeonMaster-codex\assets\DMDisquette\extract_graphics_entry.cjs) with the Atari map:

- [GRAPHICS.DAT DM Atari ST v1.1.map](D:\DungeonMaster-codex\assets\DMDisquette\DM1GDED\spec\GRAPHICS.DAT%20DM%20Atari%20ST%20v1.1.map)

we successfully extracted:

- [0558.RAW1](D:\DungeonMaster-codex\assets\DMDisquette\output\atari_i559_test\0558.RAW1%20%5BVarious%20Data%20-%20Structure%20described%20in%20CSBwin%20source%20code%5D.dat)
- [0559.RAW1](D:\DungeonMaster-codex\assets\DMDisquette\output\atari_i559_test\0559.RAW1%20%5BVarious%20Data%20-%20Structure%20described%20in%20CSBwin%20source%20code%5D.dat)
- [0560.RAW1](D:\DungeonMaster-codex\assets\DMDisquette\output\atari_i559_test\0560.RAW1%20%5BVarious%20Data%20-%20Structure%20described%20in%20CSBwin%20source%20code%5D.dat)
- [0561.RAW1](D:\DungeonMaster-codex\assets\DMDisquette\output\atari_i559_test\0561.RAW1%20%5BVarious%20Data%20-%20Structure%20described%20in%20CSBwin%20source%20code%5D.dat)
- [0562.RAW1](D:\DungeonMaster-codex\assets\DMDisquette\output\atari_i559_test\0562.RAW1%20%5BVarious%20Data%20-%20Structure%20described%20in%20CSBwin%20source%20code%5D.dat)

And `0559` now decodes cleanly as the canonical stat block:

- [atari_i559_decoded.json](D:\DungeonMaster-codex\assets\DMDisquette\output\atari_i559_decoded.json)
- [atari_i559_stats.json](D:\DungeonMaster-codex\assets\DMDisquette\output\atari_i559_stats.json)

This is the first genuinely proven end-to-end extraction of the original DM1 stat payload in this workspace.

## Best Next Step

The remaining hard problem is now narrow and concrete:

- identify where the `3032`-byte `I559` payload lives inside the PC resource set
- or prove that the PC build repacks it into a different container than a plain isolated raw block

Most likely next avenues:

- decode `0696` as a structured container instead of scanning it as if it were already the final payload
- or recover a canonical Atari/Amiga `I559` payload from a resource set that exposes it directly, then compare it back to PC tables

## Field Semantics Confirmed From `sck`

The `javap` dump of `sck` game classes now gives us the effective meaning of most fields:

- `CreatureData`
  - `moveSpeed` -> original `MovementTicks`
  - `minimumAttackSpeed` -> original `AttackTicks`
  - `armorClass` -> original `Defense`
  - `baseHP` -> original `BaseHealth`
  - `attackPower` -> original `Attack`
  - `poisonPower` -> original `PoisonAttack`
  - `hitProbability` -> original `Dexterity`
  - `mByte13` and `mByte25` exist as explicit trailing bytes in the original record
  - `damageType` -> original `AttackType`
  - `sightRange`, `detectionRange`, `spellCastingRange`
  - `bravery`, `XPClass`
  - `magicResistance`, `poisonResistance`
  - `attackLength`, `animationSpeed`, `attackAnimationSpeed`

- `WeaponData`
  - `weight`
  - `weaponClass`
  - `damage`
  - `energyInitial` -> original kinetic energy byte
  - `shootDamage` from low byte of the attributes word
  - `throwGraphic` from bits 8..12 of the attributes word

- `ClothData`
  - `weight`
  - `protection`
  - `protectionEfficiency`
  - `isShield`

- `DMItemData`
  - `type`
  - `floorGraphic`
  - `comboId`
  - allowed slot flags for mouth / head / neck / torso / legs / feet / quiver / pouch / hands / chest

This is much better than before:

- the structure is known
- the section sizes are known
- the exact runtime consumers are known
- the PC/Atari id mismatch is known

What remains is locating the correct bytes, not guessing the stat schema.

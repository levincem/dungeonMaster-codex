# I561 UI Tables Extraction

Audit date: 2026-04-08

Useful files:
- [assets/OriginalDataExtraction/decode_i561_blob.cjs](D:\DungeonMaster-codex\assets\OriginalDataExtraction\decode_i561_blob.cjs)
- [assets/OriginalDataExtraction/export_i561_stats.cjs](D:\DungeonMaster-codex\assets\OriginalDataExtraction\export_i561_stats.cjs)
- [assets/OriginalDataExtraction/output/atari_i561_stats.json](D:\DungeonMaster-codex\assets\OriginalDataExtraction\output\atari_i561_stats.json)
- [assets/OriginalDataExtraction/output/atari_i559_test/0561.RAW1 [Various Data - Structure described in CSBwin source code].dat](D:\DungeonMaster-codex\assets\OriginalDataExtraction\output\atari_i559_test\0561.RAW1%20%5BVarious%20Data%20-%20Structure%20described%20in%20CSBwin%20source%20code%5D.dat)
- [assets/OriginalDataExtraction/sourceCode/Dungeon_Master_FTL_Games_1987_Source_Code/csb/CSBwin_SRC_20190702/src/Data.h](D:\DungeonMaster-codex\assets\OriginalDataExtraction\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\Data.h)
- [assets/OriginalDataExtraction/sourceCode/Dungeon_Master_FTL_Games_1987_Source_Code/csb/CSBwin_SRC_20190702/src/CSBCode.cpp](D:\DungeonMaster-codex\assets\OriginalDataExtraction\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\CSBCode.cpp)
- [assets/OriginalDataExtraction/sourceCode/Dungeon_Master_FTL_Games_1987_Source_Code/csb/CSBwin_SRC_20190702/src/CSB.h](D:\DungeonMaster-codex\assets\OriginalDataExtraction\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\CSB.h)

## What Is Proven

Atari `0561.RAW1` corresponds to runtime table block `graphic 0x231`.

This block is predominantly UI and input infrastructure:
- button hitboxes
- key translation tables
- movement button rectangles
- drop-area coordinates
- directional deltas

## Important Variant Detail

The original source accepts two legal decompressed sizes for `0x231`:
- `0x804`
- `0x7d4`

The Atari DM1 payload present here is the short variant `0x7d4` (`2004`) bytes.

In [CSBCode.cpp](D:\DungeonMaster-codex\assets\OriginalDataExtraction\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\CSBCode.cpp), the runtime restores the missing final four `Buttons16932` entries with hardcoded fallback values when this short variant is loaded. The exporter now does exactly the same thing, with no extra interpretation.

## Prefix Byte Nuance

`Data.h` shows the block beginning at `Byte18938[2]`, but the byte accounting only matches the shipped Atari payload if those `2` bytes are treated as runtime prefix space rather than file payload.

That matches the loader call:
- `ReadAndExpandGraphic(0x8000|0x231, (ui8 *)d.Byte18938 + 2, ...)`

So the decoder records:
- `omittedRuntimePrefixBytes = 2`

and then decodes the file payload from the first button table onward.

## Output

[atari_i561_stats.json](D:\DungeonMaster-codex\assets\OriginalDataExtraction\output\atari_i561_stats.json) now exposes:
- `moveButtons18496`
- `dropAreas`
- `directionalDeltaX`
- `directionalDeltaY`
- `keyTranslationGroups`
- all named `buttonGroups`

This is not a balance table, but it is now a clean and source-grounded decode of the original UI helper block.



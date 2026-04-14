# I562 Runtime Tables Extraction

Audit date: 2026-04-08

Useful files:
- [assets/OriginalDataExtraction/decode_i562_blob.cjs](D:\DungeonMaster-codex\assets\OriginalDataExtraction\decode_i562_blob.cjs)
- [assets/OriginalDataExtraction/export_i562_stats.cjs](D:\DungeonMaster-codex\assets\OriginalDataExtraction\export_i562_stats.cjs)
- [assets/OriginalDataExtraction/output/atari_i562_stats.json](D:\DungeonMaster-codex\assets\OriginalDataExtraction\output\atari_i562_stats.json)
- [assets/OriginalDataExtraction/output/atari_i559_test/0562.RAW1 [Various Data - Structure described in CSBwin source code].dat](D:\DungeonMaster-codex\assets\OriginalDataExtraction\output\atari_i559_test\0562.RAW1%20%5BVarious%20Data%20-%20Structure%20described%20in%20CSBwin%20source%20code%5D.dat)
- [assets/OriginalDataExtraction/sourceCode/Dungeon_Master_FTL_Games_1987_Source_Code/csb/CSBwin_SRC_20190702/src/Data.h](D:\DungeonMaster-codex\assets\OriginalDataExtraction\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\Data.h)
- [assets/OriginalDataExtraction/sourceCode/Dungeon_Master_FTL_Games_1987_Source_Code/csb/CSBwin_SRC_20190702/src/CSBCode.cpp](D:\DungeonMaster-codex\assets\OriginalDataExtraction\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\CSBCode.cpp)
- [assets/OriginalDataExtraction/sourceCode/Dungeon_Master_FTL_Games_1987_Source_Code/csb/CSBwin_SRC_20190702/src/CSB.h](D:\DungeonMaster-codex\assets\OriginalDataExtraction\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\CSB.h)

## What Is Proven

Atari `0562.RAW1` corresponds to runtime table block `graphic 0x232`.

The structured portion proven by `Data.h` and `ReadTablesFromGraphicsFile()` contains:
- text mask tables
- three `RectPos` records
- `22` sound descriptors
- `G050_auc_Graphic562_WoundDefenseFactor[6]`
- `G051_ac_Graphic562_UnderscoreCharacterString[2]`
- `G052_ac_Graphic562_RenameChampionInputCharacterString[2]`
- `G053_ac_Graphic562_ReincarnateSpecialCharacters[6]`
- `DropOrder[30]`
- `CarryLocation[38]`
- icon display descriptors for `46` inventory/body/chest positions
- default graphic list `70`
- palette and color-map tables
- several helper word arrays and rect tables that are still structurally known but not yet semantically named

Confirmed directly in [CSBCode.cpp](D:\DungeonMaster-codex\assets\OriginalDataExtraction\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\CSBCode.cpp):
- `graphic 0x232` decompressed size is `0x722` (`1826`) bytes
- the runtime swaps:
  - `DropOrder`
  - `Word1526`
  - `Word1502`
  - `CarryLocation`
  - `IconDisplay`
  - palettes
  - the final word tables `Word140..Word12`

## Byte Accounting

The currently proven named structure consumes `1818` bytes.

The real Atari payload is `1826` bytes, so `8` bytes remain preserved as raw trailing data in:
- `trailingRawBytes`

This is intentional. Those bytes are not thrown away and not guessed at.

## High-Value Gameplay Tables

`atari_i562_stats.json` now exposes without reinterpretation:
- `woundDefenseFactors`
  - exact `Graphic 562` table used by `F313_xxxx_CHAMPION_GetWoundDefense`
  - current proven value: `[5, 5, 4, 6, 3, 1]`
- `dropOrder`
  - exact order used when a champion drops possessions
  - see [Character.cpp](D:\DungeonMaster-codex\assets\OriginalDataExtraction\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\Character.cpp#L2507)
- `carryLocationMasks`
  - exact bit masks used to validate whether an object may be carried in each location
  - see [MoveObject.cpp](D:\DungeonMaster-codex\assets\OriginalDataExtraction\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\MoveObject.cpp#L429)
- `defaultGraphicList`
  - base graphic indirection table used by the runtime
- `sounds`
  - original sound table entries used by `QueueSound`
- `iconDisplay`
  - original inventory/body/chest icon anchor table
- `underscoreCharacterString`, `renameChampionInputCharacterString`, `reincarnateSpecialCharacters`
  - the small text/UI helper globals adjacent to `G050..G053`

## Notes On Carry Slots

Only a few carry slot identities are currently proven from source usage, so the export stays conservative:
- slot `1` is the weapon hand
- slot `10` is the neck slot
- slot `0` is used during shoot/reload logic as the temporary ammo hand slot
- chest contents start at display place `30`, but those are not part of `CarryLocation[38]`

Any slot names beyond that should stay unconfirmed until tied to source usage more explicitly.



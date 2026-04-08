# Atari Stats Reconciliation

Audit date: 2026-04-07

Relevant files:
- [assets/OriginalDataExtraction/output/atari_i559_stats.json](D:\DungeonMaster-codex\assets\OriginalDataExtraction\output\atari_i559_stats.json)
- [assets/OriginalDataExtraction/output/atari_i560_stats.json](D:\DungeonMaster-codex\assets\OriginalDataExtraction\output\atari_i560_stats.json)
- [assets/OriginalDataExtraction/output/atari_i561_stats.json](D:\DungeonMaster-codex\assets\OriginalDataExtraction\output\atari_i561_stats.json)
- [assets/OriginalDataExtraction/output/atari_i562_stats.json](D:\DungeonMaster-codex\assets\OriginalDataExtraction\output\atari_i562_stats.json)
- [assets/OriginalDataExtraction/output/atari_game_db_comparison.json](D:\DungeonMaster-codex\assets\OriginalDataExtraction\output\atari_game_db_comparison.json)
- [assets/OriginalDataExtraction/output/weapon_attack_reference.json](D:\DungeonMaster-codex\assets\OriginalDataExtraction\output\weapon_attack_reference.json)
- [assets/OriginalDataExtraction/compare_atari_stats_to_game_db.cjs](D:\DungeonMaster-codex\assets\OriginalDataExtraction\compare_atari_stats_to_game_db.cjs)
- [assets/OriginalDataExtraction/parse_full.js](D:\DungeonMaster-codex\assets\OriginalDataExtraction\parse_full.js)
- [public/game_db.json](D:\DungeonMaster-codex\public\game_db.json)
- [docs/I560_ATTACKS_EXTRACTION.md](D:\DungeonMaster-codex\docs\I560_ATTACKS_EXTRACTION.md)
- [docs/I561_UI_TABLES_EXTRACTION.md](D:\DungeonMaster-codex\docs\I561_UI_TABLES_EXTRACTION.md)
- [docs/I562_RUNTIME_TABLES_EXTRACTION.md](D:\DungeonMaster-codex\docs\I562_RUNTIME_TABLES_EXTRACTION.md)

## Current State

We now have a proven original Atari stat payload decoded from `0559.RAW1`.

That gives us a much stronger baseline than the previously derived `game_db.json`.

## What Has Already Been Reconciled

Food values are now aligned with the original Atari payload in [public/game_db.json](D:\DungeonMaster-codex\public\game_db.json):

- `Apple` = `500`
- `Corn` = `600`
- `Bread` = `650`
- `Cheese` = `820`
- `Screamer Slice` = `550`
- `Worm Round` = `350`
- `Shank` = `990`
- `Dragon Steak` = `1400`

This also means the remake now contains the missing food entries:

- `Worm Round`
- `Screamer Slice`
- `Shank`

Monster core stats are now aligned too for the entries currently modeled in [public/game_db.json](D:\DungeonMaster-codex\public\game_db.json):

- `baseHP`
- `armor`
- `hitProb`
- `atkSpd`
- `moveSpd`

The current comparison report now shows:

- `foodsWithDifferences = 0`
- `creaturesWithDifferences = 0`

Direct weapon and clothing fields have also been realigned where the Atari mapping is one-to-one:

- weapon `weight`
- clothing `armor`
- clothing `weight`

We also reconciled the subset of `misc` item weights that already have a confirmed current mapping, including:

- `Compass`
- `Waterskin`
- `Apple`
- `Corn`
- `Bread`
- `Cheese`
- `Screamer Slice`
- `Worm Round`
- `Dragon Steak`
- `Iron Key`
- `Key of B`
- `Winged Key`
- `Topaz Key`
- `Rabbit's Foot`

## What Still Needs Interpretation

The remaining divergences are no longer straightforward missing tables. We now have the original attack tables too.

What remains is the translation problem between:

- original attack descriptors and formulas
- the remake's simplified weapon damage range model

We also now have `0562` decoded cleanly enough to expose proven runtime tables such as:

- champion `dropOrder`
- `carryLocationMasks`
- original icon display anchors
- sound table entries
- default graphic list indirection

Those are now available in [public/game_db.json](D:\DungeonMaster-codex\public\game_db.json) under `originalAtari.i562`, with any unresolved residue kept as raw bytes instead of guessed.

Examples:

- weapon damage ranges
  - Atari uses weapon descriptors from `0559`
  - and attack tables from `0560`
  - plus runtime formulas in `Attack.cpp`
  - the remake still models damage as hand-authored ranges

- derived gameplay fields
  - `exp`
  - `attackTypes`
  - inferred booleans such as poison/special behavior tags outside the raw tables

## Recommended Next Order

1. Reconcile weapon damage interpretation:
   - Atari weapon descriptors from `0559`
   - Atari attack tables from `0560`
   - runtime damage formulas from `Attack.cpp`
   - remake damage ranges

2. Revisit remaining derived monster fields:
   - `exp`
   - `attackTypes`
   - convenience booleans

## Important Caution

Not every current remake field has a one-to-one Atari equivalent.

Safe direct migrations:

- food values
- monster `baseHP`
- monster `armor`
- monster `hitProb`
- monster `atkSpd`
- monster `moveSpd`
- weapon weight
- clothing weight
- clothing protection
- confirmed misc weight entries

Fields that still need interpretation:

- weapon damage ranges
- attack class to remake UI/gameplay mapping
- `exp`
- modern convenience tags like `attackTypes`
- some poison or special-effect booleans that are currently inferred rather than directly modeled



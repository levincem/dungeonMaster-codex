# Atari Stats Reconciliation

Audit date: 2026-04-07

Relevant files:
- [assets/DMDisquette/output/atari_i559_stats.json](D:\DungeonMaster-codex\assets\DMDisquette\output\atari_i559_stats.json)
- [assets/DMDisquette/output/atari_game_db_comparison.json](D:\DungeonMaster-codex\assets\DMDisquette\output\atari_game_db_comparison.json)
- [assets/DMDisquette/compare_atari_stats_to_game_db.cjs](D:\DungeonMaster-codex\assets\DMDisquette\compare_atari_stats_to_game_db.cjs)
- [assets/DMDisquette/parse_full.js](D:\DungeonMaster-codex\assets\DMDisquette\parse_full.js)
- [public/game_db.json](D:\DungeonMaster-codex\public\game_db.json)

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

## What Still Differs Strongly

The remaining divergences are no longer the straightforward raw fields above. What is left is mostly interpretation work.

Examples:

- weapon damage ranges
  - Atari gives descriptor values like raw damage, attack class, and kinetic energy
  - the remake still models damage as hand-authored ranges

- derived gameplay fields
  - `exp`
  - `attackTypes`
  - inferred booleans such as poison/special behavior tags outside the raw tables

## Recommended Next Order

1. Reconcile weapon damage interpretation:
   - Atari raw weapon descriptor fields
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
- `exp`
- modern convenience tags like `attackTypes`
- some poison or special-effect booleans that are currently inferred rather than directly modeled

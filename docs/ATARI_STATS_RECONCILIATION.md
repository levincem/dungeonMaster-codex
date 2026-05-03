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
- [src/assets/data/game_db.json](D:\DungeonMaster-codex\src\assets\data\game_db.json)
- [docs/I560_ATTACKS_EXTRACTION.md](D:\DungeonMaster-codex\docs\I560_ATTACKS_EXTRACTION.md)
- [docs/I561_UI_TABLES_EXTRACTION.md](D:\DungeonMaster-codex\docs\I561_UI_TABLES_EXTRACTION.md)
- [docs/I562_RUNTIME_TABLES_EXTRACTION.md](D:\DungeonMaster-codex\docs\I562_RUNTIME_TABLES_EXTRACTION.md)

## Current State

We now have a proven original Atari stat payload decoded from `0559.RAW1`.

That gives us a much stronger baseline than the previously derived `game_db.json`.

## Target Hierarchy

This audit should be read with the following fidelity target in mind:

- gameplay target: original `Dungeon Master` first, with PC DOS as the primary shipped target of the remake
- cross-check truth source for core gameplay tables: Atari ST
- technical helper only: `CSB` and later source-derived tooling when they help explain a shared engine structure or formula

So this document does not treat `CSB` as an equal gameplay target.
If a `CSB`-side interpretation conflicts with `DM`, `DM` wins for remake behavior.

## Experience Audit Update

The creature-side experience field has now been clarified:

- the original source-backed gameplay field is `experienceClass` from `i559`
- it is used by the original runtime for:
  - melee-hit XP against creatures
  - defensive `Parry` XP when creatures attack champions in melee
- it is not a shared kill reward and not a generic creature bounty field

The older remake-facing `exp` field should therefore be treated as a legacy derived compatibility field, not as the authoritative original training value.

## Creature Behavior Timing Audit Update

One other creature-side field needed reinterpretation:

- the packaged extracted JSON still exposes a field named `behaviorAfterAttack`
- in the original FTL source, this is not a behavior id or an AI profile enum
- it is the low nibble of `CREATURE_INFO.AnimationTicks`, read through `M62_NEXT_BEHAVIOR_UPDATE_AFTER_ATTACK_TICKS(animationticks)` in `DEFS.H`
- the original runtime uses it as the delay before the next creature behavior update after an attack, with an added `+ random(2)` spread

So the correct gameplay meaning is:

- not "behavior 2..7 after attacking"
- but "post-attack behavior-update delay"

This also means the actual group behavior modes still live elsewhere in the original runtime (`wander`, `approach`, `attack`, `flee`) and should not be inferred from this mislabeled export field.

## Creature Wariness Audit Update

Another creature-side field is now better understood:

- the original source exposes `wariness` through `M59_WARINESS(properties)` in `DEFS.H`
- the only clear gameplay use recovered so far is not a generic aggression or pursuit formula
- in `GROUP1.C`, when a group considers moving into an open teleporter, creatures with `wariness >= 10` trigger an additional safety check:
  - if the teleporter scope includes creatures/groups
  - the engine verifies whether that creature type is allowed on the destination map
  - if not, the move is rejected

The original source bug note for off-party-map groups confirms the same meaning: a missing current-group binding can make high-wariness creatures incorrectly enter or refuse a teleporter because the destination-map allowance check is evaluated against the wrong group.

So the safest current reading is:

- not "general AI aggression"
- not "how hard the monster chases the party"
- but a targeted movement-caution flag, especially around creature/group teleporters

The remake runtime now consumes `wariness` for this narrow original rule:

- high-wariness creatures (`>= 10`) can refuse a creature/group teleporter when the destination map does not allow that creature type

So this is no longer an open broad AI unknown; it is now a narrowly integrated teleporter rule with a bounded scope.

## What Has Already Been Reconciled

Food values are now aligned with the original Atari payload in [src/assets/data/game_db.json](D:\DungeonMaster-codex\src\assets\data\game_db.json):

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

Monster core stats are now aligned too for the entries currently modeled in [src/assets/data/game_db.json](D:\DungeonMaster-codex\src\assets\data\game_db.json):

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

As of `2026-05-03`, spell projectile impacts are no longer the main gap here:

- direct spell hits on creatures now go back through creature defense
- `Fireball` / `Lightning` creature impacts now replay their secondary explosion branch more faithfully
- the remaining high-value reconciliation work is now mostly on weapon / melee interpretation

We also now have `0562` decoded cleanly enough to expose proven runtime tables such as:

- champion `dropOrder`
- `carryLocationMasks`
- original icon display anchors
- sound table entries
- default graphic list indirection

Those are now available in [src/assets/data/game_db.json](D:\DungeonMaster-codex\src\assets\data\game_db.json) under `originalAtari.i562`, with any unresolved residue kept as raw bytes instead of guessed.

Examples:

- weapon damage ranges
  - Atari uses weapon descriptors from `0559`
  - and attack tables from `0560`
  - plus runtime formulas in `Attack.cpp`
  - the remake still models damage as hand-authored ranges

- derived gameplay fields
  - `attackTypes`
  - inferred booleans such as poison/special behavior tags outside the raw tables

## Recommended Next Order

1. Reconcile weapon damage interpretation:
   - Atari weapon descriptors from `0559`
   - Atari attack tables from `0560`
   - runtime damage formulas from `Attack.cpp`
   - remake damage ranges
   - note `2026-05-03`:
     - a concrete melee mastery drift was found, then corrected, in [src/engine/systems/meleeDamage.ts](/D:/DungeonMaster-codex/src/engine/systems/meleeDamage.ts)
     - the remaining work here is now more about the broader interpretation layer than this specific proc mismatch

2. Revisit remaining derived monster fields:
   - legacy compatibility aliases such as `behaviorAfterAttack`, whose current export name does not match its real original meaning
   - `attackTypes`
   - convenience booleans
   - any leftover compatibility aliases that still shadow source-backed fields such as `experienceClass`

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
- modern convenience tags like `attackTypes`
- legacy export labels such as `behaviorAfterAttack` when they do not reflect the original source semantics directly
- some poison or special-effect booleans that are currently inferred rather than directly modeled



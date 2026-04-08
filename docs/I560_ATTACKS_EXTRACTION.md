# I560 Attack Tables Extraction

Audit date: 2026-04-08

Relevant files:
- [assets/OriginalDataExtraction/output/atari_i560_decoded.json](D:\DungeonMaster-codex\assets\OriginalDataExtraction\output\atari_i560_decoded.json)
- [assets/OriginalDataExtraction/output/atari_i560_stats.json](D:\DungeonMaster-codex\assets\OriginalDataExtraction\output\atari_i560_stats.json)
- [assets/OriginalDataExtraction/output/weapon_attack_reference.json](D:\DungeonMaster-codex\assets\OriginalDataExtraction\output\weapon_attack_reference.json)
- [assets/OriginalDataExtraction/decode_i560_blob.cjs](D:\DungeonMaster-codex\assets\OriginalDataExtraction\decode_i560_blob.cjs)
- [assets/OriginalDataExtraction/export_i560_stats.cjs](D:\DungeonMaster-codex\assets\OriginalDataExtraction\export_i560_stats.cjs)
- [assets/OriginalDataExtraction/build_weapon_attack_reference.cjs](D:\DungeonMaster-codex\assets\OriginalDataExtraction\build_weapon_attack_reference.cjs)
- [assets/OriginalDataExtraction/sourceCode/Dungeon_Master_FTL_Games_1987_Source_Code/csb/CSBwin_SRC_20190702/src/Data.h](D:\DungeonMaster-codex\assets\OriginalDataExtraction\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\Data.h)
- [assets/OriginalDataExtraction/sourceCode/Dungeon_Master_FTL_Games_1987_Source_Code/csb/CSBwin_SRC_20190702/src/Attack.cpp](D:\DungeonMaster-codex\assets\OriginalDataExtraction\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\Attack.cpp)
- [assets/OriginalDataExtraction/sourceCode/Dungeon_Master_FTL_Games_1987_Source_Code/csb/CSBwin_SRC_20190702/src/Character.cpp](D:\DungeonMaster-codex\assets\OriginalDataExtraction\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\Character.cpp)

## What Is Now Proven

The original Atari `0560.RAW1` blob is the canonical source for:

- attack tables
- legal attack sets by `attackClass`
- spell descriptors

The blob decodes cleanly at `1256` bytes.

## Important Structural Result

Original melee damage is not represented as a simple per-weapon range.

Instead, the engine combines:

- the weapon's `attackClass` from `OBJDESC`
- the attack table chosen from `legalAttacks[attackClass]`
- the selected attack's raw stats from the attack table:
  - `baseDamage`
  - `strengthRequired`
  - `staminaCost`
  - `disableTime`
  - `defenseModifier`
  - `experienceForAttacking`
  - `skillNumber`
- the attack formula in [Attack.cpp](D:\DungeonMaster-codex\assets\OriginalDataExtraction\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\Attack.cpp)
  - quickness
  - mastery
  - random rolls
  - monster defense and dexterity
  - level difficulty
  - special weapon exceptions such as `Vorpal Blade`, `Diamond Edge`, `Executioner`

This means the current remake `weapon.damage = [min,max]` model is not a one-to-one Atari field.

## Consequence For Reconciliation

These fields are now safe to call canonical:

- weapon weight from `0559`
- weapon descriptor raw values from `0559`
  - `rawClass`
  - raw `damage`
  - `kineticEnergy`
  - `shootDamage`
  - `throwGraphic`
- weapon `attackClass` from `OBJDESC`
- legal attack options from `0560`
- per-attack raw values from `0560`

These fields are not yet safe to call byte-perfect Atari equivalents in the remake:

- current hand-authored weapon damage ranges in [public/game_db.json](D:\DungeonMaster-codex\public\game_db.json)
- any direct mapping from a weapon to one single melee damage number

## Legal Attack Structure

`GetLegalAttackTypes` in [Character.cpp](D:\DungeonMaster-codex\assets\OriginalDataExtraction\sourceCode\Dungeon_Master_FTL_Games_1987_Source_Code\csb\CSBwin_SRC_20190702\src\Character.cpp) proves the useful layout of each `legalAttacks[attackClass]` entry:

- byte `0`:
  - always-enabled primary attack
- byte `1`:
  - optional attack slot 1
- byte `2`:
  - optional attack slot 2
- byte `4`:
  - mastery threshold for byte `1`
  - high bit means the item must still have charges
- byte `5`:
  - mastery threshold for byte `2`
  - high bit means the item must still have charges

The remaining bytes are still exported raw, but not yet assigned a proven gameplay meaning.

## Examples

From [weapon_attack_reference.json](D:\DungeonMaster-codex\assets\OriginalDataExtraction\output\weapon_attack_reference.json):

- `Torch`
  - `attackClass = 5`
  - primary attack: `Swing`
  - no optional attacks

- `Flamitt`
  - `attackClass = 6`
  - primary attack: `Swing`
  - optional attack: `Fireball`
  - requires charges

- `Staff Of Claws`
  - `attackClass = 8`
  - primary attack: `Slash`
  - optional attacks include `Brandish` and `Confuse`

- `Eye Of Time`
  - `attackClass = 43`
  - primary attack: `Punch`
  - optional attack: `Freeze Life`
  - requires charges

## Practical Next Step

If we want the remake to be fully faithful here, the correct direction is not:

- "guess better weapon damage ranges"

The correct direction is:

1. preserve the current hand-authored ranges only as temporary remake tuning
2. add explicit original raw attack data to the data model
3. later decide whether to:
   - emulate the original damage formula more directly
   - or keep a modernized model while clearly marking it as derived



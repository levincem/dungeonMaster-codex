# Original Magic Mana Findings

This note records the correction made to the original magic mana tables on 2026-05-19.

## Sources checked

- `assets/ReDMCSB_Release2/SOURCE/ENGINE/MENUS.C`
  - `F399_xxxx_MENUS_AddChampionSymbol(...)`: mana is spent when each rune is clicked
  - `F400_xxxx_MENUS_DeleteChampionSymbol()`: deleting runes does not refund mana
  - `F412_xxxx_MENUS_GetChampionSpellCastResult(...)`: casting does not spend mana a second time
- `assets/OriginalDataExtraction/output/atari_i560_decoded.json`
  - `byte19016`: raw power-level difficulty multipliers
  - `byte19010`: raw base mana costs for the 24 runes in the runtime UI order
- `Dungeon Master and Chaos Strikes Back Spells - Dungeon Master Solutions - Dungeon Master - Games - Dungeon Master Encyclopaedia.htm`
  - symbol table and per-spell mana totals match the raw `i560` bytes

## Raw tables confirmed

- `byte19016 = [8, 12, 16, 20, 24, 28]`
  - these are the original power-level difficulty multipliers
- `byte19010 = [1, 2, 3, 4, 5, 6, 2, 3, 4, 5, 6, 7, 4, 5, 6, 7, 7, 9, 2, 2, 3, 4, 6, 7]`
  - these are the original base mana costs for the runes in this order:
  - `LO UM ON EE PAL MON YA VI OH FUL DES ZO VEN EW KATH IR BRO GOR KU ROS DAIN NETA RA SAR`

## Practical consequences

- `LO FUL` costs `1 + 5 = 6`
  - this matches the Encyclopaedia Torch table `(06 09 13 16 20 23)`
- `LO FUL IR` costs `1 + 5 + 7 = 13`
  - this matches the Encyclopaedia Fireball table `(13 19 27 33 41 47)`

## Corrected issue

The packaged `original_magic_runtime.json` had the right power multipliers but a shifted non-power rune cost mapping. The main visible symptom was:

- `FUL` was treated as `6` instead of `5`
- `ZO` was treated as `4` instead of `7`
- several `form` and `alignment` runes were mapped to the wrong base costs

The runtime mana-spend logic now follows the raw `i560` tables and the packaged magic reference has been corrected to match them.

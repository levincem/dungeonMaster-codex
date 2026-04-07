# Dungeon Data Audit

Audit date: 2026-04-07

Reference source:
- User-provided canonical level lists for Hall of Champions and Levels 1-13

Audited file:
- [public/dungeon.json](D:\DungeonMaster-codex\public\dungeon.json)

## Executive Summary

The current [public/dungeon.json](D:\DungeonMaster-codex\public\dungeon.json) is not a reliable source of truth for placed dungeon content.

Important correction:

- an earlier audit pass mistakenly treated `maps[].tiles` in the raw JSON as a 2D array
- in the exported file, `tiles` is actually a flat list of tile objects
- after correcting that reading error, the file is clearly richer than first assumed

So the real problem is not that the map export is almost empty.

The real problem is:

- many placements exist
- many creature placements are already correct
- several item placements are present but misidentified
- some key placements are missing or attached to the wrong square
- wall texts often exist, but should not be compared as if they sat on the same floor square as item coordinates

What still looks usable:
- map geometry and map offsets
- champion roster and champion mirror placement data
- top-level object databases (`Text`, `Sensor`, `Creature`, `Weapon`, `Armor`, `Scroll`, `Potion`, `Container`, `Misc`)

What is currently unreliable:
- per-tile item placement
- per-tile text placement
- per-tile lock / sensor placement
- per-tile creature placement
- several scroll texts, which are still fragmentary in the raw object database

## Reference Totals

From the validated level lists:

- items: 303
- inscriptions: 61
- locks: 65
- creatures: 225
- champions: 24

## Current Export Findings

### Tile grid content is present, but not fully trustworthy

After reading the flat `tiles` list correctly, the export contains many placed objects.

Examples from the current extraction:

- Hall of Champions: 98 item-like objects, 28 text objects, 38 sensors
- Level 1: 55 item-like objects, 5 text objects, 56 sensors, 15 creatures
- Level 2: 66 item-like objects, 12 text objects, 62 sensors, 22 creatures
- Level 6: 44 item-like objects, 10 text objects, 32 sensors, 5 creatures

This means the runtime-facing data is not empty.

However, it is still not trustworthy enough to use as canonical content, because several placements and identities are wrong.

### The raw object databases still exist

The top-level `objectDatabase` still contains the raw extracted pools:

- `Text`: 125
- `Sensor`: 684
- `Creature`: 182
- `Weapon`: 107
- `Armor`: 121
- `Scroll`: 35
- `Potion`: 56
- `Container`: 12
- `Misc`: 280

However, these entries do not currently carry map coordinates in the exported JSON, so they cannot be reconstructed spatially from the browser-facing file alone.

## Representative Mismatches

### Hall of Champions

Reference:
- 9 items
- 2 inscriptions
- 24 champions

Current export:
- champions are present globally
- several Hall items are spatially present
- at `(4,15)`, the square contains a waterskin and a truncated scroll instead of the validated `Water (Charges=3)` and full `Invoke Ful for a magic torch`

This means Hall extraction is partially present, but item identity and text reconstruction are wrong.

### Level 1

Reference:
- 33 items
- 5 inscriptions
- 13 locks
- 15 creatures

Observed mismatch:
- at global `(0,16)`, the validated data says `Gold Key`
- current export places `Illumulet`

This is a direct content mismatch, not just a missing placement.

### Level 6

Reference includes:
- `The Firestaff` at global `(19,20)`
- the `Fireball Ful Ir. Fire Shield Ful Bro Neta.` scroll at global `(33,28)`
- the tomb inscription and the supply-room inscriptions

Current export:
- there is a scroll object at `(33,28)`, but its text is truncated to `ON FLOOR`
- there is no item object at `(19,20)` for `The Firestaff`

So the current runtime-facing map data preserves some of the level structure, but loses key identity and placement correctness.

### Level 10

Reference includes:
- the coin / chest cluster at global `(36,37)` to `(37,38)`
- the `The only way out is another way in.` scroll at `(26,35)`

Current export:
- several expected objects in the `(36,37)` / `(37,38)` cluster are missing from the extracted square contents

Again, this is a mix of missing placement and wrong reconstruction.

### Level 13

Reference includes:
- the power gem room scroll at global `(49,36)`
- the `Square Key` lock and `Red Dragon`

Current export:
- no item object is linked at global `(49,36)` for the validated scroll

The final level still suffers from missing spatial object reconstruction in critical places.

## Text Coverage Notes

Some important texts still exist in the top-level object database, but often in incomplete or detached form.

Confirmed present in the raw text database:
- `TO CLOSE PIT...`
- `SHORTCUT`
- `TURN BACK`

Missing or fragmentary as exact canonical strings in current exported data:
- `HALL OF CHAMPIONS`
- `VI ALTAR OF REBIRTH`
- `THIS FOUNTAIN ACCEPTS ONE WISH.`
- `THE TOMB OF THE FIRESTAFF`
- `INVISIBILITY OH EW SAR`

This matches the earlier finding that some scroll and wall texts were extracted only as fragments or shifted substrings.

## Per-Level Reference Counts

- Hall of Champions: 9 items, 2 inscriptions, 24 champions
- Level 1: 33 items, 5 inscriptions, 13 locks, 15 creatures
- Level 2: 43 items, 12 inscriptions, 10 locks, 20 creatures
- Level 3: 19 items, 6 inscriptions, 2 locks, 21 creatures
- Level 4: 24 items, 2 inscriptions, 14 creatures
- Level 5: 28 items, 14 inscriptions, 7 locks, 21 creatures
- Level 6: 22 items, 10 inscriptions, 11 locks, 5 creatures
- Level 7: 15 items, 2 locks, 23 creatures
- Level 8: 13 items, 3 inscriptions, 2 locks, 12 creatures
- Level 9: 20 items, 3 inscriptions, 4 locks, 27 creatures
- Level 10: 29 items, 3 inscriptions, 7 locks, 28 creatures
- Level 11: 24 items, 1 inscription, 3 locks, 20 creatures
- Level 12: 1 item, 1 lock, 18 creatures
- Level 13: 23 items, 3 locks, 1 creature

## Conclusion

The current project has good dungeon geometry data and a partially useful spatial extraction, but it still does not provide trustworthy canonical gameplay content.

The practical takeaway is:

- user-provided reference lists should be treated as the source of truth
- [public/dungeon.json](D:\DungeonMaster-codex\public\dungeon.json) is useful as a reverse-engineering artifact, not as canonical content
- creatures are often close to correct
- many item positions are present but misidentified
- several critical items and texts are still missing or fragmented
- the next step should still be to keep a separate canonical placement dataset derived from the validated level lists

## Recommended Next Step

Build a new structured file, for example:

- `public/original_level_content.json`

That file should store, per level:

- items with global and local coordinates
- inscriptions
- locks
- creatures
- optional notes for special-case mechanics

That would give the runtime a reliable placement source, independent of the current incomplete `dungeon.json` extraction.

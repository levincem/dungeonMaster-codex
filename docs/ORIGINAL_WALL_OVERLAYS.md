# Original Wall Overlays

Source: [public/graphics_db.json](../public/graphics_db.json)
Generated: 2026-04-07

This file catalogs the original Dungeon Master wall ornament families recovered from the graphics extraction.

Important:
- The names and image variants are source-backed.
- The exact wall placements in the dungeon are not yet decoded from the current export.
- Use [public/original_wall_overlays.json](../public/original_wall_overlays.json) as the machine-readable source of truth.

## Classification

### Interactive
- 01 - Square Alcove
- 02 - Vi Altar
- 03 - Arched Alcove
- 05 - Iron Lock
- 07 - Small Switch
- 14 - Tiny Switch
- 15 - Green Switch Out
- 16 - Blue Switch Out
- 17 - Coin Slot
- 18 - Double Iron Lock
- 19 - Square Lock
- 20 - Winged Lock
- 21 - Onyx Lock
- 22 - Stone Lock
- 23 - Cross Lock
- 24 - Topaz Lock
- 25 - Skeleton Lock
- 26 - Gold Lock
- 27 - Tourquoise Lock
- 28 - Emerald Lock
- 29 - Ruby Lock
- 30 - Ra Lock
- 31 - Master Lock
- 32 - Gem Hole
- 35 - Fountain
- 38 - Empty Torch Holder
- 43 - Champion Mirror
- 44 - Lever Up
- 45 - Lever Down
- 46 - Full Torch Holder
- 47 - Red Switch Out
- 48 - Eye Switch
- 49 - Big Switch Out
- 50 - Crack Switch Out
- 51 - Green Switch In
- 52 - Blue Switch In
- 53 - Red Switch In
- 54 - Big Switch In
- 55 - Crack Switch In

### Stateful
- 56 - Amalgam (Encased Gem)
- 57 - Amalgam (Free Gem)
- 58 - Amalgam (Without Gem)

### Hazard
- 12 - Slime Outlet
- 40 - Poison Holes
- 41 - Fireball Holes
- 42 - Dagger Holes

### Decorative
- 00 - Unreadable Wall Inscription
- 04 - Hook
- 06 - Wood Ring
- 08 - Dent 1
- 09 - Dent 2
- 10 - Iron Ring
- 11 - Crack
- 13 - Dent 3
- 33 - Slime
- 34 - Grate
- 36 - Manacles
- 37 - Ghoul's Head
- 39 - Scratches
- 59 - Lord Order (Outside)

## Notes

Useful families already identified for gameplay work:
- Alcoves: 01, 03
- Locks and slots: 05, 17-32
- Hidden or explicit wall buttons and switches: 07, 14-16, 44-55
- Mirror: 43
- Fountain: 35
- Torch holder states: 38, 46
- Endgame amalgam states: 56, 57, 58

Current limitation:
- [public/dungeon.json](../public/dungeon.json) tells us which ornament sets exist on a level, but not yet the exact ornament chosen on each decorated wall face.

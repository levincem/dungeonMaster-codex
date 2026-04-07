# Original Wall Overlay Positions

Generated from [public/dungeon.json](../public/dungeon.json) and [public/original_wall_overlays.json](../public/original_wall_overlays.json).

## What is exact

- Fixed wall overlay placements created by visible wall texts and wall sensors are resolved exactly.
- Stateful faces keep all their known variants, such as `Lever Up` / `Lever Down` on the same wall face.

## What remains partial

- Random decorative wall overlays are only listed as `random-capable` faces for now.
- The level random pool is known, but the current export still lacks the final resolved face-specific random pick.

## Summary

- Fixed placement events: 417
- Unique fixed wall faces: 316
- Stateful fixed faces: 64
- Random-capable wall faces: 3887

## Key Fixed Overlay Families

- Amalgam (Encased Gem): 1 face(s)
- Amalgam (Free Gem): 1 face(s)
- Amalgam (Without Gem): 1 face(s)
- Arched Alcove: 16 face(s)
- Big Switch In: 7 face(s)
- Big Switch Out: 8 face(s)
- Blue Switch In: 2 face(s)
- Blue Switch Out: 12 face(s)
- Champion Mirror: 24 face(s)
- Coin Slot: 12 face(s)
- Crack: 1 face(s)
- Crack Switch In: 4 face(s)
- Crack Switch Out: 4 face(s)
- Cross Lock: 3 face(s)
- Dagger Holes: 1 face(s)
- Emerald Lock: 1 face(s)
- Empty Torch Holder: 13 face(s)
- Eye Switch: 2 face(s)
- Fireball Holes: 14 face(s)
- Fountain: 4 face(s)
- Full Torch Holder: 13 face(s)
- Gem Hole: 1 face(s)
- Gold Lock: 7 face(s)
- Green Switch In: 12 face(s)
- Green Switch Out: 12 face(s)
- Iron Lock: 12 face(s)
- Iron Ring: 1 face(s)
- Lever Down: 12 face(s)
- Lever Up: 12 face(s)
- Lord Order (Outside): 2 face(s)
- Manacles: 1 face(s)
- Master Lock: 2 face(s)
- Onyx Lock: 3 face(s)
- Poison Holes: 1 face(s)
- Ra Lock: 4 face(s)
- Red Switch In: 3 face(s)
- Red Switch Out: 4 face(s)
- Ruby Lock: 1 face(s)
- Skeleton Lock: 6 face(s)
- Slime Outlet: 1 face(s)
- Small Switch: 32 face(s)
- Square Alcove: 22 face(s)
- Square Lock: 2 face(s)
- Stone Lock: 7 face(s)
- Tiny Switch: 9 face(s)
- Topaz Lock: 1 face(s)
- Tourquoise Lock: 4 face(s)
- Unreadable Wall Inscription: 58 face(s)
- Vi Altar: 4 face(s)
- Winged Lock: 1 face(s)

## Example Stateful Faces

- Map 0 Hall of Champions (3,14) face East: Empty Torch Holder / Full Torch Holder
- Map 1 Level 1 (6,4) face North: Square Alcove / Big Switch Out
- Map 1 Level 1 (6,8) face North: Lever Down / Lever Up
- Map 1 Level 1 (15,8) face West: Empty Torch Holder / Full Torch Holder
- Map 1 Level 1 (4,10) face South: Lever Down / Lever Up
- Map 1 Level 1 (15,13) face East: Empty Torch Holder / Full Torch Holder
- Map 1 Level 1 (20,18) face North: Green Switch In / Green Switch Out
- Map 1 Level 1 (13,19) face East: Lever Down / Lever Up
- Map 1 Level 1 (23,19) face West: Lever Down / Lever Up
- Map 1 Level 1 (30,26) face North: Empty Torch Holder / Full Torch Holder
- Map 1 Level 1 (15,28) face East: Lever Down / Lever Up
- Map 1 Level 1 (15,28) face West: Lever Down / Lever Up
- Map 1 Level 1 (5,29) face East: Empty Torch Holder / Full Torch Holder
- Map 2 Level 2 (14,1) face West: Blue Switch In / Blue Switch Out
- Map 2 Level 2 (26,2) face East: Big Switch In / Big Switch Out
- Map 2 Level 2 (0,5) face South: Big Switch In / Big Switch Out
- Map 2 Level 2 (21,11) face South: Blue Switch In / Blue Switch Out
- Map 2 Level 2 (9,29) face South: Big Switch In / Big Switch Out
- Map 2 Level 2 (28,29) face East: Empty Torch Holder / Full Torch Holder
- Map 2 Level 2 (31,29) face West: Empty Torch Holder / Full Torch Holder

## Files

- JSON catalog with placements: [public/original_wall_overlay_positions.json](../public/original_wall_overlay_positions.json)
- Overlay family catalog: [public/original_wall_overlays.json](../public/original_wall_overlays.json)

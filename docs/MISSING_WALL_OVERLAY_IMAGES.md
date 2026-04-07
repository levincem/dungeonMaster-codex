# Missing Wall Overlay Images

This file tracks the original wall overlay families that still do not have a dedicated image asset in the current runtime.

Notes:
- Yes, [public/misc/serrure.png](D:\DungeonMaster-codex\public\misc\serrure.png) is already used as a generic lock/slot sprite for many lock families.
- [public/misc/wall_foutain_overlay.png](D:\DungeonMaster-codex\public\misc\wall_foutain_overlay.png) is already used for `Fountain`.
- `Champion Mirror` and wall inscriptions are intentionally excluded here because they are already rendered through their own special systems.
- `Lord Order (Outside)` is listed for completeness as an original wall overlay family, even if the character itself also exists elsewhere as a creature concept.

## Already Covered

These overlay families already have a real image in the runtime:

- `Fountain`
- `Vi Altar`
- `Lever Up`
- `Lever Down`
- `Iron Lock`
- `Square Lock`
- `Winged Lock`
- `Onyx Lock`
- `Stone Lock`
- `Cross Lock`
- `Topaz Lock`
- `Skeleton Lock`
- `Gold Lock`
- `Tourquoise Lock`
- `Emerald Lock`
- `Ruby Lock`
- `Ra Lock`
- `Master Lock`
- `Coin Slot`
- `Gem Hole`
- `Full Torch Holder`

## Missing Images

### High Priority

These are the most useful missing assets for readability and gameplay:

- `Small Switch`
  occurrences: `32`
  class: `interactive`
  description: Wall switch or hidden button family.
  suggested file: `public/misc/wall_switch_small.png`

- `Square Alcove`
  occurrences: `22`
  class: `interactive`
  description: Wall container or deposit niche.
  suggested file: `public/misc/wall_alcove_square.png`

- `Arched Alcove`
  occurrences: `16`
  class: `interactive`
  description: Wall container or deposit niche.
  suggested file: `public/misc/wall_alcove_arched.png`

- `Empty Torch Holder`
  occurrences: `13`
  class: `interactive`
  description: Empty state of a torch holder on the wall.
  suggested file: `public/misc/wall_torch_holder_empty.png`

- `Blue Switch Out`
  occurrences: `12`
  class: `interactive`
  description: Wall switch or hidden button family.
  suggested file: `public/misc/wall_switch_blue_out.png`

- `Green Switch In`
  occurrences: `12`
  class: `interactive`
  description: Wall switch or hidden button family.
  suggested file: `public/misc/wall_switch_green_in.png`

- `Green Switch Out`
  occurrences: `12`
  class: `interactive`
  description: Wall switch or hidden button family.
  suggested file: `public/misc/wall_switch_green_out.png`

- `Tiny Switch`
  occurrences: `9`
  class: `interactive`
  description: Wall switch or hidden button family.
  suggested file: `public/misc/wall_switch_tiny.png`

- `Big Switch Out`
  occurrences: `8`
  class: `interactive`
  description: Wall switch or hidden button family.
  suggested file: `public/misc/wall_switch_big_out.png`

- `Big Switch In`
  occurrences: `7`
  class: `interactive`
  description: Wall switch or hidden button family.
  suggested file: `public/misc/wall_switch_big_in.png`

- `Crack Switch In`
  occurrences: `4`
  class: `interactive`
  description: Wall switch or hidden button family.
  suggested file: `public/misc/wall_switch_crack_in.png`

- `Crack Switch Out`
  occurrences: `4`
  class: `interactive`
  description: Wall switch or hidden button family.
  suggested file: `public/misc/wall_switch_crack_out.png`

- `Red Switch Out`
  occurrences: `4`
  class: `interactive`
  description: Wall switch or hidden button family.
  suggested file: `public/misc/wall_switch_red_out.png`

- `Red Switch In`
  occurrences: `3`
  class: `interactive`
  description: Wall switch or hidden button family.
  suggested file: `public/misc/wall_switch_red_in.png`

- `Blue Switch In`
  occurrences: `2`
  class: `interactive`
  description: Wall switch or hidden button family.
  suggested file: `public/misc/wall_switch_blue_in.png`

- `Eye Switch`
  occurrences: `2`
  class: `interactive`
  description: Wall switch or hidden button family.
  suggested file: `public/misc/wall_switch_eye.png`

### Trap / Hazard Priority

- `Fireball Holes`
  occurrences: `14`
  class: `hazard`
  description: Hazard emitter or trap outlet.
  suggested file: `public/misc/wall_hazard_fireball_holes.png`

- `Dagger Holes`
  occurrences: `1`
  class: `hazard`
  description: Hazard emitter or trap outlet.
  suggested file: `public/misc/wall_hazard_dagger_holes.png`

- `Poison Holes`
  occurrences: `1`
  class: `hazard`
  description: Hazard emitter or trap outlet.
  suggested file: `public/misc/wall_hazard_poison_holes.png`

- `Slime Outlet`
  occurrences: `1`
  class: `hazard`
  description: Hazard emitter or trap outlet.
  suggested file: `public/misc/wall_hazard_slime_outlet.png`

### Endgame / Stateful Priority

- `Amalgam (Encased Gem)`
  occurrences: `1`
  class: `stateful`
  description: Stateful Firestaff/Gem endgame wall decoration.
  suggested file: `public/misc/wall_amalgam_encased_gem.png`

- `Amalgam (Free Gem)`
  occurrences: `1`
  class: `stateful`
  description: Stateful Firestaff/Gem endgame wall decoration.
  suggested file: `public/misc/wall_amalgam_free_gem.png`

- `Amalgam (Without Gem)`
  occurrences: `1`
  class: `stateful`
  description: Stateful Firestaff/Gem endgame wall decoration.
  suggested file: `public/misc/wall_amalgam_without_gem.png`

### Low Priority Decorative

- `Lord Order (Outside)`
  occurrences: `2`
  class: `decorative`
  description: Primarily decorative or ambiance-facing.
  suggested file: `public/misc/wall_lord_order_outside.png`

- `Crack`
  occurrences: `1`
  class: `decorative`
  description: Primarily decorative or ambiance-facing.
  suggested file: `public/misc/wall_crack.png`

- `Iron Ring`
  occurrences: `1`
  class: `decorative`
  description: Primarily decorative or ambiance-facing.
  suggested file: `public/misc/wall_iron_ring.png`

- `Manacles`
  occurrences: `1`
  class: `decorative`
  description: Primarily decorative or ambiance-facing.
  suggested file: `public/misc/wall_manacles.png`

## Suggested Asset Batches

- Batch 1: all switch families
- Batch 2: alcoves + empty torch holder
- Batch 3: trap emitters
- Batch 4: amalgam states
- Batch 5: decorative leftovers

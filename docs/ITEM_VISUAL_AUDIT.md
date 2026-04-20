# Item Visual Audit

Audit date: 2026-04-08

Useful files:
- [src/data/itemImages.ts](D:/DungeonMaster-codex/src/data/itemImages.ts)
- [src/data/items.ts](D:/DungeonMaster-codex/src/data/items.ts)
- [public/items](D:/DungeonMaster-codex/public/items)

## Summary

The item art coverage is now in good shape overall.

- Visual priority rule for the project:
  - remade / modernized project art is always the first choice at runtime
  - original extracted bitmaps are only placeholders or fallbacks when no remade asset exists yet
  - this applies to overlays, door textures, and item-family placeholders as well as regular inventory art
- `graphics_db` must be read carefully:
  - entries such as `Item on floor 20` describe a shared floor-render family
  - they do not collapse the underlying item identities
  - `Mail Aketon` and `Mithral Aketon` remain separate canonical items even if the original data also groups them under the same floor-render entry
- Armor canonical IDs: fully mapped in the current runtime image table.
- Misc canonical IDs: fully mapped except for one duplicate-name family handled by a shared image.
- Runtime rendering now supports explicit name-based overrides for special objects whose extracted names are reliable even when raw type decoding is still heterogeneous in some places.
- Weapon image coverage is now good in practice for both generic and special items.

## Confirmed Remaining Risks

- Champion starter slot mapping in the Hall of Champions no longer depends on a hand-maintained table.
  It is now re-derived from the extracted mirror sensors plus the Hall champion positions.
- The full Hall roster has now been rechecked at a practical source-backed level:
  - `24 / 24` mirror sensors resolve to a unique champion
  - all Hall starter item names now match the Hall evidence, including armor
- The old negative-id starter armor shims have been removed from the runtime item layer.
  - current Hall loadouts no longer depend on them
  - lookups for names like `Tabard`, `Blue Pants`, `Kirtle`, `Sandals` or `Hide Shield` no longer fabricate synthetic runtime armor ids
- The Hall/table cross-check showed that the old `DM` / `CSB` clothing names had been mixed.
  - `Barbarian Hide`, `Robe (Body)` and `Robe (Legs)` are now restored as the canonical `DM` runtime names for the affected low clothing ids
  - this realigns the Hall starters for `Halk`, `Azizi`, `Elija` and `Mophus` with the original `Dungeon Master` reference material
- The starter chain `Hall mirror -> canonical item name -> starter auto-equip slots` is now covered by regression tests.
  - all equipped starter items must land on an allowed slot
  - wearable armor must stay on body slots when those slots exist
  - spot checks now lock sensitive champions like `Halk`, `Zed`, `Mophus`, `Elija`, `Hawk`, `Wu Tse` and `Gando`
- The current Hall starter loadouts no longer depend on any negative-id compatibility names.
  - the exact Hall item-name audit now passes for all `24 / 24` champions
- `Tabard` is now confirmed from the original carry-location masks as a `legs` item; the same slot-family cleanup also covers `Robe`, `Gunna`, `Elven Huke` and `Mithral Mail`, so the runtime equip-slot layer should prefer the source-backed slot masks over older manual slot assumptions for this clothing group.
- `Cape` and `Cloak of Night` are dual-slot items in the original carry masks (`torso` and `neck`).
  The runtime now keeps `torso` as the default auto-equip preference so existing starter silhouettes do not jump unexpectedly, while still allowing manual equip on `neck`.

There is no longer a single obvious missing runtime mapping on the item art side.

- The legacy item-image fallback tables are now much smaller:
  - armor falls back entirely through canonical names and aliases
  - misc falls back only for one unresolved legacy id
  - weapons keep only a tiny residue of old ids that still have no stable canonical-name path

## Name / Asset Notes

These are not blockers, but they are worth keeping clean:

- `Armor id 8`
  - Canonical name in runtime: `Ghi`
  - cleaned in [src/data/items.ts](D:/DungeonMaster-codex/src/data/items.ts)

- `Misc id 52`
  - Canonical runtime name: `Cross Key`
  - cleaned in [src/data/items.ts](D:/DungeonMaster-codex/src/data/items.ts)

- `Misc id 25` and `42`
  - Both are displayed as `Magical Box`
  - They intentionally use different images:
    - blue: `magical_box_blue.png`
    - green: `magical_box_green.png`

- `Misc id 32` and `46`
  - Both use the same rabbit-foot image, which is fine

## Extra Assets Present But Not Explicitly Used By The Current Mapping

These files exist in [public/items](D:/DungeonMaster-codex/public/items). Some are now used through explicit name overrides, while others are still just available for future cleanup or richer state handling:

- `bezerker_helm.png`
- `blue_gem.png`
- `bolt_blade_empty.png`
- `bolt_blade_full.png`
- `boots_of_speed.png`
- `boulder.png`
- `calista.png`
- `champion_bones.png`
- `chest_opened.png`
- `club.png`
- `dane_potion.png`
- `dexhelm.png`
- `diamond_edge.png`
- `dragon_spit.png`
- `elven_huke.png`
- `emerald_key.png`
- `eye_of_time_empty.png`
- `eye_of_time_full.png`
- `flamebain.png`
- `flamitt_empty.png`
- `flamitt_full.png`
- `hardcleave.png`
- `horn_of_fear.png`
- `mace.png`
- `mace_of_order.png`
- `mithral_aketon.png`
- `mithral_mail.png`
- `morningstar.png`
- `onyx_key.png`
- `orange_gem.png`
- `powertowers.png`
- `ra_key.png`
- `ros_potion.png`
- `ruby_key.png`
- `sapphire_key.png`
- `sceptre_of_lyf.png`
- `skeleton_key.png`
- `small_shield.png`
- `snake_staff.png`
- `solid_key.png`
- `speedbow.png`
- `square_key.png`
- `staff_of_manar.png`
- `stick.png`
- `stone_club.png`
- `stormring_empty.png`
- `stormring_full.png`
- `the_conduit.png`
- `the_firestaff.png`
- `the_firestaff_complete.png`
- `the_inquisitor.png`
- `tourquoise_key.png`
- `um_potion.png`
- `ven_potion.png`
- `vi_potion.png`
- `water.png`

Some of these are genuinely useful future assets for special items that the runtime still renders through generic IDs or simplified mappings.

## Recommended Next Cleanup

1. Decide whether special-item image overrides should stay name-based or be folded back into fully canonical `typeId` mappings once Hall/object decoding is completely stabilized.
2. Review the still-unused assets to separate:
   - future gameplay states
   - genuine leftovers

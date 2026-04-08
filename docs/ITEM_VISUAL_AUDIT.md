# Item Visual Audit

Audit date: 2026-04-08

Useful files:
- [src/data/itemImages.ts](D:/DungeonMaster-codex/src/data/itemImages.ts)
- [src/data/items.ts](D:/DungeonMaster-codex/src/data/items.ts)
- [public/items](D:/DungeonMaster-codex/public/items)

## Summary

The item art coverage is now in good shape overall.

- Armor canonical IDs: fully mapped in the current runtime image table.
- Misc canonical IDs: fully mapped except for one duplicate-name family handled by a shared image.
- Runtime rendering now supports explicit name-based overrides for special objects whose extracted names are reliable even when raw type decoding is still heterogeneous in some places.
- Weapon image coverage is now good in practice for both generic and special items.

## Confirmed Remaining Risks

- Champion starter equipment in the Hall of Champions still depends on raw Hall tile object decoding.
- That means the visual mapping is stronger than before, but starter loadouts should still be cross-checked against the trusted hero equipment lists before calling them fully canonical.

There is no longer a single obvious missing runtime mapping on the item art side.

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

1. Cross-check champion starter equipment against the trusted hero lists.
2. Decide whether special-item image overrides should stay name-based or be folded back into fully canonical `typeId` mappings once Hall/object decoding is completely stabilized.
3. Review the still-unused assets to separate:
   - future gameplay states
   - genuine leftovers

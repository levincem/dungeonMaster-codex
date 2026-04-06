# Original Item Tables

## Goal

This document records the authoritative item-table information now available from external reverse-engineering documentation of `graphics.dat item 559`.

It is meant to complement the local binary analysis already present in the project:

- local extraction is still strongest for dungeon structure and render/layout data
- this document captures item-table semantics that are now known from original-data research and should be used as the next source of truth when replacing manual item heuristics

## Source Provenance

The data summarized here comes from documentation of the item descriptors found in:

- `graphics.dat item 559`

The supplied notes state that:

- the item table is documented from Dungeon Master for Atari ST
- locations shown in the reference table are based on the PC dungeon
- similar or identical values exist across Dungeon Master / Chaos Strikes Back versions

## What This Table Gives Us Reliably

The item table described in the reference material provides a strong basis for:

- global item index
- item category
- item index inside category
- index inside the item table
- item-on-floor graphics index
- attack combo index
- carry-location bitmask
- authoritative item naming across categories

This is already enough to improve the remake significantly, even before all low-level gameplay stat tables are decoded from the PC binaries themselves.

## Category Offsets

The documented category-to-table offsets are:

- `Scroll`: `+0`
- `Container`: `+1`
- `Potion`: `+2`
- `Weapon`: `+23`
- `Clothe`: `+69`
- `Miscellaneous`: `+127`

These offsets allow conversion between:

- global item index
- item category
- index in category
- index in table

## Carry Location Bitmask

The carry-location bitmask is particularly valuable because it provides a source-backed replacement for a large portion of the slot heuristics currently maintained in code.

Documented bits:

- bit `0`: `Consumable`
- bit `1`: `Head`
- bit `2`: `Neck`
- bit `3`: `Torso`
- bit `4`: `Legs`
- bit `5`: `Feet`
- bit `6`: `Quiver 1`
- bit `7`: `Quiver 2`
- bit `8`: `Pouch`
- bit `9`: `Hands`
- bit `10`: `Chest`
- bits `11..15`: unused in the reference description

Important documented rules:

- an item with value `0` cannot be carried, except special cases such as hand-cursor style spell constructs
- any item with a non-zero value can also be placed in hands and in the backpack
- items that are only valid in hands and backpack use the documented special pattern around bit `9` and upper bits

## What This Immediately Unlocks In The Remake

This documentation is now strong enough to drive:

- equipment slot validation
- pouch/chest/quiver placement rules
- consumable flags
- category mapping
- authoritative item identity resolution

Most importantly, it means the following areas are no longer purely heuristic in principle:

- item `slot`
- part of item `usable`
- category inference
- category-specific indexing

## What This Does Not Fully Solve Yet

The documented table excerpt does **not** by itself give every gameplay stat that the remake currently encodes manually.

It does not, on its own, fully replace:

- exact weapon damage values
- exact armour strength values for all items
- sharp resistance values
- throw distance
- shoot damage
- class / delta energy
- exact weight values where still maintained manually

These fields may be documented elsewhere in the same body of research, but they are not fully established by the carry-location/index table alone.

## Practical Impact

After the addition of this source, the item-data situation should be viewed as:

- `identity / category / carry rules`: documented strongly enough to integrate
- `combat and protection stats`: still partially manual unless backed by additional tables

## Recommended Integration Order

1. Replace manual carry-slot assumptions using the carry-location bitmask
2. Normalize global item index / category / index-in-category mapping
3. Reconcile item-on-floor graphic indexes with extracted graphics metadata
4. Keep combat/protection numbers manual until the companion stat tables are imported or reconstructed with confidence

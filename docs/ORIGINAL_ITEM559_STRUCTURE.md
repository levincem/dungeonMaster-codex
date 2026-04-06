# Original Graphics.dat Item 559 Structure

## Goal

This document summarizes the documented structure of `graphics.dat item 559`, which is the most important original gameplay-table block in the Atari-style data model.

It does not claim that the PC runtime still stores this block contiguously in the same way, but it gives the authoritative logical breakdown we should use as a reference.

## High-Level Purpose

The documented `item 559` block contains initialization data for gameplay-oriented global variables, especially:

- creature descriptors
- item descriptors
- weapon descriptors
- clothe descriptors
- misc item descriptors
- food values
- door characteristics
- creature droppings
- object-size/object-entry support tables
- coordinate deltas

## Documented Sub-Blocks

### `000h` Creature facing bytes

Provides fallback packed facings for creature groups not on the current map.

### `004h`, `104h`, `144h` Text escape expansion strings

Provides string-expansion tables for dungeon text rendering.

### `244h` Door characteristics

Structure: `4 x 2 bytes`

Per door family:

- animation flag
- thrown-items-pass-through flag
- see-through flag
- resistance to destruction

Documented values:

- Grate / portcullis
- Wooden door
- Iron door
- Ra door

This is an especially valuable table because it gives exact original door behavior semantics.

### `24Ch` Creature droppings definitions

Structure: `40 words`

Defines which items are dropped when specific creatures die.

This is separate from explicit possessions in the dungeon data itself.

### `29Ch` Creature attack sound definitions

Structure: `8 bytes`

Maps creature-attack sound ordinals to sound-table entries.

### `2A4h` Creature descriptors

Structure: `27 x 26 bytes`

This is the core creature gameplay table. It contains:

- creature view index
- attack sound index
- behavior flags
- size
- attack-any-champion / prefer-back-row / levitation / nonmaterial
- drop-items and absorb-items flags
- animation/presentation flags
- movement duration
- attack duration
- armor / defense
- base health
- attack power
- poison
- hit probability / dexterity-style field
- awareness / sight / spell range
- intelligence
- experience
- bravery
- resistances
- attack animation timing
- wound probabilities
- attack type

### `562h` Food values of consumable items

Structure: `8 words`

Food values for the consumable food items.

### `572h` Miscellaneous items descriptors

Structure: `54 bytes`

One byte per misc item:

- item weight in `1/10 kg`

### `5A8h` Copy-protection value

Not useful for gameplay reconstruction.

### `5AAh` Clothe items descriptors

Structure: `58 x 4 bytes`

Per clothing/armor item:

- weight
- protection efficiency
- armor-vs-shield flag
- sharp resistance

This is one of the most important missing stat tables for the remake and is now clearly identified.

### `692h` Weapon items descriptors

Structure: `46 x 6 bytes`

Per weapon:

- weight
- weapon class / range delta
- damage
- initial thrown energy / distance
- missile image id
- shoot damage bonus

This is the other major item-stat table the remake needs.

### `7A6h` Item descriptors

Structure: `180 x 6 bytes`

Per item:

- global item index
- item-on-floor graphic index
- attack combo index
- carry locations bitmask

This is the table already partially documented and already useful for category, carry and combo reconstruction.

### `BDEh` Additional object entries created when loading dungeon.dat

Defines additional allocation counts per object type for runtime-created objects.

### `BEEh` Size of object types in dungeon.dat

Defines object record sizes in `dungeon.dat`.

### `BFEh` / `C06h` Coordinate delta tables

Original delta tables for Y and X movement:

- Y: `-1, 0, 1, 0`
- X: `0, 1, 0, -1`

## Practical Impact

`Item 559` now gives us a very strong logical map of what the original gameplay data actually consisted of.

The main remaining problem is no longer “what tables existed?” but rather:

- how to import them cleanly into the remake
- how to reconcile them with version differences
- how to recover or mirror them faithfully for the PC-oriented runtime we are targeting

## Most Valuable Tables For Immediate Integration

1. door characteristics
2. creature droppings
3. creature descriptors
4. misc item weights
5. clothe item descriptors
6. weapon item descriptors
7. item descriptors

# Original Graphics.dat Item 560 Actions And Spells

## Goal

This document summarizes the documented structure of `graphics.dat item 560`, which contains the core original tables for:

- actions
- combos
- spell definitions
- spell difficulty and mana metadata

## High-Level Purpose

`Item 560` is the logical home of the action/spell gameplay layer in the Atari-style data model.

It complements `item 559`:

- `item 559` tells us which combo index belongs to an item
- `item 560` tells us what that combo actually contains

## Documented Sub-Blocks

### `000h` Rectangle areas for actions

UI support rectangles for the action display.

### `030h` Palette changes for action-area object icons

UI palette remapping when displaying hand items in the action area.

### `040h` Actions experience gain

Structure: `44 bytes`

One byte per action:

- base experience gain

### `06Ch` Actions improved skill number

Structure: `44 bytes`

One byte per action:

- improved skill index

### `098h` Actions defense modifier

Structure: `44 signed bytes`

One signed byte per action:

- defense modifier applied until the next action

### `0C4h` Actions stamina

Structure: `44 bytes`

One byte per action:

- base stamina cost

### `0F0h` Actions hit probability

Structure: `44 bytes`

One byte per action:

- hit probability

### `11Ch` Actions damage

Structure: `44 bytes`

One byte per action:

- damage modifier in `1/32`

### `148h` Actions fatigue

Structure: `44 bytes`

One byte per action:

- fatigue / cooldown in `1/6s`

### `174h` Actions names

ASCII action names for the 44 actions.

### `2A0h` or `304h` Actions combos

Structure: `44 x 8 bytes`

Per combo:

- first action index
- second action index
- third action index
- first action flags:
  - bit 7 = use charges
  - bits 6..0 = minimum skill level
- second action flags
- third action flags
- two legacy/unused bytes

This is the authoritative original combo structure.

### `402h` or `466h` Spells

Structure: `25 x 8 bytes`

Per spell:

- symbol sequence
- base difficulty
- skill index
- duration / subtype / spell-type word

This is the core spell-definition table.

### `4CAh` / `52Eh` Spell difficulty multipliers

One byte per power symbol.

### `4D0h` / `534h` Base mana cost of symbols

One byte per symbol:

- base mana cost

## Practical Impact

`Item 560` gives a source-backed home for nearly all of the following domains:

- champion action metadata
- combo composition
- minimum-skill gating of actions
- charge usage by action slot
- spell definitions
- spell difficulty scaling
- symbol mana costs

## Most Valuable Tables For Immediate Integration

1. actions experience/skill/defense/stamina/hit/damage/fatigue arrays
2. action names
3. combo definitions
4. spell definitions
5. spell difficulty multipliers
6. symbol mana costs

## Remaining Caveat

As with `item 559`, the key remaining uncertainty for this remake is not whether the logical tables existed, but how best to:

- mirror them in structured runtime data
- choose the correct version branch
- preserve hardcoded exceptions separately from the core tables

# Original Graphics.dat Item 562 UI And System Tables

## Goal

This document summarizes the documented structure of `graphics.dat item 562`, which groups a wide variety of interface and support-system tables.

While this block is less directly about weapon/armor stats than `item 559`, it is still important because it contains authoritative data for:

- carry-location masks
- icon display
- torch/luminance behavior
- champion panel layout
- injury masks
- attack-position ordering

## High-Level Purpose

`Item 562` is best understood as a mixed UI/system support block.

It contains:

- UI rectangles and palettes
- cursor/icon rendering helpers
- inventory/carry-location support
- luminance tables
- injury and attack-position support tables
- champion-panel display metadata

## Most Important Documented Sub-Blocks

### `0F4h` Possessions drop order

Defines the order in which carried possessions are dropped when a champion dies.

### `1A2h` Resistance to injuries multipliers

System support table for injury resistance by body area.

### `2E8h` Palette index to total luminance

Maps luminance totals to dungeon-view palettes.

### `2F4h` Luminous power to luminance

Defines luminance output for:

- Torch spell
- Light spell
- Darkness spell
- light-producing item actions
- torches by charge count

### `314h` Carry Locations Masks

Structure: `38 entries`

This is a major table because it describes what kinds of objects can be stored in each carry location.

It complements the item carry-location bitmask from `item 559`.

### `392h` Icon display descriptors

Defines icon positions and object-full-type associations for:

- hands
- champion inventory
- backpack
- chest

### `4A6h` Torch Type Per Charges Count

Defines which torch graphic to use depending on torch charges.

### `4D8h` Creature injury masks

Provides the actual body-part masks used by creature wound logic.

### `4DCh` Ordered positions to attack

Defines ordered sub-cell priorities for monsters attacking party positions.

This is particularly valuable for faithful combat positioning and targeting.

## Other Important Areas

`Item 562` also documents:

- champion panel rectangles
- mouse cursor palette handling
- palettes and luminance support
- always-loaded graphics list
- action-area and spell-area rectangles
- reincarnation UI support strings and symbols

## Practical Impact

`Item 562` strengthens several domains that were previously only loosely understood:

- inventory slot/carry validation
- held-icon and inventory-icon layout
- torch and luminance behavior
- wound location logic
- sub-cell target priority logic
- champion inventory and panel presentation

## Most Valuable Tables For Immediate Integration

1. carry-location masks
2. possessions drop order
3. luminous power / palette brightness
4. torch type per charges count
5. creature injury masks
6. ordered positions to attack
7. icon display descriptors

## Remaining Caveat

Like the other Atari-style blocks, `item 562` is a logical reference model.

For this remake, the remaining work is mostly:

- selecting which parts should become structured runtime datasets
- deciding which UI/layout tables matter for the current implementation
- separating data-driven logic from hardcoded engine assumptions

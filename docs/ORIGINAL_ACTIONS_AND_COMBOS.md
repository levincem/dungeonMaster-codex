# Original Actions And Combos

## Goal

This document captures the externally documented action and combo tables used by Dungeon Master and Chaos Strikes Back.

These tables are especially important because they connect:

- an item's `attack combo` index
- the actual actions made available to the champion
- the skill, fatigue, stamina and hit/damage modifiers attached to those actions

## Source Provenance

The supplied reference material documents:

- the full action table
- the combo table

These tables are part of the broader reverse-engineering work around the original data files and engine behavior.

## Action Table Coverage

The documented action table provides, for each action:

- action index
- localized names
- improved skill
- experience gain
- defense modifier
- stamina cost
- hit probability
- damage modifier
- fatigue

This means the action system is no longer an unknown gameplay area.

## Combo Table Coverage

The documented combo table provides, for each combo:

- combo index
- up to three action slots
- whether an action consumes charges
- minimum skill level to show the action
- two unused values

This is the missing bridge between:

- item descriptors using `attack combo`
- the actual action list shown in the UI

## What This Unlocks

Together with the item table documentation, this is now enough to support a source-backed reconstruction of:

- which actions belong to each item
- which actions consume charges
- which actions are gated by minimum skill level
- which hidden/basic skill should gain experience when using an action
- the base fatigue/stamina/defense balance per action

## Important Notes

The supplied documentation also includes important clarifications:

- some actions grant special hardcoded experience rules:
  - `War Cry`
  - `Calm`
  - `Brandish`
  - `Blow Horn`
  - `Confuse`
- some actions have hardcoded edge behavior:
  - door-breaking fatigue exceptions
  - `Fuse` using a special non-material spell effect
  - `Freeze Life` affecting creatures on the current map

So not every gameplay outcome is purely table-driven.

## Practical Impact

After adding this source, the action/combo domain should be viewed as:

- `documented strongly enough to integrate`
- `still needing structured import into runtime data`

## Recommended Integration Order

1. Create a structured action table in project data
2. Create a structured combo table keyed by combo index
3. Link item `attack combo` indexes to these combo definitions
4. Keep explicitly hardcoded exceptions separate from the data tables

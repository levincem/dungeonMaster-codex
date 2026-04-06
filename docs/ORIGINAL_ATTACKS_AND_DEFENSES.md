# Original Attacks And Defenses

## Goal

This document records the externally documented mapping between attack types and champion defenses in Dungeon Master and Chaos Strikes Back.

It complements the creature descriptor documentation because creature attack types only become fully meaningful when tied to the original defense model.

## Source Provenance

The supplied reference material documents the game's attack-type table and the defense factors that mitigate each type.

## Attack Type Coverage

The documented table covers attack types `0..7`:

- `0` Unconditional
- `1` Fire
- `2` Impact
- `3` Blunt
- `4` Sharp
- `5` Magic
- `6` Mental
- `7` Blast

## What This Table Gives Us Reliably

For each attack type, the source documents:

- typical causes
- which champion statistics apply
- which item actions or spells contribute to defense
- when normal armor applies
- when special sharp-defense logic applies

Important examples:

- `Sharp` uses the sharp-defense path instead of normal armor
- `Magic` uses anti-magic style resistance rather than normal armor
- `Fire` includes anti-fire plus several shield effects
- `Impact` halves defense
- `Unconditional` ignores the standard mitigation paths

## What This Unlocks

This source is now strong enough to support a more faithful reconstruction of:

- champion defense calculation by attack type
- how creature `Attack Type` should interact with champion stats
- the distinction between normal armor defense and sharp-specific defense
- which item/spell effects belong to fire, magic or physical mitigation

## Practical Impact

After adding this source, the attacks/defenses domain should be viewed as:

- `documented strongly enough to integrate`
- `still requiring mapping into the remake combat model`

## Recommended Integration Order

1. Add a structured attack-type table to project data
2. Map creature descriptor `Attack Type` values to this table
3. Reconcile champion defense calculations with the documented factors
4. Keep engine/version bugs explicit rather than flattening them away

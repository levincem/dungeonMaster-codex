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

## Current Runtime Status

As of `2026-05-03`, the remake now uses this source more directly for spell/projectile-side damage than it did originally:

- `Fireball`, `Lightning Bolt`, `Poison Cloud`, `Open Door`, and `Disrupt Nonmaterial` now follow source-backed projectile/explosion branches much more closely
- party-wide spell backlash no longer uses a simple front-row/back-row split and instead uses a spread closer to `F324_aezz_CHAMPION_DamageAll_GetDamagedChampionCount`
- direct spell-projectile impacts on creatures now reapply creature defense before HP loss, instead of taking the rolled spell hit almost raw
- `Fireball` / `Lightning Bolt` on creatures now replay the original two-stage pattern more faithfully:
  - direct hit first
  - then the secondary explosion burst
  - with creature `fireResistance` applied on that burst instead of on the direct contact hit
- blocked `Fireball` / `Lightning Bolt` impacts now use the source-backed explosion burst branch rather than reusing the direct-hit damage roll
- food, water, drinking, mana regen, stamina regen, and HP regen have been rechecked against `CHAMPION.C` / `INVNTORY.C`
- creature-vs-champion mitigation now follows the original branching more closely too:
  - `Sharp` uses the `sharpDefense` path exported from `i559`
  - `Impact` halves physical defense again
  - `Mental` is reduced through wisdom instead of the generic anti-magic bucket
  - `Unconditional` bypasses the normal physical mitigation path
  - the hand-held shield weighting table from `Graphic 562` is now exposed in the packaged runtime as `woundDefenseFactors = [5,5,4,6,3,1]` and used directly by the remake
  - active shields are no longer modeled as generic percentages; the runtime now distinguishes additive `physical`, `magic`, and `fire` defense paths like the original engine
  - creature spellcasters now recreate real ranged projectiles from `GROUP1.C` rather than only instant ranged damage shortcuts
  - `Poison Cloud` on the party square is now resolved as a normal attack with no wounds, matching `PROJEXPL.C`

Important deliberate divergence:

- the remake does **not** currently emulate the original compiled-game bug (`BUG0_41`) that effectively neutralized much of `Anti-Magic` / `Anti-Fire`
- instead, those statistics remain active in the runtime because this is closer to the intended design than to the buggy Megamax output
- `Slime` is still intentionally left as a remaining gap in full projectile-semantics parity

Recent melee follow-up:

- a verification pass on `2026-05-03` found and then corrected a remaining mastery drift in [src/engine/systems/meleeDamage.ts](/D:/DungeonMaster-codex/src/engine/systems/meleeDamage.ts)
- the mastery proc now matches `DeterminePhysicalAttackDamage` and adds only `+10`

## Recommended Integration Order

1. Add a structured attack-type table to project data
2. Map creature descriptor `Attack Type` values to this table
3. Reconcile champion defense calculations with the documented factors
4. Keep engine/version bugs explicit rather than flattening them away

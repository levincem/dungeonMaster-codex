# Original Skills And Experience

## Goal

This document records the externally documented rules for skills, experience, level multipliers and champion growth in Dungeon Master and Chaos Strikes Back.

It also captures the documented distinctions between `Resurrect` and `Reincarnate`, which are directly relevant to the remake.

## Source Provenance

The supplied reference material documents:

- basic and hidden skills
- experience gain rules
- dungeon-level experience multipliers
- skill-level thresholds
- training pathways
- statistics growth
- resurrect / reincarnate behavior

## Skill Structure

The documented skill system includes:

- `4` basic skills:
  - Fighter
  - Ninja
  - Priest
  - Wizard
- `16` hidden skills:
  - Swing
  - Thrust
  - Club
  - Parry
  - Steal
  - Fight
  - Throw
  - Shoot
  - Identify
  - Heal
  - Influence
  - Defend
  - Fire
  - Air
  - Earth
  - Water

The relationship between hidden and basic skills is documented clearly enough to drive source-backed progression logic.

## Experience Rules

The supplied rules document:

- base experience gain from actions
- low-danger penalties
- danger bonuses
- dungeon-level multipliers
- the rule that hidden-skill XP is also added to the associated basic skill

This is enough to reconstruct a much more faithful XP/training model than a hand-tuned approximation.

## Level Thresholds

The documentation also provides the canonical doubling thresholds used by the original game.

This gives a source-backed basis for:

- skill names by level
- experience required per level
- how hidden/basic skill levels should be computed

## Statistics And Growth

The supplied material covers:

- Health
- Stamina
- Mana
- Load
- Strength
- Dexterity
- Wisdom
- Vitality
- Anti-Magic
- Anti-Fire
- Food and Water
- Luck

It also documents how statistics increase when a champion levels specific skills.

## Resurrect And Reincarnate

The reference material explicitly documents the difference between:

- `Resurrect`
- `Reincarnate`

This matters because the remake already exposes these choices and should align to the documented original behavior as closely as practical.

## What This Unlocks

This source is now strong enough to support a source-backed reconstruction of:

- skill trees and hidden/basic skill relations
- experience gain formulas
- level multipliers by dungeon depth
- action-to-skill training mapping
- champion stat growth by skill progression
- resurrect / reincarnate rules

## Practical Impact

After adding this source, the skills/experience domain should be viewed as:

- `documented strongly enough to integrate`
- `still requiring careful runtime mapping and version-choice decisions`

## Recommended Integration Order

1. Add a structured skill table with hidden/basic relationships
2. Add source-backed action XP metadata
3. Add documented level multipliers and level thresholds
4. Reconcile champion growth, load and mana/stamina recovery logic against the documented rules
5. Keep engine bugs and version-specific differences explicit where relevant

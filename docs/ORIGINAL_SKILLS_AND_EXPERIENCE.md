# Original Skills And Experience

## Goal

This document records the original `Dungeon Master` skill and experience system as it is now understood from both:

- the supplied encyclopaedia documentation
- the decompiled FTL runtime sources in `assets/OriginalDataExtraction/ReDMCSB/SOURCE/ENGINE`

The goal is not only to describe the level tables, but also to pin down where XP is granted, how it is scaled, and which original runtime fields actually matter.

Source hierarchy for this document:

- remake gameplay target: original `DM`, with PC DOS as the primary target version
- Atari ST: major cross-check source for original gameplay tables and close behavior confirmation
- `CSB`, `ReDMCSB`, `CSBwin`: technical evidence for the shared engine only, not a second gameplay target to reproduce

## Source Provenance

The current reconstruction rests on two complementary source families:

- documentation:
  - skill tree structure
  - level thresholds
  - dungeon-level multipliers
  - temporary XP
  - resurrect / reincarnate behavior
- original engine code:
  - `CHAMPION.C` for XP application, temporary XP gain, parent-skill feed and level-up stat growth
  - `GROUP2.C` for melee-hit XP and defensive `Parry` XP against creatures
  - `MENUS.C` for action XP, spell XP and special `Influence` awards
  - `SENSOR.C` for the rare local sensor-driven XP effect

## Skill Structure

The original skill tree contains:

- `4` basic skills:
  - `Fighter`
  - `Ninja`
  - `Priest`
  - `Wizard`
- `16` hidden skills:
  - `Swing`
  - `Thrust`
  - `Club`
  - `Parry`
  - `Steal`
  - `Fight`
  - `Throw`
  - `Shoot`
  - `Identify`
  - `Heal`
  - `Influence`
  - `Defend`
  - `Fire`
  - `Air`
  - `Earth`
  - `Water`

Parent linkage is the canonical original one:

- `Swing / Thrust / Club / Parry` -> `Fighter`
- `Steal / Fight / Throw / Shoot` -> `Ninja`
- `Identify / Heal / Influence / Defend` -> `Priest`
- `Fire / Air / Earth / Water` -> `Wizard`

## Core XP Pipeline

The master routine is `F304_apzz_CHAMPION_AddSkillExperience` in `CHAMPION.C`.

For any XP gain, the original runtime applies these rules in order:

1. If the trained skill is one of the hidden combat skills `Swing..Shoot` and no creature attack happened within the last `150` ticks, XP is halved.
2. If the current map has a difficulty multiplier, XP is multiplied by that map difficulty.
3. If the trained skill is one of the hidden combat skills `Swing..Shoot` and a creature attack happened within the last `25` ticks, XP is doubled.
4. Permanent XP is added to the trained skill.
5. If the trained skill is hidden, the same permanent XP is also added to its parent basic skill.
6. Temporary XP is increased by `clamp(1, experience >> 3, 100)` while the temporary bucket stays below `32000`.
7. Level-up checks compare the parent basic skill before and after the gain while ignoring:
   - temporary XP
   - equipment skill modifiers

This means the remake should treat:

- context bonuses / penalties as part of the core training pipeline, not as ad hoc combat logic
- parent basic skill feed as original behavior, not a convenience shortcut
- temporary XP as a real parallel training buffer, not just UI flavor

## Creature Combat XP

The original source makes an important distinction between a creature's legacy derived `exp`-like value and its real runtime `experienceClass`.

`experienceClass` is the source-backed combat-training coefficient from `i559`. It is used in the original engine as follows:

- when a champion lands a melee hit on a creature in `GROUP2.C`:
  - awarded XP = `((damage * creatureExperienceClass) >> 4) + 3`
- when a creature performs a melee attack against a champion in `GROUP2.C`:
  - the defending champion gains `Parry` XP equal to `creatureExperienceClass`
  - this happens before defense resolution, so the raised `Parry` level can matter immediately

Two consequences follow directly from the source:

- there is no separate party-shared "kill XP" pool
- `experienceClass` is not loot XP or bounty XP; it is a combat-training coefficient

## Action XP Outside Spellcasting

The original action pipeline in `MENUS.C` grants XP directly from the chosen action metadata.

That covers standard actions such as:

- melee actions through their selected hidden skill
- throw / shoot actions through their action table and runtime projectile path
- utility actions such as `Climb Down`

### Throw XP

Throwing also has an original special-case award in `CHAMPION.C`:

- base `Throw` XP = `8`
- `+4` if the thrown object is a weapon
- `+(kineticEnergy >> 2)` for weapon classes up to `Poison Dart`

This XP is awarded when the object is thrown, not on creature death.

### Influence Actions

`MENUS.C` also grants special `Influence` XP for fear/control-style actions:

- `War Cry` = `12`
- `Calm` = `35`
- `Brandish` = `30`
- `Blow Horn` = `20`
- `Confuse` = `45`

If the target resists or is immune to fear, that award is halved in the original runtime.

## Spell XP

Spell XP in `MENUS.C` is source-backed and formulaic.

For a spell with:

- `powerLevel` from the selected power rune (`Lo`..`Mon`)
- `requiredSkillLevel = baseDifficulty + powerLevel`

the original XP gain is:

`random(8) + (requiredSkillLevel << 4) + (((powerLevel - 1) * baseDifficulty) << 3) + requiredSkillLevel^2`

If the caster is below the required skill and the cast fails for lack of practice, the awarded XP is reduced to:

`spellXP >> missingSkillLevels`

So the original game does still reward failed low-skill casts, but with the expected downshift.

## Sensor-Driven XP

`SENSOR.C` contains one rare non-combat XP branch:

- local sensor effect `ADD_EXPERIENCE`
- it awards `Steal` XP = `300`
- if the sensor is leader-only, the full amount goes to the leader
- otherwise the amount is split across living party members

This is real engine behavior, not a documentation myth.

However, the extracted DM dungeon maps currently do not expose this effect in active use:

- regular local sensors in the extracted maps only use local payloads `0` or `1`
- the standard DM dungeon therefore does not currently appear to rely on local effect `10`

So this branch is part of the original ruleset, but not a known active blocker in the shipped DM map data.

## Level Thresholds, Temporary XP And Effective Levels

The documented doubling thresholds remain the source of truth for:

- visible skill names by level
- permanent XP required for each level
- temporary XP decay handling
- effective skill levels once equipment bonuses are applied

The runtime should therefore distinguish clearly between:

- permanent skill level
- temporary skill level contribution
- equipment-granted effective bonus levels

Only the first of these should trigger permanent level-up growth.

## Statistics And Level-Up Growth

The level-up branch in `CHAMPION.C` is now understood well enough to treat as source-backed:

- `Fighter` and `Ninja` primarily grow `Strength / Dexterity / Health / Stamina`
- `Priest` and `Wizard` grow `Wisdom / Mana / Anti-Magic / Health / Stamina`
- `Vitality` and `Anti-Fire` have their own parity-sensitive random rules

Important details from the original runtime:

- level-up growth is tied to the parent basic skill crossing a threshold
- `Anti-Fire` growth only lands on even basic-skill levels
- non-priest `Vitality` growth only lands on odd basic-skill levels
- mana growth differs between `Priest` and `Wizard`

## Resurrect And Reincarnate

The original distinction remains important:

- `Resurrect`
  - preserves the champion identity and skills
  - returns with reduced current vitals
- `Reincarnate`
  - resets skills
  - reduces core stats / maxima according to the original rules
  - redistributes the documented random rebuild bonuses

The `Vi Altar` path should therefore be treated as a genuine source-backed gameplay rule, not only as UI flavor.

## Runtime Status

The remake is now aligned on the main XP / progression rules that matter in play:

- hidden/basic skill relationships
- canonical level thresholds
- temporary XP gain and decay
- map-difficulty scaling
- stale-threat penalty and recent-threat bonus
- level-up stat growth
- source-backed spell XP
- source-backed action XP
- source-backed creature melee XP via `experienceClass`
- source-backed defensive `Parry` XP against creatures
- source-backed throw XP
- special `Influence` XP awards

The main remaining work in this domain is now:

- playtest validation over long campaigns
- version-specific differences where DM 1.2 / Amiga 2.0 diverges from earlier builds
- cleanup of legacy compatibility fields such as creature `exp`, which is not the same thing as original `experienceClass`

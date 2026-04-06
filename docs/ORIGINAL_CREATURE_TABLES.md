# Original Creature Tables

## Goal

This document records the creature-descriptor information now available from external reverse-engineering documentation of `graphics.dat item 559`.

It complements the local analysis already performed in this repository:

- local extraction remains strongest for dungeon structure, names, layout and render composition
- this document captures gameplay-relevant creature descriptors that are now known from original-data research

## Source Provenance

The supplied reference material states that the creature data comes from:

- creature descriptors in `graphics.dat item 559`

It also states that the table includes version variants and explicitly provides values for:

- Dungeon Master for PC `3.4 English`
- Dungeon Master for PC `3.4 English, French, German`

These are the variant values labelled `(d)` in the source notes.

## What This Table Gives Us Reliably

The creature descriptor table is much richer than the current hand-maintained creature runtime data.

It provides, for each creature:

- creature identity / view index
- attack sound ordinal
- floor size
- side-attack capability
- prefer-back-row flag
- attack-any-champion flag
- levitation
- non-material flag
- height
- drop-things flag
- keep-thrown-sharp-weapons flag
- see-invisible flag
- night-vision flag
- archenemy flag
- invisible-on-magic-map flag
- additional graphic-generation flags
- flip / side / back / attack aspect flags
- D2 front special handling flags
- horizontal/vertical offset amplitudes
- movement ticks
- attack ticks
- defense
- base health
- base attack
- poison attack
- dexterity
- sight / hear / smell / attack range
- fear resistance
- experience
- intelligence
- fire resistance
- poison resistance
- aspect update timing
- wound probabilities by body part
- attack type

## What This Changes For The Remake

This documentation means that the creature gameplay layer is no longer “fully unknown”.

The following fields currently maintained by hand in:

- [`src/data/creatures.ts`](/D:/DungeonMaster-codex/src/data/creatures.ts)

are now strongly documented by original-data research:

- base HP
- defense / armor-style resistance
- movement speed
- attack speed
- experience multiplier / reward base
- poison capability
- attack-type family
- various AI / sensory behavior flags

In practice, this is enough to move the creature domain from:

- `manual and speculative`

to:

- `documented externally, pending structured integration`

## Important Hardcoded Exceptions

The supplied reference also explicitly calls out abilities that are not in data tables and remain engine-hardcoded.

Confirmed example:

- the Giggler stealing items from champions' hands is hardcoded

This distinction matters because it prevents us from over-attributing behavior to the data tables.

## What Is Still Not Solved Automatically

Even with this documentation, some work remains before the remake can claim full source-backed creature behavior:

- the table still needs to be imported or transcribed into project-usable structured data
- PC binary extraction in this repository has still not isolated a native PC contiguous creature-gameplay block equivalent to Atari `I559`
- some runtime semantics still need interpretation:
  - how to map documented “Defense” exactly against the remake’s combat model
  - which version branch to choose when several values differ
  - which special-case behaviors remain engine-hardcoded rather than data-driven

## Version Strategy

Because the provided creature table includes explicit per-version forks, the recommended rule for this remake is:

- prefer the `(d)` values when present for PC `3.4`
- fall back to shared values when all branches are identical
- annotate any remaining uncertainty at the field level instead of flattening all variants silently

## Practical Impact

After this source is added, the creature-data situation should be viewed as:

- `identity, flags, timings, primary combat descriptors`: documented strongly enough to integrate
- `exact PC-native binary extraction`: still unresolved locally
- `engine-hardcoded special behaviors`: still separate from the descriptor tables

## Recommended Integration Order

1. Add a structured source-backed creature descriptor dataset to the project
2. Reconcile `src/data/creatures.ts` against the documented values, preferring PC `(d)` values
3. Mark hardcoded creature-only abilities separately from descriptor data
4. Keep the audit distinction between:
   - documented external table data
   - recovered local binary data
   - engine-hardcoded behavior

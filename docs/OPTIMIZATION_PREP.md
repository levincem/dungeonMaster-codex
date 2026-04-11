# Optimization Prep

Preparation notes before the optimization pass.

Version observed in code on `2026-04-11`.

## Objective

Reduce runtime weight and keep the codebase easy to debug, extend, and clean up while new gameplay fixes and options continue to land.

## Current signal

The production build passes, but Vite still warns about a very large `game-core` chunk.

After the first optimization pass on `2026-04-11`:

- `ChampionSheet` and `VictoryScreen` are lazy-loaded
- dungeon boot data is preloaded separately during the loading screen
- build output is now split more clearly into:
  - `game-data`
  - `game-core`
  - `dungeon-render`
  - `ChampionSheet`
  - `VictoryScreen`

Observed result after the current cleanup/chunk pass on `2026-04-11`:

- previous single `game-core`: about `12.0 MB`
- intermediate split:
  - `game-core`: about `8.3 MB`
  - `game-data`: about `3.7 MB`
- current split after isolating `src/data/*` and simplifying the core chunk:
  - `game-core`: about `3.1 kB`
  - `overlay-data`: about `8.2 MB`
  - `dungeon-blob`: about `5.7 MB`
  - `boot-data`: about `9.3 kB`
  - `world-data`: about `12.5 kB`
  - `item-data`: about `33.2 kB`
  - `magic-data`: about `16.5 kB`
  - `dungeon-render`: about `123 kB`
  - `game-db-blob`: about `330 kB`

After switching the runtime to a compact parser-derived dungeon snapshot:

- `dungeon-blob`: about `1.66 MB`
- `overlay-data`: about `8.19 MB`
- `game-db-blob`: about `330 kB`

After switching wall overlays to a compact parser-derived runtime snapshot:

- `overlay-data`: about `668 kB`
- `dungeon-blob`: about `1.66 MB`
- `game-db-blob`: about `330 kB`

After trimming the runtime dungeon snapshot to the fields actually consumed by the app:

- `dungeon-blob`: about `782 kB`
- `overlay-data`: about `668 kB`
- `game-db-blob`: about `330 kB`

So the architecture is clearer now:

- browser/runtime data and registries are isolated by role
- the old monolithic `game-core` is no longer the main weight
- the next real optimization targets are now the oversized extracted payloads
  - compact dungeon bootstrap data
  - remaining large runtime payloads (`dungeon-blob`, `three-vendor`)

At this stage, optimization should not be treated as "shrink everything at any cost". The better target is:

- clearer boundaries
- fewer giant always-loaded modules
- less duplicated glue
- a runtime that stays easy to inspect during future debugging

## Practical principles

### 1. Preserve gameplay readability first

Keep the gameplay rules obvious even if a micro-optimization looks tempting.

Good:

- split giant modules by responsibility
- move immutable lookup tables out of hot runtime code
- lazy-load big UI screens or large optional data bundles

Bad:

- clever abstractions that hide rules
- merging unrelated systems just to reduce imports
- premature memoization everywhere

### 2. Separate boot data from active simulation

The current runtime still mixes several categories:

- immutable extracted data
- derived lookup tables
- active simulation state
- rendering-only helpers

These should be kept as distinct as possible.

### 3. Optimize for future debugging

We will likely keep adjusting:

- rare mechanisms
- creature edge cases
- final-sequence behavior
- options / toggles / accessibility or convenience settings

So the optimization pass should make those easier, not harder.

## Recommended order

### Step 1. Audit bundle composition

Confirm what dominates `game-core`:

- embedded JSON payloads from `src/assets/data/`
- large runtime registries in `src/data/`
- `src/engine/store.ts`
- always-loaded 3D/UI code

Goal:

- identify the top 5 contributors before moving files around

### Step 2. Split by responsibility, not by file size only

Best candidates:

- extract store submodules from `src/engine/store.ts`
  - movement / spatial queries
  - item actions
  - spell casting
  - mechanisms
  - creature AI
  - persistence
- keep Zustand wiring in `store.ts`, move rule logic out

Goal:

- smaller files
- easier targeted debugging
- lower cognitive load

### Step 3. Isolate immutable data loaders

Large static datasets should be centralized behind stable accessors.

Good candidates:

- dungeon bootstrap data
- mechanisms lookup tables
- creature/item lookup registries
- overlay metadata

Goal:

- avoid re-importing huge modules in places that only need one helper

### Step 4. Lazy-load non-critical UI

Likely safe:

- title screen
- victory screen
- champion sheet subpanels if needed
- heavy visual-only layers that are not required at boot

Goal:

- keep initial runtime lighter without touching core gameplay

### Step 5. Introduce an options/config boundary

Before more feature work lands, add a clean home for future toggles:

- visual quality toggles
- optional convenience settings
- audio volume groups
- debug helpers

Goal:

- avoid scattering future options through engine code

## Structural target

One reasonable near-term direction:

```text
src/
  engine/
    store.ts
    systems/
      movement.ts
      mechanisms.ts
      spells.ts
      creatures.ts
      items.ts
      persistence.ts
    queries/
      mapQueries.ts
      sensorQueries.ts
      itemQueries.ts
  data/
    bootstrap/
    registries/
    assets/
  config/
    runtimeOptions.ts
```

This is not a mandatory tree, just the kind of separation that would help.

## Immediate low-risk wins

- break `src/engine/store.ts` into system helpers without changing behavior
- centralize repeated spatial and sensor queries
- isolate bundle-heavy data imports behind narrower modules
- lazy-load title/victory UI

Already done in this phase:

- extracted shared runtime types into `src/engine/runtimeTypes.ts`
- extracted persistence helpers into `src/engine/systems/persistence.ts`
- updated components to depend on runtime types directly instead of importing those types from `store.ts`
- split `src/data/*` into role-oriented chunks instead of one giant `game-data`
- isolated asset path helpers into a tiny shared `asset-runtime` chunk
- isolated wall overlay placements into `overlay-data`
- isolated dungeon and `game_db` payloads for clearer boot-time boundaries
- moved wall overlay payload access behind `src/data/originalWallOverlayData.ts` so gameplay modules no longer statically import the giant overlay JSON
- changed the runtime parser packaging so `src/assets/data/dungeon.json` is now a compact snapshot derived from the full extraction dump, cutting `dungeon-blob` from roughly `5.7 MB` to `1.66 MB`
- changed the runtime parser packaging so `src/assets/original_wall_overlay_positions.json` is now a compact snapshot derived from the full overlay export, cutting `overlay-data` from roughly `8.19 MB` to `668 kB`
- tightened the runtime dungeon snapshot further by removing unused map/tile/object fields, cutting `dungeon-blob` again from roughly `1.66 MB` to `782 kB`
- lazy-loaded the gameplay shell from `GameRoot` (`DungeonScene`, `HUD`, `MirrorPopup`) so the title path no longer eagerly pulls the active in-dungeon UI/render stack

## What not to do first

- do not rewrite the whole store architecture before measuring anything
- do not aggressively compress or externalize data if it hurts iteration speed
- do not mix optimization with another large gameplay rewrite in the same pass

## Suggested first optimization milestone

A good first milestone would be:

1. measure the largest contributors to `game-core`
2. extract store systems into smaller files without gameplay changes
3. rerun the build and compare chunk sizes

If that pass goes well, we can then choose whether the next lever is:

- more code splitting
- data loading changes
- render-layer optimization

## Recommended next step now

The next highest-value move is no longer "another random chunk rule".

It should be:

1. finish removing the legacy duplicated persistence block from `src/engine/store.ts`
2. split `src/engine/store.ts` into rule-oriented helpers
3. keep Zustand state wiring in `store.ts`
4. move large pure functions into `src/engine/systems/`

Best first extraction candidates:

- spell casting and projectile updates
- mechanism triggering and sensor queues
- creature AI tick logic
- item pickup / wall-use / inventory actions

## Recommended next step now

The next highest-value move is now:

1. reduce what must live inside `game-data`
2. identify which registries can be generated smaller or loaded more selectively
3. continue splitting pure gameplay helpers out of `store.ts`

Best next candidates:

- `src/data/items.ts`
- `src/data/runes.ts`
- `src/data/itemImages.ts`
- `src/data/originalSpells.ts`
- the remaining persistence block still duplicated in `src/engine/store.ts` and ready for final removal
- wall overlay loading if we want to lazy-load more visual-only data after boot
- a possible compact runtime snapshot derived from `dungeon.json`

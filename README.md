# Dungeon Master Codex

Remake / reinterpretation of *Dungeon Master* built with React, TypeScript, Vite, and React Three Fiber.

The project aims to rebuild the original game's exploration, champions, creatures, objects, spells, mechanisms, and dungeon data as faithfully as possible inside a modern and maintainable web codebase.

This is a non-commercial amateur project. Visuals are a mix of extracted references, remake assets, and some AI-assisted asset production. A significant part of the reverse-engineering and implementation workflow has been developed with LLM assistance, then checked, corrected, and refined inside the repository.

## Live Version

The current public build is available at [dungeon-master.fr](https://dungeon-master.fr/).

This is currently a desktop-first alpha. Smartphone play is explicitly blocked in the app.

Current local project version: `v0.6.0-alpha.0`.

## Credits

Thanks to:

The original team:

- Publisher: FTL Games
- Director: Doug Bell
- Producer: Wayne Holder
- Designer: Doug Bell
- Programmers: Doug Bell, Dennis Walker, Mike Newton
- Artist: Andrew Jaros
- Composer: Wayne Holder

The fans and preservation community:

- the [Dungeon Master community](https://www.dungeon-master.com/forum/)
- the [Dungeon Master Encyclopaedia](http://dmweb.free.fr/)
- the [ReDMCSB](https://github.com/gondur/ReDMCSB_Release2) project by Christophe Fontanel
- the Swoosh Construction Kit ecosystem and related reverse-engineering tools

## Current State

The project is now a serious playable alpha, well beyond prototype stage.

What is already in place:

- 3D dungeon exploration with original map layout and grid movement
- title flow with `Enter The Dungeon`, persisted `Resume`, and `Game Over` / victory screens
- champion recruitment through mirrors
- HUD, champion sheets, drag and drop inventory and equipment
- creatures, projectiles, melee and ranged combat, lighting, hunger, thirst, sleep, fountains, and water containers
- endgame path wired through Firestaff completion, Lord Chaos fusion, Grey Lord transition, and victory
- persistent save / resume of mutable runtime state, with integrity checks and automatic backup fallback
- in-game help, options modal, and movement key rebinding
- desktop-first UX, with smartphone play intentionally blocked

On the fidelity side, the project is now in a much stronger place than before:

- world content extraction is treated as reliable for the core dungeon content
- runtime data for champions, creatures, items, doors, spells, projectiles, and maps is primarily sourced from extracted original data
- most central gameplay logic that used to live as large local approximations in the store has been moved into smaller tested subsystems, and the Zustand store is now much closer to a composition/wiring layer than to a monolithic gameplay file
- the remaining party survival, fatigue, damage-deps, and step-transport wiring has also been pulled into dedicated store runtime modules, so the store is now mostly historical low-level helpers and local dependency assembly rather than action plumbing
- the world bootstrap and reserved-generator wrappers have also been pulled into a dedicated store runtime module, so initial creatures, floor items, open-map markers, and generator-spawn helpers are no longer initialized inline in the store
- the remaining pure champion helpers have also been split out into a dedicated runtime helper module, so vitals creation, clamps, mastery bonuses, stat relaxation, and related item fallback helpers no longer live inline in the store
- another historical `champion/combat state` cluster has also been moved into its own runtime helper module, so wounds, poison, stamina overflow, skill XP growth, and incoming-attack resolution wrappers no longer live inline in the store
- another `combat / projectile / item runtime` utility cluster has also been moved into its own runtime helper module, so cast checks, immediate projectile blockers, item charges, carried-item throws, and drop helpers no longer live inline in the store
- another `creature spatial / occupancy / line-of-sight` helper cluster has also been moved into its own runtime helper module, so runtime group ids, tile-capacity normalization, creature-cell sharing, and LOS checks no longer live inline in the store
- the remaining fresh-state bootstrap and small endgame helper cluster have also been moved into dedicated runtime modules, so the store can now be treated as a sane composition layer rather than an active cleanup hotspot
- generator data is decoded and integrated, with the main remaining uncertainty now concentrated on exact `GROUP/ACTIVE_GROUP` lifecycle semantics rather than raw generator parameters
- the runtime has been heavily cleaned up, so the main remaining risk is now gameplay validation and edge-case fidelity, not core maintainability

In short: this is already a playable alpha remake with a strong fidelity base, not a prototype and not just a data-recovery experiment anymore.

## What Still Needs Work

The largest remaining work is no longer finding core data. It is now concentrated in a few clear areas:

- long-form play validation, especially the full path from early game through Lord Chaos fusion
- targeted verification of rare late-game mechanisms, special creature behaviors, and combat/timing edge cases
- the last extraction and semantic gaps, especially around `0696.RAW1`
- the last structural fidelity gap around exact active-group semantics for creature generators
- optimization, especially around the still-heavy runtime/data chunks and the Three.js stack
- broader UX/options polish and newcomer onboarding
- localization remains partial: dictionaries exist, but locale switching is not yet exposed

So the project is close to a strong public alpha state, but not yet at a point where "100% extraction" or "100% original behavior" can honestly be claimed.

## Tech Stack

- React 19
- TypeScript
- Vite
- Three.js
- `@react-three/fiber`
- `@react-three/drei`
- Zustand

## Project Structure

```text
src/
  components/   Dungeon rendering and UI
  data/         Runtime data loaders, definitions and compatibility layers
  engine/       Store, rules, combat, interactions, persistence, options, sounds
  i18n/         Translation dictionaries and lightweight locale access
  types/        Shared types

public/
  game/images/                  Browser-served item, UI, portrait, sprite, and texture assets
  game/sounds/                  Browser-served audio assets
  graphics_*.json               Extraction/pipeline reference inputs
  original_*_runtime.json       Small active runtime/pipeline reference subset
  original_wall_overlay_positions.json
  favicon.png
  vite.svg

src/assets/data/
  dungeon.json                  Canonical compact runtime dungeon snapshot used at boot
  game_db.json                  Canonical runtime reference data used by modules
  original_creatures_runtime.json
  original_doors_runtime.json
  runtime_data_manifest.json    Runtime package manifest emitted by parse_full

assets/
  OriginalDataExtraction/       Reverse-engineering base, scripts, source references, audits
    output/                     Generated extraction and audit outputs
    reference_exports/          Archived/reference JSON exports no longer kept in public/

docs/
  PROJECT_STATE_INDEX.md        Recommended doc entry point for current project state
  FIDELITY_100_VERDICT.md       Honest summary of what can and cannot be claimed yet
  FIDELITY_REMAINING_MATRIX.md  Remaining open extraction/runtime/fidelity gaps
  GENERATOR_ALIGNMENT_NOTES.md  Focused notes on generator decoding vs runtime behavior
  REMAKE_STATUS.md              Global project status and system-by-system audit
  RUNTIME_ALIGNMENT_AUDIT.md    Source-data vs runtime integration notes
  CODEBASE_REFERENCE.md         Codebase map
  DATA_PIPELINE.md              Extraction vs runtime packaging flow
```

## Data Sources

The runtime now relies primarily on reconstructed data mirrored into `src/assets/data/` for critical boot-time modules.

For the main extracted runtime datasets, `src/assets/data/` is the canonical runtime location, while `assets/OriginalDataExtraction/output/` remains the extraction and audit output area.

For `dungeon.json`:

- `assets/OriginalDataExtraction/output/dungeon.json` is the full extraction / audit dump
- `assets/OriginalDataExtraction/output/runtime_dungeon.json` is the compact runtime snapshot generated from it
- `src/assets/data/dungeon.json` is the canonical runtime copy consumed by the app

For wall overlays:

- `public/original_wall_overlay_positions.json` remains the full extracted / reference export
- `assets/OriginalDataExtraction/output/runtime_wall_overlay_positions.json` is the compact runtime snapshot used for the app
- `src/assets/original_wall_overlay_positions.json` is the canonical runtime copy consumed by the app

The reverse-engineering and provenance work lives under:

- [assets/OriginalDataExtraction](assets/OriginalDataExtraction)

That directory contains:

- original source material kept for reference
- extraction and audit scripts
- generated comparison outputs
- notes explaining what is proven, derived, or still interpretive

The most useful project-memory and audit docs are:

- [docs/PROJECT_STATE_INDEX.md](docs/PROJECT_STATE_INDEX.md)
- [docs/NEXT_PHASE_PLAN.md](docs/NEXT_PHASE_PLAN.md)
- [docs/FIDELITY_100_VERDICT.md](docs/FIDELITY_100_VERDICT.md)
- [docs/FIDELITY_REMAINING_MATRIX.md](docs/FIDELITY_REMAINING_MATRIX.md)
- [docs/GENERATOR_ALIGNMENT_NOTES.md](docs/GENERATOR_ALIGNMENT_NOTES.md)
- [docs/REMAKE_STATUS.md](docs/REMAKE_STATUS.md)
- [docs/RUNTIME_ALIGNMENT_AUDIT.md](docs/RUNTIME_ALIGNMENT_AUDIT.md)
- [docs/CODEBASE_REFERENCE.md](docs/CODEBASE_REFERENCE.md)
- [docs/DATA_PIPELINE.md](docs/DATA_PIPELINE.md)

## Notes

- The project should currently be treated as a playable alpha, not a finished remake.
- The production build passes, and the app boots correctly from the runtime data embedded in `src/assets/data/`.
- Latest local validation recorded on `2026-04-18`: `npm.cmd run build` passes, and `npm.cmd test` passes with `515` tests.
- The world-content extraction is now considered reliable enough that the remaining uncertainty is mostly about fidelity edge cases, not about missing core dungeon content.
- The central runtime has been heavily refactored into smaller tested subsystems, so code clarity and maintainability are in a much better place than earlier alpha builds.
- The main heavy runtime payloads are still the compact dungeon snapshot, wall overlay data, and the core Three.js stack.
- The next major phase is a mix of long-form playtesting, targeted fidelity verification, and optimization.
- Remade visuals are preferred when available; extracted original bitmaps remain as placeholders or fallback art where necessary.
- `docs/` acts as the project's memory and audit trail; the README is intentionally the shorter public-facing overview.

## Legal / Intent

This project is a technical and creative tribute to *Dungeon Master*. It is intended as a non-commercial reconstruction and study project, not as an official product.

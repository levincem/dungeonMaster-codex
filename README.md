# Dungeon Master Codex

Remake / reinterpretation of *Dungeon Master* built with React, TypeScript, Vite, and React Three Fiber.

The goal is to rebuild the original game's exploration, champions, creatures, objects, spells, mechanisms, and dungeon data as faithfully as possible inside a modern and maintainable web codebase.

This is a non-commercial amateur project. The visuals are a mix of extracted references and AI-assisted asset production. A significant part of the reverse-engineering and implementation workflow has been developed with LLM assistance, then checked and refined inside the repository.

Improving graphics, including images of items on the ground and in the inventory, as well as monster sprites with more frames, is a potential area for development.

## Live Version

The current public build is available at [dungeon-master.fr](https://dungeon-master.fr/).

This is currently a desktop-first alpha. Smartphone play is explicitly blocked in the app.

Current local project version: `v0.5.0-alpha.2`.

## Current State

The project is now well beyond prototype stage and already playable through a substantial part of the original loop:

- 3D dungeon exploration with grid movement and original map data
- title screen with `Enter The Dungeon` and persisted `Resume`
- champion recruitment through mirrors
- HUD, detailed champion sheets, drag and drop inventory and equipment
- creatures, projectiles, combat, lighting, hunger, thirst, sleep, water containers, fountains
- original wall overlays positioned from extracted dungeon data
- runtime data for champions, creatures, items, doors, spells, projectiles and maps sourced primarily from extracted original data
- wall mechanisms substantially reworked: switches, pressure plates, locks, alcoves, receptacles, delayed sensors and wall item usage
- button doors now share one global rendering model: variable door material, one narrow jamb, and the original `wall_switch` image anchored on the player-facing side of that jamb
- creature AI substantially revised: open-door traversal, pursuit memory, ranged spacing, teleporter usage, invisibility handling, missile absorption, sight-range driven detection
- upgraded spell visuals: better projectile identities, impacts, local flashes, shields and `Fluxcage`
- pits are now rendered as visible openings and can trigger party falls to the matching tile below
- endgame path wired through Firestaff completion, Lord Chaos fusion, Grey Lord transition, and victory screen
- dedicated `Game Over` screen with manual return to title
- floor creature generators restored from source-backed runtime data
- generator configs now come from decoded extracted data, including spawn tile, raw count, randomized count flag, hp multiplier and disable timing
- generator saturation is now derived from explicit runtime group records (`alive` / `reserved`) instead of only implicit string counting
- new generator activations and already-reserved generator retries no longer reuse the same capacity gate
- reserved generator retries can now resolve within the total `60`-group budget instead of being re-blocked by the stricter `55`-group new-spawn margin
- distinct delayed reservations from the same generator are no longer collapsed into a single pending retry entry
- creature groups now use true runtime subcells (`frontLeft`, `frontRight`, `backLeft`, `backRight`) instead of a simple `left/right` fallback
- distinct creature groups no longer merge onto the same tile just because they share the same creature family
- creatures from the same local runtime group now reuse a shared movement plan during a monster tick instead of drifting apart from independent movement rolls
- lone creatures are now rendered centered on their tile when they occupy it alone
- persistent save / resume of the mutable runtime state
- save integrity checks plus automatic backup fallback
- in-game options modal with movement key rebinding
- blocking alpha welcome modal and tabbed in-game player guide available in-game
- simple `i18n` layer present with English as the default locale
- sleep now runs as a continuous accelerated state instead of a single large fast-forward step
- GA4 game-session events are instrumented for SPA play tracking (`game_start`, `game_resume`, `game_heartbeat`, `game_end`, `game_victory`)

It is not a finished remake yet. The largest remaining work is no longer core data recovery, but long-form play validation, the last fidelity gaps, and targeted optimization.

Current save/load behavior:

- the save button in the champion sheet writes the current mutable runtime state
- `Resume` reloads the latest persisted save
- time does not continue to elapse while the game is closed; a loaded save resumes from the exact saved state

## What Still Needs Work

Main remaining gaps before calling the runtime "fully aligned":

- `0696.RAW1` is still not semantically decoded at 100%
- creature generators still have one important structural approximation:
  - runtime generator parameters are decoded
  - the remaining uncertainty is now mostly about exact FTL `GROUP/ACTIVE_GROUP` lifecycle semantics, especially the `active / dormant` boundary
- the full path still needs a targeted long playtest from `Zokathra` through Lord Chaos fusion
- some rare late-game or edge-case mechanism interactions still need targeted play verification
- some combat damage and timing edge cases still need targeted confirmation against original references
- creature AI still has fine-grained fidelity gaps for special families and end-game cases
- some item-image aliases and other compatibility glue remain manual by design
- optimization is now the next major phase, especially around the remaining large runtime/data chunks
- broader options coverage beyond movement rebinding is still future work
- save import/export is still a future convenience feature; saves currently live in browser `localStorage`
- localization is only partially implemented:
  - translation dictionaries exist, but locale switching is not exposed yet
  - the current build still keeps original English game text as the main in-world language

## Tech Stack

- React 19
- TypeScript
- Vite
- Three.js
- `@react-three/fiber`
- `@react-three/drei`
- Zustand

## Running The Project

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

The production build passes as of this update (`2026-04-17`).

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

For the main extracted runtime datasets, `src/assets/data/` is now the canonical runtime location, while `assets/OriginalDataExtraction/output/` remains the extraction/audit output area.

For `dungeon.json` specifically:

- `assets/OriginalDataExtraction/output/dungeon.json` is the full extraction/audit dump
- `assets/OriginalDataExtraction/output/runtime_dungeon.json` is the compact runtime snapshot generated from it
- `src/assets/data/dungeon.json` is the canonical runtime copy actually consumed by the app

For wall overlays:

- `public/original_wall_overlay_positions.json` remains the full extracted/reference export
- `assets/OriginalDataExtraction/output/runtime_wall_overlay_positions.json` is the compact runtime snapshot used for the app
- `src/assets/original_wall_overlay_positions.json` is the canonical runtime copy actually consumed by the app

The reverse-engineering and provenance work lives under:

- [assets/OriginalDataExtraction](assets/OriginalDataExtraction)

That directory contains:

- original source material kept for reference
- extraction and audit scripts
- generated comparison outputs
- notes explaining what is proven, derived, or still interpretive

The most useful detailed internal summaries are:

- [docs/PROJECT_STATE_INDEX.md](docs/PROJECT_STATE_INDEX.md)
- [docs/NEXT_PHASE_PLAN.md](docs/NEXT_PHASE_PLAN.md)
- [docs/FIDELITY_100_VERDICT.md](docs/FIDELITY_100_VERDICT.md)
- [docs/FIDELITY_REMAINING_MATRIX.md](docs/FIDELITY_REMAINING_MATRIX.md)
- [docs/GENERATOR_ALIGNMENT_NOTES.md](docs/GENERATOR_ALIGNMENT_NOTES.md)
- [docs/REMAKE_STATUS.md](docs/REMAKE_STATUS.md)
- [docs/RUNTIME_ALIGNMENT_AUDIT.md](docs/RUNTIME_ALIGNMENT_AUDIT.md)
- [docs/CODEBASE_REFERENCE.md](docs/CODEBASE_REFERENCE.md)
- [docs/DATA_PIPELINE.md](docs/DATA_PIPELINE.md)
- [docs/PUBLIC_DIRECTORY_AUDIT.md](docs/PUBLIC_DIRECTORY_AUDIT.md)
- [docs/ACTIVE_IMAGE_PLACEHOLDERS.md](docs/ACTIVE_IMAGE_PLACEHOLDERS.md)
- [docs/STATS_PROVENANCE.md](docs/STATS_PROVENANCE.md)
- [docs/ATARI_STATS_RECONCILIATION.md](docs/ATARI_STATS_RECONCILIATION.md)
- [docs/WORLD_CONTENT_AUDIT.md](docs/WORLD_CONTENT_AUDIT.md)

## Notes

- The production build currently passes.
- `npm run preview` boots correctly with the dungeon data embedded in `src/assets/data/dungeon.json`.
- The app blocks smartphone play and remains desktop-first.
- The HUD debug line now distinguishes global and local map coordinates, for example `front [g:x,y / l:x,y]`; gameplay reports should prefer the local `l:` coordinate when discussing extracted map data.
- The bundle is still heavy because of the 3D stack, assets, and embedded critical JSON datasets.
- The main remaining heavy runtime payloads are now the compact dungeon snapshot, wall-overlay data, and the core Three.js stack.
- The next major phase is long-form playtesting plus targeted optimization, especially around data loading strategy.
- The project should currently be treated as a playable alpha rather than a finished remake.
- The world-content extraction is now treated as reliable.
- The central runtime has now been heavily refactored into smaller tested subsystems, so most remaining risk is gameplay validation rather than core maintainability.
- The largest remaining structural runtime gap is around exact active-group semantics for creature generators, not basic generator-data decoding.
- Remade project visuals are always preferred when available; extracted original bitmaps are kept only as placeholders / fallback art.
- `docs/` is used as project memory and audit notes; the README stays intentionally concise.

## Credits

Thanks to:

The original team : 

- Publishers : FTL Games
- Director : Doug Bell
- Producer : Wayne Holder
- Designer : Doug Bell
- Programmers : Doug Bell, Dennis Walker, Mike Newton
- Artist : Andrew Jaros
- Composer : Wayne Holder


The Fans : 

- the [Dungeon Master community](https://www.dungeon-master.com/forum/)
- the [Dungeon Master Encyclopaedia](http://dmweb.free.fr/)
- the [ReDMCSB](https://github.com/gondur/ReDMCSB_Release2) project by Christophe Fontanel
- the Swoosh Construction Kit ecosystem and related reverse-engineering tools

## Legal / Intent

This project is a technical and creative tribute to *Dungeon Master*. It is intended as a non-commercial reconstruction and study project, not as an official product.

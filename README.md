# Dungeon Master Codex

Remake / reinterpretation of *Dungeon Master* built with React, TypeScript, Vite, and React Three Fiber.

The project aims to rebuild the original game's exploration, champions, spells, items, creatures, mechanisms, and data fidelity in a modern web codebase that stays inspectable and maintainable.

This is a non-commercial amateur project. The visuals are a mix of hand-made work, extracted references, and AI-assisted asset production. A significant part of the code and reverse-engineering workflow has been developed with LLM assistance, then checked and refined inside the repository.

## Current State

The project is already playable and includes a substantial part of the core runtime:

- 3D dungeon exploration with grid-based movement
- title screen flow with dungeon entrance, `Enter The Dungeon`, and `Resume`
- champion recruitment through mirrors
- HUD and detailed champion sheets
- inventory, equipment, drag and drop, pickup and drop
- creatures, projectiles, combat, and dungeon lighting
- spells and a growing set of original mechanisms
- hunger and thirst with water containers and fountains
- original wall overlays positioned from extracted data
- maps and runtime content loaded from reconstructed original data
- canonical starter equipment for champions
- multi-attack HUD flow for weapons with more than one action
- persistent save / resume of the mutable game state

It is not a finished remake yet. Some special-case mechanics, final balancing, broader game-flow polish, and part of the remaining artwork still need work.

Current save/load behavior:

- `SAVE` writes the current mutable runtime state
- `MENU` returns to the title screen
- `Resume` reloads the latest persisted save
- time does not continue to elapse while the game is closed; a loaded save resumes from the exact saved state

The important shift is that the project is no longer mainly blocked by missing original data. Most of the core original data we needed is now extracted and documented; the main work left is integrating it faithfully into the runtime.

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

Le build de production passe a nouveau a la date de cette mise a jour (`2026-04-09`).

## Project Structure

```text
src/
  components/   Dungeon rendering and UI
  data/         Runtime data loaders and definitions
  engine/       Store, rules, combat, interactions, sounds
  types/        Shared types

public/
  dungeon.json                  Reconstructed dungeon runtime data
  game_db.json                  Remake-facing gameplay/reference database
  original_*.json               Extracted original reference tables

assets/
  OriginalDataExtraction/       Reverse-engineering base, scripts, source references, audits

docs/
  REMAKE_STATUS.md              Internal running status / alignment notes
  CODEBASE_REFERENCE.md         Codebase map
  *_EXTRACTION.md               Original-data extraction notes
```

## Working Rules

- We do not leave a work session with a broken build without explicitly calling it out.
- After each major change, `README.md` and the relevant files under `docs/` must be updated to match the actual project state.

## Data Sources

The runtime now relies primarily on reconstructed data under `public/`, not on the old placeholder level files.

The reverse-engineering and provenance work lives under:

- [assets/OriginalDataExtraction](/D:/DungeonMaster-codex/assets/OriginalDataExtraction)

That directory contains:

- original source material kept for reference
- extraction and audit scripts
- generated comparison outputs
- notes explaining what is proven, derived, or still interpretive

The most useful detailed internal summaries are:

- [docs/REMAKE_STATUS.md](/D:/DungeonMaster-codex/docs/REMAKE_STATUS.md)
- [docs/RUNTIME_ALIGNMENT_AUDIT.md](/D:/DungeonMaster-codex/docs/RUNTIME_ALIGNMENT_AUDIT.md)
- [docs/STATS_PROVENANCE.md](/D:/DungeonMaster-codex/docs/STATS_PROVENANCE.md)
- [docs/ATARI_STATS_RECONCILIATION.md](/D:/DungeonMaster-codex/docs/ATARI_STATS_RECONCILIATION.md)
- [docs/WORLD_CONTENT_AUDIT.md](/D:/DungeonMaster-codex/docs/WORLD_CONTENT_AUDIT.md)

## Notes

- The production build currently passes.
- The bundle is still fairly heavy because of the 3D stack and game assets.
- The world-content extraction is now treated as reliable.
- Some gameplay layers are already reconciled with original Atari data, while part of the runtime still remains an interpretation layer that is being reduced over time.
- `docs/` is mainly used as detailed project memory and implementation notes; the README should stay as the concise project-facing overview.

## Credits

Thanks to:

- Doug Bell, Mike Newton, Dennis Walker, Andy Jaros, Wayne Holder, Nancy Holder, Tsukasa Tawada
- FTL Games
- the [Dungeon Master community](https://www.dungeon-master.com/forum/)
- the [Dungeon Master Encyclopaedia](http://dmweb.free.fr/)
- the [ReDMCSB](https://github.com/gondur/ReDMCSB_Release2) project by Christophe Fontanel
- the Swoosh Construction Kit ecosystem and related reverse-engineering tools

## Legal / Intent

This project is a technical and creative tribute to *Dungeon Master*. It is intended as a non-commercial reconstruction and study project, not as an official product.

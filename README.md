# Dungeon Master Codex

Remake / reinterpretation of *Dungeon Master* built with React, TypeScript, Vite, and React Three Fiber.

The project aims to rebuild the original game's exploration, champions, spells, items, creatures, mechanisms, and data fidelity in a modern web codebase that stays inspectable and maintainable.

This is a non-commercial amateur project. The visuals are a mix of hand-made work, extracted references, and AI-assisted asset production. A significant part of the code and reverse-engineering workflow has been developed with LLM assistance, then checked and refined inside the repository.

## Current State

The project is already playable and includes a substantial part of the core runtime:

- 3D dungeon exploration with grid-based movement
- champion recruitment through mirrors
- HUD and detailed champion sheets
- inventory, equipment, drag and drop, pickup and drop
- creatures, projectiles, combat, and dungeon lighting
- spells and a growing set of original mechanisms
- hunger and thirst with water containers and fountains
- original wall overlays positioned from extracted data
- maps and runtime content loaded from reconstructed original data

It is not a finished remake yet. Save/load, full game flow, some special-case mechanics, final balancing, and part of the remaining artwork still need work.

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
  REMAKE_STATUS.md              High-level project state
  CODEBASE_REFERENCE.md         Codebase map
  *_EXTRACTION.md               Original-data extraction notes
```

## Data Sources

The runtime now relies primarily on reconstructed data under `public/`, not on the old placeholder level files.

The reverse-engineering and provenance work lives under:

- [assets/OriginalDataExtraction](/D:/DungeonMaster-codex/assets/OriginalDataExtraction)

That directory contains:

- original source material kept for reference
- extraction and audit scripts
- generated comparison outputs
- notes explaining what is proven, derived, or still interpretive

The most useful project-level summaries are:

- [docs/REMAKE_STATUS.md](/D:/DungeonMaster-codex/docs/REMAKE_STATUS.md)
- [docs/STATS_PROVENANCE.md](/D:/DungeonMaster-codex/docs/STATS_PROVENANCE.md)
- [docs/ATARI_STATS_RECONCILIATION.md](/D:/DungeonMaster-codex/docs/ATARI_STATS_RECONCILIATION.md)

## Notes

- The production build is valid.
- The bundle is still fairly heavy because of the 3D stack and game assets.
- Some gameplay numbers are already reconciled with original Atari data, while a few remake-facing interpretations still remain on top.

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

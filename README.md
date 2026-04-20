# Dungeon Master Codex

Modern remake / reinterpretation of *Dungeon Master* built with React, TypeScript, Vite, and React Three Fiber.

Goal: rebuild the original dungeon, systems, and feel as faithfully as possible while keeping the runtime and codebase maintainable.

Live build: [dungeon-master.fr](https://dungeon-master.fr/)

Current local version: `v0.6.0-alpha.1`

## Status

This is a desktop-first alpha.

Already in place:

- 3D dungeon exploration with original map layout and grid movement
- champion recruitment, inventory, equipment, HUD, champion sheets, drag and drop
- creatures, melee/ranged combat, projectiles, spells, lighting, hunger, thirst, sleep
- doors, pits, teleporters, fountains, wall interactions, mirrors, altars
- save / resume of mutable runtime state
- endgame path through Firestaff completion, Lord Chaos fusion, and victory

Still open:

- targeted play validation from early game to endgame
- rare mechanism and timing edge-case checks
- label / UX cleanup
- performance work, especially around dev cold start and the Three.js stack

## Run Locally

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm test
npm run build
```

## Project Layout

```text
src/
  components/   UI and dungeon rendering
  data/         Runtime data loaders and gameplay-facing reference helpers
  engine/       Rules, runtime systems, store wiring, persistence, sounds
  i18n/         Translation dictionaries
  types/        Shared types

src/assets/runtime/
  dungeon/      Runtime bootstrap + one map file per level
  db/           Runtime game_db slices
  support/      Runtime support data such as wall overlays

assets/OriginalDataExtraction/
  sourceCode/   Original-source references
  output/       Generated extraction and audit outputs
  scripts/      Extraction and comparison tooling

docs/
  PROJECT_STATE_INDEX.md   Which doc answers which question
  NEXT_PHASE_PLAN.md       Current open work only
  REMAKE_STATUS.md         Compact project memory
```

## Docs

- [docs/PROJECT_STATE_INDEX.md](/D:/DungeonMaster-codex/docs/PROJECT_STATE_INDEX.md)
- [docs/NEXT_PHASE_PLAN.md](/D:/DungeonMaster-codex/docs/NEXT_PHASE_PLAN.md)
- [docs/REMAKE_STATUS.md](/D:/DungeonMaster-codex/docs/REMAKE_STATUS.md)

## Credits

Original game:

- FTL Games
- Doug Bell
- Wayne Holder
- Dennis Walker
- Mike Newton
- Andrew Jaros

Preservation / reverse-engineering references:

- the [Dungeon Master community](https://www.dungeon-master.com/forum/)
- the [Dungeon Master Encyclopaedia](http://dmweb.free.fr/)
- the [ReDMCSB](https://github.com/gondur/ReDMCSB_Release2) project by Christophe Fontanel

## Intent

This is a non-commercial tribute, reconstruction, and study project. It is not an official product.

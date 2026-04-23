# Dungeon Master Codex

Modern remake / reinterpretation of *Dungeon Master* built with React, TypeScript, Vite, and React Three Fiber.

Goal: rebuild the original dungeon, systems, and feel as faithfully as possible while keeping the runtime and codebase maintainable.

Live build: [dungeon-master.fr](https://dungeon-master.fr/)

Current local version: `v0.7.0-beta.0`

## Status

This is now a desktop-first beta focused on gameplay validation from the early dungeon through endgame, while keeping PC DOS fidelity first and presentation polish second.

Already in place:

- 3D dungeon exploration with original map layout and grid movement
- champion recruitment, inventory, equipment, HUD, champion sheets, drag and drop
- creatures, melee/ranged combat, projectiles, spells, lighting, hunger, thirst, sleep
- doors, pits, teleporters, fountains, wall interactions, mirrors, altars
- save / resume of mutable runtime state
- endgame path through Firestaff completion, Lord Chaos fusion, and victory

Still open:

- targeted play validation from early game to endgame
- rare mechanisms, transitions, and timing edge-case checks
- a smaller pass of UX and visual polish
- selective performance work where long play sessions show real pain

Before a release candidate:

- replay the remaining generator / transition / endgame cases
- confirm the last presentation edge cases around occupied tiles and pickups
- keep fixing only issues found in real play, not by reopening solved subsystems

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

## Intent

This is a non-commercial tribute, reconstruction, and study project. It is not an official product.

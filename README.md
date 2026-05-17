# Dungeon Master Codex

Modern remake / reinterpretation of *Dungeon Master* built with React, TypeScript, Vite, and React Three Fiber.

Goal: rebuild the original dungeon, systems, and feel as faithfully as possible while keeping the runtime and codebase maintainable.

Live build: [dungeon-master.fr](https://dungeon-master.fr/)

Current local version: `v0.9.2`

## Status

This is now a desktop-first `0.9.2` public build focused on selective polish, lightweight stabilization, and keeping PC DOS fidelity first.

Latest `v0.9.2` focus:

- final targeted play validation is considered closed, with two testers reaching both endings and rechecking generators, transitions, teleporters, and pits
- shared `Hall of Fame` is now live through a lightweight Node.js + Apache VPS pipeline, with API fallback to local storage
- run stats, run identity, hover details, and title-screen access to the `Hall of Fame` are now wired end to end
- spell visuals and late-game effects were polished further, including `Fluxcage`, `Lightning`, poison families, and shared creature/player spell scaling
- title screen and options UI were refreshed, including localized language switching, a random title-screen creature panel, and a fully localized quick tutorial flow

Already in place:

- 3D dungeon exploration with original map layout and grid movement
- champion recruitment, inventory, equipment, HUD, champion sheets, drag and drop
- creatures, melee/ranged combat, projectiles, spells, lighting, hunger, thirst, sleep
- doors, pits, teleporters, fountains, wall interactions, mirrors, altars
- save / resume of mutable runtime state
- endgame path through Firestaff completion, Lord Chaos fusion, and victory

Still open:

- a smaller pass of UX and visual polish
- quick cross-browser / desktop-size verification for the end screens and shared `Hall of Fame`
- selective performance work only if long play sessions show real pain

Next useful priorities:

- keep fixing only issues found in real play, not by reopening solved subsystems
- treat profiling as optional unless a measured runtime pain point reappears

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
  RC_FINISH_PLAN.md        Short finish plan for the current 0.9.x stabilization pass
```

## Docs

- [docs/PROJECT_STATE_INDEX.md](/D:/DungeonMaster-codex/docs/PROJECT_STATE_INDEX.md)
- [docs/NEXT_PHASE_PLAN.md](/D:/DungeonMaster-codex/docs/NEXT_PHASE_PLAN.md)
- [docs/REMAKE_STATUS.md](/D:/DungeonMaster-codex/docs/REMAKE_STATUS.md)
- [docs/RC_FINISH_PLAN.md](/D:/DungeonMaster-codex/docs/RC_FINISH_PLAN.md)

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

Playtesting help:

- [Hydro338](https://github.com/Hydro338) for playtesting, bug reports, and ongoing feedback

## Intent

This is a non-commercial tribute, reconstruction, and study project. It is not an official product.

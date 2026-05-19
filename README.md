# Dungeon Master Codex

Modern remake / reinterpretation of *Dungeon Master* built with React, TypeScript, Vite, and React Three Fiber.

Goal: rebuild the original dungeon, systems, and feel as faithfully as possible while keeping the runtime and codebase maintainable.

Live build: [dungeon-master.fr](https://dungeon-master.fr/)

Current local version: `v0.9.4`

## Status

This is now a desktop-first `0.9.4` public build focused on late stabilization, Hall of Fame hardening, and fidelity fixes that tighten the original rules without reopening the core runtime.

Latest `v0.9.4` focus:

- shared `Hall of Fame` flow was stabilized across client and VPS, with better validation diagnostics, canonical proof signatures, saner long-run acceptance, and cleaner submission UX
- victory stats and `Hall of Fame` presentation were improved, including compact formatting for large counters, clearer confirmation flow, and title-screen access to detailed shared runs
- `Hall of Fame` run inspection now opens a proper detailed stats view on click instead of relying on hover-only summaries
- original magic rules were tightened further: rune mana is now spent on click with no refund on cancel, and rune mana tables were rechecked against original sources
- charge-bearing items and `Magical Boxes` were recaled closer to original behavior, including proper depletion or consumption and clearer empty-state feedback
- run stats are now more reliable and readable, with cleaner per-spell labels and better per-creature tracking for new runs

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

- [Project state index](docs/PROJECT_STATE_INDEX.md)
- [Next phase plan](docs/NEXT_PHASE_PLAN.md)
- [Remake status](docs/REMAKE_STATUS.md)
- [0.9.x finish plan](docs/RC_FINISH_PLAN.md)

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

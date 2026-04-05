# Dungeon Master Codex

A remake / reinterpretation of *Dungeon Master* built with React, TypeScript, Vite, and React Three Fiber.

The goal of this project is to recreate dungeon exploration, champions, spells, items, and mechanisms from the original game while keeping a modern codebase that is easier to evolve and maintain.

Note: I am neither a professional artist nor a professional game developer (my background is PHP / JavaScript development and server administration). This is a non-commercial amateur project. The graphics are generated with DALL-E / ChatGPT. A large part of the codebase has been written with Claude 4.6 and GPT-4.5.

## Project Status

The project is already playable and includes a substantial part of the core systems:

- 3D dungeon exploration
- grid-based party movement
- champion recruitment
- HUD and character sheets
- inventory, equipment, item drop and pickup systems
- creatures, combat, and projectiles
- spells, lighting effects, and dungeon mechanisms
- loading historical data from `Old_data`

Some content and systems still need refinement.

## Tech Stack

- React
- TypeScript
- Vite
- Three.js
- `@react-three/fiber`
- `@react-three/drei`
- Zustand

## Running the Project

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
  components/
    Dungeon/     3D scene, tiles, creatures, items, decals
    UI/          HUD, screens, mirror popup, champion sheet
  data/          Game data, loaders, definitions
  engine/        Zustand store, global logic, sounds, constants
  types/         Shared types

Old_data/
  dungeon.json
  game_db.json
  mechanisms.json
```

## Source Data

The project relies on data from `Old_data/`, especially:

- `dungeon.json` for maps, object placement, and tile content
- `game_db.json` for runes, spells, items, and various references
- `mechanisms.json` for dungeon mechanisms

These files are used as a foundation to rebuild the original game's behavior in a modern web architecture.

## Development Notes

- The main bundle is still relatively large because of dungeon data and the 3D stack.
- The TypeScript build is currently valid.
- The full Vite production build also works in an environment that allows the required subprocess execution.

## Possible Roadmap

- improve bundle splitting further
- continue visual polish for the dungeon
- complete missing interactions, effects, and behaviors
- expand the project's technical documentation

## Credits

- To the creators of the original game: Doug Bell, Mike Newton, Dennis Walker, Andy Jaros, Wayne Holder, Nancy Holder, Tsukasa Tawada
- To FTL Games
- To the Dungeon Master community
- To the [Dungeon Master Encyclopaedia](http://dmweb.free.fr/)
- To the [ReDMCSB](https://github.com/gondur/ReDMCSB_Release2) project by Christophe Fontanel

## Note

This project is a technical and creative tribute to *Dungeon Master*. It aims to preserve the spirit of the original game while adapting it to a modern web implementation.

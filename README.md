# Dungeon Master Codex

Remake / reinterpretation de *Dungeon Master* avec React, TypeScript, Vite et React Three Fiber.

Le projet vise a recreer l'exploration du donjon, les champions, les sorts, les objets et les mecanismes du jeu original, tout en gardant une base de code moderne et facile a faire evoluer.

## Etat du projet

Le projet est jouable et comprend deja une partie importante des systemes principaux :

- exploration 3D du donjon
- deplacement du groupe en case par case
- recrutement des champions
- interface HUD et fiches de personnages
- inventaire, equipement, depot et ramassage d'objets
- creatures, combats et projectiles
- sorts, effets lumineux et mecanismes du donjon
- chargement des donnees historiques depuis `Old_data`

Le contenu et certains systemes sont encore en cours d'affinage.

## Stack technique

- React
- TypeScript
- Vite
- Three.js
- `@react-three/fiber`
- `@react-three/drei`
- Zustand

## Lancer le projet

### Installation

```bash
npm install
```

### Developpement

```bash
npm run dev
```

### Build production

```bash
npm run build
```

## Structure du projet

```text
src/
  components/
    Dungeon/     Scene 3D, tuiles, creatures, objets, decals
    UI/          HUD, ecrans, popup miroir, fiche champion
  data/          Donnees de jeu, loaders, definitions
  engine/        Store Zustand, logique globale, sons, constantes
  types/         Types partages

Old_data/
  dungeon.json
  game_db.json
  mechanisms.json
```

## Donnees source

Le projet s'appuie sur des donnees issues de `Old_data/`, notamment :

- `dungeon.json` pour les maps, objets et placements
- `game_db.json` pour les runes, sorts, objets et references diverses
- `mechanisms.json` pour les mecanismes de niveau

Ces fichiers servent de base pour reconstruire les comportements du jeu dans une architecture web moderne.

## Notes de developpement

- Le bundle principal reste volumineux a cause des donnees de donjon et du rendu 3D.
- Le build TypeScript est actuellement valide.
- Le build Vite complet fonctionne egalement dans un environnement autorisant l'execution des sous-processus necessaires.

## Roadmap possible

- ameliorer le decoupage du bundle
- continuer la finition visuelle du donjon
- completer les interactions, effets et comportements manquants
- enrichir la documentation technique du projet

## Credits

- Aux createurs du jeu original : Doug Bell, Mike Newton, Dennis Walker, Andy Jaros, Wayne Holder, Nancy Holder, Tsukasa Tawada
- A FTL Games
- A la communaute Dungeon Master
- Au site [Dungeon Master Encyclopaedia](http://dmweb.free.fr/)
- Au projet [ReDMCSB](https://github.com/gondur/ReDMCSB_Release2), par Christophe Fontanel

## Remarque

Ce projet est un hommage technique et creatif autour de *Dungeon Master*. Il conserve l'esprit du jeu original tout en l'adaptant a une implementation web moderne.

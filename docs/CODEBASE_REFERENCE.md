# DungeonMaster Codex - Reference codebase

Document vivant. Cette version de reference decrit l'etat observe dans le code au 2026-04-07.

## Stack

| Outil | Role |
|---|---|
| React + TypeScript | UI et logique applicative |
| Vite | Build et dev server |
| Three.js + React Three Fiber | Rendu 3D du donjon |
| Zustand | Etat global du jeu |
| `@react-three/drei` | Camera, textures et helpers R3F |

## Flux d'entree

1. `src/main.tsx` monte l'application React et charge `src/index.css`.
2. `src/App.tsx` affiche `LoadingScreen` puis lazy-load `GameRoot`.
3. `src/components/UI/LoadingScreen.tsx` precharge une selection d'images et appelle `preloadDungeonData()`.
4. `src/GameRoot.tsx` lance la boucle `requestAnimationFrame`, monte `DungeonScene`, `HUD`, `MirrorPopup` et `ChampionSheet`.

## Source de verite des maps

La source de verite runtime est `public/dungeon.json`, chargee par `src/data/dungeonData.ts` puis parsee par `src/data/mapLoader.ts`.

Points importants:

- `GAME_MAPS` et `getGameMap()` sont derives du JSON runtime.
- Les tiles sont remappees en grille 2D `tiles[y][x]`.
- `CHAMPION_START_POSITIONS` vient aussi du JSON runtime.
- Les anciens snapshots `src/data/level0.ts` et `src/data/level1.ts` ont ete supprimes.
- Le runtime ne depend plus que des maps parsees depuis le JSON complet.

Constat rapide sur les vraies maps chargees aujourd'hui:

- Map 0 "Hall of Champions" : `18x19`, 342 tiles, 24 champions, 3 portes, 2 teleporteurs, 1 escalier.
- Map 1 "Level 1" : `32x32`, 1024 tiles, 25 portes, 2 escaliers, 7 teleporteurs, 3 pits, 1 trick wall.

## Arborescence utile

```text
src/
|-- main.tsx
|-- App.tsx
|-- GameRoot.tsx
|-- index.css
|-- App.css
|-- components/
|   |-- Dungeon/
|   |   |-- DungeonScene.tsx
|   |   |-- Cell.tsx
|   |   |-- InstancedTiles.tsx
|   |   |-- CreatureSprite.tsx
|   |   |-- FloorItemMesh.tsx
|   |   |-- WallDecal.tsx
|   |   |-- WallSensor.tsx
|   |   `-- Torch.tsx
|   `-- UI/
|       |-- LoadingScreen.tsx
|       |-- HUD.tsx
|       |-- ChampionSheet.tsx
|       |-- MirrorPopup.tsx
|       `-- RunePanel.tsx
|-- data/
|   |-- dungeonData.ts
|   |-- mapLoader.ts
|   |-- mechanisms.ts
|   |-- doors.ts
|   |-- equipment.ts
|   |-- champions.ts
|   |-- creatures.ts
|   |-- items.ts
|   |-- itemImages.ts
|   |-- runes.ts
|   `-- spells.ts
|-- engine/
|   |-- store.ts
|   |-- sounds.ts
|   `-- constants.ts
`-- types/
    |-- game.ts
    |-- items.ts
    `-- spells.ts
```

## Modules cles

### `src/engine/store.ts`

Fichier coeur du projet.

Responsabilites principales:

- position du groupe, direction, niveau courant
- composition du groupe, recrutement, mort, resurrection
- inventaires, equipements, poids, transfert d'objets
- creatures, projectiles, degats flottants
- portes, teleporteurs, trick walls, senseurs actifs
- cast de sorts et effets temporels
- boucle de regen, combat, monstres, portes et sorts

Champs structurants de `GameState`:

- `level`, `position`, `direction`
- `gamePhase`, `activeMirrorChampionId`, `activePartyMemberId`
- `gateOpen`
- `party`, `deadChampions`
- `championInventories`, `championEquipment`, `championVitals`, `championXP`, `championCombat`
- `creatures`, `floorItems`
- `openDoors`, `openWalls`, `openTeleporters`
- `activeSensors`, `firedSensors`, `visibleTexts`
- `spellLights`, `projectiles`, `activeShields`, `footprintHistory`, `damageEvents`

Actions visibles dans le runtime:

- deplacement : `moveForward`, `moveBackward`, `strafeLeft`, `strafeRight`, `turnLeft`, `turnRight`
- groupe : `addToParty`, `removeFromParty`, `openMirror`, `closeMirror`, `openPartyMember`, `closePartyMember`
- objets : `pickupItem`, `dropItem`, `equipItem`, `unequipItem`, `giveItem`, `giveEquippedItem`, `useItem`
- combat et magie : `attackFront`, `castSpell`, `sleep`
- progression : `goToLevel`, `toggleDoor`, `activateWallSensor`, `tryOpenGate`
- etats critiques : `killChampion`, `resurrectChampion`

Helpers exposes hors store:

- `xpToLevel`
- `computeLightLevel`
- `torchStateIndex`
- `subscribePlateActivated`
- `onCreatureAction`
- `MIRROR_WALL_MAP`, `MIRROR_FACE_MAP`, `STAIR_CONNECTIONS`

### `src/components/Dungeon/DungeonScene.tsx`

Scene 3D principale.

Contient notamment:

- camera et brouillard
- rendu des tiles et murs via `Cell` et `InstancedTiles`
- decals muraux, textes graves et senseurs
- sprites de creatures et items au sol
- detection de clic sur miroirs et interactions de decor
- affichage du nom du niveau a partir de `getGameMap(level).name`

### `src/components/UI/HUD.tsx`

UI principale en exploration.

Contient:

- cartes champions et grille de formation 2x2
- attaques manuelles et cooldowns
- affichage des mains et objets equipes
- runes disponibles et journal court de cast
- infos de position / niveau
- ouverture de la fiche champion

### `src/components/UI/ChampionSheet.tsx`

Fiche detaillee d'un champion.

Fonctionnalites:

- portrait, vitaux, caracteristiques et classes
- equipement par slots
- carquois et poches
- sac a dos complet
- drag and drop entre inventaire, equipement et autres champions
- consommation et lecture via zones de drop
- retrait du groupe depuis la fiche

### `src/data/items.ts`

Catalogue objets hybride:

- consomme les JSON runtime `public/original_*_catalog.json`
- garde des fallback legacy integres
- centralise `resolveItemName(...)`
- expose `WEAPON_TYPES`, `ARMOR_TYPES`, `POTION_TYPES`, `MISC_TYPES`

### `src/data/equipment.ts`

Regles d'equipement partagees entre UI et runtime:

- `getEquippableSlots`
- `canEquipItemInSlot`
- `getTotalWeight`
- `getEffectiveChampionStats`
- `getChampionMaxLoad`

### `src/data/doors.ts`

Branche les proprietes originales des portes a partir de `public/original_doors_runtime.json`.

Expose:

- `getDoorDefinition`
- `doorBlocksVision`
- `doorBlocksThrownItems`
- `getDoorTexturePath`

### `src/data/mechanisms.ts`

Parse `Old_data/mechanisms.json` et fournit les mecanismes par map / tile / face.

Le store s'en sert pour:

- leviers
- dalles de pression
- serrures et senseurs associes
- logique des portes type hold / threshold

## Conventions utiles

- positions du groupe dans le store : `[y, x]`
- directions de deplacement : `NORTH | EAST | SOUTH | WEST`
- directions de tiles : `North | East | South | West`
- acces map runtime : `map.tiles[y][x]`
- cles de portes / murs ouverts : `"level,y,x"`
- cles des miroirs dans `MIRROR_WALL_MAP` : `"mapIndex,x,y"`

## Flow de jeu actuellement branche

- L'application demarre directement dans le Hall of Champions.
- Le recrutement passe par les miroirs.
- Le gate d'entree depend de `gateOpen` et donc de la taille du groupe.

## Nettoyage recemment acte

- Suppression de `src/components/UI/HeroSelectionScreen.tsx`
- Suppression de `src/data/level0.ts`
- Suppression de `src/data/level1.ts`

Le depot est maintenant plus proche de son runtime reel et contient moins de faux points d'entree documentaires.

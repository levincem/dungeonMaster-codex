# DungeonMaster Codex - Reference codebase

Document vivant. Cette version de reference decrit l'etat observe dans le code au 2026-04-11.

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
4. `src/GameRoot.tsx` lance la boucle `requestAnimationFrame`, monte `TitleScreen` tant que `gamePhase === 'title'`, puis `DungeonScene`, `HUD`, `MirrorPopup` et `ChampionSheet` en exploration.

## Source de verite des maps

La source de verite runtime utilisee au boot est maintenant `src/assets/data/dungeon.json`, exposee par `src/data/dungeonData.ts` puis parsee par `src/data/mapLoader.ts`.

Points importants:

- `getGameMaps()` et `getGameMap()` sont derives du JSON runtime embarque.
- Les tiles sont remappees en grille 2D `tiles[y][x]`.
- `getChampionStartPositions()` vient aussi du JSON runtime embarque.
- Les anciens snapshots `src/data/level0.ts` et `src/data/level1.ts` ont ete supprimes.
- Le runtime ne depend plus que des maps parsees depuis le JSON complet.
- La copie `public/dungeon.json` reste utile comme reference d'extraction/historique, mais n'est plus la source de boot critique.

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
|   |   |-- WallMountedItemMesh.tsx
|   |   |-- WallDecal.tsx
|   |   |-- WallSensor.tsx
|   |   `-- Torch.tsx
|   `-- UI/
|       |-- LoadingScreen.tsx
|       |-- TitleScreen.tsx
|       |-- HUD.tsx
|       |-- ChampionSheet.tsx
|       |-- MirrorPopup.tsx
|       |-- RunePanel.tsx
|       `-- dragPayload.ts
|-- data/
|   |-- assetPaths.ts
|   |-- dungeonData.ts
|   |-- gameDbData.ts
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
|   |-- runtimeTypes.ts
|   |-- saveGame.ts
|   |-- sounds.ts
|   |-- systems/
|   |   `-- persistence.ts
|   `-- constants.ts
|-- assets/
|   |-- data/
|   |   |-- dungeon.json
|   |   |-- game_db.json
|   |   |-- original_creatures_runtime.json
|   |   |-- original_doors_runtime.json
|   |   `-- runtime_data_manifest.json
|   `-- original_wall_overlay_positions.json
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
- creatures, projectiles, degats flottants et impacts visuels de sorts
- portes, teleporteurs, trick walls, senseurs actifs et mecanismes differes
- cast de sorts, shields, `Fluxcage`, evenements visuels et effets temporels
- boucle de regen, combat, monstres, portes et sorts

Champs structurants de `GameState`:

- `level`, `position`, `direction`
- `gamePhase`, `activeMirrorChampionId`, `activePartyMemberId`
- `gateOpen`
- `party`, `deadChampions`
- `championInventories`, `championEquipment`, `championVitals`, `championXP`, `championCombat`
- `creatures`, `floorItems`
- `openDoors`, `openWalls`, `openTeleporters`
- `activeSensors`, `firedSensors`, `visibleTexts`, `pendingSensorEvents`
- `spellLights`, `projectiles`, `activeShields`, `footprintHistory`, `damageEvents`, `spellVisualEvents`

Actions visibles dans le runtime:

- deplacement : `moveForward`, `moveBackward`, `strafeLeft`, `strafeRight`, `turnLeft`, `turnRight`
- groupe : `addToParty`, `removeFromParty`, `openMirror`, `closeMirror`, `openPartyMember`, `closePartyMember`
- objets : `pickupItem`, `dropItem`, `equipItem`, `unequipItem`, `giveItem`, `giveEquippedItem`, `useItem`, `useItemOnFrontWall`
- combat et magie : `attackFront`, `castSpell`, `sleep`
- progression : `goToLevel`, `toggleDoor`, `activateWallSensor`, `tryOpenGate`
- etats critiques : `killChampion`, `resurrectChampion`

Helpers exposes hors store:

- `xpToLevel`
- `computeLightLevel`
- `torchStateIndex`
- `subscribePlateActivated`
- `onCreatureAction`
- `getCreatureFluxcageExpiry`
- `MIRROR_WALL_MAP`, `MIRROR_FACE_MAP`, `STAIR_CONNECTIONS`

### `src/components/Dungeon/DungeonScene.tsx`

Scene 3D principale.

Contient notamment:

- camera et brouillard
- rendu des tiles et murs via `Cell` et `InstancedTiles`
- decals muraux, textes graves et senseurs
- sprites de creatures et items au sol
- objets montes sur mur via `WallMountedItemMesh`
- detection de clic sur miroirs et interactions de decor
- cible de drop contextuelle sur le mur en face pour les mecanismes a objet
- couches VFX pour projectiles, shields, `Fluxcage`, impacts et flashes de sorts
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
- pas de boutons `SAVE` / `MENU` persistants en bas du HUD actuellement

### `src/components/UI/TitleScreen.tsx`

Ecran d'entree actuel.

Contient:

- logo et mise en scene de la porte principale
- bouton `Enter The Dungeon` qui bascule en exploration
- bouton `Resume` active seulement si une sauvegarde persistente existe
- animation d'ouverture des portes avant l'entree

### `src/engine/saveGame.ts`

Couche minimale de persistance.

Expose:

- `SAVE_STORAGE_KEY`
- `hasPersistedSave()`
- `readPersistedSave()`
- `writePersistedSave()`
- `clearPersistedSave()`

La persistance passe actuellement par `window.localStorage`.

### `src/components/UI/ChampionSheet.tsx`

Fiche detaillee d'un champion.

Fonctionnalites:

- portrait, vitaux, caracteristiques et classes
- equipement par slots
- carquois et poches
- sac a dos complet
- drag and drop entre inventaire, equipement et autres champions
- consommation et lecture via zones de drop
- depot explicite sur mecanisme mural quand le contexte le permet
- sauvegarde persistente via le bouton de la fiche
- retrait du groupe depuis la fiche

### `src/components/UI/dragPayload.ts`

Petit module partage pour normaliser le payload de drag and drop entre la fiche champion et la scene 3D.

### `src/data/items.ts`

Catalogue objets hybride:

- s'appuie surtout sur `src/assets/data/game_db.json` pour les types, noms et tables runtime
- centralise les helpers de nommage et de lookup
- garde des fallback legacy integres la ou le runtime a encore besoin de compatibilite
- expose `WEAPON_TYPES`, `ARMOR_TYPES`, `POTION_TYPES`, `MISC_TYPES`

### `src/data/equipment.ts`

Regles d'equipement partagees entre UI et runtime:

- `getEquippableSlots`
- `canEquipItemInSlot`
- `getTotalWeight`
- `getEffectiveChampionStats`
- `getChampionMaxLoad`

### `src/data/doors.ts`

Branche les proprietes originales des portes a partir des donnees runtime embarquees.

Expose:

- `getDoorDefinition`
- `doorBlocksVision`
- `doorBlocksThrownItems`
- `getDoorTexturePath`

### `src/data/mechanisms.ts`

Reconstruit une vue runtime des mecanismes a partir des sensors extraits du donjon.

Le store s'en sert pour:

- leviers et switches muraux
- dalles de pression
- serrures, alcoves et receptacles
- requirements d'objets
- logique des capteurs `hold`, `delay` et variantes associees

### `src/data/creatures.ts`

Expose les definitions creatures derivees des donnees extraites et des couches runtime restantes.

Inclut notamment:

- stats de base
- categories d'attaque
- flags de comportement comme `attackFromAllSides`, `sightRange`, `preferBackRow`, `levitates`, `absorbMissiles`, `seeInvisible`

## Conventions utiles

- positions du groupe dans le store : `[y, x]`
- directions de deplacement : `NORTH | EAST | SOUTH | WEST`
- directions de tiles : `North | East | South | West`
- acces map runtime : `map.tiles[y][x]`
- cles de portes / murs ouverts : `"level,y,x"`
- cles des miroirs dans `MIRROR_WALL_MAP` : `"mapIndex,x,y"`

## Flow de jeu actuellement branche

- L'application demarre sur un `TitleScreen`.
- `Enter The Dungeon` fait passer `gamePhase` de `title` a `exploration`.
- `Resume` recharge la derniere sauvegarde persistente si elle existe.
- le bouton de sauvegarde de `ChampionSheet` ecrit l'etat mutable courant.
- il n'y a pas de bouton `MENU` expose au joueur dans le HUD pour le moment.
- Le recrutement passe par les miroirs.
- Le gate d'entree depend de `gateOpen` et donc de la taille du groupe.

## Regles de maintenance

- On ne termine pas une session en laissant un build casse sans le signaler explicitement.
- Apres chaque gros changement, les fichiers de documentation touches par ce changement doivent etre remis a jour.

## Notes recentes

- Les JSON critiques de runtime ont ete copies sous `src/assets/data/` pour fiabiliser `npm run dev` et `npm run preview`.
- `parse_full.cjs` est maintenant l'orchestrateur de packaging runtime et `src/assets/data/runtime_data_manifest.json` decrit le sous-ensemble canonique a conserver.
- Contrepartie actuelle: le chunk `game-core` est nettement plus lourd tant que ces donnees restent embarquees dans le bundle JS.
- `vite.config.ts` contient deja un decoupage manuel avec un chunk `game-core`, qui sera un point central du futur chantier d'optimisation.

## Nettoyage recemment acte

- Suppression de `src/components/UI/HeroSelectionScreen.tsx`
- Suppression de `src/data/level0.ts`
- Suppression de `src/data/level1.ts`
- Normalisation des points d'entree `champions.ts` et `creatures.ts` autour des implementations runtime actuelles

Le depot est maintenant plus proche de son runtime reel et contient moins de faux points d'entree documentaires.

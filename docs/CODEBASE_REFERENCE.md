# DungeonMaster Codex - Reference codebase

Document vivant. Cette version de reference decrit l'etat observe dans le code au `2026-04-19`.

Pour l'etat de fidelite et les verrous ouverts, privilegier aussi:

- [docs/PROJECT_STATE_INDEX.md](/D:/DungeonMaster-codex/docs/PROJECT_STATE_INDEX.md)
- [docs/FIDELITY_100_VERDICT.md](/D:/DungeonMaster-codex/docs/FIDELITY_100_VERDICT.md)
- [docs/FIDELITY_REMAINING_MATRIX.md](/D:/DungeonMaster-codex/docs/FIDELITY_REMAINING_MATRIX.md)

## Stack

| Outil | Role |
|---|---|
| React + TypeScript | UI et logique applicative |
| Vite | Build et dev server |
| Three.js + React Three Fiber | Rendu 3D du donjon |
| Zustand | Etat global du jeu |
| Helpers maison `renderHelpers.tsx` + `useLoadedTexture.ts` | Billboard et chargement de textures legers |

## Flux d'entree

1. `src/main.tsx` monte l'application React et charge `src/index.css`.
2. `src/App.tsx` affiche `LoadingScreen`, detecte les smartphones, puis prechauffe `GameRoot` pendant l'ecran de bienvenue avant de le lazy-load; si ce warm-up n'est pas termine quand l'utilisateur continue, un sas visuel "Preparing Title Screen" prend le relais.
3. `src/components/UI/LoadingScreen.tsx` ne precharge plus que les visuels du titre et le bootstrap du donjon, pour rendre le tout premier boot beaucoup plus leger.
4. `src/GameRoot.tsx` lance la boucle `requestAnimationFrame`, monte `TitleScreen` tant que `gamePhase === 'title'`, rechauffe d'abord le voisinage utile du donjon, puis etale en vagues idle les visuels gameplay, les slices `game_db`, les overlays muraux et les modules gameplay coeur (`DungeonScene`, `HUD`, effets de sorts), avant de continuer le warm-up complet en arriere-plan pendant l'exploration.
5. `src/components/Dungeon/renderHelpers.tsx` et `src/components/Dungeon/useLoadedTexture.ts` portent maintenant les helpers de rendu legers (`BillboardGroup`, chargement de textures) utilises par la scene et les sprites, ce qui retire les usages actifs de `@react-three/drei` du graphe gameplay.
6. `src/components/Dungeon/DungeonScene.tsx` garde maintenant son overlay de drag/drop hors du coeur canvas; les previews et drop targets de floor-drag vivent dans un overlay dedie, et le drop plein ecran relit l'etat runtime a la demande plutot que de garder le canvas abonne aux coordonnees de drag.
7. `src/components/Dungeon/dungeonSceneDerivedState.ts` porte maintenant les derives purs les plus denses de la scene (boutons muraux, decals, pressure plates, trick walls, pits, interactions murales de drop), ce qui rend `DungeonScene.tsx` plus lisible et plus testable.
8. `src/components/Dungeon/DungeonProjectileLayers.tsx` porte maintenant les couches runtime de projectiles, shields, `Fluxcage` et poison persistant, ce qui coupe un autre bloc dense hors de `DungeonScene.tsx` tout en gardant le preload des effets photons.
9. `src/components/Dungeon/DungeonSpellImpactLayer.tsx` et `src/components/Dungeon/DungeonMagicVisionLayer.tsx` portent maintenant deux autres familles VFX qui restaient encore inline dans `DungeonScene.tsx`: les impacts de sorts d'un cote, et la couche `magic vision` de l'autre.
10. `src/components/UI/hudDerivedState.ts` porte maintenant une partie des derives purs du HUD (`CombatGrid`, degats recents, etat du carre de face, selection de runes, etat de cast), ce qui allege `HUD.tsx` sans deplacer les interactions utilisateur.
11. `src/components/UI/HudMagicPanel.tsx` et `src/components/UI/HudOptionsModal.tsx` decoupent maintenant deux gros blocs UI du HUD (runes/cast et keybindings/options), ce qui rend `HUD.tsx` plus lisible.
12. `src/components/UI/championSheetDerivedState.ts` porte maintenant les derives purs les plus repetitifs de la fiche champion (bonus de potions, resume de vitaux, charge, contexte de mur frontal, premier slot d'equipement valide), ce qui allege `ChampionSheet.tsx` sans toucher a ses interactions.

## Source de verite des maps

La source de verite runtime utilisee au boot est maintenant `src/assets/runtime/dungeon/bootstrap.json`, exposee par `src/data/dungeonData.ts` puis parsee par `src/data/mapLoader.ts`.

Points importants:

- `getGameMaps()` et `getGameMap()` sont derives du package runtime embarque `bootstrap + maps/level-XX`.
- Les tiles sont remappees en grille 2D `tiles[y][x]`.
- `getChampionStartPositions()` vient aussi du bootstrap runtime embarque.
- Les anciens snapshots `src/data/level0.ts` et `src/data/level1.ts` ont ete supprimes.
- Le runtime ne depend plus que des maps parsees depuis les fichiers runtime generes par niveau.

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
|   |   |-- DungeonProjectileLayers.tsx
|   |   |-- DungeonSpellImpactLayer.tsx
|   |   |-- DungeonMagicVisionLayer.tsx
|   |   |-- Cell.tsx
|   |   |-- InstancedTiles.tsx
|   |   |-- CreatureSprite.tsx
|   |   |-- FloorItemMesh.tsx
|   |   |-- WallMountedItemMesh.tsx
|   |   |-- WallDecal.tsx
|   |   |-- WallSensor.tsx
|   |   `-- WallTextLayer.tsx
|   `-- UI/
|       |-- LoadingScreen.tsx
|       |-- TitleScreen.tsx
|       |-- HUD.tsx
|       |-- HudMagicPanel.tsx
|       |-- HudOptionsModal.tsx
|       |-- ChampionSheet.tsx
|       |-- MirrorPopup.tsx
|       |-- VictoryScreen.tsx
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
|   |-- itemImageCompatibility.ts
|   |-- items.ts
|   |-- itemImages.ts
|   |-- itemRuntimeCompatibility.ts
|   |-- originalSpells.ts
|   |-- runes.ts
|   |-- spellRuntime.ts
|   `-- reference/
|       `-- spellsReference.ts
|-- engine/
|   |-- store.ts
|   |-- runtimeTypes.ts
|   |-- saveGame.ts
|   |-- options.ts
|   |-- sounds.ts
|   |-- systems/
|   |   `-- persistence.ts
|   `-- constants.ts
|-- i18n/
|   |-- en.ts
|   |-- fr.ts
|   `-- index.ts
|-- assets/
|   `-- runtime/
|       |-- dungeon/
|       |   |-- bootstrap.json
|       |   `-- maps/
|       |-- db/
|       |   |-- game_db.json
|       |   |-- game_db_items.json
|       |   |-- game_db_weapon_attacks.json
|       |   `-- game_db_creatures.json
|       |-- reference/
|       |   |-- original_creatures_runtime.json
|       |   |-- original_doors_runtime.json
|       |   `-- original_teleporters_runtime.json
|       |-- support/
|       |   |-- original_wall_overlay_positions.json
|       |   `-- wall_overlays/
|       `-- runtime_data_manifest.json
`-- types/
    |-- game.ts
    |-- items.ts
    `-- spells.ts
```

## Modules cles

### `src/engine/store.ts`

Fichier coeur du projet, mais maintenant beaucoup plus recentre sur la composition runtime que sur la logique inline.

Responsabilites principales:

- position du groupe, direction, niveau courant
- composition du groupe, recrutement, mort, resurrection
- inventaires, equipements, poids, transfert d'objets
- creatures, projectiles, degats flottants et impacts visuels de sorts
- portes, teleporteurs, trick walls, senseurs actifs et mecanismes differes
- cast de sorts, shields, `Fluxcage`, evenements visuels et effets temporels
- boucle de regen, combat, monstres, portes et sorts
- options de jeu runtime et etat du panneau d'options

Note d'architecture:

- la grosse passe de nettoyage est terminee: la majorite des wrappers d'action, boucles top-level et familles de helpers historiques ont ete sortis vers `src/engine/systems/*`
- `store.ts` doit maintenant etre lu comme une couche de composition Zustand / runtime, pas comme le hotspot principal de dette structurelle

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
- `gameOptions`, `optionsModalOpen`

Actions visibles dans le runtime:

- deplacement : `moveForward`, `moveBackward`, `strafeLeft`, `strafeRight`, `turnLeft`, `turnRight`
- groupe : `addToParty`, `removeFromParty`, `openMirror`, `closeMirror`, `openPartyMember`, `closePartyMember`
- objets : `pickupItem`, `dropItem`, `equipItem`, `unequipItem`, `giveItem`, `giveEquippedItem`, `useItem`, `useItemOnFrontWall`
- combat et magie : `attackFront`, `castSpell`, `sleep`
- progression : `goToLevel`, `toggleDoor`, `activateWallSensor`, `tryOpenGate`
- options : `setGameOptions`, `openOptionsModal`, `closeOptionsModal`
- etats critiques : `killChampion`, `resurrectChampion`, `loadGame`

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
- calcul de visibilite pour overlays muraux, boutons de portes et autres interactions frontales
- couches VFX assemblees via `DungeonProjectileLayers.tsx`, `DungeonSpellImpactLayer.tsx`, `DungeonMagicVisionLayer.tsx` et `DamageLayer`
- affichage du nom du niveau a partir de `getGameMap(level).name`

### `src/components/Dungeon/Cell.tsx`

Rendu local des cellules non instanciees, notamment miroirs et portes.

Points importants:

- les portes a bouton utilisent un seul modele commun a tout le jeu
- le materiau de porte reste variable via `doorType`
- le jambage du bouton reste fixe dans l'espace local de la porte
- le `wall_switch_small_in/out` est pose directement sur la face visible du jambage, cote joueur
- cette structure evite les anciens cas de bouton flottant dans l'ouverture ou cache derriere le mur

### `src/components/UI/HUD.tsx`

UI principale en exploration.

Contient:

- cartes champions et grille de formation 2x2
- attaques manuelles et cooldowns
- affichage des mains et objets equipes
- runes disponibles et journal court de cast
- infos de position / niveau
- ligne de debug avec coords globales et locales, y compris la case frontale (`front [g:x,y / l:x,y]`)
- ouverture de la fiche champion
- bouton d'ouverture du panneau d'options
- bouton d'aide `?`
- remapping des touches de deplacement

Note de structure:

- `src/components/UI/hudDerivedState.ts` centralise maintenant une partie des derives purs du HUD, pour garder le composant concentre sur le wiring UI et les interactions.
- `src/components/UI/HudMagicPanel.tsx` et `src/components/UI/HudOptionsModal.tsx` portent maintenant deux gros blocs de rendu stateful du HUD, ce qui retire au composant principal une partie de son JSX le plus dense.
- Le vieux bloc commente `HUD_DUPE` a ete supprime; `HUD.tsx` ne porte maintenant plus qu'un seul chemin de rendu actif.

### `src/components/UI/TitleScreen.tsx`

Ecran d'entree actuel.

Contient:

- logo et mise en scene de la porte principale
- bouton `Enter The Dungeon` qui bascule en exploration
- bouton `Resume` active seulement si une sauvegarde persistente existe
- animation d'ouverture des portes avant l'entree

### `src/components/UI/VictoryScreen.tsx`

Ecran de victoire branche sur `gamePhase === 'victory'`.

Contient:

- premiere carte `Congratulations!`
- apparition du `Grey Lord`
- seconde carte `The End`

### `src/engine/saveGame.ts`

Couche minimale de persistance.

Expose:

- `SAVE_STORAGE_KEY`
- `hasPersistedSave()`
- `readPersistedSave()`
- `writePersistedSave()`
- `clearPersistedSave()`

La persistance passe actuellement par `window.localStorage`.

### `src/engine/options.ts`

Couche utilitaire pour les raccourcis.

Expose:

- les keybindings par defaut
- la normalisation des touches
- le matching de keybinding
- le formatage des touches pour l'UI

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

Note de structure:

- `src/components/UI/championSheetDerivedState.ts` centralise maintenant les derives purs de bonus/vitaux/charge/contexte mural et l'auto-selection de slot d'equipement, pour garder la fiche plus lisible et plus testable.

### `src/components/UI/dragPayload.ts`

Petit module partage pour normaliser le payload de drag and drop entre la fiche champion et la scene 3D.

### `src/data/items.ts`

Catalogue objets hybride:

- s'appuie surtout sur `src/assets/runtime/db/game_db_items.json` pour les types, noms et tables runtime
- centralise les helpers de nommage et de lookup
- garde seulement la glue runtime active; les alias/fallbacks residuels vivent maintenant dans `src/data/itemRuntimeCompatibility.ts`
- expose `WEAPON_TYPES`, `ARMOR_TYPES`, `POTION_TYPES`, `MISC_TYPES`

### `src/data/itemRuntimeCompatibility.ts`

Pont de compatibilite encore assume:

- alias de potions runtime
- overrides d'armures synthetiques utilises par les loadouts de depart
- fallback defensif minimal tant que toute la table source n'est pas disponible partout

### `src/data/itemImages.ts`

Resolution d'images runtime:

- derive d'abord le chemin depuis le nom canonique de l'objet
- garde seulement le branchement public pour inventaire / equipement / sol
- consomme les alias/fallbacks isoles dans `src/data/itemImageCompatibility.ts`

### `src/data/itemImageCompatibility.ts`

Pont de compatibilite visuelle:

- aliases nom -> fichier image
- maps legacy `typeId -> filename` gardees en dernier recours
- fallback par categorie tant que tous les assets ne suivent pas encore les noms runtime

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

Reconstruit une vue runtime des mecanismes directement a partir des sensors extraits du donjon.

Ne depend pas du rapport humain `assets/OriginalDataExtraction/output/mechanisms.json`, qui reste seulement un export de lecture.

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

### Pipeline sorts

Le pipeline sorts actif se repartit maintenant clairement ainsi:

- `src/data/runes.ts`: catalogue runtime utilise par le HUD, le cast et les tests
- `src/data/originalSpells.ts`: descripteurs et formules source-backed utiles au runtime
- `src/data/spellRuntime.ts`: helpers runtime de duree, shields, projectiles et impacts
- `src/data/reference/spellsReference.ts`: table de reference conservee pour audits/cross-checks, non importee par le gameplay

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
- le HUD permet d'ouvrir un panneau d'options et de reassigner les touches de deplacement.
- Le recrutement passe par les miroirs.
- Le gate d'entree depend de `gateOpen` et donc de la taille du groupe.
- La victoire bascule vers `VictoryScreen`.

## Regles de maintenance

- On ne termine pas une session en laissant un build casse sans le signaler explicitement.
- Apres chaque gros changement, les fichiers de documentation touches par ce changement doivent etre remis a jour.

## Notes recentes

- Les JSON critiques de runtime vivent maintenant sous `src/assets/runtime/`, avec un split `bootstrap + maps/level-XX + db/reference/support`.
- Les overlays muraux runtime sont eux aussi charges par map depuis `src/assets/runtime/support/wall_overlays/map-XX.json`, au lieu d'un gros chunk de positions unique.
- Le codebase est decoupe en chunks plus fins qu'avant; `GameRoot`, `HUD`, `ChampionSheet`, `MirrorPopup` et `VictoryScreen` ont maintenant aussi des chunks explicites, mais les plus gros restes sont toujours surtout la pile Three.js / rendu, plus quelques slices `game_db`.
- La couche `i18n` existe, mais la selection de langue n'est pas encore exposee.

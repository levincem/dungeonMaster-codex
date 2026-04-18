# Next Phase Plan

Etat pose le `2026-04-18`.

## Plan autonome - reprise 2026-04-20

Ordre d'attaque a suivre sans revalidation utilisateur sauf regression sensible:

1. `DungeonScene`
2. `HUD`
3. `ChampionSheet`
4. modules runtime hybrides (`sensorRuntimeDeps`, `transportRuntimeDeps`, `storeAttackFrontRuntime`, `storeSpellRuntime`, `persistence`)
5. seulement ensuite une nouvelle passe i18n/labels si le chantier precedent reste stable

### Phase 1 - DungeonScene

Objectif:

- continuer a degonfler `src/components/Dungeon/DungeonScene.tsx`
- sortir les derives ou couches encore coherents sans eparpiller le wiring R3F
- viser la lisibilite et la reduction des rerenders avant un nouveau travail bundle

Sous-cibles:

- identifier les derniers blocs encore purement derives ou fortement presentationnels
- preferer des modules `derived-state` ou `layer` dedies a des micro-composants sans responsabilite claire
- conserver dans `DungeonScene.tsx` uniquement:
  - composition du canvas
  - branchement store/runtime
  - coordination des couches

Definition de fini locale:

- fichier sensiblement plus lisible
- aucune regression camera / drag-drop / spell impacts / magic vision
- tests verts
- build verte

### Phase 2 - HUD

Objectif:

- continuer a reduire `src/components/UI/HUD.tsx` maintenant que les premiers gros blocs sont sortis

Sous-cibles:

- isoler les derives presentation encore denses
- separer les gros blocs stateful encore lisibles comme responsabilites propres
- surveiller de pres les glyphes, labels et encodages pendant toute passe

Regle speciale:

- si un caractere se casse dans le HUD, corriger dans la meme passe avant toute autre continuation

Definition de fini locale:

- pas de mojibake
- pas de regression de drag/drop, combat grid, runes, options ou raccourcis
- tests/build verts

### Phase 3 - ChampionSheet

Objectif:

- finir le nettoyage structurel de `src/components/UI/ChampionSheet.tsx`

Sous-cibles:

- continuer a sortir les derives purs ou panneaux d'inspection coherents
- garder en place le wiring drag/drop et les actions store
- ne pas casser les cas deja sensibles:
  - drag/drop nourriture
  - gourde bouche
  - gourde oeil
  - interactions fontaine / autel / mur frontal
  - reprise de save

Definition de fini locale:

- le composant reste dense mais clairement compose
- les cas de drag/drop critiques restent jouables
- tests/build verts

### Phase 4 - Runtime hybride

Objectif:

- nettoyer les modules encore lourds sans relancer un chantier `store`

Priorite:

1. `src/engine/systems/sensorRuntimeDeps.ts`
2. `src/engine/systems/transportRuntimeDeps.ts`
3. `src/engine/systems/storeAttackFrontRuntime.ts`
4. `src/engine/systems/storeSpellRuntime.ts`
5. `src/engine/systems/persistence.ts`

Attentes:

- clarifier les contrats de deps
- couper les objets de deps trop larges quand une vraie frontiere existe
- eviter les extractions "pour faire baisser les lignes"

### Ce qu'il ne faut pas faire

- ne pas recommencer a micro-extraire le `store` pour gagner quelques lignes
- ne pas deplacer du simple wiring local dans dix fichiers de plus
- ne pas toucher a l'i18n globale tant que les gros blocs UI ne sont pas stabilises
- ne pas laisser une passe UI sans verifier encodage, drag/drop et build

### Discipline de fin de passe

Pour chaque passe substantielle:

- ajouter ou etendre un test cible quand la logique se prete au test
- lancer `npm.cmd test`
- lancer `npm.cmd run build`
- mettre a jour `docs/REMAKE_STATUS.md` et ce plan si l'etat reel a change
- noter honnetement les regressions evitees, les compromis et le prochain meilleur levier

Ce document decrit la suite logique maintenant que:

- l'extraction principale est tres solide
- le gameplay central est largement source-backed
- le reste ouvert est surtout structurel, hybride ou de validation

## 1. Priorite produit

Ordre recommande:

1. finir la validation fidelity restante
2. reduire les couches hybrides et les vieux noms trompeurs
3. optimiser les gros chargements et les chunks
4. simplifier l'organisation interne du projet

## 2. Fidelite a fermer

### Bloc 1 - generateurs / groupes actifs

Objectif:

- borner encore mieux la semantique runtime `alive / reserved / dormant`

Actions:

- documenter explicitement les invariants du runtime actuel des groupes
- verifier si certains groupes doivent cesser de compter comme `active` hors niveau courant
- separer plus nettement cycle de vie `reserved -> alive -> dormant?`
- continuer les tests cibles autour saturation / retries / teleports / pits / changements de niveau

Livrable attendu:

- une note de verite courte sur ce que le remake emule exactement
- ou, mieux, une representation runtime encore plus proche de FTL si la preuve est suffisante

### Bloc 2 - extraction encore ouverte

Objectif:

- reduire l'angle mort semantique de `0696.RAW1`

Actions:

- continuer le classement des tuples et sous-zones
- separer clairement `UI`, `composition`, `layout de rendu`, et eventuelles metadata runtime
- garder ce chantier distinct du moteur gameplay pour ne pas le bloquer inutilement

## 3. Maintenabilite

### Renommage et nettoyage

Objectif:

- faire disparaitre les vieux noms `Approx` qui ne sont plus de vraies approximations

Actions:

- poursuivre le renommage des reliquats historiques dans `store.ts`
- considerer comme deja faite une premiere passe sur les anciens wrappers gameplay `Approx`, maintenant renommes vers des roles `Original`, `Runtime` ou `Patch`
- considerer aussi comme entamee l'extraction de l'orchestration runtime des degats de party hors `store.ts`
- considerer aussi comme entamee l'extraction de l'orchestration de transport de pas de la party hors `store.ts`
- considerer aussi comme entamee l'extraction de l'orchestration des effets immediats de transport hors `store.ts`
- considerer aussi comme entamee la centralisation du cablage transport runtime dans `src/engine/systems/transportRuntimeDeps.ts`
- considerer aussi comme entamee l'extraction du cablage `CLIMB DOWN` dans `src/engine/systems/climbDownRuntimeDeps.ts`
- considerer aussi comme entamee la centralisation du cablage capteurs et interactions murales dans `src/engine/systems/sensorRuntimeDeps.ts`
- considerer aussi comme entamee l'extraction du noyau runtime capteurs dans `src/engine/systems/sensorRuntimeCore.ts`
- considerer aussi comme entamee l'extraction du coeur `direct / floor / wall` des capteurs dans `src/engine/systems/sensorTriggeredEffects.ts`
- considerer aussi comme entamee l'extraction des helpers d'etat capteurs et des wall launchers dans `src/engine/systems/sensorRuntimeCore.ts`
- considerer aussi comme entamee l'extraction de l'activation runtime des generateurs dans `src/engine/systems/sensorGeneratorRuntime.ts`
- considerer aussi comme entamee l'extraction de la composition des groupes de creatures generes dans `src/engine/systems/generatedCreatureGroups.ts`
- considerer aussi comme entamee l'extraction de l'etat runtime des sous-cases de creatures dans `src/engine/systems/creatureTileState.ts`
- considerer aussi comme entamee l'extraction de l'orchestration d'attaque monstre dans `src/engine/systems/monsterAttackTurn.ts`
- considerer aussi comme entamee l'extraction de l'orchestration de mouvement monstre dans `src/engine/systems/monsterMovementTurn.ts`
- considerer aussi comme entamee l'extraction de la finalisation de destination monstre dans `src/engine/systems/monsterDestinationTurn.ts`
- considerer aussi comme entamee l'extraction de la preparation d'un tour monstre dans `src/engine/systems/monsterTurnState.ts`
- considerer aussi comme entamee l'extraction d'un tour monstre unitaire complet dans `src/engine/systems/monsterSingleTurn.ts`
- considerer aussi comme entamee l'extraction de la boucle complete `tickMonsters` dans `src/engine/systems/monsterTickRuntime.ts`
- considerer aussi comme entamee l'extraction de la boucle projectiles / poison clouds de `tickSpells` dans `src/engine/systems/spellProjectileTickRuntime.ts`
- considerer aussi comme entamee l'extraction de l'orchestrateur commun des deplacements party dans `src/engine/systems/partyMoveCommand.ts`
- considerer aussi comme entamee l'extraction de l'orchestration top-level de `attackFront` dans `src/engine/systems/attackFrontRuntime.ts`
- considerer aussi comme entamee l'extraction de l'orchestration top-level de `castSpell` dans `src/engine/systems/castSpellRuntime.ts`
- considerer aussi comme entamee l'extraction des commandes runtime `pickup / drop` dans `src/engine/systems/floorItemCommandRuntime.ts`
- considerer aussi comme entamee l'extraction des commandes runtime `useItem / fillWater / front-wall item interactions` dans `src/engine/systems/itemCommandRuntime.ts`
- considerer aussi comme entamee l'extraction des commandes runtime `throwCarriedItem / resurrectChampion` dans `src/engine/systems/itemCarryCommandRuntime.ts`
- considerer aussi comme entamee l'extraction des transferts runtime d'inventaire/equipement dans `src/engine/systems/itemTransferCommandRuntime.ts`
- considerer aussi comme entamee l'extraction de la commande top-level `castSpell` dans `src/engine/systems/castSpellCommandRuntime.ts`
- considerer aussi comme entamee l'extraction de l'orchestrateur top-level de `tickSpells` dans `src/engine/systems/tickSpellsRuntime.ts`
- considerer aussi comme entamee l'extraction du builder de dependances projectile de `tickSpells` dans `src/engine/systems/tickSpellsProjectileDeps.ts`
- considerer aussi comme terminee la sortie des builders de dependances `sensor / transport / CLIMB DOWN` hors `store.ts`, maintenant assembles dans `src/engine/systems/sensorRuntimeDeps.ts`, `src/engine/systems/transportRuntimeDeps.ts` et `src/engine/systems/climbDownRuntimeDeps.ts`
- considerer aussi comme entamee l'extraction du cablage top-level des sorts du `store` vers `src/engine/systems/storeSpellRuntime.ts`, qui porte maintenant l'orchestration runtime de `castSpell` et `tickSpells`
- considerer aussi comme entamee l'extraction de l'assemblage runtime de `tickFrame` vers `src/engine/systems/tickFrameRuntimeDeps.ts`, ce qui retire du `store` son gros objet inline de deps pour exploration / sleep / endgame / pending events
- considerer aussi comme entamee l'extraction de l'etat runtime et du paquet de dependances de `tickMonsters` vers `src/engine/systems/storeMonsterRuntime.ts`, ce qui retire du `store` le gros assemblage inline du tick monstre
- considerer aussi comme entamee la recentralisation d'une partie des closures stateful de `tickSpells` dans `src/engine/systems/storeSpellRuntime.ts`, ce qui retire du `store` plusieurs bindings locaux autour des degats de groupe, des teleporters projectile et de l'impact champion
- considerer aussi comme entamee l'extraction des wrappers repetitifs de deplacement party vers `src/engine/systems/storePartyMoveRuntime.ts`, ce qui retire du `store` une partie du cablage duplique `moveForward / moveBackward / strafeLeft / strafeRight` et de leurs side-effects UI
- considerer aussi comme entamee la sortie des derniers callbacks stateful principaux du tick monstre dans `src/engine/systems/storeMonsterRuntime.ts`, ce qui diminue encore la part de logique inline restante dans `tickMonsters`
- considerer aussi comme entamee la sortie du cablage runtime restant des interactions murales vers `src/engine/systems/storeWallInteractionRuntime.ts`, ce qui retire du `store` le wiring direct de `activateWallSensor`, des interactions `front wall` et du `Vi Altar`
- considerer aussi comme entamee la sortie des helpers de feedback runtime vers `src/engine/systems/storeFeedbackRuntime.ts` et du petit bloc portes/combat vers `src/engine/systems/storeDoorRuntime.ts`, ce qui retire du `store` plusieurs helpers inline de message, VFX, toggle de porte et ticks simples
- considerer aussi comme entamee la sortie de l'orchestration runtime locale de `attackFront` vers `src/engine/systems/storeAttackFrontRuntime.ts`, ce qui retire du `store` le gros cablage projectile / utilitaire / melee encore specifique a l'attaque de face
- considerer aussi comme entamee la sortie de la fabrique des degats runtime de party vers `src/engine/systems/storePartyDamageRuntime.ts`, ce qui retire du `store` le builder inline de `wall bump`, `fall impact`, `spell backlash` et `party-wide incoming attack`
- considerer aussi comme entamee la sortie des wrappers `regen / sleep / endgame` vers `src/engine/systems/storeTimeRuntime.ts`, ce qui retire du `store` trois helpers de plomberie delegataires et clarifie le cablage de `tickFrame` et `regenTick`
- considerer aussi comme entamee la sortie du builder de deps `pickup / drop` au sol vers `src/engine/systems/storeFloorItemRuntime.ts`, ce qui retire du `store` un autre objet inline de plomberie autour des commandes d'objets au sol
- considerer aussi comme bien avancee la sortie de la persistence locale du `store` vers `src/engine/systems/storePersistenceRuntime.ts`, qui centralise maintenant payload de sauvegarde, hydratation et wrappers `save/load/returnToTitle`
- considerer aussi comme bien avancee la sortie des transitions UI/runtime courtes du `store` vers `src/engine/systems/storeUiRuntime.ts`, qui couvre maintenant miroir, panneaux, drag de sol, gate, changement de niveau, rotations et selection/reorder de champions
- considerer aussi comme bien avancee la factorisation des patches optionnels et du roster de party vers `src/engine/systems/storePatchRuntime.ts` et `src/engine/systems/storePartyRosterRuntime.ts`
- considerer aussi comme bien avancee la sortie des derniers wrappers d'etat et d'objets du `store` vers `src/engine/systems/storeStateRuntime.ts` et `src/engine/systems/storeItemRuntime.ts`
- considerer aussi comme bien avancee la sortie du wiring top-level de `tickFrame / regenTick / tickMovement` vers `src/engine/systems/storeFrameRuntime.ts`, qui retire du `store` une partie supplementaire du cablage temporel Zustand
- considerer aussi comme bien avancee la sortie des wrappers top-level `attackFront / castSpell / tickSpells / tickMonsters` vers `src/engine/systems/storeGameplayRuntime.ts`, ce qui laisse le `store` encore plus proche d'un simple point de composition
- considerer aussi comme bien avancee la sortie des helpers capteurs restants vers `src/engine/systems/storeSensorRuntime.ts`, qui centralise maintenant le noyau `snapshot / diff / queue / generator / wall sensor` encore local au `store`
- considerer aussi comme bien avancee la sortie de l'etat mutable externe des creatures vers `src/engine/systems/storeCreatureRuntime.ts`, ce qui retire du `store` un nouveau bloc de maps/listeners runtime
- considerer aussi comme bien avancee la sortie des wrappers `party / survival / fatigue / party damage deps` vers `src/engine/systems/storePartyRuntime.ts`, ce qui retire du `store` un nouveau bloc historique autour de la survie, du repos, du cooldown de mouvement et des degats de groupe
- considerer aussi comme bien avancee la sortie des wrappers `transport / immediate effects / party move deps` vers `src/engine/systems/storeMovementRuntime.ts`, ce qui retire du `store` le reliquat de cablage direct autour des transports de pas et des effets immediats de case
- considerer aussi comme bien avancee la sortie du bootstrap monde et des wrappers de generation reserves vers `src/engine/systems/storeWorldRuntime.ts`, ce qui retire du `store` les boucles d'initialisation creatures/items/open sets et un nouveau bloc de plomberie generateur
- considerer aussi comme bien avancee la sortie des helpers champion purs vers `src/engine/systems/storeChampionRuntime.ts`, ce qui retire du `store` un nouveau bloc de `vitals / clamps / skill modifiers / stat relax / item fallback`
- considerer aussi comme bien avancee la sortie d'un noyau historique `champion/combat state` vers `src/engine/systems/storeChampionStateRuntime.ts`, ce qui retire du `store` les helpers locaux de blessures, poison, overflow d'endurance, criteres temporels, gain d'XP de competence et resolution d'attaque entrante
- considerer aussi comme bien avancee la sortie d'un paquet utilitaire `combat / projectile / item runtime` vers `src/engine/systems/storeCombatRuntime.ts`, ce qui retire du `store` les helpers locaux de checks de cast, de projectile immediat, de charges d'objets, de drops et de lancer d'objet transporte
- considerer aussi comme bien avancee la sortie d'un noyau `creature spatial / occupancy / LOS` vers `src/engine/systems/storeCreatureSpatialRuntime.ts`, ce qui retire du `store` les helpers locaux de `groupId` runtime, capacite de tuile, normalisation des cellules, partage de tuiles et ligne de vue
- considerer aussi comme bien avancee la sortie du bootstrap d'etat initial vers `src/engine/systems/storeBootstrapRuntime.ts` et du petit noyau `endgame` vers `src/engine/systems/storeEndgameRuntime.ts`, ce qui retire du `store` ses deux derniers blocs coherents qui valaient encore une extraction dediee
- considerer aussi comme entamee la factorisation du cablage repetitif des deplacements party directement dans `src/engine/store.ts`, ainsi que la suppression des wrappers morts les plus simples; les reliquats encore "faciles" sont maintenant surtout de petits builders ou callbacks stateful, plus des blocs de duplication massifs
- considerer aussi comme entamee la sortie des gros pavés inline restants de `castSpell`, `tickSpells`, `tickFrame` et `regenTick` vers des helpers locaux du `store`, afin de laisser les actions Zustand plus proches d'un pur role d'orchestration avant d'attaquer les extractions plus structurelles
- considerer aussi comme entamee la meme approche sur `tickMonsters` et sur le petit bloc `front wall / Vi altar`, ce qui laisse surtout dans le `store` des utilitaires d'assemblage plus fins et quelques actions encore modestement denses
- considerer aussi comme entamee la meme approche sur `saveGame / loadGame / pickupItem / pickupItemToChampion / dropItem`, afin de faire disparaitre encore un peu de plomberie repetitive avant de viser les derniers blocs plus structurels
- conserver les helpers purs comme points de verite
- supprimer les reliquats morts ou trompeurs quand ils n'ont plus d'appelants
- poursuivre la meme approche sur les gros composants UI restants en privilegiant des modules derives purs et testes (`ChampionSheet`, puis `DungeonScene`) plutot que de nouvelles micro-extractions de wiring

### Provenance plus explicite

Objectif:

- rendre visible ce qui est `source-backed`, `fallback`, `manual`, `presentation-only`

Actions:

- isoler davantage les couches de compatibilite data
- regrouper, quand c'est pertinent, les fallback tables dans des modules nommes explicitement `compat` ou `manual`
- ajouter quelques tests de provenance pour figer les chemins critiques:
  - items
  - equipment slots
  - creatures
  - spell runtime

### Store central

Objectif:

- continuer a degonfler `src/engine/store.ts`

Actions:

- considerer comme largement faite la sortie des wrappers d'orchestration Zustand residuels vers des modules systeme dedies
- limiter `store.ts` a la composition Zustand et au cablage des sous-systemes
- garder la logique pure testable hors store
- traiter maintenant comme reste principal:
  - les helpers historiques plus bas niveau encore presents dans `store.ts`
  - les assemblages locaux de deps/runtime qui ne meritent pas tous une extraction supplementaire
  - la clarification documentaire de ce qui reste volontairement dans le `store`
- noter qu'apres la sortie de `storeFrameRuntime.ts`, `storeGameplayRuntime.ts`, `storeSensorRuntime.ts`, `storeCreatureRuntime.ts`, `storePartyRuntime.ts`, `storeMovementRuntime.ts`, `storeWorldRuntime.ts`, `storeChampionRuntime.ts`, `storeChampionStateRuntime.ts`, `storeCombatRuntime.ts`, `storeCreatureSpatialRuntime.ts`, `storeBootstrapRuntime.ts` et `storeEndgameRuntime.ts`, le reste du chantier store ne justifie plus prioritairement de nouvelles micro-extractions; le meilleur rendement se deplace maintenant vers l'UI, l'optimisation et la validation fidelity
- basculer ensuite prioritairement vers:
  - optimisation et reduction des gros chargements
  - playtests/fidelite sur les cas rares et la fin de jeu
- simplification des gros composants UI restants (`DungeonScene`, `ChampionSheet`) plutot qu'un acharnement sur les derniers petits reliquats Zustand

## 4. Optimisation

### Chargement et bundles

Objectif:

- reduire le poids du boot et le cout du premier rendu

Actions:

- etudier un chargement differe pour certaines grosses donnees non critiques au boot
- revoir le chunking Vite/Rollup des blocs lourds:
  - overlays
  - dungeon blob
  - Three.js stack
- identifier ce qui peut etre lazy-load sans casser l'experience de demarrage

Priorites concretes apres le dernier build:

- `three-core` ~ `728 kB`
- `dungeon-render` ~ `358 kB`
- `react-vendor` ~ `193 kB`
- `three-r3f` ~ `162 kB`
- `game-db-items` ~ `120 kB`
- `game-db-weapon-attacks` ~ `108 kB`
- `game-db-creatures` ~ `42 kB`
- `hud-ui` ~ `32 kB`
- `champion-sheet` ~ `27 kB`
- les maps du donjon sont maintenant deja separees en chunks `level-XX`, le `game_db` runtime a lui aussi ete casse en slices, et l'ancien blob `overlay-data` a ete remplace par des chunks `wall_overlays/map-XX`; le prochain gain viendra donc surtout du preload plus fin de ces slices et de la pile de rendu Three.js

Lecture utile:

- le runtime dungeon est maintenant charge via `bootstrap.json` puis `maps/level-XX.json` dans `dungeonData.ts`
- `gameDbData.ts` precharge maintenant des slices dediees `items / weapon attacks / creatures`, tout en gardant `preloadGameDbData()` comme facade de transition
- le tout premier boot a ete allégé: `LoadingScreen` ne chauffe plus que les visuels du titre et le bootstrap du donjon, puis le warm-up lourd bascule vers la phase titre et les sas explicites `Preparing Title Screen` / `Enter` / `Resume`
- le warm-up titre a maintenant aussi ete etalé en vagues idle dans `GameRoot`, et le preload de fond des niveaux cede la main entre chaque niveau; le prochain gain devra donc venir surtout du contenu charge et du rendu, plus d'un simple deplacement du preload
- les overlays muraux passent maintenant par un loader asynchrone par map; le gros gain data cote overlays a donc deja ete obtenu
- la scene gameplay n'importe plus activement `@react-three/drei`; le gain facile sur la pile R3F a donc deja ete capte, et la suite demandera plutot du profilage sur `DungeonScene` / `three-core`
- `DungeonScene` est maintenant deja decoupe en plusieurs couches VFX dediees (`DungeonProjectileLayers`, `DungeonSpellImpactLayer`, `DungeonMagicVisionLayer`); la suite utile n'est donc plus de sortir des micro-blocs, mais de profiler ce qui reste dans `three-core` / `dungeon-render`
- le prochain gain ne viendra donc pas d'un simple `manualChunks`, deja present, mais plutot de:
  - reduire la taille des datasets embarques
  - verifier si certains preloads visuels actuellement bloques au boot doivent rester au titre ou peuvent passer par un sas de transition entre niveaux sans nuire au ressenti
  - profiler plus finement `DungeonScene` et sa dependance a `three-core` / `three-r3f`, qui restent la vraie masse du rendu
  - verifier si certains consommateurs forcent encore un preload complet trop tot alors que le format est maintenant compatible avec un preload par niveau, un preload de voisinage et une hydratation monde progressive

### Rendu runtime

Objectif:

- gagner en fluidite sans regresser visuellement

Actions:

- profiler DungeonScene, HUD et ChampionSheet en situation reelle
- verifier les rerenders evitables autour du store
- surveiller les listes d'effets visuels, projectiles et decals muraux
- ajouter pendant le polish HUD un feedback visuel discret de level-up sur le portrait du champion, assez visible pour attirer l'oeil sans devenir envahissant

## 5. Organisation du projet

### Docs

Objectif:

- garder une memoire projet courte, fiable, non contradictoire

Actions:

- conserver `PROJECT_STATE_INDEX.md` comme point d'entree
- eviter les verites paralleles entre README et docs
- dater les audits importants
- noter explicitement quand un sujet passe de `approx/open` a `wrapper historique` ou `clos`

### Frontend / UX

Objectif:

- rendre l'alpha plus lisible sans melanger cela avec la fidelite moteur

Actions:

- integrer plus tard une aide de demarrage simple pour nouveaux joueurs
- continuer a distinguer clairement:
  - ergonomie alpha
  - presentation moderne
  - fidelite gameplay originale

## 6. Regle de travail recommandee

Pour les prochaines passes:

- quand un fichier touche affiche du mojibake ou un encodage casse, le corriger dans la meme passe
- quand un fallback reste necessaire, le nommer et le documenter comme tel
- quand un bloc devient source-backed, laisser une trace dans les docs puis simplifier les vieux wrappers

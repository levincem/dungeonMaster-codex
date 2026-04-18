# Dungeon Master Remake - Etat du projet

Version remise a jour a partir du code observe le `2026-04-18`.

## Resume rapide

Le projet est maintenant une base jouable et serieuse, avec une vraie boucle d'exploration, un runtime nourri par les donnees extraites du jeu original, et une grosse partie des systemes majeurs deja recales.

Le point important a ce stade:

- l'extraction des donnees originales essentielles est consideree comme fiable
- la dette principale n'est plus "trouver les donnees", mais "fermer les derniers ecarts de fidelite, nettoyer l'UX et optimiser"
- le projet doit maintenant etre traite comme une alpha desktop-first jouable, pas comme un prototype
- la reference prioritaire pour la fidelite runtime est la branche PC DOS `DM12/DM13`; l'Atari ST sert surtout de recoupement quand les comportements restent tres proches

Docs de reference a privilegier pour l'etat courant:

- [docs/PROJECT_STATE_INDEX.md](/D:/DungeonMaster-codex/docs/PROJECT_STATE_INDEX.md)
- [docs/FIDELITY_100_VERDICT.md](/D:/DungeonMaster-codex/docs/FIDELITY_100_VERDICT.md)
- [docs/FIDELITY_REMAINING_MATRIX.md](/D:/DungeonMaster-codex/docs/FIDELITY_REMAINING_MATRIX.md)
- [docs/RUNTIME_ALIGNMENT_AUDIT.md](/D:/DungeonMaster-codex/docs/RUNTIME_ALIGNMENT_AUDIT.md)

## Session 2026-04-18

Points consolides dans cette passe:

- le degonflage de [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts) a continue jusqu'a sortir l'essentiel des wrappers d'orchestration Zustand encore repetitifs ou stateful
- la persistence locale du `store` vit maintenant dans [src/engine/systems/storePersistenceRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storePersistenceRuntime.ts), qui centralise le payload de sauvegarde, l'hydratation, `saveGame`, `loadGame` et `returnToTitle`
- les transitions UI/runtime courtes du `store` vivent maintenant dans [src/engine/systems/storeUiRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeUiRuntime.ts), y compris `mirror`, `party member`, `options`, `floor drag`, `goToLevel`, `tryOpenGate`, `turnLeft`, `turnRight`, `selectChampion` et `reorderParty`
- les actions a patch optionnel sont maintenant factorisees dans [src/engine/systems/storePatchRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storePatchRuntime.ts), ce qui retire du `store` une nouvelle couche de plomberie repetitive
- les entrees `addToParty` et `removeFromParty` sont maintenant sorties vers [src/engine/systems/storePartyRosterRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storePartyRosterRuntime.ts)
- les derniers wrappers d'etat du `store` ont ete sortis vers [src/engine/systems/storeStateRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeStateRuntime.ts), qui porte maintenant notamment `killCreature`, `killChampion`, `setGameOptions`, `sleep` et `wakeUp`
- les wrappers item/restauration restants ont ete sortis vers [src/engine/systems/storeItemRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeItemRuntime.ts), qui porte maintenant `useItem`, `fillWaterContainer` et `resurrectChampion`
- la boucle temporelle top-level du `store` passe maintenant aussi par [src/engine/systems/storeFrameRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeFrameRuntime.ts), qui centralise le wiring de `tickFrame`, `regenTick` et `tickMovement` au-dessus de `tickFrameState`, `storeTimeRuntime` et `timeStateTicks`
- les derniers wrappers top-level de gameplay `attackFront`, `castSpell`, `tickSpells` et `tickMonsters` passent maintenant aussi par [src/engine/systems/storeGameplayRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeGameplayRuntime.ts), ce qui retire du `store` un nouveau bloc d'orchestration dense autour du combat, des sorts et de la boucle monstre
- l'extraction des helpers capteurs restants du `store` a continue dans [src/engine/systems/storeSensorRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeSensorRuntime.ts), qui centralise maintenant le noyau `snapshot / diff / queue / generator / wall sensor` encore local au wiring Zustand
- [src/engine/systems/storeCreatureRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeCreatureRuntime.ts) porte maintenant aussi l'etat mutable externe des creatures (`timers`, `attack windows`, `confused/fluxcage/frightened`, `last seen`) et les listeners runtime associes
- [src/engine/systems/storePartyRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storePartyRuntime.ts) centralise maintenant les wrappers party/survie/degats encore restants du `store`, y compris `advanceSurvivalTime`, `isPartyRested`, `buildCombatTickPatch`, `computeMovementCooldown`, `buildPartyDamageDeps`, `applyPartyLoadBasedFatigue` et `applyPartyMoveFatigue`
- [src/engine/systems/storeMovementRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeMovementRuntime.ts) centralise maintenant les wrappers de transport/deplacement encore locaux au `store`, en couvrant `applyImmediateTransportSquareEffects`, `resolvePartyStepTransport` et le builder `buildPartyMoveDeps`
- [src/engine/systems/storeWorldRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeWorldRuntime.ts) centralise maintenant le bootstrap monde/generateurs encore local au `store`, en couvrant creatures initiales, items de sol, pits/teleporteurs/textes ouverts, loadouts de depart et wrappers de generation reserves
- [src/engine/systems/storeChampionRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeChampionRuntime.ts) centralise maintenant les helpers champion purs encore restants du `store`, en couvrant `vitals`, clamps faim/soif, bonus de maitrise, relax des stats et conversion d'objets comme la fiole vide
- [src/engine/systems/storeChampionStateRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeChampionStateRuntime.ts) centralise maintenant un autre noyau historique `champion/combat state` encore local au `store`, en couvrant blessures, poison, overflow d'endurance, criteres temporels originaux, gain d'XP de competence et wrapper de resolution d'attaque entrante
- [src/engine/systems/storeCombatRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeCombatRuntime.ts) centralise maintenant le paquet utilitaire `combat / projectile / item runtime` encore disperse dans le `store`, en couvrant notamment les stats d'arme en main, les checks de cast originaux, les helpers de projectile/porte immediate, les charges d'objet, les drops et le lancer d'objet transporte
- [src/engine/systems/storeCreatureSpatialRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeCreatureSpatialRuntime.ts) centralise maintenant le noyau spatial historique `group ids / capacite de tuile / cellules de creature / partage de tuile / line of sight` qui restait encore local au `store`
- [src/engine/systems/storeBootstrapRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeBootstrapRuntime.ts) centralise maintenant le bootstrap d'etat initial du `store`, en couvrant l'etat frais du donjon, les valeurs par defaut et l'initialisation des grandes collections runtime
- [src/engine/systems/storeEndgameRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeEndgameRuntime.ts) centralise maintenant le petit noyau `endgame` encore local au `store`, en couvrant les evenements visuels de fusion, les poison clouds generes, les messages de fin et les constantes d'orchestration associees
- [src/engine/systems/storeWallInteractionRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeWallInteractionRuntime.ts) couvre maintenant aussi les runners stateful des interactions `front wall`, de `activateWallSensor` et le builder de deps `Vi Altar`
- le packaging runtime des donnees a ete rebase de `src/assets/data/` vers [src/assets/runtime](/D:/DungeonMaster-codex/src/assets/runtime), avec un split `bootstrap + maps/level-XX + db/reference/support`
- [src/data/dungeonData.ts](/D:/DungeonMaster-codex/src/data/dungeonData.ts) lit maintenant un bootstrap compacte puis des maps par niveau, tout en gardant un preload complet compatible avec le runtime actuel
- [vite.config.ts](/D:/DungeonMaster-codex/vite.config.ts) preserve maintenant les chunks `level-XX` au lieu de re-fusionner les maps du donjon dans un blob unique
- `original_teleporters_runtime.json` fait maintenant officiellement partie du package runtime genere et du manifeste, au lieu de rester un fichier isole dans l'ancien layout
- [src/engine/systems/storeBootstrapRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeBootstrapRuntime.ts) garde maintenant l'etat `title` leger, sans hydrater tout le monde runtime au chargement du module
- le bootstrap runtime genere par [assets/OriginalDataExtraction/parse_full.cjs](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/parse_full.cjs) inclut maintenant aussi `defaultOpenPits`, `defaultOpenTeleporters` et `defaultVisibleTexts`, ce qui permet de reconstituer les marqueurs monde "cheap" sans recharger toutes les maps
- la persistence porte maintenant `hydratedLevels`, ce qui permet de sauver/restaurer quels niveaux ont deja materialise leurs creatures et items au lieu de supposer un monde complet toujours hydrate
- [src/engine/systems/storeWorldRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeWorldRuntime.ts) sait maintenant construire creatures et items par niveau, et les transitions inter-niveaux hydratent explicitement le niveau cible avant telefrag / capteurs / effets immediats
- [src/components/UI/LoadingScreen.tsx](/D:/DungeonMaster-codex/src/components/UI/LoadingScreen.tsx) ne precharge plus que le bootstrap du donjon au boot; [src/GameRoot.tsx](/D:/DungeonMaster-codex/src/GameRoot.tsx) ne precharge ensuite plus que `level-00` pour une nouvelle partie ou le niveau du save pour `Resume`, au lieu de forcer tout le donjon
- le packaging runtime `game_db` est maintenant lui aussi decoupe: [assets/OriginalDataExtraction/parse_full.cjs](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/parse_full.cjs) genere toujours [src/assets/runtime/db/game_db.json](/D:/DungeonMaster-codex/src/assets/runtime/db/game_db.json) pour les audits et la transition, mais aussi [game_db_items.json](/D:/DungeonMaster-codex/src/assets/runtime/db/game_db_items.json), [game_db_weapon_attacks.json](/D:/DungeonMaster-codex/src/assets/runtime/db/game_db_weapon_attacks.json) et [game_db_creatures.json](/D:/DungeonMaster-codex/src/assets/runtime/db/game_db_creatures.json) pour le runtime reel
- [src/data/gameDbData.ts](/D:/DungeonMaster-codex/src/data/gameDbData.ts) precharge maintenant ces slices dediees au lieu d'un seul blob, et les consommateurs majeurs (`items`, `weaponAttacks`, `creatures`, `sounds`) ont ete realignes sur ce split
- [src/components/UI/LoadingScreen.tsx](/D:/DungeonMaster-codex/src/components/UI/LoadingScreen.tsx) attend maintenant aussi explicitement les overlays muraux, le module d'effets de sorts et le catalogue complet d'images d'items au lieu de les laisser partir en preload "best effort"
- [src/GameRoot.tsx](/D:/DungeonMaster-codex/src/GameRoot.tsx) precharge maintenant le voisinage du niveau utile (`niveau courant +/- 1`) avant `Enter` / `Resume`, puis rechauffe le reste des maps en arriere-plan pendant la partie, ce qui reduit fortement le risque de transition casse entre deux niveaux sans revenir a un preload monolithique au titre
- le packaging runtime des overlays muraux est maintenant lui aussi decoupe: [assets/OriginalDataExtraction/parse_full.cjs](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/parse_full.cjs) genere toujours [src/assets/runtime/support/original_wall_overlay_positions.json](/D:/DungeonMaster-codex/src/assets/runtime/support/original_wall_overlay_positions.json) comme snapshot compact canonique, mais aussi [src/assets/runtime/support/wall_overlays](/D:/DungeonMaster-codex/src/assets/runtime/support/wall_overlays) avec un fichier `map-XX.json` par niveau pour le runtime reel
- [src/data/originalWallOverlayData.ts](/D:/DungeonMaster-codex/src/data/originalWallOverlayData.ts) charge maintenant ces overlays par map, expose un preload de voisinage et garde un warm-up complet seulement en arriere-plan depuis l'ecran titre
- [src/data/originalWallOverlays.ts](/D:/DungeonMaster-codex/src/data/originalWallOverlays.ts) indexe maintenant les positions d'overlay par map et expose aussi le catalogue complet des images d'overlay a precharger
- [src/components/UI/LoadingScreen.tsx](/D:/DungeonMaster-codex/src/components/UI/LoadingScreen.tsx) precharge maintenant explicitement le voisinage `overlay map 0 +/- 1` ainsi que toutes les images d'overlay mural, pour garder les visuels critiques chauds sans recharger un blob monolithique
- [src/GameRoot.tsx](/D:/DungeonMaster-codex/src/GameRoot.tsx) precharge maintenant le voisinage utile des overlays en meme temps que le voisinage utile des maps, puis rechauffe le reste des overlays en arriere-plan tant que l'on est sur le titre
- [src/preload/gameplayModulePreload.ts](/D:/DungeonMaster-codex/src/preload/gameplayModulePreload.ts) centralise maintenant aussi le prechauffage modulaire de `GameRoot`, `DungeonScene`, `HUD`, `MirrorPopup`, `ChampionSheet`, `VictoryScreen` et des effets de sorts, au lieu de laisser ces chunks gameplay arriver uniquement a la demande
- [src/preload/gameplayModulePreload.ts](/D:/DungeonMaster-codex/src/preload/gameplayModulePreload.ts) attend maintenant aussi le preload `game_db` avant d'importer `GameRoot`, ce qui evite les acces sync trop precoces aux slices runtime pendant un boot a froid
- [src/preload/gameplayVisualPreload.ts](/D:/DungeonMaster-codex/src/preload/gameplayVisualPreload.ts) distingue maintenant les visuels du titre et les visuels gameplay lourds, avec un cache de preload dedie
- [src/App.tsx](/D:/DungeonMaster-codex/src/App.tsx) prechauffe maintenant `GameRoot` pendant l'ecran de bienvenue, ce qui retire encore un petit palier de chargement juste avant l'arrivee au titre interactif
- [src/App.tsx](/D:/DungeonMaster-codex/src/App.tsx) affiche maintenant aussi un sas explicite `Preparing Title Screen` si l'utilisateur continue avant la fin du warm-up du runtime titre
- [src/GameRoot.tsx](/D:/DungeonMaster-codex/src/GameRoot.tsx) affiche maintenant aussi un sas de preload explicite pour `Enter` / `Resume`, le temps de finir le preload gameplay coeur (`niveau utile`, overlays utiles, slices `game_db`, `DungeonScene`, `HUD`, effets de sorts)
- [src/components/UI/LoadingScreen.tsx](/D:/DungeonMaster-codex/src/components/UI/LoadingScreen.tsx) a ete allégé: il ne precharge plus que les visuels du titre et le bootstrap du donjon, au lieu de bloquer le tout premier boot sur les gros assets gameplay
- [vite.config.ts](/D:/DungeonMaster-codex/vite.config.ts) sort maintenant aussi des chunks UI explicites `hud-ui`, `champion-sheet`, `mirror-popup` et `victory-screen`, ce qui rend la pile de rendu plus lisible au build et plus facile a profiler ensuite
- [src/components/Dungeon/renderHelpers.tsx](/D:/DungeonMaster-codex/src/components/Dungeon/renderHelpers.tsx) centralise maintenant les helpers de rendu legers (`useLoadedTexture`, `BillboardGroup`) et la scene gameplay n'importe plus activement `@react-three/drei`
- [src/components/Dungeon/DungeonScene.tsx](/D:/DungeonMaster-codex/src/components/Dungeon/DungeonScene.tsx) utilise maintenant une `perspectiveCamera` R3F native au lieu de `PerspectiveCamera`, ce qui retire un dernier morceau de dependance a `drei` dans le chemin de rendu actif
- a ce stade, [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts) est tombe a `2369` lignes et se comporte beaucoup plus comme un point de composition/wiring que comme un depot de logique d'action
- la part encore dense du `store` n'est plus principalement le tableau d'actions Zustand: ce sont surtout des helpers historiques plus bas niveau, de l'assemblage local de dependances et quelques utilitaires runtime restes sur place
- la validation locale de cette passe est verte au `2026-04-18`: `node .\\assets\\OriginalDataExtraction\\parse_full.cjs`, `npm.cmd run build` et `npm.cmd test` passent; la suite de tests est maintenant a `517` tests verts

Impact de maintenance:

- le chantier "terminer le store" est maintenant largement ferme au niveau des wrappers d'action et de la plomberie d'orchestration
- les familles `sensor / generator / wall runtime helpers`, puis `party / survival / movement transport`, puis `world bootstrap / generator wrappers`, puis `champion helper runtime`, ne sont plus majoritairement inline dans le `store`; elles ont maintenant des points de verite dedies et testes
- la famille `champion state / incoming attack / poison / skill XP` a maintenant elle aussi un point de verite dedie et teste, au lieu d'un bloc historique encore local au `store`
- la famille `combat / projectile / item utility runtime` a maintenant elle aussi un point de verite dedie hors `store`, ce qui retire encore un bloc melangeant checks de cast, outils de lancer, helpers de portes immediates et plomberie d'objets
- la famille `creature spatial / occupancy / LOS` a maintenant elle aussi un point de verite dedie hors `store`, ce qui retire encore un bloc historique melangeant ids de groupe runtime, normalisation des sous-cases, partage de tuiles et ligne de vue
- le bootstrap d'etat initial et le petit noyau `endgame` ont maintenant eux aussi des points de verite dedies hors `store`, ce qui permet raisonnablement de considerer le `store` comme assaini dans son role de couche de composition
- cote data runtime, le donjon n'est plus le seul gros blob a avoir ete casse: le `game_db` runtime n'alimente plus un chunk unique, ce qui clarifie la frontiere `items / attacks / creatures` et prepare les prochaines optimisations de preload
- cote data runtime, les overlays muraux ne vivent plus eux non plus dans un gros chunk de positions unique: le vieux `overlay-data` a ete remplace par un petit loader et des chunks `wall_overlays/map-XX`, ce qui retire un gros poids du boot tout en gardant les visuels critiques precharges
- cote preload runtime, l'entree en jeu n'attend plus seulement la data: elle prechauffe maintenant aussi la coque `GameRoot` puis les modules gameplay coeur (`DungeonScene`, `HUD`, effets de sorts), avec un sas visible si le warm-up n'est pas fini au clic
- cote rendu, la pile gameplay est maintenant mieux scindee au build (`GameRoot`, `hud-ui`, `champion-sheet`, `mirror-popup`, `victory-screen`, `dungeon-render`), la scene n'importe plus activement `@react-three/drei`, et le chunk `three-r3f` est retombe a environ `161.6 kB`; le vrai prochain hotspot reste maintenant surtout `three-core` puis `dungeon-render`
- la suite logique n'est plus de sortir a tout prix chaque petite closure restante, mais plutot:
  - documenter l'etat reel obtenu
  - garder les tests cibles sur les modules runtime extraits
  - finir les derniers helpers historiques par familles metier coherentes
  - puis choisir entre optimisation, playtests de fidelite et gros composants UI encore volumineux

## Session 2026-04-17

Points consolides dans cette passe:

- le coeur gameplay anciennement suffixe `Approx` a ete largement sorti du `store` vers des helpers purs et testes
- `luck`, `quickness`, `resistances`, `wound defense`, `shield defense`, `projectile impacts`, `XP/level-up`, `survival/regen/sleep` sont maintenant beaucoup mieux recales et mieux documentes
- une premiere passe de maintenabilite a aussi renomme dans `store.ts` les vieux wrappers gameplay `Approx` qui ne designaient plus de vraie approximation
- une deuxieme passe de maintenabilite a commence a sortir du `store` l'orchestration runtime des degats de party vers [src/engine/systems/partyIncomingDamageState.ts](/D:/DungeonMaster-codex/src/engine/systems/partyIncomingDamageState.ts)
- une troisieme passe a commence a sortir du `store` l'orchestration de transport de pas de la party vers [src/engine/systems/partyStepTransport.ts](/D:/DungeonMaster-codex/src/engine/systems/partyStepTransport.ts)
- une quatrieme passe a commence a sortir du `store` l'orchestration des effets immediats de transport vers [src/engine/systems/partyImmediateTransportEffects.ts](/D:/DungeonMaster-codex/src/engine/systems/partyImmediateTransportEffects.ts)
- une cinquieme passe a centralise le cablage transport runtime dans [src/engine/systems/transportRuntimeDeps.ts](/D:/DungeonMaster-codex/src/engine/systems/transportRuntimeDeps.ts), ce qui retire au `store` une bonne partie des builders de deps lies aux pits, teleporteurs et capteurs de mouvement
- une sixieme passe a sorti aussi le cablage `CLIMB DOWN` dans [src/engine/systems/climbDownRuntimeDeps.ts](/D:/DungeonMaster-codex/src/engine/systems/climbDownRuntimeDeps.ts)
- une septieme passe a centralise le cablage des capteurs et interactions murales dans [src/engine/systems/sensorRuntimeDeps.ts](/D:/DungeonMaster-codex/src/engine/systems/sensorRuntimeDeps.ts), y compris mouvement, evenements differes, push sensors, wall sensors, alcoves et echanges muraux
- une huitieme passe a commence a sortir le noyau runtime des capteurs dans [src/engine/systems/sensorRuntimeCore.ts](/D:/DungeonMaster-codex/src/engine/systems/sensorRuntimeCore.ts), avec les requetes capteurs, les cibles sonores de portes, la revelation murale et la mise en file / resolution immediate des effets simples
- une neuvieme passe a sorti le coeur `direct / floor / wall` du declenchement capteurs dans [src/engine/systems/sensorTriggeredEffects.ts](/D:/DungeonMaster-codex/src/engine/systems/sensorTriggeredEffects.ts)
- une dixieme passe a etendu [src/engine/systems/sensorRuntimeCore.ts](/D:/DungeonMaster-codex/src/engine/systems/sensorRuntimeCore.ts) pour y sortir aussi les helpers d'etat capteurs (`key`, `snapshot`, `runtimeData`, `placement`) et la construction des projectiles de wall launchers, avec une injection explicite des donnees d'objets physiques depuis le `store`
- une onzieme passe a sorti l'activation runtime des generateurs vers [src/engine/systems/sensorGeneratorRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/sensorGeneratorRuntime.ts), en isolant cooldown, reservation, blocage de case et mise en file des retries
- une douzieme passe a sorti la composition des groupes de creatures generes vers [src/engine/systems/generatedCreatureGroups.ts](/D:/DungeonMaster-codex/src/engine/systems/generatedCreatureGroups.ts), avec tests sur capacite, sous-cases et creation effective du groupe
- une treizieme passe a sorti l'etat runtime des sous-cases de creatures vers [src/engine/systems/creatureTileState.ts](/D:/DungeonMaster-codex/src/engine/systems/creatureTileState.ts), avec tests sur capacite locale, attribution des cellules, normalisation par tuile et occupation de cellule
- une quatorzieme passe a sorti l'orchestration d'attaque d'un monstre vers [src/engine/systems/monsterAttackTurn.ts](/D:/DungeonMaster-codex/src/engine/systems/monsterAttackTurn.ts), avec tests cibles sur l'avance de contact et la resolution d'attaque
- une quinzieme passe a sorti l'orchestration de mouvement d'un monstre vers [src/engine/systems/monsterMovementTurn.ts](/D:/DungeonMaster-codex/src/engine/systems/monsterMovementTurn.ts), avec tests sur les cas `fluxcage`, `hold` et plan de groupe partage
- une seizieme passe a sorti la finalisation de destination d'un monstre vers [src/engine/systems/monsterDestinationTurn.ts](/D:/DungeonMaster-codex/src/engine/systems/monsterDestinationTurn.ts), avec tests sur la conservation de tableau quand rien ne change et la normalisation des tuiles source/destination
- une dix-septieme passe a sorti la preparation d'un tour monstre vers [src/engine/systems/monsterTurnState.ts](/D:/DungeonMaster-codex/src/engine/systems/monsterTurnState.ts), avec tests sur l'initialisation des timers, la detection de la party, la memoire de cible et les flags runtime
- une dix-huitieme passe a assemble ces briques dans [src/engine/systems/monsterSingleTurn.ts](/D:/DungeonMaster-codex/src/engine/systems/monsterSingleTurn.ts), de sorte que [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts) ne garde plus essentiellement que l'application des maps runtime externes et les side-effects audio/UI
- une dix-neuvieme passe a sorti la boucle complete `tickMonsters` dans [src/engine/systems/monsterTickRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/monsterTickRuntime.ts), ce qui laisse au `store` surtout le cablage des maps runtime externes et les callbacks audio/UI
- une vingtieme passe a sorti la boucle projectiles / nuages toxiques de `tickSpells` dans [src/engine/systems/spellProjectileTickRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/spellProjectileTickRuntime.ts), avec conservation des impacts party/creatures, de la continuation de projectile et des pulses de poison cloud
- une vingt-et-unieme passe a sorti l'orchestrateur commun des deplacements party vers [src/engine/systems/partyMoveCommand.ts](/D:/DungeonMaster-codex/src/engine/systems/partyMoveCommand.ts), ce qui retire enfin du `store` la duplication entre `moveForward`, `moveBackward`, `strafeLeft` et `strafeRight`
- une vingt-deuxieme passe a sorti l'orchestration top-level de `attackFront` vers [src/engine/systems/attackFrontRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/attackFrontRuntime.ts), avec un helper pur qui ne charge plus les tables d'armes au module load et des tests dedies sur les chemins projectile, utilitaire et melee
- une vingt-troisieme passe a sorti l'orchestration top-level de `castSpell` vers [src/engine/systems/castSpellRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/castSpellRuntime.ts), ce qui laisse au `store` surtout les closures de dependances metier autour de la preparation, des sorts non projectiles et des projectiles
- une vingt-quatrieme passe a sorti les commandes runtime `pickup / drop` vers [src/engine/systems/floorItemCommandRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/floorItemCommandRuntime.ts), ce qui retire du `store` la duplication `pickupItem / pickupItemToChampion` et la logique directe `dropItem` autour de l'autel, des capteurs de sol et des effets de transport immediats
- une vingt-cinquieme passe a termine la famille des commandes objet en sortant `useItem`, `fillWater` et les wrappers d'interaction objet sur mur de face vers [src/engine/systems/itemCommandRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/itemCommandRuntime.ts), avec tests dedies sur l'usage, le remplissage a la fontaine et les deux chemins d'interaction murale
- une vingt-sixieme passe a sorti `throwCarriedItem` et `resurrectChampion` vers [src/engine/systems/itemCarryCommandRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/itemCarryCommandRuntime.ts), puis a extrait l'orchestrateur top-level de `tickSpells` vers [src/engine/systems/tickSpellsRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/tickSpellsRuntime.ts), ce qui laisse au `store` surtout le builder de dependances projectile/poison cloud au lieu du flux complet
- une vingt-septieme passe a sorti le reliquat des transferts d'inventaire/equipement (`dropCarriedItem`, `equipItem`, `unequipItem`, `giveItem`, `giveEquippedItem`) vers [src/engine/systems/itemTransferCommandRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/itemTransferCommandRuntime.ts), ce qui retire encore au `store` plusieurs wrappers CRUD qui ne faisaient plus que de la validation et de la delegation
- une vingt-huitieme passe a sorti l'orchestrateur de commande `castSpell` vers [src/engine/systems/castSpellCommandRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/castSpellCommandRuntime.ts), ce qui retire du `store` la grosse fermeture top-level du cast et laisse surtout les deps runtime explicites autour des sorts non projectiles et des projectiles
- une vingt-neuvieme passe a sorti le builder dense de dependances projectile de `tickSpells` vers [src/engine/systems/tickSpellsProjectileDeps.ts](/D:/DungeonMaster-codex/src/engine/systems/tickSpellsProjectileDeps.ts), en y deplacant aussi les helpers d'impact projectile, d'explosion, de poison cloud lingering et de disruption `nonmaterial`, ce qui laisse au `store` surtout le cablage runtime haut niveau et les deux callbacks encore lies a l'etat courant
- une trentieme passe a termine l'extraction des builders de dependances `sensor / transport / CLIMB DOWN` hors du `store`, en deplacant leur assemblage vers [src/engine/systems/sensorRuntimeDeps.ts](/D:/DungeonMaster-codex/src/engine/systems/sensorRuntimeDeps.ts), [src/engine/systems/transportRuntimeDeps.ts](/D:/DungeonMaster-codex/src/engine/systems/transportRuntimeDeps.ts) et [src/engine/systems/climbDownRuntimeDeps.ts](/D:/DungeonMaster-codex/src/engine/systems/climbDownRuntimeDeps.ts), ce qui laisse [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts) plus proche d'un vrai point de composition Zustand et moins d'un depot de builders locaux
- une trente-et-unieme passe a sorti le cablage top-level des sorts du `store` vers [src/engine/systems/storeSpellRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeSpellRuntime.ts), qui porte maintenant l'orchestration runtime de `castSpell` et `tickSpells`; le `store` ne garde plus que les callbacks stateful indispensables et les side-effects externes comme le son d'ouverture de porte
- une trente-deuxieme passe a sorti l'assemblage des dependances runtime de `tickFrame` vers [src/engine/systems/tickFrameRuntimeDeps.ts](/D:/DungeonMaster-codex/src/engine/systems/tickFrameRuntimeDeps.ts), ce qui retire du `store` le gros objet inline de deps exploration/sleep/endgame/pending events et laisse `tickFrame` plus proche d'un vrai point d'orchestration
- une trente-troisieme passe a sorti l'etat runtime et le paquet de dependances de `tickMonsters` vers [src/engine/systems/storeMonsterRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeMonsterRuntime.ts), ce qui retire du `store` le gros assemblage inline du tick monstre et clarifie enfin le contrat de la boucle IA
- une trente-quatrieme passe a recentralise dans [src/engine/systems/storeSpellRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeSpellRuntime.ts) une partie de la plomberie stateful de `tickSpells` (`party damage deps`, bindings de teleporter projectile et de resolution d'impact champion), ce qui retire encore du `store` plusieurs closures de cablage autour des sorts
- une trente-cinquieme passe a sorti les wrappers de deplacement party repetitifs vers [src/engine/systems/storePartyMoveRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storePartyMoveRuntime.ts), ce qui retire du `store` une bonne partie du cablage dupliqué `moveForward / moveBackward / strafeLeft / strafeRight` ainsi que leurs side-effects UI associes
- une trente-sixieme passe a sorti dans [src/engine/systems/storeMonsterRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeMonsterRuntime.ts) les deux derniers callbacks stateful principaux du tick monstre (`resolveMonsterAttackAgainstChampion` et `resolveCreatureTeleporterTransport`), ce qui laisse au `store` un bloc monstre encore plus proche d'un pur assemblage
- une trente-septieme passe a sorti le cablage runtime restant des interactions murales vers [src/engine/systems/storeWallInteractionRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeWallInteractionRuntime.ts), ce qui retire du `store` le wiring direct de `activateWallSensor`, des interactions `front wall` et du `Vi Altar`, avec tests dedies sur l'application de patch, la decoration de resurrection et le nettoyage du drag de sol
- une trente-huitieme passe a sorti les helpers de feedback runtime (`messages`, `damage events`, `death dust`, celebration du `Vi Altar`) vers [src/engine/systems/storeFeedbackRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeFeedbackRuntime.ts), ainsi que le petit bloc portes/combat vers [src/engine/systems/storeDoorRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeDoorRuntime.ts); le `store` ne garde plus ici que le cablage Zustand et les appels aux sous-systemes, avec tests dedies sur les toggles de porte, le tick de porte, le tick combat et la decoration de resurrection
- une trente-neuvieme passe a sorti l'orchestration runtime locale de `attackFront` vers [src/engine/systems/storeAttackFrontRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeAttackFrontRuntime.ts), ce qui retire du `store` le gros cablage projectile / utilitaire / melee encore colle a la commande d'attaque de face, tout en gardant [src/engine/systems/attackFrontRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/attackFrontRuntime.ts) comme coeur top-level du flux
- une quarantieme passe a sorti la fabrique des degats runtime de party vers [src/engine/systems/storePartyDamageRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storePartyDamageRuntime.ts), ce qui retire du `store` le builder inline de `wall bump`, `fall impact`, `spell backlash` et `party-wide incoming attack` au profit d'un module dedie reutilise par les flux de mouvement et de sorts
- une quarante-et-unieme passe a sorti les petits wrappers `regen / sleep / endgame` vers [src/engine/systems/storeTimeRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeTimeRuntime.ts), ce qui retire du `store` trois helpers de plomberie encore purement delegataires et simplifie le cablage de `tickFrame` et `regenTick`
- une quarante-deuxieme passe a sorti le builder de deps `pickup / drop` au sol vers [src/engine/systems/storeFloorItemRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/storeFloorItemRuntime.ts), ce qui retire du `store` un autre bloc de plomberie locale autour de `pickupItem`, `pickupItemToChampion` et `dropItem`
- une quarante-troisieme passe a encore resserre la plomberie simple restante du `store`, en factorisant le cablage repetitif des deplacements party dans [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts) et en supprimant un wrapper combat local devenu mort; a ce stade, les reliquats "simples" restants sont surtout de petits builders ou callbacks stateful, plus de gros blocs de duplication evidente
- une quarante-quatrieme passe a sorti du corps des actions Zustand les gros pavés inline de `castSpell` et `tickSpells` dans [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts), en les regroupant dans des helpers locaux dedies; la logique reste au meme endroit mais le point d'entree runtime est maintenant plus lisible
- une quarante-cinquieme passe a fait la meme chose pour `tickFrame` et `regenTick` dans [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts), ce qui laisse les actions top-level encore plus proches d'un simple role d'orchestration
- une quarante-sixieme passe a fait sortir le gros assemblage inline de `tickMonsters` vers un helper local dedie dans [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts), sans deplacer la logique metier hors des modules monstres deja extraits
- une quarante-septieme passe a mutualise le cablage restant des interactions `front wall / Vi altar` dans [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts), en partageant enfin les deps et l'application des patches au lieu de dupliquer ces petits flows
- une quarante-huitieme passe a resserre les actions `saveGame / loadGame / pickupItem / pickupItemToChampion / dropItem` dans [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts), avec des helpers locaux de persistence et d'objets au sol pour reduire encore le bruit d'assemblage
- il ne reste plus de gros bloc gameplay central suivi comme "non prouve" dans la matrice de fidelite
- les vrais restes ouverts sont maintenant:
  - `0696.RAW1`
  - la structure runtime des groupes actifs / generateurs
  - quelques couches hybrides / fallbacks
  - la validation en jeu des cas rares et de la fin

## Passe recente frontend et prod

Les evolutions recentes visibles dans le code portent surtout sur la stabilite de la build web, le packaging runtime et le polish desktop-first.

Points recales:

- build production validee
- reorganisation des assets runtime sous `public/game/images` et `public/game/sounds`
- embarquement des JSON critiques sous `src/assets/runtime` pour fiabiliser le boot, avec `bootstrap + maps/level-XX`
- ecran titre avec `Enter The Dungeon` et `Resume`
- modale de bienvenue alpha bloquante au demarrage, plus aide rapide accessible depuis le HUD
- couche `i18n` simple avec anglais par defaut
- panneau d'options en jeu avec remapping des touches de deplacement
- blocage explicite sur smartphone tant qu'un vrai support mobile n'existe pas
- ecran de victoire branche
- instrumentation GA4 ajoutee pour suivre une session de jeu dans une SPA:
  - `game_start`
  - `game_resume`
  - `game_heartbeat`
  - `game_end`
  - `game_victory`

## Session 2026-04-15

Points fermes dans cette passe:

- generateurs de creatures au sol rebranches depuis une table source-backed compacte
- spawns de generateurs recales un cran plus loin:
  - creation atomique d'un vrai groupe runtime
  - `groupId` partage pour les creatures d'un meme groupe
  - formation initiale non artificielle au lieu d'un simple empilement centre puis renormalise
- comportement de vol des `Gigglers` recale:
  - le vol ne se limite plus a un objet aleatoire du backpack
  - certains slots equipes legers sont maintenant aussi ciblables
  - le Giggler repasse en fuite apres le vol dans l'esprit de la logique FTL
- override manuel `Alert` retire pour le `Screamer`; retour a la lecture source-backed de son attaque `Mental`
- actions d'objets source-backed restaurees au-dela des seules armes (`Block`, `Climb Down`, `Freeze Life`, `Flip`, etc.)
- placeholders originaux ajoutes pour les portes `iron` et `ra`, avec effet energie runtime sur les portes `Ra`
- recentrage automatique d'un monstre seul sur sa case, puis passage a de vraies sous-cases runtime pour les groupes (`frontLeft`, `frontRight`, `backLeft`, `backRight`)
- ciblage melee recale pour conserver la logique "meme colonne avant sinon autre cible joignable de la ligne avant" avec ces nouvelles sous-cases
- drops fixes de creatures recales sur `I559 creatureDroppings`, avec premiers objets maudits source-backed pour l'`Animated Armour`
- malus `-3 luck` par objet maudit equipe comme dans le moteur original; aucun blocage de retrait manuel n'est actuellement prouve par le source FTL recale
- `telefrag` retabli pour les arrivees forcees de la party par pit ou teleporter sur une case de creature
- ouverture immediate des pits / teleporteurs sous la party ou sous les creatures rebranchee dans le runtime, au lieu d'attendre un deplacement ulterieur
- `Lord Chaos` a retrouve un premier teleporter special cote IA: deplacement jusqu'a `2` cases avec case intermediaire ignoree, donc passage possible a travers murs et portes fermees comme dans la logique source
- sprites d'objets au sol remis dans la profondeur normale pour ne plus traverser visuellement les monstres
- teleporteurs recales un cran plus loin:
  - la party recupere la vraie rotation runtime source-backed
  - `back / strafe` declenchent aussi pits / stairs / teleporteurs
  - les projectiles traversent maintenant les teleporteurs ouverts avec rotation
  - les creatures reappliquent maintenant une rotation de sous-case approximative en traversant un teleporter
  - les reseaux de teleporteurs en chaine sont maintenant suivis sur plusieurs sauts pour la party, les creatures et les projectiles
- generateurs/groupes recales un cran plus loin:
  - chaque groupe genere garde maintenant sa propre identite runtime
  - les retries de generateur ne contournent plus la limite approximate des groupes actifs
  - les generateurs de sol locaux se declenchent maintenant aussi sur entree directe de la party

Decision de maintenance a ne plus reouvrir sans nouvelle evidence:

- les assets refaits / modernises sont prioritaires sur tous les bitmaps originaux equivalents
- les bitmaps originaux ne servent que de placeholders ou de secours temporaires
- aucune couche de compatibilite de sauvegarde n'est a maintenir tant que le projet n'est pas en beta; les recalages runtime peuvent casser les saves existantes pendant cette phase

Constat de scope important:

- les generateurs muraux d'objets `type 12` existent dans le format moteur general, mais ne sont pas presents dans le donjon runtime DM charge par l'application; ce n'est donc pas un trou gameplay actif a traiter en priorite

## Tour des systemes du jeu

### Flow global et progression

Etat actuel:

- ecran titre jouable avec `Enter The Dungeon` et `Resume`
- recrutement via miroirs fonctionnel
- sauvegarde / reprise persistentes via `localStorage`
- l'etat mutable du donjon, du groupe, des projectiles, effets et options est restaure
- ecran de victoire branche

Reste a faire:

- vrai game over
- playtest complet et cible du flow de fin autour du `Firestaff` complet et de Lord Chaos
  - volontairement reporte a plus tard tant que les chantiers runtime centraux ne sont pas clos

### Maps, geometrie et contenu spatial

Etat actuel:

- source de verite runtime: `src/assets/runtime/dungeon/bootstrap.json` + `src/assets/runtime/dungeon/maps/level-XX.json`
- parsing central via `src/data/dungeonData.ts` et `src/data/mapLoader.ts`
- portes, teleporteurs, trick walls, pits et eau sont presents dans les maps runtime
- overlays muraux originaux sont positions depuis les donnees extraites
- les pits ouverts sont rendus comme de vrais trous et peuvent provoquer une chute vers la case correspondante du niveau inferieur

Reste a faire:

- verifier finement les derniers cas specifiques de pits, eau et cartes rares
- continuer a tester les cas de teleports et transitions de niveau les plus atypiques
  - note: le cas source "creature teleportee sur une map interdite" n'est pas observable dans la campagne DM de reference actuelle, car les `allowedCreatureTypes` extraits sont vides sur toutes les maps de ce donjon

### Champions, UI et inventaire

Etat actuel:

- HUD principal jouable
- ChampionSheet complete avec drag and drop
- inventaire, equipement, transfert, ramassage et depot fonctionnent
- starters des champions recales sur la source canonique actuelle
- portraits, paths d'assets et resolution d'images ont ete securises
- save button disponible depuis la fiche champion
- panneau d'options disponible dans le HUD pour les touches de deplacement
- manuel d'aide en jeu integre depuis `src/i18n/help.en.json`, avec navigation par onglets verticaux
- HUD de debug plus explicite avec coords globales et locales (`g:` / `l:`) pour eviter les confusions entre lecture de map et position en jeu

Reste a faire:

- elargir les options exposees au joueur
- ajouter plus tard une aide basique d'onboarding pour les nouveaux joueurs
- continuer le polish desktop de certaines vues UI

### Objets, equipement et statuts

Etat actuel:

- objets, noms et grande partie des catalogues viennent maintenant des donnees extraites
- images d'objets beaucoup moins hardcodees, avec resolution plus systematique et quelques alias speciaux restants
- poids, equipement, eau, faim, soif, sommeil, fatigue et regeneration sont jouables

Reste a faire:

- garder un oeil sur quelques alias d'images et objets speciaux
- il reste une couche de compatibilite dans `items.ts` pour faire le pont entre data source, objets synthetiques et runtime

### Magie, runes et projectiles

Etat actuel:

- pipeline runtime reel branche autour de `src/data/runes.ts` et `src/engine/store.ts`
- le cablage projectile de `tickSpells` est maintenant centralise dans `src/engine/systems/tickSpellsProjectileDeps.ts`, ce qui retire du `store` les helpers locaux de resolution d'impact et d'effets de projectile
- ordre des runes runtime recale sur les `spellID` Atari / `i560`
- catalogue extrait des sorts recale sur les 25 descripteurs Atari, sans sorts de soin speculatifs dans `game_db`
- large set de sorts jouables et de projectiles differencies
- reussite des sorts recalee sur la logique source `ReDMCSB`:
  - niveau requis = `baseDifficulty + rune de puissance`
  - verification par paliers manquants avec seuil `wisdom + 15` borne a `115`
  - XP de cast derivee de la formule originale au lieu d'un gain moyen fixe
- energie initiale et decroissance des projectiles magiques recalees sur `MENUS.C` / `CHAMPION.C`
- impacts directs de `Fireball` et `Lightning Bolt` recales sur la formule de `PROJEXPL.C`
- `Poison Bolt` reapplique maintenant aussi sa composante poison avec resistance de creature issue de `i559`
- les projectiles magiques standards traversent de nouveau les creatures non materielles, sauf `Disrupt Nonmaterial`
- `Open Door` est maintenant lance comme un vrai projectile magique avec trajet, impact et VFX dedie, au lieu d'un simple effet instantane sur la premiere porte en ligne
- les potions buvables suivent maintenant les formules de `INVNTORY.C`:
  - `Ros/Ku/Dane/Neta` modifient bien les statistiques courantes, avec retour progressif vers la valeur max
  - `Mon` restaure l'endurance
  - `Ya` est traite comme une protection magique locale
  - `Ee` restaure le mana avec la meme logique de depassement adouci
  - `Vi` soigne et tente de guerir les blessures
  - `Water Flask` rehydrate et redevient une flasque vide
- le parser runtime conserve desormais aussi la `power` des potions dans `src/assets/data/dungeon.json`, au lieu de la perdre dans le snapshot compact
- `Ven Potion` et `Ful Bomb` jetes convertissent de nouveau leur `power` en impact toxique / feu au contact, au lieu de rester de simples projectiles physiques
- la nutrition des aliments suit maintenant bien `foodValues`; manger n'ajoute plus de regain d'endurance invente par le remake
- VFX de sorts et protections sensiblement ameliores
- `Lightning Bolt` a maintenant un rendu `Photons2` plus allonge, davantage lu comme un eclair que comme une boule
- `Fluxcage` visible et branche dans le runtime
- `Poison Cloud` n'est plus un simple burst:
  - le nuage persiste sur la case comme dans la source
  - il pulse avec decroissance interne et reste sauvegardable/rechargeable
  - `Ven Potion` jetee reutilise maintenant cette meme logique persistante
- `Disrupt Nonmaterial` suit maintenant mieux le cas special de `PROJEXPL.C`:
  - les creatures non materielles classiques sur la case prennent toutes le meme impact
  - `Materializer` / `Zytaz` ne peuvent etre touches que pendant leur fenetre d'attaque
  - leur degat utilise aussi la composante aleatoire supplementaire de la source
- faim, soif, nourriture et boisson ont ete reverifiees contre `CHAMPION.C` et `INVNTORY.C`:
  - regen mana, stamina, HP et cadence sommeil/eveil recalees sur la boucle de survie source (`64` ticks eveille, `16` en dormant)
  - le palier plus lent (`256` ticks eveille, `64` en dormant) ne sert plus qu'a la detente progressive des statistiques courantes vers leur maximum
  - nourriture et eau suivent bien les reserves `Food` / `Water`
  - boire une gourde ou une flasque applique de nouveau `+800` / `+1600` eau comme dans l'original
  - la fatigue appliquee a chaque pas suit de nouveau la formule source de deplacement `((Load * 3) / MaximumLoad) + 1`, au lieu d'un coefficient runtime errone qui vidait l'endurance beaucoup trop vite
- les degats de retour des sorts sur le groupe ne sont plus repartis par simple facteur avant/arriere; ils suivent maintenant une dispersion plus proche de `F324_aezz_CHAMPION_DamageAll_GetDamagedChampionCount`
- le combat creatures utilise maintenant plus directement la famille d'attaque originale en melee (`Blunt`, `Sharp`, `Magic`, `Fire`, `Mental`) au lieu d'un tirage hybride trop libre, et les shields magiques ne reduisent plus les attaques physiques par erreur
- la probabilite de blessure est maintenant recalee sur le seuil source `random(128) + 10` ajuste par la vitalite, au lieu d'une formule maison beaucoup plus agressive
- la mitigation des attaques creatures suit maintenant mieux le branchement original:
  - `Sharp` passe par la vraie voie `sharp defense` issue de `i559`
  - `Impact` divise de nouveau la defense
  - `Mental` passe par la sagesse plutot que par `Anti-Magic`
  - `Unconditional` n'utilise plus la mitigation physique standard
  - les shields tenus en main utilisent maintenant aussi la vraie table `Graphic 562` `G050 = [5,5,4,6,3,1]`, remontee dans le pipeline sous `woundDefenseFactors`
- les creatures lanceuses de sorts source-backed (`Vexirk`, `Wizard Eye`, `Materializer/Zytaz`, `Demon`, `Red Dragon`, `Lord Chaos`) recreent maintenant de vrais projectiles runtime avec type de missile et energie proches de `GROUP1.C`, au lieu d'un simple degat instantane a distance
- les fixed possessions de creatures suivent maintenant la vraie table `I559 creatureDroppings`, y compris les jets aleatoires de `Screamer Slice`, `Worm Round`, `Drumstick`, `Dragon Steak`, rochers, armes et armures fixes
- les impacts de projectiles de creatures sur le groupe suivent de nouveau plus directement `PROJEXPL.C`:
  - impact cible `tete/torse` pour le champion vise
  - explosion secondaire sur la case du groupe pour `Fireball` / `Lightning Bolt`
  - `Poison Cloud` sur la case du groupe reapplique une attaque normale sans blessures, puis laisse un nuage persistant
- les shields de sorts et objets ne sont plus traites comme des pourcentages generiques:
  - `Party Shield` et `Ya Potion` alimentent une vraie defense additive `physical`
  - `Spellshield` alimente une defense additive `magic`
  - `Fire Shield` / `Fireshield` alimentent une defense additive `fire`

Reste a faire:

- `src/data/spells.ts` reste encore un fichier legacy de reference
- quelques `reference_exports` peuvent encore garder une nomenclature de sorts plus ancienne que le runtime regenere
- quelques nuances fines de missiles / effets restent a verifier:
  - quelques `local effects` rares restent plus subtils que le simple ciblage `(x,y)`, meme si `F271` et la rotation locale de liste de sensors sont maintenant recables
  - l'effet local `ADD_EXPERIENCE` de `F270` n'apparait pas dans le donjon DM extrait actuel
- `Zo Ven` est de nouveau present dans la couche de reference extraite; son comportement runtime fin reste a confirmer par playtest
- les launchers muraux `type 14-15` existent cote moteur mais ne sont pas utilises dans le donjon DM extrait

### Mecanismes

Etat actuel:

- `src/data/mechanisms.ts` reconstruit maintenant une vue structuree depuis les sensors extraits du vrai donjon
- switches muraux et dalles pilotent correctement leur etat runtime
- leviers muraux relies a leurs sensors extraits et utilisables directement en scene
- les verrouillages muraux ne s'ouvrent plus automatiquement si la cle est simplement possedee
- usage explicite d'objet sur mecanisme mural via drag and drop
- alcoves et receptacles muraux fonctionnels
- objets montes sur mur visibles en scene
- capteurs `Hold`, possession et objets specifiques de sol recales
- rotation locale `F271` recablee sur un ordre persistant par face murale pour clics, locks, alcoves et echangeurs
- parser recale sur le vrai champ `Multiple` source-backed pour les sensors locaux / generators / launchers
- sensors reguliers `isLocal` recables sur une vraie branche locale au lieu d'une cible `(0,0)` parasite
- file d'evenements differee pour les mecanismes avec `delay`
- clic sonore partage pour switchs / dalles quand pertinent
- portes a bouton recalees sur un modele unique: un seul jambage et un `wall switch` fixe sur la face du jambage cote joueur, quel que soit le materiau de porte
- launchers muraux `type 7-10` recrees comme de vrais projectiles runtime, avec payloads `kineticEnergy/stepEnergy` issus du parser
- le depot d'ossements sur un `Vi Altar` repasse bien par `Bones` (`Misc typeId 5`) et n'attend plus un identifiant erronne
- la resurrection au `Vi Altar` ne repart plus a `1 HP`:
  - le maximum de sante est reduit comme dans `F283_CHAMPION_ViAltarRebirth`
  - le champion revient avec la moitie de ce nouveau maximum
- `Reincarnate` suit maintenant la procedure source de `CHAMPION.C`:
  - skills remises a zero
  - sante / endurance / mana divisees par deux
  - statistiques recalees par reduction au huitieme puis `12` increments aleatoires

Reste a faire:

- playtests cibles sur les cas rares et les grosses sequences combinatoires
- verification fine de quelques countdowns / cas de fin de jeu
- possiblement du polish visuel supplementaire sur certains overlays `in/out`

Verdict:

- les mecanismes sont maintenant globalement fonctionnels
- le risque restant est surtout de la fidelite fine, plus un pan entier manquant

### Creatures et IA

Etat actuel:

- les definitions runtime viennent beaucoup plus proprement des donnees extraites
- flags et ranges utiles maintenant importes et utilises:
  - `attackFromAllSides`
  - `attackRange`
  - `sightRange`
  - `preferBackRow`
  - `levitates`
  - `absorbMissiles`
  - `seeInvisible`
- les creatures peuvent franchir une porte ou grille ouverte
- memoire courte de poursuite
- portee de vue originale utilisee au lieu d'un rayon fixe
- gestion de l'invisibilite cote detection
- absorption de missiles pour les familles qui l'ont
- usage des teleporteurs par les monstres
- meilleur espacement des attaquants a distance et profils magiques / flottants / non materiels
- generateurs de creatures au sol revenus dans le runtime
- creature seule rendue au centre de sa case, au lieu d'un decalage lateral permanent

Reste a faire:

- plusieurs comportements tres fins restent encore interpretes plutot que reproduits instruction par instruction
- quelques familles speciales et cas de fin de jeu meritent encore des tests cibles
- garder pour plus tard une aide basique / onboarding de demarrage pour les nouveaux joueurs
- raffiner la fidelite des generateurs:
  - cadence exacte
  - saturation exacte des groupes actifs
  - cas limites de coexistence avec la party et les retries

Verdict:

- les donnees creatures sont bien mieux recalees
- l'IA a fortement progresse
- ce n'est pas encore une reproduction parfaite du runtime FTL

### Combat

Etat actuel:

- combat jouable
- attaques multiples par arme mieux gerees dans le HUD
- projectiles physiques et munitions ont progresse
- poison et steal sont branches cote monstres
- plusieurs timings gameplay importants ont ete recales sur une base plus proche de l'original
- degats flottants monstres visibles en scene et petit nuage de poussiere a la mort
- chute dans les pits: impact sonore et degats sur les champions vivants maintenant recales sur une vraie attaque source-backed `20` ciblee `legs/feet`, au lieu d'un petit jet maison

Reste a faire:

- certaines formules restent encore simplifiees
- la mitigation de degats reste intentionnellement "bug-fixee" sur un point: le runtime continue d'utiliser `Anti-Magic` / `Anti-Fire`, alors que le binaire original souffrait du bug compilateur `BUG0_41` qui les neutralisait largement
- `Rust` ne doit pas etre traite comme une mecanique manquante a rebrancher a tout prix: tout indique qu'elle avait ete prevue puis jamais reellement programmee dans le jeu cible
- `Immobilize` ne doit pas etre traite comme un manque: aucune trace fiable n'a ete retrouvee ni comme competence speciale de monstre ni comme sort
- `Teleport` ne doit pas etre traite comme un type d'attaque creature generique:
  - le vrai sujet restant est le teleporter special de `Lord Chaos`
  - d'apres la reference, il peut se teleporter jusqu'a `2` cases, a travers murs et portes fermees, sans subir de degats
  - ce point est maintenant rebranche dans l'IA, mais reste a verifier en playtest cible pour fermer completement l'alignement de fin de jeu
- `THRUST` est de nouveau traite comme une vraie attaque de melee, au lieu de retomber par erreur dans le fallback des actions non physiques
- `Freeze Life` est maintenant un vrai etat runtime source-backed, persiste en sauvegarde et ignore bien les creatures `archenemy`
- `Calm`, `Brandish`, `Blow Horn` et `War Cry` ne sont plus des no-op: ils reutilisent la resistance a la peur extraite depuis `i559` et poussent bien les creatures a fuir
- le sommeil n'est plus un gros fast-forward par clic: il est maintenant continu, tick par tick, et s'interrompt au prochain clic / appui clavier
- `FUSE` sur Lord Chaos ne passe plus directement de "mort" a l'ecran de victoire: le runtime joue maintenant une vraie phase `endgame` avec alternance Chaos/Order plus proche de `STARTND2.C`, apparition du Grey Lord, masquage des fluxcages, purge des autres groupes du niveau courant et bascule finale vers la victoire
- l'Amalgam de fin ne laisse plus absorber son energie trop tot: l'etat mural et le verrou logique suivent de nouveau la progression `ZOKATHRA -> gem libre -> Firestaff complet`
- la party recupere enfin la rotation source-backed des teleporteurs, et les deplacements `back/strafe` declenchent eux aussi correctement pits, stairs et teleporteurs au lieu de se comporter comme de simples pas "plats"
- les projectiles traversent maintenant les teleporteurs ouverts avec rotation, au lieu d'etre resolus comme s'ils continuaient toujours sur leur ligne d'origine
- les creatures qui franchissent un teleporter reappliquent maintenant une rotation de sous-case runtime, ce qui reduit l'ecart de disposition de groupe a l'arrivee

### Assets, presentation et finition

Etat actuel:

- overlays muraux gameplay largement couverts
- chargement des paths d'assets securise pour les deploys non-racine
- rendu des projectiles et protections nettement meilleur
- preload plus fiable depuis l'embarquement des JSON critiques dans `src/assets/data`
- placeholders d'origine disponibles pour certaines portes encore non refaites (`iron`, `ra`)
- les overlays / textures / images refaits restent prioritaires sur tout bitmap original equivalent

Reste a faire:

- polish visuel
- quelques images ou variantes specifiques
- quelques soucis d'encodage historiques

## Ce qu'on n'a pas oublie

Point de controle avant optimisation:

- flow d'entree: oui
- maps et contenu spatial: oui
- champions / mirrors / recrutement: oui
- inventaire / equipement / drag and drop: oui
- objets / potions / images: oui
- sorts / projectiles / VFX: oui
- mecanismes: oui, grosse passe recente
- creatures / IA: oui, grosse passe recente
- sauvegarde / reprise: oui
- sequence de fin / game over / victoire: a revoir plus tard, volontairement pas prioritaire sur cette passe
- optimisation: les builds passent, mais plusieurs chunks restent encore lourds

## Priorites recommandees

### 1. Fermer les derniers trous de fidelite

- finir generateurs / groupes
- finir `pits / teleporters / telefrag`
- verifier les derniers cas rares de mecanismes
- tester quelques familles de creatures encore sensibles
- continuer a reduire la glue runtime restante la ou elle ne sert plus

### 2. Attaquer l'optimisation

- continuer a reduire les plus gros chunks de data et de rendu
- reevaluer ce qui doit rester embarque dans `src/assets/data`
- decouper plus proprement certaines couches runtime / UI / VFX

### 3. Finir le flow de jeu complet

- a revoir plus tard, apres fermeture des trois chantiers runtime prioritaires
- game over
- fin / victoire
- dernier polish UX

## Note Demain

- `Game over`: comportement voulu simple a integrer/valider
  - les 4 champions morts
  - ecran noir
  - message `GAME OVER`
  - retour a l'ecran titre
- verifier quelques cas rares de mecanismes / countdowns en situation reelle
- refaire un petit tour de families creatures sensibles en playtest
- confirmer les degats de chute contre les references originales si une formule exploitable apparait
- continuer le polish visuel leger seulement si quelque chose choque encore en jeu

### 4. Ameliorations futures / confort

- etendre le menu d'options
- prevoir un export / import de sauvegarde en fichier texte, en plus du `localStorage`
- envisager une mini-map optionnelle, clairement presentee comme aide moderne et non comme element du jeu d'origine

### 5. Localisation et coherence des textes

- exposer un vrai choix `EN / FR`
- poser un systeme de localisation unique plutot qu'un melange progressif
- a court terme, finir de nettoyer les chaines encore en francais cote UI/runtime si l'objectif reste l'anglais par defaut

## Notes de confiance

- La structure generale et la base technique sont bonnes.
- Les donnees extraites doivent etre traitees comme la base fiable.
- Le projet a maintenant plus besoin d'integration fidele, de verification ciblee et d'optimisation que d'une reecriture complete.

## Discipline de maintenance

- On ne quitte pas une session avec un build casse sans le signaler clairement.
- Apres chaque gros changement, il faut mettre a jour `README.md` et les notes pertinentes sous `docs/`.
- Quand un bug touche les maps ou mecanismes, il faut toujours distinguer coordonnees globales et locales avant de conclure sur la donnee extraite.

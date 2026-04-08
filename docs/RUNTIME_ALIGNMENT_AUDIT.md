# Runtime Alignment Audit

Etat du runtime actuel compare aux donnees originales desormais considerees comme fiables.

## Conclusion courte

Nous ne sommes plus bloques par un manque d'information originale.

Les donnees extraites doivent maintenant etre considerees comme la source fiable pour :

- le contenu spatial du donjon
- les tables principales de gameplay Atari (`0559`, `0560`, `0561`, `0562`)
- les positions d'overlays muraux
- les catalogues d'objets et les statistiques de base des creatures

Le principal ecart restant n'est plus l'extraction, mais l'integration du runtime :

- certaines zones du jeu lisent deja directement ou indirectement les donnees originales
- d'autres utilisent encore une couche hybride
- d'autres enfin reposent encore sur un modele simplifie du remake

## Ce qui est desormais considere comme fiable

Les points suivants doivent maintenant etre traites comme la base de verite du projet :

- le contenu spatial du donjon
  - items
  - inscriptions
  - locks
  - creatures
  - generators
- les positions et familles d'overlays muraux originaux
- les grandes tables Atari originales `0559`, `0560`, `0561`, `0562`
- les catalogues d'objets extraits et normalises
- les objets de depart des champions, maintenant injectes depuis une source canonique dediee

Autrement dit :

- on ne doit plus ajouter de nouvelles approximations faute de donnees
- quand un comportement n'est pas encore fidele, il faut plutot le classer comme `integration en cours`
- si une valeur du runtime contredit la source extraite, la source extraite doit l'emporter par defaut

## Deja bien aligne

### Monde et contenu spatial

- [public/dungeon.json](/D:/DungeonMaster-codex/public/dungeon.json) sert maintenant de base fiable pour la geometrie et le contenu place du donjon.
- [docs/WORLD_CONTENT_AUDIT.md](/D:/DungeonMaster-codex/docs/WORLD_CONTENT_AUDIT.md) confirme la reconciliation complete du contenu canonique :
  - items `300 / 300`
  - inscriptions `61 / 61`
  - locks `65 / 65`
  - creatures `225 / 225`
  - generators `50 / 50`
- [src/data/dungeonData.ts](/D:/DungeonMaster-codex/src/data/dungeonData.ts) charge bien cette base runtime.

### Portes et structures runtime associees

- [src/data/doors.ts](/D:/DungeonMaster-codex/src/data/doors.ts) consomme [public/original_doors_runtime.json](/D:/DungeonMaster-codex/public/original_doors_runtime.json).
- Les portes sont donc deja alimentees par une source reconciliee plutot que par une simple estimation manuelle.

### Overlays muraux originaux

- [src/data/originalWallOverlays.ts](/D:/DungeonMaster-codex/src/data/originalWallOverlays.ts) consomme la base des positions reelles.
- [src/components/Dungeon/DungeonScene.tsx](/D:/DungeonMaster-codex/src/components/Dungeon/DungeonScene.tsx) et [src/components/Dungeon/WallDecal.tsx](/D:/DungeonMaster-codex/src/components/Dungeon/WallDecal.tsx) exploitent deja cette donnee.
- La couche positionnelle des fontaines, leviers, alcoves, locks, switches et autres overlays fixes est donc deja tres bien recollee a l'original.

### Objets visuels et starters des champions

- [src/data/itemImages.ts](/D:/DungeonMaster-codex/src/data/itemImages.ts) supporte maintenant des overrides visuels par nom canonique en plus du mapping par `typeId`.
- Cela permet d'utiliser proprement les sprites d'objets speciaux deja presents sans dependre exclusivement des ids bruts.
- [src/data/championStarterItems.ts](/D:/DungeonMaster-codex/src/data/championStarterItems.ts) sert maintenant de source canonique des objets de depart des champions.
- [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts) recrute donc les champions avec une repartition logique :
  - equipement porte
  - armes en main
  - munitions dans les carquois
  - reste en inventaire

### Stats de base des creatures

- [src/data/creatures.ts](/D:/DungeonMaster-codex/src/data/creatures.ts) utilise [public/original_creatures_runtime.json](/D:/DungeonMaster-codex/public/original_creatures_runtime.json).
- Les champs de base actuellement alignes incluent notamment :
  - `baseHP`
  - `armor`
  - `hitProb`
  - `atkSpd`
  - `moveSpd`
  - `exp`
  - `poison`

## Couche hybride : fiable sur le fond, encore mixee avec du legacy

### Objets

- [src/data/items.ts](/D:/DungeonMaster-codex/src/data/items.ts) importe bien les catalogues originaux :
  - [public/original_weapons_catalog.json](/D:/DungeonMaster-codex/public/original_weapons_catalog.json)
  - [public/original_armor_catalog.json](/D:/DungeonMaster-codex/public/original_armor_catalog.json)
  - [public/original_potions_catalog.json](/D:/DungeonMaster-codex/public/original_potions_catalog.json)
  - [public/original_misc_catalog.json](/D:/DungeonMaster-codex/public/original_misc_catalog.json)
- Mais le fichier garde encore de grosses tables de secours `LEGACY_*`.
- Le runtime objets est donc deja nourri par les bonnes donnees, mais avec une couche de compatibilite qui melange encore ancien modele et donnees extraites.

### Base gameplay centralisee

- [public/game_db.json](/D:/DungeonMaster-codex/public/game_db.json) contient maintenant les blocs originaux fiables `originalAtari.i559`, `i560`, `i561`, `i562` ainsi que `weaponAttackReference`.
- Mais son `_meta.source` reste une base `derived gameplay/reference database used by the remake`.
- En pratique, ce fichier contient a la fois :
  - une couche remake interpretee
  - les nouvelles tables originales embarquees

### Creatures : attaques et drops

- [src/data/creatures.ts](/D:/DungeonMaster-codex/src/data/creatures.ts) reste partiellement manuel pour :
  - `BASE_ATTACK_TYPE_MAP`
  - `LEGACY_ATTACK_TYPE_OVERRIDES`
  - `LEGACY_DROP_OVERRIDES`
- Les stats de base sont maintenant fiables, mais une partie de la semantique de combat reste encore une reconstruction.
- Les cas suivants sont maintenant stabilises cote runtime :
  - `Poison`
  - `Steal`
- Les cas suivants ne doivent pas etre traites comme confirmes sans preuve supplementaire :
  - `Immobilize`
  - `Teleport`
- `Rust` doit rester inactif, puisque cette idee n'a apparemment jamais ete programmee dans l'original.

### Mecanismes

- [src/data/mechanisms.ts](/D:/DungeonMaster-codex/src/data/mechanisms.ts) s'appuie encore sur [Old_data/mechanisms.json](/D:/DungeonMaster-codex/Old_data/mechanisms.json).
- Les correspondances `item -> lock` et certaines interpretations restent manuelles.
- Le systeme n'est pas faux, mais ce n'est pas encore une integration `source originale d'abord`.

## Encore largement simplifie cote remake

### Modele d'attaque et degats des armes

- [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts) a deja beaucoup progresse :
  - choix d'attaque original cote HUD
  - seuils de maitrise
  - cooldowns et `defenseModifier`
  - projectiles physiques plus proches de l'original
- Mais il reste encore une couche d'interpretation runtime :
  - degats min/max exposes cote remake
  - simplifications residuelles sur certaines attaques
  - integration encore incomplete des descripteurs complets d'attaque

### Combat des creatures

- [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts) est deja mieux recolle qu'avant :
  - puissance d'attaque brute
  - `hitProb`
  - posture defensive temporaire
  - poison persistant avec base temporelle originale approximee
- Mais le modele reste encore incomplet par rapport au runtime FTL exact.

### Sorts

- [src/data/spells.ts](/D:/DungeonMaster-codex/src/data/spells.ts) reste une liste manuelle de sorts et d'effets.
- Cette couche n'est pas encore alimentee par la semantique complete extraite de `0560`.
- Les projectiles magiques heros/monstres partagent deja une partie du rendu, mais pas encore toute la logique originale.

### Equipement, port et masques de transport

- [src/data/equipment.ts](/D:/DungeonMaster-codex/src/data/equipment.ts) applique encore des regles manuelles de slots, de bonus et de charge.
- Les `carryLocationMasks` originaux desormais extraits ne sont pas encore utilises par le runtime.
- `getItemWeight()` ne couvre meme pas encore tout le spectre des objets non-armure/non-arme.

### Eau, faim et soif

- [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts) et [src/data/waterContainers.ts](/D:/DungeonMaster-codex/src/data/waterContainers.ts) implementent une boucle de survie coherente.
- Mais cette boucle est encore un design de remake equilibre, pas une restitution prouvee du modele original.

### Echelle de temps globale

- [src/engine/time.ts](/D:/DungeonMaster-codex/src/engine/time.ts) pose maintenant une base commune issue du timing original.
- Quelques systemes importants y sont deja recales :
  - cooldowns d'attaque
  - vitesse de creatures
  - poison
- Mais l'ensemble du runtime ne vit pas encore sur une horloge originale unifiee :
  - faim / soif
  - buffs
  - certains sorts
  - certains projectiles

## Ce que cela veut dire concretement

Le projet a change de phase.

Avant :

- on cherchait encore ou se trouvaient les vraies donnees
- on devait regulierement combler les trous
- on ne savait pas toujours si une valeur venait de l'original ou d'une approximation

Maintenant :

- les donnees originales essentielles sont reunies et documentees
- la base fiable existe
- le travail prioritaire est surtout de remplacer les simplifications restantes par les tables et formules originales

## Ordre d'integration recommande

### Priorite haute

- recoller les sorts a `0560`
- etendre l'echelle de temps commune aux systemes qui vivent encore chacun sur leur propre cadence
- continuer a remplacer les interpretations runtime residuelles par les vraies formules originales

### Priorite moyenne

- remplacer les regles d'equipement manuelles par l'exploitation des `carryLocationMasks`
- reduire les `LEGACY_*` encore presents dans [src/data/items.ts](/D:/DungeonMaster-codex/src/data/items.ts)
- recoller les drops et categories d'attaque de creatures a la donnee extraite

### Priorite basse

- verifier ensuite les derniers raffinements de gameplay modernes comme faim/soif et contenants d'eau
- conserver eventuellement certains choix modernes si on decide qu'ils ameliorent le confort sans trahir le jeu

## Verdict

Oui, les donnees extraites doivent maintenant etre traitees comme la version fiable.

Le runtime actuel est :

- tres bien aligne sur le contenu du monde
- nettement mieux aligne qu'avant sur les attaques, projectiles et starters
- encore en integration sur plusieurs couches de calcul

La bonne suite n'est donc plus `extraire davantage a tout prix`, mais `brancher proprement ce qu'on a enfin recupere avec certitude`.

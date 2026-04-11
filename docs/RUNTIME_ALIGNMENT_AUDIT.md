# Runtime Alignment Audit

Etat du runtime actuel compare aux donnees originales desormais considerees comme fiables.

Version observee dans le code au 2026-04-11.

## Conclusion courte

Nous ne sommes plus bloques par un manque d'information originale.

Les donnees extraites doivent maintenant etre considerees comme la source fiable pour:

- le contenu spatial du donjon
- les tables principales de gameplay Atari (`0559`, `0560`, `0561`, `0562`)
- les positions d'overlays muraux
- les catalogues d'objets et les statistiques de base des creatures
- une partie croissante des flags comportementaux et des proprietes runtime

Le principal ecart restant n'est plus l'extraction, mais l'integration du runtime:

- certaines zones lisent maintenant tres directement les donnees originales
- d'autres utilisent encore une couche de compatibilite ou d'interpretation
- les ecarts restants sont surtout des ecarts de comportement fin, pas des absences de donnees

## Ce qui est desormais considere comme fiable

Les points suivants doivent etre traites comme la base de verite du projet:

- le contenu spatial du donjon
  - items
  - inscriptions
  - locks
  - creatures
  - generators
- les positions et familles d'overlays muraux originaux
- les grandes tables Atari originales `0559`, `0560`, `0561`, `0562`
- les catalogues d'objets extraits et normalises
- les objets de depart des champions actuellement reconstruits a partir des donnees runtime
- une part utile des descripteurs creatures originaux

Autrement dit:

- on ne doit plus ajouter de nouvelles approximations faute de donnees
- quand un comportement n'est pas encore fidele, il faut le classer comme `integration en cours`
- si une valeur du runtime contredit la source extraite, la source extraite doit l'emporter par defaut

## Deja bien aligne

### Monde et contenu spatial

- [src/assets/data/dungeon.json](/D:/DungeonMaster-codex/src/assets/data/dungeon.json) est la base fiable utilisee au boot.
- [docs/WORLD_CONTENT_AUDIT.md](/D:/DungeonMaster-codex/docs/WORLD_CONTENT_AUDIT.md) confirme la reconciliation complete du contenu canonique:
  - items `300 / 300`
  - inscriptions `61 / 61`
  - locks `65 / 65`
  - creatures `225 / 225`
  - generators `50 / 50`
- [src/data/dungeonData.ts](/D:/DungeonMaster-codex/src/data/dungeonData.ts) et [src/data/mapLoader.ts](/D:/DungeonMaster-codex/src/data/mapLoader.ts) chargent bien cette base runtime.

### Portes et structures runtime associees

- [src/data/doors.ts](/D:/DungeonMaster-codex/src/data/doors.ts) consomme les proprietes originales reconciliees.
- Vision, collisions de projectiles et textures de portes sont deja pilotes depuis des donnees runtime source-backed.

### Overlays muraux originaux

- [src/data/originalWallOverlays.ts](/D:/DungeonMaster-codex/src/data/originalWallOverlays.ts) consomme la base des positions reelles.
- [src/components/Dungeon/DungeonScene.tsx](/D:/DungeonMaster-codex/src/components/Dungeon/DungeonScene.tsx) et [src/components/Dungeon/WallDecal.tsx](/D:/DungeonMaster-codex/src/components/Dungeon/WallDecal.tsx) exploitent deja cette donnee.
- La couche positionnelle des fontaines, leviers, alcoves, locks, switches et autres overlays fixes est donc deja tres bien recollee a l'original.

### Objets, noms et starters des champions

- [src/data/items.ts](/D:/DungeonMaster-codex/src/data/items.ts) exploite maintenant prioritairement les catalogues originaux embarques.
- Les noms runtime preferent les tables extraites au lieu de rester sur des fallback hardcodes.
- Les potions runtime ont ete recalees sur les noms originaux.
- [src/data/championStarterItems.ts](/D:/DungeonMaster-codex/src/data/championStarterItems.ts) resout maintenant la plupart de ses objets depuis les noms plutot que par duplication d'ids.

### Stats et flags creatures

- [src/data/creatures.ts](/D:/DungeonMaster-codex/src/data/creatures.ts) utilise les donnees creatures extraites comme base.
- Les champs actuellement bien alignes incluent notamment:
  - `baseHP`
  - `armor`
  - `hitProb`
  - `atkSpd`
  - `moveSpd`
  - `exp`
  - `poison`
  - `attackRange`
  - `sightRange`
  - `attackFromAllSides`
  - `preferBackRow`
  - `levitates`
  - `absorbMissiles`
  - `seeInvisible`

### Mecanismes

- [src/data/mechanisms.ts](/D:/DungeonMaster-codex/src/data/mechanisms.ts) ne repose plus sur un simple vieux snapshot externe: le module reconstruit maintenant une vue exploitable des sensors du vrai donjon.
- [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts) utilise ces donnees pour:
  - switchs muraux et dalles
  - serrures murales a usage explicite d'objet
  - alcoves et receptacles muraux
  - capteurs `Hold`
  - capteurs de possession et d'objet specifique
  - capteurs a delai via `pendingSensorEvents`
- La logique n'est pas encore parfaite sur tous les cas rares, mais on n'est plus dans un simple systeme placeholder.

## Couche hybride: fiable sur le fond, encore mixee avec du runtime de compatibilite

### Objets

- [src/data/items.ts](/D:/DungeonMaster-codex/src/data/items.ts) reste une couche hybride.
- Le fichier exploite bien les catalogues originaux, mais garde encore des tables de compatibilite et des helpers pour:
  - anciens noms runtime
  - objets synthetiques
  - correspondances nom -> `typeId`
- Ce n'est plus un obstacle majeur de fidelite, mais c'est encore de la glue.

### Images d'objets

- [src/data/itemImages.ts](/D:/DungeonMaster-codex/src/data/itemImages.ts) derive maintenant beaucoup de chemins a partir des noms et variantes, avec verification contre les assets reels.
- Il reste toutefois un noyau d'alias et quelques fallbacks, normaux a ce stade parce qu'il faut encore faire le pont entre noms originaux, variantes et vrais fichiers du projet.

### Equipement

- [src/data/equipment.ts](/D:/DungeonMaster-codex/src/data/equipment.ts) centralise bien les regles runtime, mais une partie de ces regles reste encore interpretee plutot que derivee directement des masques originaux.
- C'est une couche utile et propre, mais pas encore un miroir parfait du moteur original.

### Creatures: attaques et drops

- [src/data/creatures.ts](/D:/DungeonMaster-codex/src/data/creatures.ts) garde encore quelques overrides de categorie d'attaque et de drops.
- Les stats et plusieurs flags comportementaux sont maintenant fiables, mais toute la semantique creature n'est pas encore 100% source-backed.

## Encore interprete cote remake

### IA creatures

- [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts) a beaucoup progresse:
  - franchissement des portes ouvertes
  - memoire de poursuite
  - portee de vue originale
  - detection de l'invisibilite
  - absorption des missiles
  - usage des teleporteurs
  - meilleur comportement des attaquants a distance
- Mais on reste encore sur une reconstruction gameplay du comportement, pas sur une reproduction instruction par instruction du runtime FTL.

### Combat et degats des armes

- Le HUD et les attaques ont beaucoup progresse.
- Plusieurs timings et comportements sont maintenant plus proches de l'original.
- Il reste malgre tout des simplifications sur certaines formules et certains cas speciaux.

### Sorts et semantique complete des missiles

- Le runtime reel de cast s'appuie sur [src/data/runes.ts](/D:/DungeonMaster-codex/src/data/runes.ts) et le store.
- [src/data/spells.ts](/D:/DungeonMaster-codex/src/data/spells.ts) reste un fichier legacy de reference.
- Les VFX ont fait un grand bond, mais toute la semantique fine de certains missiles ou effets rares n'est pas encore completement recalee.

### Flow de fin de jeu

- Le cas `Zo Kath Ra` / `Amalgam` / `The Firestaff (Complete)` est mieux cerne cote data.
- La sequence complete doit encore etre reverifiee en situation de jeu.

## Ce que cela veut dire concretement

Le projet a clairement change de phase.

Avant:

- on cherchait encore ou se trouvaient les vraies donnees
- on devait combler des trous
- on ne savait pas toujours si une valeur venait de l'original ou d'une approximation

Maintenant:

- les donnees originales essentielles sont reunies et documentees
- la base fiable existe
- le travail prioritaire est surtout de remplacer les simplifications restantes par des integrations plus directes et des comportements plus fideles

## Ordre d'integration recommande

### Priorite haute

- finir les derniers cas rares de mecanismes et de fin de jeu
- verifier quelques familles creatures encore sensibles
- reduire encore les couches de compatibilite quand elles ne servent plus

### Priorite moyenne

- continuer a simplifier `items.ts`, `itemImages.ts` et les couches de glue voisines
- recoller les derniers raffinements de gameplay qui restent interpretes
- preparer le chantier d'optimisation du bundle et du `game-core`

### Priorite basse

- conserver certains choix modernes si on decide qu'ils ameliorent le confort sans trahir le jeu
- revenir plus tard sur les nuances les plus fines avec des tests de jeu cibles

## Verdict

Oui, les donnees extraites doivent etre traitees comme la base fiable.

Le runtime actuel est:

- tres bien aligne sur le contenu du monde
- nettement mieux aligne qu'avant sur les objets, portes, mecanismes et creatures
- encore en integration sur quelques couches de comportement fin et de compatibilite runtime

La bonne suite n'est donc plus `extraire davantage a tout prix`, mais `finaliser les derniers recollages`, puis `optimiser proprement ce runtime devenu beaucoup plus source-backed`.

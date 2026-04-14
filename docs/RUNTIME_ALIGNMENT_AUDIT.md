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
- les sensors muraux `type 5` et `type 6` ne reposent plus sur une simple approximation via `activeSensors`:
  - les AND/OR gates de mur utilisent maintenant leur vrai `data` runtime (masques bas/haut nibble)
  - les countdowns muraux decremente/incrementent maintenant un vrai compteur persistant
  - cet etat mutable est sauvegarde/recharge via `sensorRuntimeData`
- les launchers muraux ne sont plus des trous silencieux dans le runtime:
  - le parser conserve maintenant `kineticEnergy` et `stepEnergy` pour les sensors `type 7-10` et `14-15`
  - le runtime cree de vrais projectiles pour les launchers muraux `type 7-10`
  - les launchers d'explosion actuellement supportes reutilisent les branches source-backed `fireball`, `lightning`, `poison_bolt`, `poison_cloud`, `open`, `disrupt_nonmaterial`
  - le lanceur d'objet reel rencontre dans le donjon (`ICON_WEAPON_POISON_DART`) cree maintenant un vrai projectile physique
- les cas `revert` les plus usuels ne sont plus simplement transportes dans la data:
  - capteurs de possession au sol
  - capteurs d'objet specifique au sol
  - certaines serrures murales negatives
  - clic mural vide sur capteurs muraux type `2`
- La logique n'est pas encore parfaite sur tous les cas rares, mais on n'est plus dans un simple systeme placeholder.

Reste explicitement en attente cote mecanismes rares:

- les launchers muraux `type 14-15` existent bien dans le moteur FTL, mais n'apparaissent pas dans le donjon DM extrait (`0` occurrence dans les donnees courantes). Ce n'est donc plus un trou gameplay actif, plutot un point de completude moteur.
- l'effet special `Slime` a maintenant sa propre branche runtime: projectile de creature distinct, impact `Blunt` et composante poison dedies, au lieu d'un fallback generique
- les rotations locales `F271` restent le vrai point subtil: FTL ne traite pas ces sensors comme des cibles `(x,y)` mais comme un champ `Multiple` 12 bits pour les sensors locaux / launchers / generators. Le pipeline conserve maintenant `isLocal` et `multipleValue` pour eviter une nouvelle derive sur cette couche.

### Experience et progression

- [src/data/skillProgression.ts](/D:/DungeonMaster-codex/src/data/skillProgression.ts) et [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts) suivent maintenant beaucoup plus directement `CHAMPION.C`.
- Le runtime prend en compte:
  - seed initial des hidden skills
  - reconstruction des quatre basic skills
  - temporary experience
  - penalties / bonuses de contexte sur les hidden skills
  - croissance des statistiques a la montee de niveau
  - bonus de niveau de competence apportes par les objets originaux clefs
  - `Reincarnate` n'utilise plus un bonus global maison:
  - remise a zero des skills
  - reduction des statistiques / maxima recalee sur `CHAMPION.C`
  - distribution des `12` increments aleatoires documentes par la source
- `Vi Altar` recale de nouveau la resurrection sur `F283_CHAMPION_ViAltarRebirth`:
  - consommation des vrais `Bones` (`Misc typeId 5`)
  - baisse permanente du maximum de sante
  - retour avec la moitie de ce nouveau maximum de sante
- La progression n'est donc plus une simple approximation de type `sqrt(xp)`, mais une integration largement recalee sur la logique FTL.

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
- Les modificateurs de niveau de competence par objet ne sont plus oublies cote runtime, meme si l'UI ne reflète pas encore partout ces bonus de facon exhaustive.

### Creatures: attaques et drops

- [src/data/creatures.ts](/D:/DungeonMaster-codex/src/data/creatures.ts) garde encore quelques overrides de categorie d'attaque et de drops.
- Les stats et plusieurs flags comportementaux sont maintenant fiables, mais toute la semantique creature n'est pas encore 100% source-backed.
- Le runtime de combat exploite maintenant davantage l'`attackType` original pour la melee, ce qui reduit les tirages hybrides trop libres entre physique / feu / magie.
- Les protections de type shield ne s'appliquent plus aux attaques physiques de creatures, ce qui etait une approximation de trop par rapport au modele original.
- Le seuil de blessure suit maintenant la comparaison source `random(128) + 10` ajustee par la vitalite, ce qui devrait reduire les blessures excessives par rapport a l'ancien calcul maison.
- Le branchement de mitigation est maintenant plus proche de `F321` / `F313`:
  - `Sharp` utilise `sharpDefense`
  - `Impact` divise la defense
  - `Mental` s'appuie sur la sagesse plutot que sur `Anti-Magic`
  - `Unconditional` ne passe plus par la mitigation physique standard
- les armures marquees `isShield` dans `i559` utilisent maintenant aussi la vraie table `Graphic 562` `G050` exposee dans le runtime package sous `woundDefenseFactors`
- les liens `item -> slot` ne reposent plus uniquement sur les slots manuels de `items.ts` pour les vetements source-backs; `equipment.ts` consomme maintenant aussi une table d'allowed slots par nom, derivee des masques originaux `ObjDesc.word4` / `CarryLocation`
- cas notables confirmes par les masques Atari: `Robe`, `Tabard`, `Gunna`, `Elven Huke` et `Mithral Mail` sont des vetements de `legs`, pas de `torso`
- les cas `Cape` / `Cloak of Night` restent volontairement bi-slots (`torso` + `neck`) comme dans les masques originaux, mais l'auto-equip garde `torso` en premier pour ne pas deplacer arbitrairement les loadouts de depart
- la vieille table `itemTypeNames.armor` du pipeline reste utile pour les noms, mais elle ne doit plus etre consideree comme une source de verite pour les slots
  - les shields actifs runtime sont maintenant separes en defenses additives `physical` / `magic` / `fire`, au lieu d'un ancien modele pourcentage trop aplati
- Les lanceurs de projectiles creatures ne passent plus uniquement par un raccourci de degat a distance:
  - les types de missile de `GROUP1.C` sont maintenant remappes pour `Vexirk`, `Wizard Eye`, `Materializer/Zytaz`, `Demon`, `Red Dragon` et `Lord Chaos`
  - l'energie/attaque du projectile creature exploite de nouveau `attack` et `dexterity` issus de `i559`
  - les impacts sur le groupe reappliquent un impact cible puis, selon le sort, l'explosion secondaire source-backed
  - `Poison Cloud` sur la case du groupe repasse par une attaque `Normal` sans blessures au lieu d'une mitigation magique generique

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
- Le plus gros reliquat runtime visible cote creatures n'est plus `Slime`; le gros morceau mecanismes restant est maintenant surtout quelques `local effects` rares qui ne passent pas par la rotation simple de face.

### Flow de fin de jeu

- Le cas `Zo Kath Ra` / `Amalgam` / `The Firestaff (Complete)` est mieux cerne cote data.
- La sequence complete doit encore etre reverifiee en situation de jeu.

### Mecanismes rares encore en integration

- les rotations locales de listes de sensors (`F271`) sont maintenant branchees cote runtime mural: clic sur face, locks, alcoves et echangeurs passent par un ordre de face persistant au lieu d'un index statique
- le pipeline decode maintenant correctement le champ `Multiple` source-backed sur 12 bits (`targetWord >> 4`), au lieu de melanger la charge utile locale avec le nibble non reference de poids faible
- les sensors reguliers `isLocal` ne partent plus par erreur sur une cible `(0,0)` du remake; ils restent limites a leur vrai effet local comme dans `F272`
- certains cas fins de local effects restent encore interpretes
- les launchers muraux `type 7-10` passent maintenant bien par une vraie creation de projectile runtime
- les launchers muraux `type 14-15` restent un point de completude moteur seulement, pas un trou actif du donjon extrait
- la sémantique exacte de tous les sensors `revert` n'est pas encore closee pour chaque cas exotique, meme si les cas de puzzle les plus visibles sont maintenant mieux couverts
- `Freeze Life` n'est plus un trou runtime: la duree active suit maintenant un compteur de ticks persiste, et les creatures `archenemy` restent bien immunisees comme dans `GROUP1.C`
- les actions de peur equipees (`Calm`, `Brandish`, `Blow Horn`, `War Cry`) reutilisent desormais la `fearResistance` extraite depuis `i559` au lieu d'un comportement placeholder
- le fallback "Action originale non encore integree" ne doit plus attraper `THRUST`, qui est reclassee cote melee
- le sommeil est maintenant traite comme un etat runtime continu et non plus comme un fast-forward compact sur un seul clic; la regen et le vieillissement des effets avancent par ticks acceleres jusqu'au reveil
- la victoire n'est plus un simple kill-switch sur `Fuse`: le runtime passe par une phase `endgame` dediee qui neutralise les ticks normaux, alterne `Lord Chaos` / `Lord Order`, fixe ensuite `Grey Lord`, nettoie les autres creatures et ne bascule vers l'ecran final qu'apres cette sequence

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

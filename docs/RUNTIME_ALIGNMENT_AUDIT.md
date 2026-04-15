# Runtime Alignment Audit

Etat du runtime actuel compare aux donnees originales desormais considerees comme fiables.

Version observee dans le code au 2026-04-15.

Reference prioritaire de fidelite gameplay:

- version PC DOS `DM12/DM13` quand une divergence existe entre branches source
- version Atari ST comme source de recoupement utile sur les donnees et comportements tres proches, pas comme cible prioritaire du remake

## Fermetures recentes - 2026-04-15

Points a considerer comme clos sauf regression constatee en jeu:

- Les donnees canoniques actives (`game_db.json`, `runtime_dungeon.json`, manifestes, creatures, doors) sont maintenant considerees comme alignees avec l'extraction. Les ecarts trouves pendant cette passe venaient surtout du runtime TypeScript, pas du parser ni des snapshots.
- Les masques de slots source-backed et les references d'attaques d'objets ont ete recales dans [src/data/items.ts](/D:/DungeonMaster-codex/src/data/items.ts), [src/data/equipment.ts](/D:/DungeonMaster-codex/src/data/equipment.ts) et [src/data/weaponAttacks.ts](/D:/DungeonMaster-codex/src/data/weaponAttacks.ts).
  - les armes, armures, potions, scrolls et objets divers exploitent maintenant correctement les masques originaux
  - les actions source-backed non limitees aux armes sont de nouveau visibles cote runtime (`Block`, `Climb Down`, `Flip`, `Freeze Life`, etc.)
- Les regles de portes ont ete recalees:
  - une grille ajouree ne laisse plus passer n'importe quel projectile physique
  - la regle "objets de poche seulement, clefs exclues" est appliquee
  - les portes `iron` et `ra` ont maintenant des placeholders issus des bitmaps originaux
  - les overlays / textures refaits restent prioritaires; les bitmaps originaux ne servent que de fallback placeholder
  - la fermeture de porte sur creature n'utilise plus un degat maison `25-40`; elle suit maintenant l'ordre de grandeur source `5`
  - la grille remonte plus haut pendant son rebond, ce qui evite l'effet visuel "retombe trop bas" observe au debut du jeu
  - un impact sonore `wall_bump` est maintenant joue a chaque coup de porte sur creature
- Les portes `Ra` ont un premier rendu energie runtime dedie. Ce n'est pas encore un rendu final moderne, mais la logique de porte et le placeholder visuel sont en place.
- Les collisions de deplacement sans avance reelle utilisent maintenant `wall_bump` au lieu de `cry`.
- Les degats sur creature utilisent maintenant un burst court et plus lisible, ancre sur la sous-case du monstre quand la cible est connue, au lieu d'un simple chiffre trop haut sur la tuile.
- Le cout d'endurance du deplacement suit de nouveau la formule source de `COMMAND.C`:
  - `((Load * 3) / MaximumLoad) + 1`
  - le runtime utilisait par erreur `* 25`, ce qui faisait fondre l'endurance beaucoup trop vite a chaque pas
  - la descente au puits avec `Climb Down` applique de nouveau son cout specifique de `MOVE.C`: `((Load * 25) / MaximumLoad) + 1`
- La boucle de survie / regeneration runtime suit maintenant explicitement la branche source `C19` de `CHAMPION.C`:
  - cadence d'application des time effects `64` ticks eveille / `16` ticks en sommeil, comme dans `MAIN.C`
  - le palier plus lent `256` ticks eveille / `64` ticks en sommeil ne concerne que la detente progressive des statistiques courantes vers leur maximum, pas toute la regeneration
  - la detente des statistiques courantes vise maintenant bien les maxima runtime modifies par l'equipement et les boosts temporaires, pas seulement les stats de base du champion
  - regen mana `((MaximumMana / 40) + 1)` avec doublement en sommeil
  - cout d'endurance de regen mana = `ManaGain * Max(7, 16 - WizardLevel)`
  - bonus de regen stamina apres inactivite sur les seuils source `80 / 250`
  - regen HP conditionnee par `stamina >= MaximumStamina / 4` et `timeCriteria < Vitality + 12`
  - les degats de chute de la party ne sont plus un jet maison `2-6 HP`; ils repassent maintenant par une vraie attaque source-backed de force `20` sur `legs/feet`, comme dans `MOVE.C`
- Les generateurs de creatures au sol sont de nouveau actifs via [src/data/originalGenerators.ts](/D:/DungeonMaster-codex/src/data/originalGenerators.ts) et [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts).
  - le manque de monstres constate venait bien en grande partie de cette absence
  - les creatures generees reapparaissent maintenant depuis leur vraie case de spawn source-backed
  - la table compacte runtime embarque desormais `54` generateurs `type 6` issus de l'export source
  - l'ancien chiffre `50` correspondait au sous-ensemble "canonical world content" suivi par l'audit de placement, pas au total brut des capteurs de generation presents dans l'export
  - le runtime suit maintenant aussi la formule source pour les HP initiaux:
    - `healthMultiplier == 0` retombe sur la difficulte de la map
    - HP = `baseHealth * multiplier + random((baseHealth >> 2) + 1)`
  - les delais de reactivation longs suivent aussi la regle source:
    - si `ticks > 127`, le delai effectif devient `(ticks - 126) << 6`
  - le runtime applique maintenant aussi le garde-fou FTL sur la saturation de la map de la party:
    - FTL bloque les nouveaux groupes quand on approche des `60` groupes actifs et garde `5` slots de marge
    - le remake approxime maintenant cela par des `groupId` runtime partages quand ils existent, avec fallback sur les cases occupees pour les vieux cas sans groupe explicite
  - quand une case de spawn est occupee par le groupe ou par d'autres creatures, le runtime ne "remplit" plus artificiellement cette case:
    - un groupe genere est maintenant mis en attente puis retente plus tard
    - le retry suit la cadence FTL des events `move later`, soit `5` ticks source
    - cela rapproche le remake du vrai comportement `event 60/61 move group later`
  - les creatures generees sont maintenant creees comme un vrai groupe runtime atomique:
    - elles partagent un `groupId` commun
    - leur placement initial n'est plus "center puis normalize", mais une vraie formation de groupe appliquee des le spawn
    - les sous-cases initiales utilisent maintenant une rotation de depart aleatoire, plus proche de la logique source de `F185_auzz_GROUP_GetGenerated`
  - les groupes generes differes ne reutilisent plus artificiellement le meme `groupId` d'un ancien spawn sur la meme case:
    - chaque activation genere maintenant une identite de groupe distincte
    - le comptage de saturation des groupes actifs est donc moins faussement compresse
  - un spawn differe ne contourne plus la limite approximate des groupes actifs:
    - si la map de la party est encore saturee, le retry repart simplement sur son delai `move later`
  - les generateurs de sol locaux `type 6` ne sont plus oublies dans le pipeline `enter floor square`:
    - ils se declenchent maintenant aussi quand la party entre directement sur leur case
    - le runtime n'est donc plus limite aux seuls cas ou un autre sensor cible ensuite le generateur
- Les creatures ne reposent plus seulement sur un simple `left/right` runtime:
  - un monstre seul sur une case est maintenant recentre
  - les groupes partages utilisent des sous-cases `frontLeft`, `frontRight`, `backLeft`, `backRight`
  - les groupes de `3-4` creatures peuvent donc enfin occuper une vraie disposition `2x2`
  - le ciblage melee preserve la priorite "meme colonne avant, sinon autre case avant" au lieu de frapper dans le vide
  - les petites creatures melee placees en back row sur une case adjacente peuvent maintenant avancer vers une sous-case de contact au lieu de rester bloquees derriere leur propre groupe
- Les fixed possessions de creatures ne reposent plus sur un override manuel:
  - le runtime relit maintenant la vraie table `creatureDroppings` extraite de `I559`
  - les drops fixes de `Skeleton`, `Stone Golem`, `Trolin`, `Animated Armour`, `Rockpile`, `Pain Rat`, `Screamer`, `Magenta Worm` et `Red Dragon` suivent a nouveau les quantites et flags aleatoires d'origine
  - les items maudits de l'`Animated Armour` sont maintenant identifies comme tels dans les donnees runtime
  - les objets maudits equipes appliquent maintenant aussi le malus source `-3 luck` par objet
  - le source FTL recale ici ne montre pas de blocage special au retrait manuel: `cursed` doit donc etre traite comme un attribut et un malus, pas comme une impossibilite prouvee de desequiper
- Les deplacements forces et effets de case ouverts ont ete recales sur le moteur original:
  - si la party arrive sur une case occupee par une creature via pit ou teleporter, la creature est maintenant tuee instantanement (`telefrag`)
  - si un pit s'ouvre sous une creature, le runtime lui applique a nouveau une vraie resolution de chute au lieu de la laisser flotter sur place
  - si un pit ou un teleporter s'ouvre sous la party, l'effet est maintenant applique immediatement au lieu d'attendre un deplacement manuel ulterieur
  - pour la campagne DM de reference, `allowedCreatureTypes` est vide sur toutes les maps extraites; le cas "creature teleportee vers une map non autorisee" n'est donc pas un ecart gameplay observable sur ce donjon precis
- L'IA de `Lord Chaos` a maintenant recupere son deplacement special "double square move":
  - quand le deplacement normal echoue, l'archenemy peut maintenant se projeter jusqu'a `2` cases plus loin
  - la case intermediaire n'est pas testee comme obstacle, ce qui lui permet de traverser murs et portes fermees comme dans la branche source
  - la destination reste, elle, validee runtime (case finale praticable et non saturee)
  - ce point reste encore a confirmer en playtest de fin de jeu pour les cas les plus exotiques autour des fluxcages
- Les sprites d'objets au sol ecrivent maintenant correctement dans le depth buffer:
  - un objet sur la case avant ne doit plus rester visible "a travers" un monstre occupant cette meme case
- Les wall sensors cliquables avec effet `Hold` suivent maintenant la semantique FTL de `SENSOR.C`:
  - un clic mural convertit bien `Hold` en activation effective `Set`
  - ces boutons/serrures murales ne restent donc plus silencieusement sans effet dans le runtime
- Les alcoves `type 13` suivent maintenant mieux `SENSOR.C`:
  - depot et retrait font bien tourner la face murale concernee
  - cela couvre aussi les cas ou la metadata runtime compacte n'expose pas explicitement la rotation locale, comme certaines alcoves speciales non-torches
- Les wall sensors `type 2` "click with any object" sont maintenant relies au flux `use item on wall`:
  - tenir n'importe quel objet peut de nouveau activer ces boutons muraux dans les cas non-`revert`
  - les rares variantes `Hold` utilisent aussi la conversion source vers `Set` lors d'une activation avec objet en main
- Les serrures murales consomptibles ne peuvent plus reconsommer un objet apres usage:
  - les sensors `onceOnly` et le cas special `type 17` sont maintenant ignores une fois deja servis
  - on evite donc de reperdre une clef, une piece ou `ZOKATHRA` sur un sensor deja consomme
- Les sauvegardes sont maintenant versionnees avec une build et un schema de save distincts.
  - le schema courant est `2`
  - le passage au schema `2` correspond a la recale de l'echelle interne de l'endurance et casse volontairement les saves precedentes de schema `1`
  - tant que le projet reste en alpha, aucune compatibilite ascendante n'est maintenue pour ces ruptures
- Le point "generateur d'objet mural type 12" n'est pas un trou gameplay actif du donjon DM charge par ce projet:
  - le label existe toujours dans le format et dans [src/data/mechanisms.ts](/D:/DungeonMaster-codex/src/data/mechanisms.ts)
  - mais les snapshots runtime utilises par l'application ne contiennent pas de capteurs muraux `type 12`
  - ce sujet ne doit donc plus etre traite comme une priorite d'alignement pour cette campagne

Point restant ouvert mais borne:

- `generatorHealthMultiplier` n'est pas une croissance de vie dans le temps.
  - ce champ n'agit qu'au moment du spawn
  - la formule source est maintenant rebranchee; ce qui reste a verifier, c'est surtout le ressenti gameplay et les derniers cas limites
- la notion exacte de `groupes actifs` reste encore approximee cote remake.
  - le runtime a maintenant des sous-cases de tile pour les creatures et un `groupId` runtime leger pour les spawns / groupes poses sur une meme case
  - il ne reproduit pas encore toute la structure interne `GROUP/ACTIVE_GROUP` du moteur FTL
  - la limite de saturation des generateurs est maintenant recalee sur l'esprit FTL, mais pas encore sur une representation interne complete des groupes source
- quelques comportements de creatures restent encore partiellement manuels.
  - les projectiles des vrais lanceurs de sorts (`Wizard Eye`, `Vexirk`, `Materializer`, `Demon`, `Red Dragon`, `Lord Chaos`) sont maintenant recales directement sur `GROUP1.C`
  - `Giggler -> steal` ne repose plus sur un simple tirage aleatoire dans le backpack:
    - le runtime suit maintenant un ordre de tentatives de slots beaucoup plus proche de `F193_xxxx_GROUP_StealFromChampion` (`neck`, `pouch`, `backpack`, `quiver`, etc.)
    - un Giggler peut desormais voler aussi depuis certains slots equipes, pas seulement depuis l'inventaire
    - apres un vol reussi, il repasse aussi dans une logique de fuite proche de l'original
  - le `Screamer` ne doit plus etre traite comme un comportement runtime special `Alert`:
    - ce reliquat manuel a ete retire
    - le runtime retombe maintenant sur la lecture source-backed de son attaque `Mental`
  - `Ruster -> rust` ne doit pas etre traite comme un trou d'implementation a combler a tout prix: l'etat actuel de la reference indique au contraire que cette mecanique etait prevue mais n'a jamais ete reellement programmee dans le jeu original cible
  - `Immobilize` ne doit pas etre traite comme une competence speciale manquante: aucune trace fiable n'a ete retrouvee ni comme attaque de creature ni comme sort dans la cible DM PC DOS
  - `Teleport` ne doit pas etre modelise comme un type d'attaque generique:
    - le cas avise reste celui de `Lord Chaos`, qui peut se teleporter specialement jusqu'a `2` cases, y compris a travers murs et portes fermees
    - ce comportement est maintenant rebranche cote IA, mais reste a valider en playtest sur les cas de fin de jeu les plus tordus; il ne doit pas etre confondu avec une attaque standard reusable par d'autres creatures

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

## Checklist prochaine passe

Ordre recommande pour la prochaine vague de verification / alignement:

### Priorite 1 - gameplay central

- IA speciale de `Lord Chaos`
  - valider en jeu son vrai teleporter special jusqu'a `2` cases
  - confirmer le ressenti avec fluxcages / portes / murs fermes
  - confirmer qu'il ne subit aucun degat sur cette action
- generateurs de creatures
  - cadence exacte observee en jeu
  - taille reelle des groupes au spawn
  - cas limites de saturation / retries / coexistence avec la party
- pits / teleporters / telefrag
  - valider en playtest les ouvertures sous creatures
  - valider les chutes multi-niveaux
  - valider les telefrags de party dans des cas reels
- combat / survie
  - confirmer les degats de chute
  - confirmer les derniers timings de regen / sommeil / inactivite
  - verifier les dernieres formules simplifiees encore sensibles

### Priorite 2 - mecanismes et fin de jeu

- countdowns et mecanismes rares encore interpretes
- sequence complete `Firestaff / Amalgam / Fuse / fin de jeu`
- derniers cas subtils de local effects / rotations locales de sensors

### Priorite 3 - creatures et cas speciaux

- valider en jeu `Giggler -> steal` maintenant que le vol vise aussi l'equipement leger et declenche une fuite
- confirmer en playtest le ressenti du `Screamer` apres suppression de l'ancien override `Alert`
- validation de quelques familles de fin de jeu / arch-enemies
- garder explicitement hors scope "mecaniques fantasmees" non prouvees:
  - `Rust`
  - `Immobilize`
  - `Teleport` comme attaque generique

### Priorite 4 - couches encore interpretees

- equipement: continuer a remplacer les regles manuelles residuelles par des derives directs de la source quand c'est prouve
- items / glue runtime: reduire les couches de compatibilite qui n'ont plus de raison d'etre

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
- les generateurs muraux d'objets `type 12` sont eux aussi a traiter comme un point de completude moteur generique, pas comme un manque du donjon DM runtime courant
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

- [src/data/creatures.ts](/D:/DungeonMaster-codex/src/data/creatures.ts) garde encore quelques overrides de categorie d'attaque.
- Les stats, plusieurs flags comportementaux et les fixed possessions sont maintenant fiables, mais toute la semantique creature n'est pas encore 100% source-backed.
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
- la victoire n'est plus un simple kill-switch sur `Fuse`: le runtime passe par une phase `endgame` dediee qui neutralise les ticks normaux, alterne `Lord Chaos` / `Lord Order` sur une cadence plus proche de `STARTND2.C`, fixe ensuite `Grey Lord`, masque les fluxcages au bon moment, nettoie les autres creatures du niveau courant seulement et ne bascule vers l'ecran final qu'apres cette sequence
- la phase `endgame` sait aussi relire les textes ordonnes en `(0,0)` si le snapshot runtime les expose, au lieu d'imposer un texte de victoire hardcode
- l'Amalgam de fin suit maintenant mieux son vrai etat runtime: `encased gem` avant `ZOKATHRA`, `free gem` apres liberation, puis `without gem` apres absorption par le Firestaff; l'exchange Firestaff reste donc bloque tant que le gem n'a pas ete libere
- les teleporteurs reappliquent maintenant leur vraie rotation a la party via une table compacte derivee de l'extraction complete (`rotationType` relatif/absolu + `rotation`), au lieu de conserver toujours la direction courante
- les cases speciales de transport (`pit`, `stairs`, `teleporter`) ne sont plus limitees au seul `moveForward`: `moveBackward` et les strafes passent maintenant par le meme pipeline de resolution a l'entree de case
- les projectiles ne traitent plus un teleporter ouvert comme une simple dalle:
  - ils traversent maintenant les teleporteurs ouverts
  - leur direction est reappliquee via la vraie rotation du teleporter
  - les impacts sont resolves sur la case d'arrivee, y compris sur creatures / party
- les creatures qui traversent un teleporter ne gardent plus systematiquement une disposition de groupe figee:
  - leur sous-case runtime est maintenant reappliquee avec rotation approximative du groupe
  - l'entree dans un teleporter ne bloque plus artificiellement des destinations pourtant partageables par le runtime de groupes
- la party et les creatures ne s'arretent plus au premier saut dans les reseaux de teleporteurs en chaine:
  - le runtime suit maintenant les teleporteurs ouverts successifs jusqu'a la destination stable
  - la rotation est reappliquee a chaque saut intermediaire
- certains launchers muraux locaux ne sont plus muets cote runtime:
  - les capteurs muraux locaux `type 7-10 / 14-15` peuvent maintenant etre actives directement sur leur face quand le donjon les expose sans bouton `type 1/2` separe
  - leur branche locale cree bien un projectile runtime au lieu d'etre court-circuitee par le fallback `isLocal`
- les capteurs muraux locaux de type gate / countdown ne perdent plus leur effet local final quand ils sont actives par evenement:
  - si une gate murale locale valide sa condition et doit ensuite faire tourner sa face de sensors, la rotation est maintenant reappliquee cote runtime
  - cela couvre notamment les cas rares de puzzle ou une gate locale sert elle-meme de mecanisme de rotation, sans bouton mural standard expose

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

- raffiner la fidelite fine des generateurs de creatures
  - cadence exacte
  - randomisation du compte
  - interpretation exacte de `generatorHealthMultiplier`
- finir les derniers cas rares de `pits / teleporters / telefrag`
  - rotation / transport des projectiles
  - rotation / placement de groupes de creatures
  - derniers cas limites de transports en chaine
- finir les derniers cas rares de mecanismes
- verifier quelques familles creatures encore sensibles
- reduire encore les couches de compatibilite quand elles ne servent plus

### Priorite moyenne

- laisser explicitement la sequence de fin de jeu et le playtest lourd pour une passe ulterieure
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

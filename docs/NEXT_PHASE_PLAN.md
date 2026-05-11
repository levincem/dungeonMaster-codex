# Next Phase Plan

Etat revu le `2026-05-11`.

Ce document ne doit contenir que des sujets encore ouverts.

Lecture actuelle:

- le projet est entre en phase `beta`
- ce plan ne liste plus des chantiers d'alpha, mais surtout ce qu'il reste a valider avant une release plus large

Regle simple:

- un sujet `ferme` sort d'ici et reste trace dans [docs/REMAKE_STATUS.md](/D:/DungeonMaster-codex/docs/REMAKE_STATUS.md)
- un sujet `ouvert` doit dire explicitement ce qui manque encore
- on n'utilise plus de statuts flous du type `entamee` sans dire `pourquoi ce n'est pas fini`

Regle de correction:

- on ne force pas un comportement attendu par une couche de contournement si la cause du bug n'est pas encore identifiee
- d'abord reproduire, borner et expliquer le bug
- ensuite appliquer le plus petit correctif qui supprime la cause
- eviter les couches de correctifs sur correctifs qui masquent le symptome sans expliquer la regression

## Ferme recemment

- `GROUP / ACTIVE_GROUP / generateurs`
  - ferme cote rebranchement gameplay principal
  - il reste surtout du playtest cible; le reliquat exact sur la structure interne `ACTIVE_GROUP` est documente comme point de fidelite borne, pas comme nouveau chantier moteur prioritaire
- faux requirement `Compass` sur les `floor type 3`
  - ferme
  - l'extraction et le runtime traitent maintenant correctement ces cases comme des capteurs `party / orientation`
- `0696.RAW1`
  - ferme au niveau semantique utile
  - le bloc est maintenant borne comme conteneur de composition/layout, pas comme verrou gameplay cache
  - il peut encore rester des noms provisoires pour certains helpers/opcodes, mais ce n'est plus un sujet prioritaire a rouvrir sans besoin concret
- serie de correctifs playtest `LVL 1`
  - projectiles physiques recuperables apres impact / mort de creature
  - drag and drop donjon rationalise `ici / devant / lancer`
  - dalles `Hold + revert`, poids `party / objet / creature`, et pits relies corriges
  - artefact visuel `wallButtons` du puzzle boulder/dalle corrige
  - porte a deux leviers et leviers `up/down` recales
- serie de correctifs playtest recents `LVL 3` / runtime coeur
  - `TrickWall` imaginaires de nouveau traversables sans passage force par `openWalls`
  - la mort d'une creature libere maintenant correctement les dalles `creature-only`, ce qui recale le puzzle de la momie / prisonnier
  - `tickCrushingDoors` reapplique aussi les effets de mort attendus `drops / death dust`
  - impacts `Fireball` / `Lightning` sur creatures recalés sur le pipeline source `hit direct via defense creature + burst secondaire + reduction feu au bon endroit`
- passe fidelite runtime
  - fermee cote recollage code/source pour les domaines critiques utiles au runtime
  - le reliquat fidelity n'est plus un chantier de reimplementation, mais surtout du playtest cible et quelques finitions visuelles
- passe `i18n / labels`
  - fermee sur le runtime/UI visible
  - manuel francais dedie ajoute et labels debug/runtime restants reroutes dans les fichiers de langue
- rendu `Ra Door`
  - ferme cote presentation cible
  - le rendu visible passe maintenant par un panneau energetique procedural + rideau `photons2`
- serie de correctifs playtest `LVL 5` / interactions murales / runtime d'exploration
  - portes ouvertes par defaut restaurees depuis les donnees source et au rechargement
  - serrures et anneaux muraux modernes recales en clic, taille et visibilite de face
  - les faces multi-serrures rejouent maintenant toute leur sequence compatible en une seule insertion, comme dans les sources originales
  - drag and drop `sol -> deplacement -> relacher` ferme
  - les creatures a distance ne gagnent plus de ligne de vue a travers un coin de mur bloque en diagonale adjacente
- serie de correctifs playtest / GitHub `LVL 7` / `LVL 8` / HUD
  - fontaine fixe `LVL 8` de nouveau buvable via le runtime actif
  - coffre `Green Gem` de `LVL 8` recale a travers teleporter + pit meme quand le niveau cible n'etait pas encore hydrate
  - projectiles muraux `LVL 7` reappliquent bien leurs degats a la party
  - drag and drop `sol -> portrait / main champion` referme apres la regression du pipeline de lancer
- presentation / pickup des items sur case occupee
  - ferme cote runtime utile
  - les items sur case occupee ont maintenant leur presentation relevee / tiree vers le joueur, avec couverture dediee sur les cas `creature` et `party`
  - si un nouveau playtest remonte un vrai cas de pickup impossible ou illisible, on le rouvrira comme bug cible plutot que comme chantier ouvert generique

## Ordre recommande avant release

1. playtest cible `generateurs / transitions de niveau`
2. mecanismes rares et endgame
3. profilage / optimisation

## 1. Playtest cible generateurs / transitions

Statut:

- ouvert

Pourquoi ce n'est pas fini:

- le chantier generateurs est largement recale cote code et tests
- le reliquat utile est surtout une passe de confirmation gameplay sur les cas limites, pas un gros doute moteur restant

A verifier:

- `teleport`
- `pit`
- changement de niveau
- repop tardif
- retour sur un niveau deja quitte

Definition de fini:

- les cas ci-dessus ont ete joues explicitement
- aucun comportement incoherent n'est observe sur `active / dormant / reserved`
- si un ecart apparait, il devient un bug cible avec reproduction courte

Support:

- [PLAYTEST_CHECKLIST_TRANSITIONS_ENDGAME.md](/D:/DungeonMaster-codex/docs/PLAYTEST_CHECKLIST_TRANSITIONS_ENDGAME.md)

## 2. Profilage / optimisation

Statut:

- ouvert

Pourquoi ce n'est pas fini:

- le boot prod est acceptable, mais la pile runtime / rendu reste lourde
- le mode `dev` reste lent a froid, meme si ce n'est pas le sujet prioritaire
- les warnings de build les plus bruyants sont maintenant recales; le sujet redevient surtout une question de mesure reelle et de rendement
- le warm-up title/gameplay est deja plus progressif qu'avant, mais `three` et le chargement des maps restent la vraie masse a surveiller

Priorites:

- `three-core`
- `dungeon-render`
- preload des donnees runtime
- warm-up title / gameplay
- rerenders evitables dans `DungeonScene`
- garder le preload coeur limite aux assets / modules a rendement immediat

Definition de fini:

- on identifie 2 ou 3 gains concrets a fort rendement
- on applique seulement ceux qui ne compliquent pas le runtime inutilement

## 3. Mecanismes rares et endgame

Statut:

- ouvert

Pourquoi ce n'est pas fini:

- le coeur gameplay est solide, mais quelques cas tardifs / rares meritent encore confirmation en vrai playtest
- la semantique des mecanismes courants est maintenant largement decryptee; le reliquat n'est plus un chantier moteur large, mais un petit long tail de combinaisons `delay / gate / local wall effects / countdowns` si de nouveaux retours apparaissent
- le chemin `Firestaff -> Fuse -> endgame -> victory` et la fin alternative du `Hall of Champions` ne sont plus les inconnues principales
- le point ouvert utile cote fin de jeu est surtout la fidelite exacte de la representation de `Lord Chaos` face aux `Fluxcage` et a ses echappements speciaux, si on veut coller de tres pres a la formulation walkthrough
- un garde-fou utile existe deja: `Fluxcage` lance sur sa case le fait maintenant s'echapper vers une case adjacente libre au lieu de le pieger artificiellement
- second garde-fou en place: `Fuse` n'entre plus en `endgame` si `Lord Chaos` a encore une case adjacente libre; il s'echappe d'abord au lieu de valider la fusion

Cible:

- representation exacte du piege final de `Lord Chaos`
- echappements speciaux / double move de `Lord Chaos`
- derniers timings / enchainements de la vraie fin
- mecanismes tardifs peu frequents seulement si un playtest remonte un cas concret

Definition de fini:

- les cas critiques ont ete rejoues
- les derniers ecarts observes sont documentes comme bugs ou comme sujets fermes

Support:

- [PLAYTEST_CHECKLIST_TRANSITIONS_ENDGAME.md](/D:/DungeonMaster-codex/docs/PLAYTEST_CHECKLIST_TRANSITIONS_ENDGAME.md)

## Hors priorite immediate

- compatibilite navigateur `drag and drop inventaire -> vue donjon`
  - a verifier sur `Firefox / Linux`
  - symptome remonte: un objet deja dans l'inventaire reste en main apres relacher sur la vue du donjon; le drag natif navigateur semble prendre le dessus et l'overlay de drop du jeu n'apparait pas correctement
  - non confirme localement a ce stade; non reproduit cote `Brave`
  - ne pas corriger avant reproduction locale nette; la piste probable est l'ecart entre le drag HTML natif de l'inventaire et le drag `maison` des objets deja au sol
- nouvelles micro-extractions du `store`
  - non prioritaires
  - le gros travail utile est deja fait
  - on n'en relance pas sans raison nette
- polish HUD `combat`
  - a revoir plus tard
  - petit reliquat concret seulement
  - le `combat grid` ouvre encore son sous-menu sur le compte total `allAttacks` au lieu de s'en tenir strictement aux actions vraiment utilisables
  - les actions non utilisables restent encore visibles dans ce menu au lieu d'etre simplement filtrees

## Discipline de mise a jour

Quand un sujet avance:

- soit il est `ferme` et il sort de ce document
- soit il reste `ouvert` et on precise exactement ce qu'il manque encore
- pas de longues listes historiques ici
- l'historique detaille vit dans [docs/REMAKE_STATUS.md](/D:/DungeonMaster-codex/docs/REMAKE_STATUS.md)

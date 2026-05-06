# Next Phase Plan

Etat revu le `2026-05-06`.

Ce document ne doit contenir que des sujets encore ouverts.

Lecture actuelle:

- le projet est entre en phase `beta`
- ce plan ne liste plus des chantiers d'alpha, mais surtout ce qu'il reste a valider avant une release plus large

Regle simple:

- un sujet `ferme` sort d'ici et reste trace dans [docs/REMAKE_STATUS.md](/D:/DungeonMaster-codex/docs/REMAKE_STATUS.md)
- un sujet `ouvert` doit dire explicitement ce qui manque encore
- on n'utilise plus de statuts flous du type `entamee` sans dire `pourquoi ce n'est pas fini`

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

## Ordre recommande avant release

1. playtest cible `generateurs / transitions de niveau`
2. mecanismes rares et endgame
3. presentation / interaction des items sur case occupee
4. profilage / optimisation

## 1. Playtest cible generateurs / transitions

Statut:

- ouvert

Pourquoi ce n'est pas fini:

- le chantier generateurs est boucle cote code, mais pas encore valide en jeu sur les cas limites

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

## 2. Presentation / interaction des items sur case occupee

Statut:

- ouvert

Pourquoi ce n'est pas fini:

- un cas de presentation / ciblage reste a confirmer quand un groupe de creatures partage la case d'objets au sol

A verifier:

- objets au sol partiellement masques par un groupe de creatures sur la meme case
- visibilite du pickup quand un item est sous ou derriere un groupe
- priorite de ciblage / ramassage sur la case occupee sans casser la lisibilite des creatures

Definition de fini:

- les items au sol restent visibles et ramassables meme quand un groupe occupe la case
- le comportement retenu est rejoue une fois proprement en playtest

## 3. Profilage / optimisation

Statut:

- ouvert

Pourquoi ce n'est pas fini:

- le boot prod est acceptable, mais la pile runtime / rendu reste lourde
- le mode `dev` reste lent a froid, meme si ce n'est pas le sujet prioritaire
- le warm-up title/gameplay est deja plus progressif qu'avant, mais les gros chunks `three` et `map-*` restent la vraie masse a surveiller

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

## 4. Mecanismes rares et endgame

Statut:

- ouvert

Pourquoi ce n'est pas fini:

- le coeur gameplay est solide, mais les cas rares n'ont pas encore tous ete rejoues et verifies jusqu'au bout
- la semantique des mecanismes courants est maintenant largement decryptee, mais les combinaisons rares `delay / gate / local wall effects / countdowns` demandent encore du playtest cible pour confirmer qu'on couvre bien tout le long tail sans regressions

Cible:

- `Zo Kath Ra`
- `Firestaff`
- `Fuse`
- victoire
- mecanismes tardifs peu frequents

Definition de fini:

- les cas critiques ont ete rejoues
- les derniers ecarts observes sont documentes comme bugs ou comme sujets fermes

Support:

- [PLAYTEST_CHECKLIST_TRANSITIONS_ENDGAME.md](/D:/DungeonMaster-codex/docs/PLAYTEST_CHECKLIST_TRANSITIONS_ENDGAME.md)

## Hors priorite immediate

- nouvelles micro-extractions du `store`
  - non prioritaires
  - le gros travail utile est deja fait
  - on n'en relance pas sans raison nette
- polish HUD `combat`
  - a revoir plus tard
  - si une seule action est disponible, ne pas ouvrir de sous-menu
  - masquer les actions indisponibles au lieu de les afficher en grise

## Discipline de mise a jour

Quand un sujet avance:

- soit il est `ferme` et il sort de ce document
- soit il reste `ouvert` et on precise exactement ce qu'il manque encore
- pas de longues listes historiques ici
- l'historique detaille vit dans [docs/REMAKE_STATUS.md](/D:/DungeonMaster-codex/docs/REMAKE_STATUS.md)

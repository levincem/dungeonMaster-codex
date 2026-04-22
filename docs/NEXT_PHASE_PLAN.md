# Next Phase Plan

Etat revu le `2026-04-22`.

Ce document ne doit contenir que des sujets encore ouverts.

Regle simple:

- un sujet `ferme` sort d'ici et reste trace dans [docs/REMAKE_STATUS.md](/D:/DungeonMaster-codex/docs/REMAKE_STATUS.md)
- un sujet `ouvert` doit dire explicitement ce qui manque encore
- on n'utilise plus de statuts flous du type `entamee` sans dire `pourquoi ce n'est pas fini`

## Ferme recemment

- `GROUP / ACTIVE_GROUP / generateurs`
  - ferme cote code
  - il reste seulement un playtest cible, pas un nouveau chantier moteur
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
- passe fidelite runtime
  - fermee cote recollage code/source pour les domaines critiques utiles au runtime
  - le reliquat fidelity n'est plus un chantier de reimplementation, mais surtout du playtest cible et quelques finitions visuelles
- passe `i18n / labels`
  - fermee sur le runtime/UI visible
  - manuel francais dedie ajoute et labels debug/runtime restants reroutes dans les fichiers de langue
- rendu `Ra Door`
  - ferme cote presentation cible
  - le rendu visible passe maintenant par un panneau energetique procedural + rideau `photons2`

## Ordre recommande

1. playtest cible `generateurs / transitions de niveau`
2. mecanismes rares et endgame
3. verification visuelle `HUD / ChampionSheet / DungeonScene`
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

## 2. Verification visuelle HUD / ChampionSheet / DungeonScene

Statut:

- ouvert

Pourquoi ce n'est pas fini:

- ces zones ont ete beaucoup remaniees, mais la verification a surtout ete structurelle et testee, pas encore assez jouee visuellement

A verifier:

- HUD combat / runes / drag and drop
- ChampionSheet inventaire / fontaine / autel / front wall
- DungeonScene interactions visibles, decals, pits, overlays, trick walls
- si un artefact `DungeonScene` reapparait, utiliser d'abord le mini mode debug local :
  - `Alt+Shift+T` textes muraux
  - `Alt+Shift+D` decals muraux
  - `Alt+Shift+B` boutons/capteurs muraux
  - `Alt+Shift+R` reset
  - actif uniquement en dev, pas dans la build
- cas deja observe:
  - sur le puzzle `LVL 1` boulder/dalle, un rectangle brun flottant venait de la couche `wallButtons`

Definition de fini:

- aucun bug visuel ou de wiring evident sur les zones touchees
- les cas sensibles sont rejoues une fois proprement

Point note pour reprise de playtest:

- objets au sol partiellement masques par un groupe de creatures sur la meme case
  - a verifier en presentation / interaction: il faut pouvoir mieux voir, cibler et ramasser les items presents sous ou derriere un groupe
  - piste a tester: leger recul camera / meilleur framing de la case / priorite visuelle pickup sur la case occupee
  - ne pas traiter ca comme un bug de donnee ou de logique item tant que le rendu / ciblage n'a pas ete rejoue proprement
- cooldown de deplacement trop bas quand le groupe est vide au tout debut
  - probablement normalise trop agressivement par la formule de mouvement quand `party.length === 0`
  - a recaler demain pour garder un comportement propre meme avant recrutement

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

## Discipline de mise a jour

Quand un sujet avance:

- soit il est `ferme` et il sort de ce document
- soit il reste `ouvert` et on precise exactement ce qu'il manque encore
- pas de longues listes historiques ici
- l'historique detaille vit dans [docs/REMAKE_STATUS.md](/D:/DungeonMaster-codex/docs/REMAKE_STATUS.md)

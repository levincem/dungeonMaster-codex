# Dungeon Master Remake - Etat du projet

Etat revu le `2026-04-20`.

Ce document est un journal d'etat compact.

Pour la liste des sujets encore ouverts et ordonnes, lire [docs/NEXT_PHASE_PLAN.md](/D:/DungeonMaster-codex/docs/NEXT_PHASE_PLAN.md).

## Resume actuel

Le projet est maintenant une alpha desktop-first jouable et serieuse.

Ce qui est solidement en place:

- exploration 3D du donjon et progression principale
- HUD, fiche champion, inventaire, equipement, drag and drop
- feedback visuel de montee de niveau champion cote HUD
- creatures, projectiles, melee, distance, sorts, faim, soif, sommeil
- portes, pits, teleporteurs, fontaines, interactions murales, miroirs, autels
- sauvegarde / reprise d'un etat runtime mutable
- chemin de fin de jeu jusqu'a la victoire

Lecture honnete du projet aujourd'hui:

- l'extraction utile au runtime principal est consideree comme fiable
- le coeur gameplay est largement `source-backed`
- le `store` n'est plus le gros chantier prioritaire
- les restes ouverts sont surtout du playtest cible, de la fidelite sur cas rares, des labels/UX et de l'optimisation

Validation locale la plus recente:

- `npm.cmd test` : `608` tests verts
- `npm.cmd run build` : vert

## Aide debug locale

Pour isoler rapidement un artefact `DungeonScene`, un mini mode debug de rendu a ete ajoute temporairement:

- `Alt+Shift+T` : active/desactive les textes muraux
- `Alt+Shift+D` : active/desactive les decals muraux
- `Alt+Shift+B` : active/desactive les boutons/capteurs muraux (`WallSensor`)
- `Alt+Shift+R` : reset
- ce mini panneau/debug render n'est actif qu'en dev; il n'apparait pas dans la build

Point utile deja confirme:

- sur le puzzle `LVL 1` du boulder et de la dalle, le rectangle brun flottant etait lie a la couche `wallButtons`
- cause racine identifiee: `buildDungeonSceneWallButtons(...)` faisait remonter a tort des capteurs de sol `type 1/2` dans la couche des boutons muraux
- correctif applique: la couche `wallButtons` ne rend plus que des capteurs poses sur `Wall` / `TrickWall`
- si l'artefact revient, commencer par couper `B` avant de chercher plus loin

## Ce qui est ferme

### Architecture runtime

- packaging runtime deplace vers `src/assets/runtime/`
- donjon splitte en `bootstrap + maps/level-XX`
- `game_db` splitte en slices runtime `items / weapon attacks / creatures`
- overlays muraux splittes par map

### Store et runtime

- le gros degonflage du `store` est fait
- les familles runtime principales ont des modules dedies et testes
- le `store` peut maintenant etre considere comme une couche de composition saine, pas comme un monolithe prioritaire a casser davantage

### Generateurs / groupes actifs

- distinction runtime explicite `active / dormant`
- les groupes hors map de la party ne consomment plus les slots `ACTIVE_GROUP`
- les reservations hors map ne consomment plus la marge `60 / 5`
- les retries `move later` rematerialisent un blueprint gele au lieu de reroller le groupe

### Sensors `floor type 3`

- ces capteurs sont maintenant traites comme `party / orientation`
- ils n'exportent plus de faux `requiredObjectName`
- un drop d'objet ne les declenche plus comme une plaque a objet
- les rares `type 3` encore nommes sont des sensors muraux legitimes

### `0696.RAW1`

- le bloc est maintenant borne comme conteneur post-Atari de composition/layout
- il ne doit plus etre traite comme un verrou gameplay opaque
- ce qui reste provisoire concerne surtout les noms exacts de certains helpers/opcodes

## Ce qui reste ouvert

Le detail ordonne vit dans [docs/NEXT_PHASE_PLAN.md](/D:/DungeonMaster-codex/docs/NEXT_PHASE_PLAN.md), mais en resume:

- playtest cible `generateurs / transitions de niveau`
- passe `i18n / labels`
- verification visuelle des zones UI remaniees
- profilage / optimisation
- mecanismes rares et endgame
- quelques couches runtime/data encore hybrides et quelques placeholders de presentation

## Checkpoints recents

### 2026-04-20

Travail ferme dans cette session:

- chantier `generateurs / groupes actifs` boucle cote code
- correction globale des faux `Compass` sur les `floor type 3`
- audit multi-levels refait pour les sensors de sol / mur
- `0696.RAW1` recale comme conteneur de composition/layout plutot que comme bloc stats cache
- `creatures.ts` recale sur les champs directs `I559` quand leur semantique est prouvee
  - `baseHP`
  - `armor`
  - `hitProb`
  - `atkSpd`
  - `moveSpd`
  - `poison`
  - `originalAttackType`
- `items.ts` recale pour lire la slice source-backed packagee meme sans preload explicite
- garde-fous ajoutes sur la nutrition extraite et les masques d'equipement packagees
- `championStarterItems.ts` ne duplique plus d'ids de compatibilite dans ses loadouts
- les starters passent maintenant par une resolution centralisee par nom, y compris pour `Robe` et `Empty Flask`
- dismiss dans le Hall of Champions ne droppe plus le materiel du champion au sol
- les alias de potions ne gardent plus que les vrais libelles alternatifs
- la couche d'images d'items a perdu plusieurs aliases redondants de potions canoniques
- les aliases redondants de `The Firestaff (Complete)` ont aussi saute
- plusieurs mappings legacy d'images ont encore ete retires quand le nom canonique ou un alias resolvait deja le bon sprite
- le Hall recroise maintenant `24 / 24` starters sans table manuelle `slot -> champion`
- les noms d'items des `24` starters matchent maintenant l'evidence Hall, y compris les armures
- le recroisement contre la table de reference DM a confirme un melange `DM / CSB` sur quelques noms d'armure Hall
- `Barbarian Hide`, `Robe (Body)` et `Robe (Legs)` ont ete restaures comme noms canoniques DM pour les ids concernes
- les anciens shims d'armure a ids negatifs ont ete retires de la couche runtime
- les dalles `floor type 3` de passage/orientation reapparaissent maintenant dans le rendu des plaques de sol
- une animation de montee de niveau champion a ete ajoutee dans le HUD
- checklist ciblee ecrite pour `transitions / generateurs / endgame`
- clarification documentaire ajoutee sur `graphics_db` :
  - une famille `Item on floor` est une ressource de rendu au sol, pas une fusion d'identite d'objet
- garde-fou global ajoute sur la chaine `Hall -> items -> auto-equip`
  - les starters equipent maintenant leurs slots attendus sous test, y compris pour les cas sensibles `Halk`, `Zed`, `Mophus`, `Elija`, `Hawk`, `Wu Tse` et `Gando`
- audit de packaging ajoute :
  - `audit_runtime_package_consistency.cjs` verifie maintenant que `output/runtime_*` et `src/assets/runtime/*` restent strictement alignes pour bootstrap, maps, `game_db`, slices, overlays et manifest
- passe de corrections gameplay / rendu suite aux playtests:
  - armes lancees recuperables apres impact / mort de creature
  - drag and drop donjon repense avec une grammaire commune `poser ici / poser devant / lancer`
  - drop direct `main -> donjon` et `donjon -> donjon` maintenant routes par le meme helper
  - overlay de feedback ajoute dans `DungeonScene` pendant le drag pour rendre la destination visible
  - correction de la logique `Hold + revert` pour les dalles qui doivent fermer une fosse quand elles sont chargees
  - attaques de contact bloquees depuis la rangee arriere
  - quiver reutilise correctement apres un lancer
  - ciblage melee des monstres recontraint a la facade exposee
  - dalles de pression `Hold` recalees pour `party / objets / creatures`
  - teleports caches rendus avec un brouillard magique discret
  - petit mode debug `DungeonScene` ajoute pour isoler `texts / decals / wallButtons`
  - correction des portes a deux leviers pilotees par un capteur mural `type 5`
    - les evenements muraux a distance atteignent maintenant bien le capteur de combinaison meme si sa face physique differe du `targetDir` des leviers
  - suivi sur les memes leviers:
    - plus de faux bruit de porte au premier levier quand la porte ne bouge pas encore reellement
    - le levier garde maintenant correctement son etat visuel `up/down` au lieu d'annuler son toggle via un double update d'`activeSensors`
Impact:

- le moteur est plus proche de `GROUP1.C`
- les capteurs de sol `type 3` sont maintenant interpretes correctement
- `0696` ne fait plus partie des gros verrous semantiques prioritaires
- la couche `creatures` ne depend plus d'une vieille table normalisee pour ses stats coeur
- la couche `items / equipment` n'a plus de dependance cachee au preload pour ses donnees source-backed packagees
- les starters ne trainent plus de duplication d'ids ni de faux masques d'equipement derives d'index negatifs
- le Hall cote starters est maintenant recale sur les noms d'items exacts du tableau DM sans dependre de shims d'armure legacy
- le reste hybride cote creatures est maintenant surtout `exp` et `attackTypes`
- le prochain meilleur levier global reste le playtest cible et la finition UI/runtime
- les playtests remontent maintenant surtout des ecarts locaux de rendu/interactions au lieu de gros soucis de donnees

### 2026-04-19

Passe de consolidation:

- nettoyage d'encodage sur plusieurs zones UI
- simplification de `DungeonScene`
- simplification de `HUD`
- simplification de `ChampionSheet`
- clarification de plusieurs modules runtime hybrides (`sensorRuntimeDeps`, `transportRuntimeDeps`, `storeAttackFrontRuntime`, `storeSpellRuntime`, `persistence`)

Impact:

- meilleure lisibilite
- moins de bruit structurel
- prochain meilleur levier de cette branche: labels / verification visuelle / optimisation

### 2026-04-18

Point de bascule assume:

- le `store` cesse d'etre la priorite principale
- le projet passe d'une logique de gros degonflage architectural a une logique de finition ciblee
- les gros blocs encore denses a surveiller deviennent surtout `DungeonScene`, `HUD`, `ChampionSheet` et quelques modules runtime hybrides

## Milestones plus anciens deja absorbes

Ces points sont consideres comme acquis et n'ont plus besoin d'etre repetes partout:

- extraction et integration des principales donnees runtime
- externalisation progressive des familles gameplay hors `store`
- fiabilisation des calculs coeur `luck / quickness / defenses / projectiles / XP / survival`
- preload runtime plus progressif qu'avant
- separation plus propre des chunks gameplay / data / rendu

## Regle documentaire

Pour eviter de reperdre le fil:

- `README` reste court et public
- `NEXT_PHASE_PLAN` ne contient que des sujets ouverts
- `REMAKE_STATUS` garde seulement l'etat courant et quelques checkpoints utiles
- un sujet ferme sort du plan courant au lieu d'y survivre en statut ambigu

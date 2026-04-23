# Dungeon Master Remake - Etat du projet

Etat revu le `2026-04-23`.

Ce document est un journal d'etat compact.

Pour la liste des sujets encore ouverts et ordonnes, lire [docs/NEXT_PHASE_PLAN.md](/D:/DungeonMaster-codex/docs/NEXT_PHASE_PLAN.md).

## Resume actuel

Le projet est maintenant une beta desktop-first jouable et serieuse.

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
- les restes ouverts sont surtout du playtest cible, des cas rares, quelques ecarts de presentation et de l'optimisation
- on n'est pas encore en `release candidate`, mais on n'est plus dans une logique d'alpha fragile

Validation locale la plus recente:

- `npm.cmd test` : `721` tests verts
- `npm.cmd run lint` : vert
- `npm.cmd run build` : vert

## Lecture beta

Ce que veut dire `beta` ici:

- le debut du jeu est maintenant jouable de facon suivie sans bug bloquant evident
- le coeur du runtime tient en conditions normales de playtest
- les regressions restantes attendues sont plutot des cas rares, du tuning ou du polish que des ruptures structurelles

Ce qu'il reste avant une release plus large:

- rejouer explicitement `generateurs / transitions / endgame`
- verifier les mecanismes rares et les timings tardifs
- confirmer les derniers cas de presentation / pickup sur case occupee
- continuer a surveiller les performances sur longues sessions, surtout en `dev`

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
- presentation / interaction des items sur case occupee
- profilage / optimisation
- mecanismes rares et endgame
- surtout du playtest cible sur cas rares, puis quelques ecarts de presentation

## Checkpoints recents

### 2026-04-22

Travail ferme dans cette session:

- input clavier de deplacement maintenu recale dans `HUD`
  - le maintien d'une touche ne depend plus du repeat OS
  - le rythme suit maintenant le `movementCooldown` runtime au lieu d'un ressenti artificiellement ralenti
- warm-up runtime encore adouci
  - le preload visuel gameplay est maintenant fractionne `coeur / secondaire`
  - les icones d'items ne partent plus en rafale sur le chemin immediat d'entree en partie
  - les overlays muraux decoratifs et rares ont aussi quitte le preload coeur
  - les modules UI secondaires (`MirrorPopup`, `ChampionSheet`, `VictoryScreen`) ne se rechauffent plus qu'en idle pendant le gameplay
  - les effets `PhotonsFireball` ne bloquent plus le preload coeur d'entree
- passe `i18n / labels` runtime/UI refermee
  - les derniers labels visibles du runtime/UI sont maintenant reroutes dans `src/i18n/en.ts` et `src/i18n/fr.ts`
  - le manuel francais existe maintenant en propre via `src/i18n/help.fr.json`
  - la langue par defaut suit maintenant la locale du navigateur (`fr` / `en`)
- correctif fidelity sur les porte-torches muraux
  - `Full Torch Holder` n'affiche plus une torche en surimpression
  - l'overlay plein porte seul l'image visible de la torche
  - une zone de pickup invisible conserve le ramassage de la torche sur le mur
- rendu `Ra Door` recale
  - le rendu visible passe maintenant par un panneau energetique procedural + rideau `photons2`
  - ce point sort de la pile `asset a peindre` et de la pile `VFX a finaliser`
- les presets muraux partages couvrent maintenant aussi `Full Torch Holder` et `Empty Torch Holder`
- docs de fidelite remises a jour pour refleter l'etat reel des overlays muraux et des placeholders actifs
- dernier reliquat interprete cote creatures maintenant borne explicitement
  - la traduction runtime des `attackTypes` speciaux vit maintenant dans une table exportee et testee
  - les cas sans interpretation speciale retombent explicitement sur la table de base `originalAttackType -> attackTypes`
- relecture des notes de fidelite
  - `items.ts` et `equipment.ts` ne sont plus traites comme gros trous fidelity
  - le reliquat utile est maintenant recentre sur le playtest `transitions / endgame` et les derniers placeholders visuels

Impact:

- le ressenti de deplacement clavier est plus propre sans changer encore la formule brute du cooldown
- le demarrage et la reprise evitent mieux les grosses rafales de decode d'images non critiques
- l'entree en partie ne bloque plus sur les VFX projectile ni sur les overlays decoratifs peu frequents
- les labels runtime/UI ne trainent plus de reliquat visible en dur hors contenu de jeu volontaire
- la locale francaise dispose maintenant de son manuel et suit enfin une resolution automatique coherente
- le bug visuel le plus visible sur les overlays stateful de porte-torche est ferme
- la `Ra Door` a maintenant un rendu energie finalisable sans dependre d'un repaint bitmap
- le dernier reliquat interprete cote creatures est maintenant explicite, borne et verrouille par tests
- la memoire projet recolle de nouveau avec l'etat reel du runtime et des validations locales

### 2026-04-20

Travail ferme dans cette session:

- chantier `generateurs / groupes actifs` boucle cote code
- correction globale des faux `Compass` sur les `floor type 3`
- correction globale des fausses dalles visibles sur les `floor type 3` caches
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
- les `floor type 3` ne sont plus traites en bloc:
  - les variantes cachees sans graphisme de dalle restent invisibles
  - les variantes avec vrai graphisme de dalle reapparaissent correctement dans le rendu
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

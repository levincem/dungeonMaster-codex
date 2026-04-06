# Dungeon Master Remake - Etat du projet et plan d'achevement

## Resume rapide

Le projet est deja une base tres avancee et jouable:

- rendu 3D du donjon avec React, TypeScript, Vite, Three.js et React Three Fiber
- deplacement du groupe dans les niveaux
- recrutement des champions via les miroirs
- interface HUD jouable
- HUD principal retravaille : portraits en ligne, mains visibles, formation 2x2 a droite
- monstres visibles avec IA simple
- combat temps reel simplifie
- sorts partiellement fonctionnels
- inventaire, equipement, transfert et ramassage d'objets
- portes, senseurs, teleporteurs et une partie des interactions de carte
- TrickWalls (murs secrets) avec système levier/capteur/porte logique
- fiche de champion redessinée (parchemin, équipement silhouette, noms DM1)
- textes muraux gravés en 3D directement sur les murs (canvas texture)
- overlays muraux (escaliers, autels, leviers, serrures) correctement positionnés et sans bleeding

En revanche, ce n'est pas encore un remake "proprement termine". Le projet ressemble aujourd'hui a une vertical slice avancee plutot qu'a une recreation complete et finie de Dungeon Master.

## Ce que j'ai constate

### 1. Le coeur du jeu est deja la

Les zones les plus solides du projet:

- [src/App.tsx](/D:/DungeonMaster-codex/src/App.tsx)
  boucle temps reel centralisee avec regen, combat, monstres, portes et sorts
- [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts)
  coeur de la logique de jeu
- [src/components/Dungeon/DungeonScene.tsx](/D:/DungeonMaster-codex/src/components/Dungeon/DungeonScene.tsx)
  scene 3D, creatures, objets, fog, interactions du decor
- [src/components/UI/HUD.tsx](/D:/DungeonMaster-codex/src/components/UI/HUD.tsx)
  deplacement, combat, runes, selection des champions
- [src/components/UI/ChampionSheet.tsx](/D:/DungeonMaster-codex/src/components/UI/ChampionSheet.tsx)
  inventaire et equipement avances
- [src/data/mapLoader.ts](/D:/DungeonMaster-codex/src/data/mapLoader.ts)
  chargement du dungeon original depuis `Old_data/dungeon.json`

### 2. Le projet build maintenant proprement

Commande verifiee:

```powershell
npm.cmd run build
```

Conclusion:

- le build vert n'est plus un blocage
- on peut maintenant se concentrer sur la fidelite systemique, les mecanismes et le polish

### 3. Des ecrans existent mais ne sont pas branches

[src/components/UI/HeroSelectionScreen.tsx](/D:/DungeonMaster-codex/src/components/UI/HeroSelectionScreen.tsx) est deja code, mais [src/App.tsx](/D:/DungeonMaster-codex/src/App.tsx) ne l'utilise pas.

Aujourd'hui:

- l'app charge directement la scene du donjon
- la composition de l'equipe passe surtout par les miroirs du Hall of Champions

Donc il faut choisir une direction claire:

- soit conserver l'approche fidele au jeu original via les miroirs
- soit brancher l'ecran de selection comme vrai ecran de debut
- soit utiliser l'ecran comme mode optionnel/debug

### 4. La magie est seulement partiellement implemente

Le systeme de runes est riche dans:

- [src/data/runes.ts](/D:/DungeonMaster-codex/src/data/runes.ts)
- [src/data/spells.ts](/D:/DungeonMaster-codex/src/data/spells.ts)

Mais les effets reels dans le store sont limites. Dans [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts#L935), les effets bien pris en charge sont surtout:

- `heal`
- `light`
- `open`
- `fireball`
- `lightning`
- `poison`
- `plasma`

Les effets declares mais encore sans implementation gameplay solide:

- `shield`
- `fire_shield`
- `darkness`
- `invisibility`
- `magic_vision`
- `potion`
- `footprints`

Conclusion:

- la magie a deja une bonne base de data et d'UI
- mais elle n'est pas encore au niveau d'un remake complet

### 5. Le combat existe, mais reste une version simplifiee

Le combat du groupe et l'IA des monstres tournent deja dans [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts), mais on voit encore beaucoup de simplifications:

- degats et formules approximatifs
- peu d'exploitation des resistances et proprietes fines des creatures
- effets speciaux des monstres seulement partiellement representes
- peu d'etats persistants sur les champions
- armes a distance, lancers, munitions et usages speciaux pas finalises

Le jeu est donc jouable, mais pas encore "authentique" ni complet systemiquement.

### 6. Les objets et statuts avancent nettement, mais ne sont pas termines

Les donnees d'objets sont riches:

- nourriture
- eau
- potions
- cles
- corde
- objets speciaux
- conteneurs

Les points deja bien avances:

- catalogues runtime relies a des JSON d'origine consolides
- nettoyage global des noms d'objets a partir des listes extraites
- regles d'equipement centralisees et partagees entre UI et runtime
- verification des slots valides cote store
- poids et charge max rapproches du comportement DM
- quelques bonus passifs documentes branches

Mais la boucle de jeu associee n'est pas encore terminee:

- pas de faim/soif visible
- pas de vrai systeme de poison persistant cote groupe
- potions et bonus temporaires incomplets
- cles, serrures et drag and drop main -> serrure encore a finaliser
- conteneurs non exploites comme vrai systeme de contenu
- usage des objets speciaux incomplet

### 7. Les tiles speciales et interactions de carte progressent, mais restent incompletes

Le typage et les donnees prevoient:

- `Pit`
- `Water`
- `TrickWall` (murs secrets) — **implementes** : impassables par defaut, ouvrables par capteurs
- portes de plusieurs types
- textes muraux
- teleporteurs
- senseurs / portes logiques — **implementes** : type 5, seuil d'inputs, actions Hold

Ce qui est maintenant deja mieux cale:

- portes branchees sur leurs proprietes originales (vision / passage projectiles)
- texture specifique de grille fer
- vraies plaques de pression Floor affichees, sans faux positifs teleporter au debut du niveau 0
- convention levier_haut = inactif, levier_bas = actif

Mais il manque encore des comportements attendus pour un remake complet:

- chutes dans les puits
- usage de la corde
- interactions liees a l'eau
- illusions / vision magique completes
- gestion plus fine des portes verrouillees

### 8. Il manque encore des conditions de fin et des etats globaux

Je n'ai pas vu de boucle complete pour:

- victoire finale
- game over
- mort totale du groupe
- ecran de defaite ou de fin
- reprise / sauvegarde / chargement

Or ce sont des briques importantes pour pouvoir dire que le remake est proprement termine.

### 9. Le contenu visuel n'est pas complet

[MISSING_IMAGES.md](/D:/DungeonMaster-codex/MISSING_IMAGES.md) montre deux categories de manque:

- des images deja creees mais non mappees dans [src/data/itemImages.ts](/D:/DungeonMaster-codex/src/data/itemImages.ts)
- des items encore sans image du tout

En plus:

- plusieurs fallbacks d'assets masquent les manques plutot que de les resoudre
- le chargement considere les erreurs de preload comme acceptables

### 10. Le polish global n'est pas fini

Points de finition encore visibles:

- README non nettoye et encore melange avec le template Vite
- problemes d'encodage de texte dans plusieurs fichiers
- ecran de chargement permissif sur les assets manquants
- coherence UX encore a harmoniser

## Diagnostic global

### Niveau actuel

Le projet est:

- fort sur la structure
- fort sur les donnees source
- fort sur le rendu et l'ambiance
- moyen sur la fidelite systemique complete
- faible sur la robustesse "version livrable"

### Formulation simple

On n'est pas devant "un prototype vide".
On n'est pas non plus devant "un remake fini".
On est devant une excellente base jouable qui demande encore une vraie phase de stabilisation et de completion.

## Plan propose

## Phase 1 - Remettre le projet au propre techniquement

Objectif:

- retrouver un projet qui compile, se build et sert de base stable

Taches:

- corriger toutes les erreurs TypeScript
- supprimer ou corriger les champs references mais absents comme `description`
- durcir le typage du map loader
- verifier que `npm.cmd run build` passe
- nettoyer les warnings evidents
- corriger les soucis d'encodage visibles dans les fichiers source prioritaires
- remettre le README en etat minimum utile

Definition of done:

- build vert
- README coherent
- base technique saine pour avancer

## Phase 2 - Clarifier le flow de jeu principal

Objectif:

- definir clairement comment commence, progresse et se termine une partie

Taches:

- decider du vrai flow de debut:
  - selection via miroirs seulement
  - ecran de selection branche
  - ou mode hybride
- ajouter un etat "game over" correct
- ajouter un etat de victoire ou de fin
- definir le comportement quand tous les champions sont morts
- afficher des ecrans ou overlays de fin de partie minimum

Definition of done:

- une partie peut etre lancee, jouee, perdue ou terminee proprement

## Phase 3 - Completer la magie

Objectif:

- rendre les sorts deja decrits reellement utiles en jeu

Taches:

- implementer `shield`
- implementer `fire_shield`
- implementer `darkness`
- implementer `invisibility`
- implementer `magic_vision`
- implementer `potion`
- implementer `footprints`
- verifier l'equilibrage mana / XP / duree
- harmoniser [src/data/runes.ts](/D:/DungeonMaster-codex/src/data/runes.ts) et [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts)

Definition of done:

- tous les effets de sorts declares ont un effet gameplay identifiable

## Phase 4 - Finaliser les systemes d'objets et de statuts

Objectif:

- transformer l'inventaire actuel en vrai systeme Dungeon Master complet

Taches:

- ajouter faim et soif
- ajouter poison persistant et antidote
- ajouter usage reel des nourritures et de l'eau
- finaliser les potions creees ou trouvees
- gerer les bonus temporaires
- mieux gerer poids et charge
- ajouter logique de cles / serrures
- gerer les conteneurs avec contenu
- finaliser objets speciaux et objets de quete

Definition of done:

- les objets du donjon ne sont plus seulement "ramassables", ils ont leurs usages attendus

## Phase 5 - Completer les interactions de carte

Objectif:

- couvrir les interactions essentielles du dungeon original

Taches:

- implementer comportement des pits
- implementer corde et descente si necessaire
- gerer l'eau et ses specificites si prevues
- completer portes verrouillees / types de portes
- completer portes secretes / illusions / vision magique
- verifier les senseurs particuliers map par map
- tester les niveaux critiques du donjon

Definition of done:

- les niveaux importants se traversent sans blocage fonctionnel majeur

## Phase 6 - Raffiner combat et IA

Objectif:

- passer d'un combat "jouable" a un combat plus credible et plus fidele

Taches:

- revoir formules de degats
- exploiter davantage `armor`, `hitProb`, resistances, types d'attaque
- completer effets speciaux de monstres
- gerer mieux les armes a distance, lancers et munitions
- eventuellement enrichir l'IA des monstres importants
- verifier l'equilibrage des cooldowns et de l'XP

Definition of done:

- le combat donne une impression plus proche de Dungeon Master et moins "placeholder"

## Phase 7 - Finir les assets et le polish

Objectif:

- faire disparaitre les gros manques visibles

Taches:

- vider progressivement [MISSING_IMAGES.md](/D:/DungeonMaster-codex/MISSING_IMAGES.md)
- mapper les images deja presentes dans [src/data/itemImages.ts](/D:/DungeonMaster-codex/src/data/itemImages.ts)
- creer ou assigner les images vraiment absentes
- revoir ecran de chargement et gestion des assets manquants
- corriger textes, encodage et coherence FR/EN
- faire une passe UX visuelle finale

Definition of done:

- plus de gros placeholders visibles pendant une partie normale

## Phase 8 - Fonctions de confort

Objectif:

- ajouter ce qui rend le projet vraiment reutilisable et reprenable

Taches:

- sauvegarde / chargement
- eventuel menu principal
- options son / affichage
- mode debug ou outils de test pour les maps

Definition of done:

- le projet devient confortable a utiliser et a maintenir

## Priorisation conseillee

### Must-have

- Phase 1
- Phase 2
- Phase 3
- Phase 4
- parties critiques de la Phase 5

### Should-have

- Phase 6
- Phase 7

### Nice-to-have

- Phase 8

## Recommandation concrete pour la reprise

Si on reprend le chantier de maniere pragmatique, le meilleur ordre est:

1. remettre le build au vert
2. choisir et brancher le vrai flow de debut
3. implementer les sorts manquants les plus structurants
4. completer objets, statuts et interactions de carte
5. finir assets et polish

## Premiere checklist de reprise

- [x] Faire passer `npm.cmd run build`
- [ ] Decider si `HeroSelectionScreen` doit etre branche ou non
- [ ] Ajouter au moins un etat de game over
- [ ] Ajouter au moins un etat de victoire ou de fin
- [x] Implementer `shield`
- [x] Implementer `invisibility`
- [x] Implementer `magic_vision`
- [ ] Implementer les sorts de type `potion`
- [ ] Clarifier faim / eau / poison / objets utilitaires
- [ ] Finaliser cles / serrures / alcoves avec drag and drop depuis les mains
- [ ] Brancher defenses d'armure / boucliers / resistances dans les degats recus
- [ ] Commencer le nettoyage de `MISSING_IMAGES.md`

## Journal des sessions

### Session 2026-04-06

**Donnees originales et runtime**

- Consolidation des tables d'origine en JSON de reference et JSON runtime dans `public/`
- `creatures.ts` et `items.ts` relies aux donnees originales consolidees
- nettoyage global des noms d'objets a partir des listes extraites
- resolver centralise des noms d'items utilise par les catalogues et par le chargement runtime

**HUD et interface**

- HUD principal retravaille : 4 portraits sur une ligne, mains visibles, formation 2x2 a droite
- tailles et espacements ajustes pour se rapprocher d'un usage clavier + DM1
- correction du halo de drag and drop dans la fiche champion

**Objets / equipement**

- regles de slots centralisees dans `src/data/equipment.ts`
- validation des slots cote UI et store
- correction des cas comme `Armor_21` / `Armor_22`
- formule de charge max rapprochee de Dungeon Master
- quelques bonus passifs d'objets documentes branches

**Portes / mecanismes**

- portes branchees sur leurs proprietes originales (vision / projectiles)
- plaques de pression derivees des vrais mecanismes Floor
- texture de grille fer corrigee via asset alpha propre
- convention des leviers fixee : haut=inactif, bas=actif

**ChampionSheet (src/components/UI/ChampionSheet.tsx)**

- Refonte complète : thème parchemin (parchemin.png en repeat), layout 3 colonnes
- Bouton × intégré dans le header (plus d'overlap)
- Silhouette d'équipement : grille CSS areas (head/neck/torso/legs/feet/hands + quiver 2×2 sous main droite + poches 1×2 sous main gauche)
- Bloc skills déplacé sous l'équipement dans la colonne centrale
- Portrait gauche en hauteur pleine
- Sac à dos : slots carrés (aspectRatio 1), miniatures 44px
- Portraits des autres membres en bas du sac à dos (drag & drop pour passer des objets)
- Highlight pulsant sur les slots valides lors d'un drag (animation CSS gold)
- Correction lecture des textes parchemins : utilisation de `rawObj.text` (pas `rawObj.name`)

**Overlays muraux (src/components/Dungeon/DungeonScene.tsx + WallDecal.tsx)**

- Textes muraux : remplacement du popup HTML par des plans 3D avec texture canvas (`WallTextEntry`, `makeEngravedTexture`) — texte gravé or sur fond transparent
- Correction violation règles des hooks React : extraction de `WallTextEntry` en composant propre (useMemo hors de .map())
- Correction `depthTest={false}` → `depthTest={true}` + `polygonOffset` sur WallTextEntry et WallDecal : fin du bleeding à travers les murs
- Correction `FACE_ROT_TEXT` East/West : les textes sont stockés sur les tiles Wall (convention inversée vs tiles Floor), rotations corrigées
- Correction `CHAMPION_DATA_RE` : regex `/\n{2,}[MF]\n[A-Z]/` pour filtrer les noms de champions avec 3+ sauts de ligne
- Escalier : `stairsEntryFace` retourne la face d'entrée (visible par le joueur qui approche), plus `OPPOSITE`
- Escalier : offset d'atterrissage (`DIR_STEP`) pour sortir du tile escalier
- Autel : détection via Sensor `graphic=5` (pas texte "ALTAR")
- Build TypeScript : suppression des imports/variables inutilisés (`Direction`, `position`, `direction`)

## Note finale

Le depot vaut clairement la peine d'etre termine.
La base est serieuse et deja impressionnante. Le plus gros enjeu n'est pas de tout recrire, mais de transformer une base jouable en produit coherent, stable et complet.

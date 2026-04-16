# Beta Readiness Plan

Etat pose le `2026-04-16`.

Ce document fixe le plan de travail reel pour amener le projet d'une alpha avancee a une beta desktop-first solide.

## Objectif beta

La beta ne veut pas dire "fidelite parfaite au binaire FTL".

La beta veut dire:

- run complete faisable sans blocker connu
- runtime suffisamment stable pour que les saves ne cassent plus entre petites versions
- socle qualite reproductible: lint, build, tests smoke, checklist de playtest
- UX assez coherente pour accueillir des testeurs externes

## Etat de depart

Signal actuel observe dans le repo:

- build production OK
- lint KO
- pas de script `test` visible dans `package.json`
- extraction consideree comme largement fiable
- runtime globalement coherent mais encore trop centralise dans `src/engine/store.ts`

Conclusion:

- le sujet principal n'est plus l'extraction
- le sujet principal est la stabilisation produit du runtime

## Progression du jour

Chantiers deja fermes:

- `lint` remis au vert
- `build` valide
- base de tests locale posee avec `npm run test`
- flow `Game Over` minimal ajoute avec retour manuel au titre
- durcissement du stockage de save:
  - checksum d'integrite sur les nouvelles saves
  - compatibilite conservee avec les anciennes saves sans checksum
  - slot backup avec fallback si la save principale est corrompue
  - tests de persistance et de fallback ajoutes
- coherence de chargement save / resume nettoyee
- reprise informe si elle vient d'un backup au moment du chargement
- plusieurs extractions prudentes du runtime central deja fermees:
  - portes cassables: etat runtime distingue `open` et `broken`, avec fallback visuel genere sans nouvel asset
  - etat champion
  - inventaire
  - pickup d'items au sol
  - runtime senseurs muraux
  - interactions murales frontales
  - activation de senseurs muraux
  - evenements differes / generateurs
  - senseurs de mouvement
  - pushes muraux
  - capteurs muraux d'objets
  - etat mur frontal / fontaines
  - drops de mort
  - resurrection / reincarnation / autels
  - transport terrain `pit / teleporter`
  - effets terrain immediats `telefrag / creatures sur pit / creatures sur teleporter`
  - effets des teleporteurs nouvellement ouverts
  - effets des puits nouvellement ouverts
  - transport d'entree dans un puits ouvert
  - transport d'entree dans un teleporter ouvert
  - transport par escaliers
  - deplacement standard avec senseurs + empreintes
  - action `Climb Down`
  - actions de peur utilitaires `Calm / Brandish / Blow Horn / War Cry`
  - ciblage des creatures en face / priorite de contact
  - helpers de direction runtime / ciblage
  - projectiles de creatures / choix d'effet original
  - logique de vol des creatures
  - projectiles des actions utilitaires d'attaque
  - actions de controle de creature `Confuse / Fluxcage`
  - buffs utilitaires d'attaque `Light / Spellshield / Fireshield / Freeze Life / Window`
  - soin utilitaire d'attaque `Heal`
  - effets de statut simples dans `castSpell`
  - patchs de sortie des statuts simples dans `castSpell`
  - buffs temporises simples dans `castSpell` `light / darkness / shield / fire_shield`
  - patchs de sortie des buffs temporises simples dans `castSpell`
  - soin runique `heal` dans `castSpell`
  - creation d'objet `plasma / Zokathra` dans `castSpell`
  - patch de sortie de `plasma / Zokathra` dans `castSpell`
  - patchs de statuts `invisibility / see_through_walls / reveal_hidden / footprints` dans `castSpell`
  - creation de potions runiques dans `castSpell`
  - patch de sortie des potions runiques dans `castSpell`
  - consommation des objets dans `useItem` `eau / potions / nourriture`
  - patch final de `useItem` `equipement / inventaire / activeShields`
  - localisation partagee des objets de champion `inventaire / equipement`
  - action de remplissage des contenants a la fontaine
  - orchestration partagee des buffs / statuts simples dans `castSpell`
  - orchestration partagee des sorts-objets `potion / plasma` dans `castSpell`
  - resets UI partages pour `loadGame / returnToTitle`
  - orchestration partagee des sorts non-projectiles dans `castSpell`
  - preparation partagee du cast dans `castSpell` `cooldown / mana / skill / XP / message / cooldown champion`
  - preparation des sorts projectiles dans `castSpell`
  - orchestration partagee des sorts projectiles dans `castSpell` `porte immediate / blocage immediat / backlash / lancement projectile`
  - tick de combat partage `cooldowns / defenseModifier / purge des damageEvents`
  - ticks temps partage `regenTick / tickMovement`
  - resolution partagee de la selection d'action dans `attackFront` `attaque choisie / skill / indisponible / munitions`
  - projectiles physiques de `attackFront` `Throw / Shoot`
  - orchestration partagee des actions utilitaires simples de `attackFront` `Heal / buffs / projectiles / Block / Flip`
  - orchestration partagee des actions utilitaires de controle / peur dans `attackFront` `Confuse / Fluxcage / Calm / Brandish / Blow Horn / War Cry`
  - resolution partagee de l'action `Fuse` dans `attackFront`
  - resolution partagee des suites d'attaque de melee dans `attackFront` `degats / kill XP / drops / death dust`
  - application partagee des vitals d'attaque dans `attackFront` `stamina cost / clamp / effective stats`
  - resolution partagee du cas `pas de cible -> casser une porte` dans `attackFront`
  - patchs partages des attaques projectile physiques dans `attackFront` `Throw / Shoot / missing ammo`
  - contexte partage des cibles frontales dans `attackFront` `preferred column / front creatures / target`
  - orchestration partagee complete des actions utilitaires dans `attackFront` `simple / controle / peur / Climb Down / Fuse`
  - orchestration partagee des attaques projectile physiques dans `attackFront` `Throw / Shoot / quiver ammo`
  - formule partagee des degats de melee dans `attackFront`
  - orchestration partagee de la branche melee / porte frontale dans `attackFront`
  - orchestration partagee de `tickFrame` `game over / endgame / sleeping / regen / movement / combat / pending world events`
  - resolution partagee des pulses de `activePoisonClouds` dans `tickSpells`
  - resolution partagee des impacts projectile sur la party dans `tickSpells`
  - resolution partagee des impacts projectile sur les creatures dans `tickSpells`
  - resolution partagee du parcours projectile `mur / porte / teleporter / blocage` dans `tickSpells`
  - continuation partagee des projectiles actifs dans `tickSpells`
  - finalisation partagee du patch de fin de `tickSpells`
  - resolution partagee des attaques monstres sur champion `esquive / degats / StaminaDrain / poison`
  - selection partagee de la cible d'attaque des creatures `priorite de colonne / any champion / all sides`
  - repositionnement partage des creatures vers les cellules de contact avant attaque
  - dispatch partage des attaques de creature `projectile / steal / damage`
  - resolution partagee du deplacement des creatures `fuite / spacing ranged / poursuite / patrol / wander / double-move archenemy`
  - resolution partagee de la destination des creatures `teleporter / validation d'arrivee / conservation de cellule`
  - resolution partagee de la perception des creatures `LOS / invisibilite / memorisation de la position du groupe`
  - resolution partagee de l'etat runtime des creatures `confused / fluxcaged / frightened / attackReach / spacing`
  - resolution partagee du contexte de cible d'attaque des creatures `champion / vitals / inventaire / equipement`
  - resolution partagee du demarrage d'attaque des creatures `timer / confusion / fenetre d'attaque`
  - resolution partagee de l'application du resultat d'attaque des creatures `projectile / steal / damage`
  - traitement partage des morts de champions pendant `tickMonsters`
  - finalisation partagee du patch de `tickMonsters`
  - tick partage des portes ecrasantes `closing / bouncing / recapture`, avec rebond visuel complet pour les portes bloquees par une creature
  - impacts immediats et visuels des sorts projectiles dans `castSpell`
  - patchs de sortie du sort `open` dans `castSpell`
  - patchs des sorts projectiles bloques dans `castSpell`
  - consequences des sorts projectiles bloques dans `castSpell` `poison cloud / source-backed damage / backlash`

Etat courant confirme:

- `npm run test` passe
- `npm run lint` passe
- `npm run build` passe
- la suite locale couvre actuellement `286` tests

## Priorites

### P0 - Gates beta obligatoires

Ce qui doit etre ferme avant de parler beta:

1. `lint` vert
2. `build` vert
3. base de tests de non-regression
4. contrat de save beta fige
5. vrai flow `Game Over`
6. flow `Victory / endgame` valide en run complete
7. plus de blocker connu sur la progression complete

### P1 - Stabilisation forte

1. checklist de playtest structuree
2. reduction des risques dans `store.ts` sans refonte totale
3. nettoyage des couches legacy qui peuvent brouiller la source de verite
4. coherence UX et messages
5. coherence langue / encodage

### P2 - Durcissement de release

1. validation perf desktop-first
2. documentation de release beta
3. passe finale de non-regression

## Bugs notes a reprendre

- portes ecrasantes / rebond sur monstre:
  - symptome: quand une porte se referme sur un monstre, remonte, puis redescend, la hauteur de blocage descend un peu plus bas a chaque cycle
  - comportement attendu: la porte doit remonter puis redescendre jusqu'au meme point de blocage a chaque fois, sans derive cumulative de hauteur
- organisation des assets de portes:
  - `grille_metal.png` vit encore dans `misc` alors qu'elle fait partie des trois textures de porte
  - a realigner plus tard vers `textures` pour avoir une famille d'assets coherente

## Plan de travail detaille

### Chantier 1 - Qualite technique minimale

Objectif:

- remettre le projet dans un etat de validation fiable

Actions:

- corriger les erreurs `eslint`
- verifier que `npm run build` reste propre apres correction
- figer une mini routine locale `lint + build`

Definition of done:

- `npm run lint` passe
- `npm run build` passe
- aucun warning critique garde "par habitude"

### Chantier 2 - Base de tests utile

Objectif:

- attraper vite les regressions les plus cheres

Actions:

- ajouter un vrai script `test` dans `package.json`
- ajouter des tests smoke sur:
  - boot des donnees runtime
  - `mapLoader`
  - save / load / resume
  - etats critiques `endgame` / `victory` quand c'est testable sans scene complete
- privilegier les tests qui verrouillent le contrat runtime plutot qu'une couverture large cosmetique

Definition of done:

- une suite minimale de tests existe
- elle tourne facilement en local
- elle couvre les regressions de boot et de persistance

### Chantier 3 - Contrat beta des saves

Objectif:

- faire des sauvegardes un engagement produit, pas un comportement opportuniste

Actions:

- auditer tous les champs persistes
- verifier le schema de save actuel
- decider du gel de schema pour la beta
- verifier les cas:
  - save
  - reload
  - resume
  - save incompatible
  - save corrompue
- clarifier si import/export manuel est beta scope ou post-beta

Definition of done:

- le schema de save beta est stable
- les cas d'erreur sont propres
- la reprise de partie est testee sur plusieurs sessions

### Chantier 4 - Fermeture du loop gameplay

Objectif:

- rendre la run complete jouable de bout en bout

Actions:

- implementer le vrai `Game Over`
- valider `title -> recrutement -> progression -> fin -> retour titre`
- valider la chaine:
  - `Zokathra`
  - `Amalgam`
  - `Firestaff complete`
  - `Fluxcage`
  - `Fuse`
  - `Victory`
- traiter les cas deja identifies comme sensibles:
  - pits
  - teleporters en chaine
  - telefrag
  - countdowns rares
  - Lord Chaos
  - portes cassables
  - generateurs

Definition of done:

- aucune sequence critique n'est encore "supposee marcher"
- la run complete est testee

### Chantier 5 - Playtest structure

Objectif:

- ne plus dependre du ressenti ou de la memoire seule

Actions:

- creer une checklist de playtest
- separer les tests en familles:
  - progression
  - combat
  - mecanismes
  - persistance
- classer les bugs:
  - blocker beta
  - important beta
  - post-beta

Definition of done:

- chaque passe de test produit un etat clair
- les retests sont diriges par checklist

### Chantier 6 - Reduction de risque dans le runtime central

Objectif:

- rendre les zones critiques plus isolables sans lancer une refonte totale

Actions:

- ne pas reecrire tout `src/engine/store.ts` avant beta
- extraire prioritairement les helpers les plus risqus ou les plus testables
- priorites probables:
  - persistance
  - projectiles
  - mecanismes
  - endgame
  - generateurs

Definition of done:

- les zones critiques ont des frontieres plus lisibles
- les bugs sont plus faciles a tester et corriger

### Chantier 7 - Nettoyage legacy

Objectif:

- garder une seule source de verite par sujet critique

Actions:

- clarifier le statut de `src/data/spells.ts`
- reduire les couches de compatibilite inutiles dans `items.ts`, `itemImages.ts` et voisins
- nettoyer les branches et commentaires legacy qui ne servent plus

Definition of done:

- moins d'ambiguite entre reference, compatibilite et runtime actif

### Chantier 8 - Coherence UX

Objectif:

- rendre la beta testable sans mode d'emploi oral permanent

Actions:

- ajouter le vrai `Game Over`
- rendre les erreurs de save et etats incompatibles lisibles
- ajouter un onboarding court ou une aide de demarrage
- ameliorer les retours vraiment utiles:
  - mecanismes
  - etat du groupe
  - combat
  - interactions murales

Definition of done:

- un testeur externe comprend mieux ce qui se passe sans assistance

### Chantier 9 - Coherence langue et encodage

Objectif:

- enlever les signaux de projet "pas encore propre"

Actions:

- corriger les traces d'encodage abime
- harmoniser EN / FR
- choisir une cible beta claire pour les textes

Definition of done:

- les textes critiques sont coherents
- plus de melange involontaire ou de rendu casse

### Chantier 10 - Validation performance desktop-first

Objectif:

- garantir une experience beta stable sur la cible reelle

Actions:

- mesurer boot, Hall of Champions, zones chargees, fin de jeu
- surveiller particulierement:
  - `three-core`
  - `overlay-data`
  - `dungeon-blob`
- traiter seulement les vrais points d'impact avant beta

Definition of done:

- l'experience desktop-first est stable et defendable

### Chantier 11 - Packaging beta

Objectif:

- rendre la release beta explicite et repetable

Actions:

- mettre a jour `README.md`
- documenter le scope beta
- documenter les garanties et limites:
  - saves
  - desktop-first
  - mobile
  - localisation
- ajouter une checklist de release simple

Definition of done:

- la beta est clairement definie pour nous et pour les joueurs

## Ordre recommande

### Phase 1 - Qualite minimale

1. lint vert
2. build vert
3. base de tests
4. save schema beta
5. `Game Over`

### Phase 2 - Fermeture gameplay

1. validation endgame complete
2. checklist walkthrough critique
3. correction des blockers de playtest
4. durcissement save / resume

### Phase 3 - Durcissement beta

1. UX coherente
2. textes / encodage
3. perf desktop acceptable
4. docs de release
5. passe finale de non-regression

## Hors scope beta

Ces sujets ne doivent pas ralentir la beta sauf si un bug direct y est lie:

- refonte totale de `src/engine/store.ts`
- support smartphone
- fidelite absolue a chaque bug historique du moteur original
- polish visuel final complet
- optimisation exhaustive du bundle
- gros systemes de confort modernes non essentiels

## Go / No-Go beta

On passe en beta seulement si:

- `npm run lint` passe
- `npm run build` passe
- une base de tests existe et passe
- la run complete n'a plus de blocker connu
- save / load / resume sont stables
- `Game Over` et `Victory` existent comme flows complets
- la langue et les messages principaux sont coherents
- les bugs restants sont surtout du polish, pas des risques de progression ou de corruption d'etat

## Plan de la journee

Ordre de travail recommande pour aujourd'hui:

1. remettre `lint` au vert
2. verrouiller le premier socle de tests
3. ouvrir le chantier `Game Over`
4. durcir le contrat de save
5. seulement ensuite preparer la checklist de playtest critique

## Prochaine action recommandee

Le prochain chantier rationnel n'est plus la qualite minimale. Il devient:

1. poursuivre les blocs runtime plus couples avec prudence `tickMonsters / tickDoors / endgame`
2. nettoyer les textes / encodage les plus visibles
3. puis preparer la checklist de playtest critique avant le long playtest

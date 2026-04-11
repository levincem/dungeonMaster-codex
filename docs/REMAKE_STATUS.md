# Dungeon Master Remake - Etat du projet

Version remise a jour a partir du code observe le 2026-04-11.

## Resume rapide

Le projet est maintenant une base jouable et serieuse, avec une vraie boucle d'exploration, un runtime nourri par les donnees extraites du jeu original, et une grosse partie des systemes majeurs deja recales.

Le point important a ce stade:

- l'extraction des donnees originales essentielles est consideree comme fiable
- la dette principale n'est plus "trouver les donnees", mais "finir les derniers recollages de fidelite et optimiser"
- le projet doit maintenant etre considere comme une beta jouable et serieuse

## Tour des systemes du jeu

### Flow global et progression

Etat actuel:

- ecran titre jouable avec `Enter The Dungeon` et `Resume`
- recrutement via miroirs fonctionnel
- sauvegarde / reprise persistentes via `localStorage`
- l'etat mutable du donjon, du groupe et des effets runtime est bien restaure

Reste a faire:

- vrai game over
- ecran de victoire / fin
- verification finale du flow de fin autour du `Firestaff` complet

### Maps, geometrie et contenu spatial

Etat actuel:

- source de verite runtime: `src/assets/data/dungeon.json`
- parsing central via `src/data/dungeonData.ts` et `src/data/mapLoader.ts`
- contenu spatial reconcilie:
  - items `300 / 300`
  - inscriptions `61 / 61`
  - locks `65 / 65`
  - creatures `225 / 225`
  - generators `50 / 50`
- portes, teleporteurs, trick walls, pits et eau sont presents dans les maps runtime
- overlays muraux originaux sont positions depuis les donnees extraites

Reste a faire:

- verifier finement quelques interactions specifiques de pits, eau et cartes rares
- continuer a tester les cas de teleports et transitions de niveau les plus atypiques

### Champions, UI et inventaire

Etat actuel:

- HUD principal jouable
- ChampionSheet complete avec drag and drop
- inventaire, equipement, transfert, ramassage et depot fonctionnent
- starters des champions recales sur la source canonique actuelle
- portraits, paths d'assets et resolution d'images ont ete securises
- save button disponible depuis la fiche champion

Reste a faire:

- unifier encore la glue autour des items de depart synthetiques
- eventuellement exposer la sauvegarde ailleurs qu'en fiche si on veut un flow plus proche d'un jeu fini

### Objets, equipement et statuts

Etat actuel:

- objets, noms et grande partie des catalogues viennent maintenant des donnees extraites
- potions runtime recalees sur les noms originaux
- images d'objets beaucoup moins hardcodees, avec resolution plus systematique et quelques alias speciaux restants
- poids, equipement, eau, faim, soif, sommeil, fatigue et regeneration sont jouables

Reste a faire:

- garder un oeil sur quelques alias d'images et objets speciaux
- il reste une couche de compatibilite dans `items.ts` pour faire le pont entre data source, objets synthetiques et runtime

### Magie, runes et projectiles

Etat actuel:

- le pipeline runtime reel passe par `src/data/runes.ts` et `src/engine/store.ts`
- sorts jouables branches:
  - `light`
  - `darkness`
  - `open`
  - `fireball`
  - `lightning`
  - `poison_bolt`
  - `poison_cloud`
  - `disrupt_nonmaterial`
  - `plasma`
  - `shield`
  - `fire_shield`
  - `invisibility`
  - `see_through_walls`
  - `footprints`
  - `potion`
- actions magiques d'objets a charges recablees:
  - `Dispell`
  - `Confuse`
  - `Fluxcage`
  - `Invoke`
  - `Fuse`
- `Poison Bolt` et `Poison Cloud` sont bien separes
- `Des Ew` est traite comme projectile anti non-materiel avec cas special `Materializer / Zytaz`
- grosse passe recente sur les VFX:
  - `Fireball` plus lisible comme vraie boule de feu
  - `Lightning`, `Poison` et `Disrupt` mieux differencies
  - impacts sur mur et creature
  - flashes locaux
  - `Shield`, `Fire Shield` et `Fluxcage` visibles

Reste a faire:

- `src/data/spells.ts` reste encore un fichier legacy de reference
- quelques nuances fines de missiles / effets restent a verifier
- `Zo Ven` reste documente mais non implemente

### Mecanismes

Etat actuel:

- `src/data/mechanisms.ts` reconstruit maintenant une vue structuree depuis les sensors extraits du vrai donjon
- switches muraux et dalles pilotent correctement leur etat runtime
- les verrouillages muraux ne s'ouvrent plus automatiquement si la cle est simplement possedee
- usage explicite d'objet sur mecanisme mural via drag and drop
- alcoves et receptacles muraux fonctionnels
- objets montes sur mur visibles en scene
- capteurs `Hold`, possession et objets specifiques de sol recales
- file d'evenements differee pour les mecanismes avec `delay`
- clic sonore partage pour switchs / dalles quand pertinent

Reste a faire:

- playtests cibles sur les cas rares et les grosses sequences combinatoires
- verification fine de quelques countdowns / cas de fin de jeu
- possiblement du polish visuel supplementaire sur certains overlays `in/out`

Verdict:

- les mecanismes sont maintenant globalement fonctionnels
- le risque restant est surtout de la fidelite fine, plus un pan entier manquant

### Creatures et IA

Etat actuel:

- les definitions runtime viennent beaucoup plus proprement des donnees extraites
- flags et ranges utiles maintenant importes et utilises:
  - `attackFromAllSides`
  - `attackRange`
  - `sightRange`
  - `preferBackRow`
  - `levitates`
  - `absorbMissiles`
  - `seeInvisible`
- les creatures peuvent franchir une porte ou grille ouverte
- memoire courte de poursuite
- portee de vue originale utilisee au lieu d'un rayon fixe
- gestion de l'invisibilite cote detection
- absorption de missiles pour les familles qui l'ont
- usage des teleporteurs par les monstres
- meilleur espacement des attaquants a distance et profils magiques / flottants / non materiels

Reste a faire:

- plusieurs comportements tres fins restent encore interpretes plutot que reproduits instruction par instruction
- quelques familles speciales et cas de fin de jeu meritent encore des tests cibles

Verdict:

- les donnees creatures sont bien mieux recalees
- l'IA a fortement progresse
- ce n'est pas encore une reproduction parfaite du runtime FTL

### Combat

Etat actuel:

- combat jouable
- attaques multiples par arme mieux gerees dans le HUD
- projectiles physiques et munitions ont progresse
- poison et steal sont branches cote monstres
- plusieurs timings gameplay importants ont ete recales sur une base plus proche de l'original

Reste a faire:

- certaines formules restent encore simplifiees
- `Rust`, `Teleport` et `Immobilize` ne doivent toujours pas etre vendus comme pleinement reproduits

### Assets, presentation et finition

Etat actuel:

- overlays muraux gameplay largement couverts
- chargement des paths d'assets securise pour les deploys non-racine
- rendu des projectiles et protections nettement meilleur
- preload plus fiable depuis l'embarquement des JSON critiques dans `src/assets/data`

Reste a faire:

- polish visuel
- quelques images ou variantes specifiques
- quelques soucis d'encodage historiques

## Ce qu'on n'a pas oublie

Point de controle avant optimisation:

- flow d'entree: oui
- maps et contenu spatial: oui
- champions / mirrors / recrutement: oui
- inventaire / equipement / drag and drop: oui
- objets / potions / images: oui
- sorts / projectiles / VFX: oui
- mecanismes: oui, grosse passe recente
- creatures / IA: oui, grosse passe recente
- sauvegarde / reprise: oui
- sequence de fin / game over / victoire: non, encore incomplet
- optimisation: pas commencee comme chantier principal, c'est bien la prochaine etape

## Priorites recommandees

### 1. Fermer les derniers trous de fidelite

- verifier les derniers cas rares de mecanismes et de fin de jeu
- tester quelques familles de creatures encore sensibles
- continuer a reduire la glue runtime restante la ou elle ne sert plus

### 2. Attaquer l'optimisation

- reduire le poids du chunk `game-core`
- reevaluer ce qui doit rester embarque dans `src/assets/data`
- decouper plus proprement certaines couches runtime / UI / VFX

### 3. Finir le flow de jeu complet

- game over
- fin / victoire
- dernier polish UX

### 4. Ameliorations beta / confort

- ajouter un vrai menu d'options dans l'UI
- permettre la reassignment des touches depuis ce menu
- conserver ces options dans la sauvegarde
- prevoir un export / import de sauvegarde en fichier texte, en plus du `localStorage`
- envisager une mini-map optionnelle, clairement presentee comme aide moderne et non comme element du jeu d'origine

### 5. Localisation et coherence des textes

- ajouter une vraie version anglaise et une vraie version francaise
- poser un systeme de localisation unique au lieu du melange actuel
- a court terme, corriger l'etat courant pour revenir a de l'anglais partout, de facon coherente avec le jeu original
- a moyen terme, exposer un choix `EN / FR` dans les options

Constat actuel:

- le projet melange encore textes originaux anglais et textes UI/runtime francais
- ce n'est pas encore gere comme une vraie fonctionnalite de localisation

## Notes de confiance

- La structure generale et la base technique sont bonnes.
- Les donnees extraites doivent etre traitees comme la base fiable.
- Le projet a maintenant plus besoin d'integration fidele, de verification ciblee et d'optimisation que d'une reecriture complete.

## Discipline de maintenance

- On ne quitte pas une session avec un build casse sans le signaler clairement.
- Apres chaque gros changement, il faut mettre a jour `README.md` et les notes pertinentes sous `docs/`.

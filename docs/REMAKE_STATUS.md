# Dungeon Master Remake - Etat du projet

Version remise a jour a partir du code observe le `2026-04-13`.

## Resume rapide

Le projet est maintenant une base jouable et serieuse, avec une vraie boucle d'exploration, un runtime nourri par les donnees extraites du jeu original, et une grosse partie des systemes majeurs deja recales.

Le point important a ce stade:

- l'extraction des donnees originales essentielles est consideree comme fiable
- la dette principale n'est plus "trouver les donnees", mais "fermer les derniers ecarts de fidelite, nettoyer l'UX et optimiser"
- le projet doit maintenant etre traite comme une beta desktop-first jouable, pas comme un prototype

## Passe recente frontend et prod

Les evolutions recentes visibles dans le code portent surtout sur la stabilite de la build web, le packaging runtime et le polish desktop-first.

Points recales:

- build production validee
- reorganisation des assets runtime sous `public/game/images` et `public/game/sounds`
- embarquement des JSON critiques sous `src/assets/data` pour fiabiliser le boot
- ecran titre avec `Enter The Dungeon` et `Resume`
- modale de bienvenue beta bloquante au demarrage, plus aide rapide accessible depuis le HUD
- couche `i18n` simple avec anglais par defaut
- panneau d'options en jeu avec remapping des touches de deplacement
- blocage explicite sur smartphone tant qu'un vrai support mobile n'existe pas
- ecran de victoire branche

## Tour des systemes du jeu

### Flow global et progression

Etat actuel:

- ecran titre jouable avec `Enter The Dungeon` et `Resume`
- recrutement via miroirs fonctionnel
- sauvegarde / reprise persistentes via `localStorage`
- l'etat mutable du donjon, du groupe, des projectiles, effets et options est restaure
- ecran de victoire branche

Reste a faire:

- vrai game over
- playtest complet et cible du flow de fin autour du `Firestaff` complet et de Lord Chaos

### Maps, geometrie et contenu spatial

Etat actuel:

- source de verite runtime: `src/assets/data/dungeon.json`
- parsing central via `src/data/dungeonData.ts` et `src/data/mapLoader.ts`
- portes, teleporteurs, trick walls, pits et eau sont presents dans les maps runtime
- overlays muraux originaux sont positions depuis les donnees extraites
- les pits ouverts sont rendus comme de vrais trous et peuvent provoquer une chute vers la case correspondante du niveau inferieur

Reste a faire:

- verifier finement les derniers cas specifiques de pits, eau et cartes rares
- continuer a tester les cas de teleports et transitions de niveau les plus atypiques

### Champions, UI et inventaire

Etat actuel:

- HUD principal jouable
- ChampionSheet complete avec drag and drop
- inventaire, equipement, transfert, ramassage et depot fonctionnent
- starters des champions recales sur la source canonique actuelle
- portraits, paths d'assets et resolution d'images ont ete securises
- save button disponible depuis la fiche champion
- panneau d'options disponible dans le HUD pour les touches de deplacement
- HUD de debug plus explicite avec coords globales et locales (`g:` / `l:`) pour eviter les confusions entre lecture de map et position en jeu

Reste a faire:

- elargir les options exposees au joueur
- continuer le polish desktop de certaines vues UI

### Objets, equipement et statuts

Etat actuel:

- objets, noms et grande partie des catalogues viennent maintenant des donnees extraites
- images d'objets beaucoup moins hardcodees, avec resolution plus systematique et quelques alias speciaux restants
- poids, equipement, eau, faim, soif, sommeil, fatigue et regeneration sont jouables

Reste a faire:

- garder un oeil sur quelques alias d'images et objets speciaux
- il reste une couche de compatibilite dans `items.ts` pour faire le pont entre data source, objets synthetiques et runtime

### Magie, runes et projectiles

Etat actuel:

- pipeline runtime reel branche autour de `src/data/runes.ts` et `src/engine/store.ts`
- ordre des runes runtime recale sur les `spellID` Atari / `i560`
- catalogue extrait des sorts recale sur les 25 descripteurs Atari, sans sorts de soin speculatifs dans `game_db`
- large set de sorts jouables et de projectiles differencies
- reussite des sorts recalee sur la logique source `ReDMCSB`:
  - niveau requis = `baseDifficulty + rune de puissance`
  - verification par paliers manquants avec seuil `wisdom + 15` borne a `115`
  - XP de cast derivee de la formule originale au lieu d'un gain moyen fixe
- energie initiale et decroissance des projectiles magiques recalees sur `MENUS.C` / `CHAMPION.C`
- impacts directs de `Fireball` et `Lightning Bolt` recales sur la formule de `PROJEXPL.C`
- `Poison Bolt` reapplique maintenant aussi sa composante poison avec resistance de creature issue de `i559`
- les projectiles magiques standards traversent de nouveau les creatures non materielles, sauf `Disrupt Nonmaterial`
- `Open Door` est maintenant lance comme un vrai projectile magique avec trajet, impact et VFX dedie, au lieu d'un simple effet instantane sur la premiere porte en ligne
- les potions buvables suivent maintenant les formules de `INVNTORY.C`:
  - `Ros/Ku/Dane/Neta` modifient bien les statistiques courantes, avec retour progressif vers la valeur max
  - `Mon` restaure l'endurance
  - `Ya` est traite comme une protection magique locale
  - `Ee` restaure le mana avec la meme logique de depassement adouci
  - `Vi` soigne et tente de guerir les blessures
  - `Water Flask` rehydrate et redevient une flasque vide
- le parser runtime conserve desormais aussi la `power` des potions dans `src/assets/data/dungeon.json`, au lieu de la perdre dans le snapshot compact
- `Ven Potion` et `Ful Bomb` jetes convertissent de nouveau leur `power` en impact toxique / feu au contact, au lieu de rester de simples projectiles physiques
- la nutrition des aliments suit maintenant bien `foodValues`; manger n'ajoute plus de regain d'endurance invente par le remake
- VFX de sorts et protections sensiblement ameliores
- `Lightning Bolt` a maintenant un rendu `Photons2` plus allonge, davantage lu comme un eclair que comme une boule
- `Fluxcage` visible et branche dans le runtime
- `Poison Cloud` n'est plus un simple burst:
  - le nuage persiste sur la case comme dans la source
  - il pulse avec decroissance interne et reste sauvegardable/rechargeable
  - `Ven Potion` jetee reutilise maintenant cette meme logique persistante
- `Disrupt Nonmaterial` suit maintenant mieux le cas special de `PROJEXPL.C`:
  - les creatures non materielles classiques sur la case prennent toutes le meme impact
  - `Materializer` / `Zytaz` ne peuvent etre touches que pendant leur fenetre d'attaque
  - leur degat utilise aussi la composante aleatoire supplementaire de la source
- faim, soif, nourriture et boisson ont ete reverifiees contre `CHAMPION.C` et `INVNTORY.C`:
  - regen mana, stamina, HP et cadence sommeil/eveil recalees sur la boucle de survie source (`256` ticks eveille, `64` en dormant)
  - nourriture et eau suivent bien les reserves `Food` / `Water`
  - boire une gourde ou une flasque applique de nouveau `+800` / `+1600` eau comme dans l'original
  - la fatigue appliquee a chaque pas suit de nouveau la formule de `MOVE.C` basee sur `load / maxLoad`, au lieu d'un cout maison trop bas et d'une cadence de regen trop rapide
- les degats de retour des sorts sur le groupe ne sont plus repartis par simple facteur avant/arriere; ils suivent maintenant une dispersion plus proche de `F324_aezz_CHAMPION_DamageAll_GetDamagedChampionCount`
- le combat creatures utilise maintenant plus directement la famille d'attaque originale en melee (`Blunt`, `Sharp`, `Magic`, `Fire`, `Mental`) au lieu d'un tirage hybride trop libre, et les shields magiques ne reduisent plus les attaques physiques par erreur
- la probabilite de blessure est maintenant recalee sur le seuil source `random(128) + 10` ajuste par la vitalite, au lieu d'une formule maison beaucoup plus agressive
- la mitigation des attaques creatures suit maintenant mieux le branchement original:
  - `Sharp` passe par la vraie voie `sharp defense` issue de `i559`
  - `Impact` divise de nouveau la defense
  - `Mental` passe par la sagesse plutot que par `Anti-Magic`
  - `Unconditional` n'utilise plus la mitigation physique standard
  - les shields tenus en main utilisent maintenant aussi la vraie table `Graphic 562` `G050 = [5,5,4,6,3,1]`, remontee dans le pipeline sous `woundDefenseFactors`
- les creatures lanceuses de sorts source-backed (`Vexirk`, `Wizard Eye`, `Materializer/Zytaz`, `Demon`, `Red Dragon`, `Lord Chaos`) recreent maintenant de vrais projectiles runtime avec type de missile et energie proches de `GROUP1.C`, au lieu d'un simple degat instantane a distance
- les impacts de projectiles de creatures sur le groupe suivent de nouveau plus directement `PROJEXPL.C`:
  - impact cible `tete/torse` pour le champion vise
  - explosion secondaire sur la case du groupe pour `Fireball` / `Lightning Bolt`
  - `Poison Cloud` sur la case du groupe reapplique une attaque normale sans blessures, puis laisse un nuage persistant
- les shields de sorts et objets ne sont plus traites comme des pourcentages generiques:
  - `Party Shield` et `Ya Potion` alimentent une vraie defense additive `physical`
  - `Spellshield` alimente une defense additive `magic`
  - `Fire Shield` / `Fireshield` alimentent une defense additive `fire`

Reste a faire:

- `src/data/spells.ts` reste encore un fichier legacy de reference
- quelques `reference_exports` peuvent encore garder une nomenclature de sorts plus ancienne que le runtime regenere
- quelques nuances fines de missiles / effets restent a verifier:
  - quelques `local effects` rares restent plus subtils que le simple ciblage `(x,y)`, meme si `F271` et la rotation locale de liste de sensors sont maintenant recables
  - l'effet local `ADD_EXPERIENCE` de `F270` n'apparait pas dans le donjon DM extrait actuel
- `Zo Ven` est de nouveau present dans la couche de reference extraite; son comportement runtime fin reste a confirmer par playtest
- les launchers muraux `type 14-15` existent cote moteur mais ne sont pas utilises dans le donjon DM extrait

### Mecanismes

Etat actuel:

- `src/data/mechanisms.ts` reconstruit maintenant une vue structuree depuis les sensors extraits du vrai donjon
- switches muraux et dalles pilotent correctement leur etat runtime
- leviers muraux relies a leurs sensors extraits et utilisables directement en scene
- les verrouillages muraux ne s'ouvrent plus automatiquement si la cle est simplement possedee
- usage explicite d'objet sur mecanisme mural via drag and drop
- alcoves et receptacles muraux fonctionnels
- objets montes sur mur visibles en scene
- capteurs `Hold`, possession et objets specifiques de sol recales
- rotation locale `F271` recablee sur un ordre persistant par face murale pour clics, locks, alcoves et echangeurs
- parser recale sur le vrai champ `Multiple` source-backed pour les sensors locaux / generators / launchers
- sensors reguliers `isLocal` recables sur une vraie branche locale au lieu d'une cible `(0,0)` parasite
- file d'evenements differee pour les mecanismes avec `delay`
- clic sonore partage pour switchs / dalles quand pertinent
- portes a bouton recalees sur un modele unique: un seul jambage et un `wall switch` fixe sur la face du jambage cote joueur, quel que soit le materiau de porte
- launchers muraux `type 7-10` recrees comme de vrais projectiles runtime, avec payloads `kineticEnergy/stepEnergy` issus du parser
- le depot d'ossements sur un `Vi Altar` repasse bien par `Bones` (`Misc typeId 5`) et n'attend plus un identifiant erronne
- la resurrection au `Vi Altar` ne repart plus a `1 HP`:
  - le maximum de sante est reduit comme dans `F283_CHAMPION_ViAltarRebirth`
  - le champion revient avec la moitie de ce nouveau maximum
- `Reincarnate` suit maintenant la procedure source de `CHAMPION.C`:
  - skills remises a zero
  - sante / endurance / mana divisees par deux
  - statistiques recalees par reduction au huitieme puis `12` increments aleatoires

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
- degats flottants monstres visibles en scene et petit nuage de poussiere a la mort
- chute dans les pits: impact sonore et degats sur les champions vivants, mais valeurs encore a confirmer

Reste a faire:

- certaines formules restent encore simplifiees
- la mitigation de degats reste intentionnellement "bug-fixee" sur un point: le runtime continue d'utiliser `Anti-Magic` / `Anti-Fire`, alors que le binaire original souffrait du bug compilateur `BUG0_41` qui les neutralisait largement
- `Rust`, `Teleport` et `Immobilize` ne doivent toujours pas etre vendus comme pleinement reproduits
- confirmer si les valeurs de degats de chute peuvent etre derivees proprement des references originales
- `THRUST` est de nouveau traite comme une vraie attaque de melee, au lieu de retomber par erreur dans le fallback des actions non physiques
- `Freeze Life` est maintenant un vrai etat runtime source-backed, persiste en sauvegarde et ignore bien les creatures `archenemy`
- `Calm`, `Brandish`, `Blow Horn` et `War Cry` ne sont plus des no-op: ils reutilisent la resistance a la peur extraite depuis `i559` et poussent bien les creatures a fuir
- le sommeil n'est plus un gros fast-forward par clic: il est maintenant continu, tick par tick, et s'interrompt au prochain clic / appui clavier
- `FUSE` sur Lord Chaos ne passe plus directement de "mort" a l'ecran de victoire: le runtime joue maintenant une vraie phase `endgame` avec alternance Chaos/Order, apparition du Grey Lord, purge des autres groupes et bascule finale vers la victoire

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
- optimisation: les builds passent, mais plusieurs chunks restent encore lourds

## Priorites recommandees

### 1. Fermer les derniers trous de fidelite

- verifier les derniers cas rares de mecanismes et de fin de jeu
- tester quelques familles de creatures encore sensibles
- continuer a reduire la glue runtime restante la ou elle ne sert plus

### 2. Attaquer l'optimisation

- continuer a reduire les plus gros chunks de data et de rendu
- reevaluer ce qui doit rester embarque dans `src/assets/data`
- decouper plus proprement certaines couches runtime / UI / VFX

### 3. Finir le flow de jeu complet

- game over
- fin / victoire
- dernier polish UX

## Note Demain

- `Game over`: comportement voulu simple a integrer/valider
  - les 4 champions morts
  - ecran noir
  - message `GAME OVER`
  - retour a l'ecran titre
- verifier quelques cas rares de mecanismes / countdowns en situation reelle
- refaire un petit tour de families creatures sensibles en playtest
- confirmer les degats de chute contre les references originales si une formule exploitable apparait
- continuer le polish visuel leger seulement si quelque chose choque encore en jeu

### 4. Ameliorations beta / confort

- etendre le menu d'options
- prevoir un export / import de sauvegarde en fichier texte, en plus du `localStorage`
- envisager une mini-map optionnelle, clairement presentee comme aide moderne et non comme element du jeu d'origine

### 5. Localisation et coherence des textes

- exposer un vrai choix `EN / FR`
- poser un systeme de localisation unique plutot qu'un melange progressif
- a court terme, finir de nettoyer les chaines encore en francais cote UI/runtime si l'objectif reste l'anglais par defaut

## Notes de confiance

- La structure generale et la base technique sont bonnes.
- Les donnees extraites doivent etre traitees comme la base fiable.
- Le projet a maintenant plus besoin d'integration fidele, de verification ciblee et d'optimisation que d'une reecriture complete.

## Discipline de maintenance

- On ne quitte pas une session avec un build casse sans le signaler clairement.
- Apres chaque gros changement, il faut mettre a jour `README.md` et les notes pertinentes sous `docs/`.
- Quand un bug touche les maps ou mecanismes, il faut toujours distinguer coordonnees globales et locales avant de conclure sur la donnee extraite.

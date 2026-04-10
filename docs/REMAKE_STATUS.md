# Dungeon Master Remake - Etat du projet

Version remise a jour a partir du code observe le 2026-04-09.

## Resume rapide

Le projet est deja une base jouable et serieuse, avec un vrai runtime de dungeon, une UI exploitable et un chargement de donnees originales consolidees.

Ce n'est pas encore un remake complet, mais ce n'est plus un simple prototype.

Point important :

- l'extraction des donnees originales essentielles est maintenant consideree comme fiable
- le travail restant concerne surtout l'integration fidele de ces donnees dans le runtime

## Ce qui est effectivement en place

### Base runtime

- rendu 3D du donjon avec React Three Fiber
- maps runtime chargees depuis `src/assets/data/dungeon.json`
- loop de jeu centralisee dans `GameRoot` + `store`
- HUD d'exploration jouable
- recrutement via miroirs
- fiche champion complete avec drag and drop
- creatures visibles avec deplacement et attaques
- degats flottants, projectiles et lumiere dynamique
- inventaire, equipement, transfert et ramassage d'objets
- portes, trick walls, teleporteurs et une partie des senseurs
- starters des champions injectes depuis une source canonique dediee
- menu d'attaque sur le HUD quand plusieurs actions sont disponibles
- faim / soif, contenants d'eau et fontaines jouables

### Donnees et catalogues

- catalogues runtime embarques sous `src/assets/data/original_*`
- parse des mechanisms depuis `src/assets/data/mechanisms.json`
- definitions de portes originales branchees
- noms d'objets consolides via `resolveItemName(...)`
- regles d'equipement centralisees dans `src/data/equipment.ts`
- contenu spatial du donjon reconcilie :
  - items `300 / 300`
  - inscriptions `61 / 61`
  - locks `65 / 65`
  - creatures `225 / 225`
  - generators `50 / 50`
- tables Atari `0559`, `0560`, `0561`, `0562` extraites et documentees

### UI et presentation

- HUD principal avec portraits en ligne, mains visibles et formation 2x2
- ChampionSheet riche
- MirrorPopup branche
- LoadingScreen branche
- textes muraux graves en 3D
- overlays muraux et decals bien mieux cales sur l'original
- objets speciaux mieux relies a leurs vrais sprites

## Ce qui est encore partiel ou incomplet

### Flow global

- ecran titre jouable avec entree dans le donjon
- pas de game over complet
- pas d'ecran de victoire / fin
- sauvegarde / chargement persistents via `localStorage`
- la sauvegarde joueur est actuellement exposee par le bouton de la fiche champion, pas par un bouton permanent dans le HUD
- build de production valide a la date de cette mise a jour

### Magie

Le systeme de runes et de sorts existe deja cote runtime, mais il n'est pas encore completement unifie.

Point important:

- la source de verite runtime actuelle est `src/data/runes.ts`
- `src/data/spells.ts` existe encore, mais ne pilote pas le lancement reel des sorts
- il faut donc juger l'etat actuel de la magie a partir de `runes.ts` + `store.ts`

Effets deja reels et branches dans le runtime:

- `light`
- `darkness`
- `open`
- `fireball`
- `lightning`
- `poison_bolt`
- `poison_cloud`
- `disrupt_nonmaterial` (`Des Ew`)
- `plasma`
- `shield`
- `fire_shield`
- `invisibility`
- `see_through_walls` (`Oh Ew Ra`)
- `footprints`
- `potion`
- les recettes originales de potions d'attributs (`Ful Bro Ku`, `Oh Bro Ros`, `Ya Bro Dain`, `Ya Bro Neta`) sont maintenant branchees
  - elles creent maintenant bien les potions `Strength`, `Dexterity`, `Wisdom` et `Vitality`
  - leurs buffs temporaires utilisent la duree source-backed du catalogue runtime

Nuances importantes:

- les projectiles magiques existent, mais leurs comportements sont encore simplifies
  - pas encore de logique fine par type de missile comme dans le runtime FTL
- `Des Ew` est maintenant traite comme projectile anti non-materiel
  - cas special source-backed : `Materializer / Zytaz` ne doivent etre endommages que pendant leur phase d'attaque
- les visuels de sorts sont presents a un niveau fonctionnel
  - mais pas encore a un niveau de fidelite original complete
- `src/data/spells.ts` reste un fichier legacy de reference et n'est pas utilise par le pipeline runtime

Sorts / comportements encore manquants ou incomplets dans la base runtime actuelle:

- `Oh Bro` et `Oh Bro Ra` ont ete retires
  - dans Dungeon Master, le soin passe par des potions a creer puis boire
- `Oh Gor Ros` a ete retire
  - ce sort appartient a Chaos Strikes Back, pas a Dungeon Master
- `Zo Ven` reste documente mais non implemente pour l'instant
  - a reverifier avant branchement gameplay

- `Dispell` ne doit pas etre traite comme un sort de runes standard
  - a ce stade il doit etre considere comme une action d'objet a charges
- les actions d'objet a charges `Dispell`, `Confuse`, `Fluxcage`, `Invoke` et `Fuse` sont maintenant recablees cote runtime
- `Confuse` et `Fluxcage` sont maintenant relies a l'IA monstre, pas seulement a une action visuelle
- `Fuse` reste encore a reverifier en fin de jeu quand le wiring definitif du `Firestaff complet` sera totalement fige
- la distinction visuelle et mecanique fine entre certains missiles speciaux reste encore a faire
- `Oh Gor Ros` utilise pour l'instant une logique de revelation locale lisible
  - il faudra encore affiner exactement quels elements caches doivent luire et a quelle portee
- `Oh Ew Ra` permet maintenant de voir a travers les murs avec un rendu translucide
  - l'effet reste encore a affiner visuellement pour mieux evoquer une vision spectrale de l'original

Le cas de fin de jeu est maintenant mieux cerne cote data :

- `Zo Kath Ra` intervient bien dans la salle finale
- l'interaction utile est sur le mur nord du niveau 13, autour de `global (49,35)` / `(49,36)`
- l'Amalgam recoit d'abord le plasma de `Zo Kath Ra`, puis `The Firestaff`
- le resultat attendu est `The Firestaff (Complete)`

Autrement dit, la fin semble reposer sur un mecanisme mural special de transformation, pas sur un simple item de sol standard.

### Objets et statuts

- equipement, poids et quelques bonus passifs sont en place
- poison persistant, faim, soif, contenants d'eau et fontaines sont jouables
- faim / soif / regeneration / fatigue suivent maintenant une boucle de survie beaucoup plus proche du code original
  - cap `2048`, reserves initiales `1500 + random(256)`, reserves negatives jusqu'a `-1024`
  - mana / stamina / health utilisent des paliers de regen source-backed au lieu d'un simple flux par seconde
  - les deplacements du groupe consomment maintenant de la stamina selon la charge, au lieu d'etre gratuits
  - les deplacements du groupe appliquent maintenant un cooldown derive des `movement ticks` de l'original, au lieu d'etre spammables sans rythme
  - `sleep()` n'est plus un remplissage instantane : il avance le temps, use les torches et laisse faim/soif continuer
- plusieurs objets speciaux ont maintenant leur vrai visuel via override par nom canonique
- il reste encore des comportements speciaux et des etats fins a finaliser

### Carte et interactions

- `Pit`, `Water`, `Teleporter`, `Door`, `TrickWall` existent dans les types et les maps runtime
- toutes les interactions attendues de ces tiles ne sont pas encore finalisees
- il reste du travail sur pits, corde, eau, verrouillages et cas speciaux de maps

### Combat

- le combat est jouable
- les attaques multiples par arme sont maintenant mieux gerees dans le HUD
- projectiles physiques et munitions ont beaucoup progresse
- poison et steal sont branches cote monstres
- `Rust`, `Teleport` et `Immobilize` ne doivent pas etre consideres comme implementes en gameplay reel
- ces tags peuvent encore exister dans les donnees runtime / references creatures, mais ils ne correspondent pas aujourd'hui a une reproduction fidele de leurs effets originaux
- les formules restent encore partiellement simplifiees
- les sorts et plusieurs effets speciaux demandent encore un recollage plus fin
- les potions d'attributs utilisent maintenant un buff temporaire runtime au lieu d'un faux bonus XP

### Assets et finition

- les overlays muraux gameplay sont maintenant presque completement couverts
- il reste surtout du polish, quelques images specifiques et un meilleur rangement futur des assets
- le preload d'images est volontairement permissif
- quelques soucis d'encodage restent visibles dans certains fichiers historiques
- point recent important: `npm run dev` et `npm run preview` sont plus fiables depuis que les JSON critiques sont embarques cote `src/assets/data`
  - contrepartie provisoire: le bundle runtime est plus gros, surtout `game-core`

## Point important sur les maps

La source de verite actuelle n'a jamais ete les anciens scaffolds `src/data/level0.ts` et `src/data/level1.ts`.

Le runtime utilise:

- `src/assets/data/dungeon.json`
- `src/data/dungeonData.ts`
- `src/data/mapLoader.ts`

Constat:

- les anciens fichiers `level0.ts` / `level1.ts` ont ete supprimes
- la vraie map 0 runtime est `18x19`
- la vraie map 1 runtime est `32x32`

Conclusion:

- le runtime de map doit etre juge a partir de `src/assets/data/dungeon.json` et `mapLoader.ts`
- `public/dungeon.json` reste une copie statique utile, mais n'est plus le point de chargement critique au boot

## Priorites recommandees

### Flow d'entree / menu

- le flow vise est maintenant clarifie :
  - logo `Dungeon Master`
  - scene d'entree devant la grande porte
  - bouton vert `Enter The Dungeon`
  - bouton rouge `Resume`
- `Resume` charge maintenant la derniere sauvegarde persistente, pas juste un etat RAM
- le runtime demarre maintenant sur un ecran titre dedie au lieu d'entrer directement en exploration
- la sauvegarde doit se brancher sur ce point d'entree plutot que d'ajouter un flux parallele
- boucle actuellement en place :
  - bouton de sauvegarde dans `ChampionSheet`
  - bouton `Resume` qui recharge la derniere sauvegarde persistante
- la sauvegarde stocke l'etat mutable du donjon, du groupe et des effets temporels, pas l'etat d'UI transitoire

### 1. Continuer l'integration fidele

- recoller les sorts et les durees a la base originale
- reduire les couches runtime encore interpretatives
- consolider les derniers details de fidelite gameplay
- terminer le recollage fin des blessures localisees et des effets magiques speciaux
  - l'essentiel de l'horloge gameplay est maintenant recale
  - les blessures localisees existent maintenant cote runtime
  - les jambes blesses reduisent la charge max, et les pieds blesses ralentissent davantage les deplacements
  - la fiche champion colore maintenant la charge en jaune au-dessus de 5/8 et en rouge en surcharge, comme dans l'original
  - il reste surtout des cas speciaux et du polissage sur la magie
  - point deja corrige : `Oh Ew Ra` a maintenant son propre effet `see through walls`, distinct de `Oh Gor Ros`
  - point deja corrige : `Des Ew` est traite comme projectile anti non-materiel, avec cas special `Materializer / Zytaz`
  - point deja corrige : `Poison Bolt` et `Poison Cloud` sont maintenant separes cote gameplay
  - point deja corrige : les principales actions magiques d'objet a charges (`Dispell`, `Confuse`, `Fluxcage`, `Invoke`, `Fuse`) sont maintenant integrees au runtime
  - point deja corrige : les expirations de sorts / projectiles utilisent maintenant la meme horloge murale que le reste du runtime, il n'y a plus de melange `requestAnimationFrame(now)` / `Date.now()` sur ce chemin critique
  - point deja corrige : plusieurs durees gameplay sont maintenant quantifiees sur une grille temporelle originale (VBL / timer ticks) au lieu de ms libres
  - point deja corrige : les lumieres, portes ecrasantes et plusieurs buffs / projectiles ont maintenant des constantes temporelles partagees au lieu de nombres disperses
  - point deja corrige : le cycle `food / water / stamina / mana / health` s'appuie maintenant sur une boucle de game time discrète et sur les paliers principaux de `CHAMPION.C`
  - point deja corrige : le sommeil se comporte maintenant comme une avance rapide de temps au lieu d'une restauration instantanee
  - point deja corrige : le rythme de deplacement du groupe suit maintenant un cooldown derive de `F310_AA08_CHAMPION_GetMovementTicks(...)`

### 2. Stabiliser le flow de jeu

- definir le vrai debut de partie
- ajouter game over et fin minimale

### 3. Finaliser les systemes gameplay

- magie
- objets / statuts
- serrures / cles / alcoves
- pits / eau / interactions de niveau
- sequence de fin `Amalgam / Zo Kath Ra / The Firestaff (Complete)`

### 4. Finir le contenu visible

- images manquantes
- polish UI/UX
- texte et encodage

## Notes de confiance

- La structure generale et la base technique sont bonnes.
- Les donnees extraites doivent maintenant etre traitees comme la base fiable.
- Le projet a maintenant plus besoin d'integration fidele, d'alignement et de finition que d'une reecriture complete.

## Discipline de maintenance

- On ne quitte pas une session avec un build casse sans le signaler clairement.
- Apres chaque gros changement, il faut mettre a jour `README.md` et les notes pertinentes sous `docs/`.

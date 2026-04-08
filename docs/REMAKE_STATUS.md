# Dungeon Master Remake - Etat du projet

Version remise a jour a partir du code observe le 2026-04-08.

## Resume rapide

Le projet est deja une base jouable et serieuse, avec un vrai runtime de dungeon, une UI exploitable et un chargement de donnees originales consolidees.

Ce n'est pas encore un remake complet, mais ce n'est plus un simple prototype.

Point important :

- l'extraction des donnees originales essentielles est maintenant consideree comme fiable
- le travail restant concerne surtout l'integration fidele de ces donnees dans le runtime

## Ce qui est effectivement en place

### Base runtime

- rendu 3D du donjon avec React Three Fiber
- maps chargees depuis `public/dungeon.json`
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

- catalogues runtime `public/original_*`
- parse des mechanisms depuis `Old_data/mechanisms.json`
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

- pas de vrai menu principal
- pas de game over complet
- pas d'ecran de victoire / fin
- sauvegarde / chargement absents

### Magie

Le systeme de runes et de sorts est riche cote data, mais tous les effets ne sont pas egalement finalises cote gameplay.

Les effets clairement presents dans le runtime actuel incluent au minimum:

- `heal`
- `light`
- `open`
- `fireball`
- `lightning`
- `poison`
- `plasma`

Les autres effets existent dans les definitions mais demandent encore une verification ou un approfondissement gameplay:

- `shield`
- `fire_shield`
- `darkness`
- `invisibility`
- `magic_vision`
- `potion`
- `footprints`

### Objets et statuts

- equipement, poids et quelques bonus passifs sont en place
- poison persistant, faim, soif, contenants d'eau et fontaines sont jouables
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
- les formules restent encore partiellement simplifiees
- les sorts et plusieurs effets speciaux demandent encore un recollage plus fin

### Assets et finition

- les overlays muraux gameplay sont maintenant presque completement couverts
- il reste surtout du polish, quelques images specifiques et un meilleur rangement futur des assets
- le preload d'images est volontairement permissif
- quelques soucis d'encodage restent visibles dans certains fichiers historiques

## Point important sur les maps

La source de verite actuelle n'a jamais ete les anciens scaffolds `src/data/level0.ts` et `src/data/level1.ts`.

Le runtime utilise:

- `public/dungeon.json`
- `src/data/dungeonData.ts`
- `src/data/mapLoader.ts`

Constat:

- les anciens fichiers `level0.ts` / `level1.ts` ont ete supprimes
- la vraie map 0 runtime est `18x19`
- la vraie map 1 runtime est `32x32`

Conclusion:

- le runtime de map doit etre juge uniquement a partir de `public/dungeon.json` et `mapLoader.ts`

## Priorites recommandees

### 1. Continuer l'integration fidele

- recoller les sorts et les durees a la base originale
- etendre l'echelle de temps commune
- reduire les couches runtime encore interpretatives

### 2. Stabiliser le flow de jeu

- definir le vrai debut de partie
- ajouter game over et fin minimale

### 3. Finaliser les systemes gameplay

- magie
- objets / statuts
- serrures / cles / alcoves
- pits / eau / interactions de niveau

### 4. Finir le contenu visible

- images manquantes
- polish UI/UX
- texte et encodage

## Notes de confiance

- La structure generale et la base technique sont bonnes.
- Les donnees extraites doivent maintenant etre traitees comme la base fiable.
- Le projet a maintenant plus besoin d'integration fidele, d'alignement et de finition que d'une reecriture complete.

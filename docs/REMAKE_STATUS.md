# Dungeon Master Remake - Etat du projet

Version remise a jour a partir du code observe le 2026-04-07.

## Resume rapide

Le projet est deja une base jouable et serieuse, avec un vrai runtime de dungeon, une UI exploitable et un chargement de donnees originales consolidees.

Ce n'est pas encore un remake complet, mais ce n'est plus un simple prototype.

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

### Donnees et catalogues

- catalogues runtime `public/original_*`
- parse des mechanisms depuis `Old_data/mechanisms.json`
- definitions de portes originales branchees
- noms d'objets consolides via `resolveItemName(...)`
- regles d'equipement centralisees dans `src/data/equipment.ts`

### UI et presentation

- HUD principal avec portraits en ligne, mains visibles et formation 2x2
- ChampionSheet riche
- MirrorPopup branche
- LoadingScreen branche
- textes muraux graves en 3D
- overlays muraux et decals mieux cales qu'avant

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
- poison persistant, faim, soif et usages speciaux restent incomplets
- cles / serrures / alcoves sont partiellement cablees mais pas encore closes systemiquement
- conteneurs et objets speciaux ne semblent pas encore complets

### Carte et interactions

- `Pit`, `Water`, `Teleporter`, `Door`, `TrickWall` existent dans les types et les maps runtime
- toutes les interactions attendues de ces tiles ne sont pas encore finalisees
- il reste du travail sur pits, corde, eau, verrouillages et cas speciaux de maps

### Combat

- le combat est jouable
- les formules restent simplifiees
- les resistances et comportements speciaux ne paraissent pas encore au niveau d'un remake fini
- les armes a distance / lancers / munitions sont encore a consolider

### Assets et finition

- `MISSING_IMAGES.md` montre qu'il reste des images a mapper ou a creer
- le preload d'images est volontairement permissif
- README et docs etaient en retard sur l'etat reel
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

### 1. Clarifier la reference documentaire

- garder `CODEBASE_REFERENCE.md` et `REMAKE_STATUS.md` alignes sur le runtime reel

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
- Les docs d'etat precedentes surestimaient certains points et oubliaient plusieurs modules reels.
- Le projet a maintenant plus besoin d'alignement, de tri et de finition que d'une reecriture complete.

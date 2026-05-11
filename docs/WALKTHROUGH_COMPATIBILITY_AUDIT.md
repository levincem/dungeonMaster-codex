# Walkthrough Compatibility Audit

Audit rapide de compatibilite entre le runtime actuel et un walkthrough complet de *Dungeon Master*.

Version observee dans le code au 2026-05-11.

## Objectif

Verifier si une solution complete du jeu semble compatible avec ce qui est actuellement implemente dans le runtime.

Le but ici n'est pas de reecrire un walkthrough, mais d'identifier:

- ce qui semble deja compatible
- ce qui reste douteux
- ce qui risque de bloquer une run complete

## Conclusion courte

Le coeur du jeu et une grande partie du milieu de progression semblent compatibles avec la structure actuelle du runtime.

Les 4 gros blockers identifies lors de la premiere passe ont maintenant une implementation dediee dans le runtime:

- `Zo` ouvre desormais la premiere porte fermee trouvee dans son axe
- les portes destructibles peuvent etre brisees en attaque physique
- la sequence `Zokathra -> Amalgam -> The Firestaff (Complete)` est branchee
- la vraie fin et la fin alternative du `Hall of Champions` sont maintenant toutes deux modelees

Le risque principal n'est donc plus un oubli structurel, mais la fidelite exacte en playtest sur quelques sequences tardives.

## Globalement compatibles

### Serrures, clefs et objets requis

Le walkthrough repose tres souvent sur:

- `Gold Key`
- `Iron Key`
- `Key Of B`
- `Solid Key`
- `Square Key`
- `Tourquoise Key`
- `Cross Key`
- `Skeleton Key`
- `Winged Key`
- `Topaz Key`
- `Emerald Key`
- `Ruby Key`
- `Ra Key`
- `Master Key`

Constat:

- les objets existent bien dans [src/data/items.ts](/D:/DungeonMaster-codex/src/data/items.ts)
- les correspondances requirement -> objet sont bien centralisees dans [src/data/mechanisms.ts](/D:/DungeonMaster-codex/src/data/mechanisms.ts)
- l'usage explicite d'objet sur mur est implemente dans [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts)

Verdict:

- plutot compatible

### Coin slots, gem holes, eye switches, alcoves

Le walkthrough utilise regulierement:

- `Copper Coin`
- `Silver Coin`
- `Gold Coin`
- `Blue Gem`
- `Mirror Of Dawn`
- `Magnifier`
- `Corbamite`

Constat:

- ces objets sont bien presents dans les donnees runtime
- les overlays muraux correspondants existent:
  - `Coin Slot`
  - `Gem Hole`
  - `Eye Switch`
  - `Square Alcove`
  - `Arched Alcove`
- les requirements d'objet extraits apparaissent bien dans `dungeon.json`
- la logique runtime actuelle gere bien les depots explicites sur mur

Verdict:

- plutot compatible

### Riddle Room et grands puzzles a objet

Exemples du walkthrough:

- salle d'enigmes avec `Blue Gem`, `Mirror Of Dawn`, `Gold Coin`, `Bow`
- puzzles de type alcove / objet specifique / pressure pad avec objet depose
- ouvertures de `Skeleton Stairs`

Constat:

- la structure de donnees extraite couvre bien ces cas
- les sensors muraux/sols et les requirements d'objet sont maintenant bien plus propres

Verdict:

- plutot compatible, sous reserve de playtests

### Lord Chaos: containment et Fuse

Le walkthrough demande:

- de contenir Lord Chaos dans des `Fluxcage`
- de lancer `Fuse` avec `The Firestaff (Complete)`

Constat:

- `Fluxcage` est branche cote runtime
- `Fuse` est branche cote runtime
- Lord Chaos doit deja etre `fluxcaged` avant `Fuse` dans [fuseAction.ts](/D:/DungeonMaster-codex/src/engine/systems/fuseAction.ts:91)
- l'IA speciale de `Lord Chaos` a aussi recupere son `double square move`, ce qui rebranche bien sa capacite de fuite speciale a haut niveau [creatureMovementState.ts](/D:/DungeonMaster-codex/src/engine/systems/creatureMovementState.ts:79) [originalArchenemyMovement.ts](/D:/DungeonMaster-codex/src/engine/systems/originalArchenemyMovement.ts:5)
- nuance importante: la condition finale reste aujourd'hui plus abstraite qu'une reconstruction litterale des cases de `Fluxcage` posees autour de lui
- correctif utile deja en place: si `Fluxcage` est lance directement sur la case de `Lord Chaos` alors qu'une case adjacente libre existe, il s'y echappe au lieu d'etre traite comme deja piege
- correctif utile ajoute sur `Fuse`: meme si `Lord Chaos` est encore marque `fluxcaged`, le cast ne demarre plus la vraie fin s'il a encore une case adjacente libre; il s'echappe d'abord et la fusion echoue

Verdict:

- compatible pour finir le jeu
- encore partiellement abstrait sur la geometrie exacte du piege final si on prend le walkthrough comme oracle strict

## Risques de blocage probables

Cette section conserve les 4 points originaux comme historique d'audit, mais ils ne sont plus consideres comme des blockers structurels non implementes.

### 1. `Zo` a distance sur une porte

Le walkthrough s'appuie explicitement sur des cas du type:

- lancer `Zo` de l'autre cote d'un pit
- ouvrir une porte non adjacente

Constat code:

- l'effet `open` actuel ouvre seulement la porte juste devant le groupe dans [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts)
- il n'y a pas actuellement de vraie projection distante de `Zo` sur un mecanisme ou une porte lointaine

Statut actuel:

- traite dans le runtime

Risque residuel:

- faible a moyen, surtout si un puzzle attend un comportement encore plus fin qu'une simple ouverture de la premiere porte dans l'axe

### 2. Portes cassables / destructibles

Le walkthrough s'appuie sur plusieurs cas ou il faut:

- briser une wooden door
- casser une porte comme `None Shall Pass`

Constat code:

- je n'ai pas trouve de vraie logique de degats sur porte dans `attackFront`
- les portes sont gerees surtout comme ouvertes / fermees / ecrasantes
- je n'ai pas trouve de pipeline clair "attaque de porte -> destruction -> passage"

Statut actuel:

- traite dans le runtime

Risque residuel:

- moyen, car la casse de porte merite encore un playtest cible sur les quelques cas iconiques du walkthrough

### 3. Sequence finale `Zokathra -> Amalgam -> The Firestaff (Complete)`

Le walkthrough explique:

- lancer `Zo Kath Ra`
- inserer le plasma dans l'Amalgam
- inserer `The Firestaff`
- recevoir `The Firestaff (Complete)`

Constat data:

- les donnees extraites documentent explicitement cette logique
- on trouve des requirements `ZOKATHRA SPELL` et `THE FIRESTAFF` dans `dungeon.json`
- les overlays `Amalgam (Encased Gem)`, `Amalgam (Free Gem)` et `Amalgam (Without Gem)` existent

Constate runtime:

- `Zo Kath Ra` cree maintenant le bon item runtime `Zokathra`
- la compatibilite requirement `ZOKATHRA SPELL` est geree
- l'usage de `The Firestaff` sur l'Amalgam remplace maintenant correctement l'objet par `The Firestaff (Complete)`
- le pickup direct du reward cache est explicitement bloque tant que la transformation via l'Amalgam n'a pas eu lieu

Risque residuel:

- moyen, car ce chemin critique merite encore un vrai playtest bout en bout

### 4. Victoire / fin de jeu

Constate code:

- `GamePhase` couvre maintenant les phases `endgame`, `victory` et `alternate_ending`
- la neutralisation de Lord Chaos via `Fuse` bascule vers une vraie sequence `endgame` avec alternance `Lord Chaos / Lord Order`, apparition du `Grey Lord`, puis ecran final
- le retour au `Hall of Champions` avec `The Firestaff` incomplet declenche maintenant aussi la fin alternative: retour devant `Lord Order`, barrage de `fireballs`, mort de la party, puis `game over` normal

Risque residuel:

- faible sur la completion
- moyen seulement si l'objectif devient la fidelite spatiale tres stricte du piege de `Lord Chaos`

## Points a reverifier en playtest

Ces points ne me semblent pas rouges, mais meritent un test cible:

- puzzles temporels et countdowns du walkthrough
- puzzles de teleporteurs a direction changee
- invisibles teleporters retenant certaines creatures dans une salle
- interactions `pressure pad + objet maintenu`
- `Skeleton Stairs` et sequences de retours entre niveaux
- quelques puzzles de pits a reouverture / refermeture

## Synthese

Si on se base sur ce walkthrough comme oracle de progression:

- debut et milieu du jeu: plutot rassurants
- logique des objets requis et mecanismes muraux: globalement rassurante
- progression profonde et fin de jeu: encore fragile sur quelques points precis

Les verifications prioritaires restantes avant de dire "run complete compatible walkthrough":

1. valider en jeu les puzzles `Zo` a distance les plus sensibles
2. valider quelques portes cassables emblematiques (`None Shall Pass`, portes en bois de debut de jeu)
3. confirmer jusqu'ou on veut pousser la fidelite exacte du piege final `Lord Chaos + Fluxcage` par rapport a la formulation walkthrough
4. verifier les derniers cas rares de countdowns / teleporters / retours entre niveaux

## Liens utiles

- [docs/REMAKE_STATUS.md](/D:/DungeonMaster-codex/docs/REMAKE_STATUS.md)
- [docs/RUNTIME_ALIGNMENT_AUDIT.md](/D:/DungeonMaster-codex/docs/RUNTIME_ALIGNMENT_AUDIT.md)
- [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts)
- [src/data/mechanisms.ts](/D:/DungeonMaster-codex/src/data/mechanisms.ts)
- [src/data/items.ts](/D:/DungeonMaster-codex/src/data/items.ts)
- [src/data/runes.ts](/D:/DungeonMaster-codex/src/data/runes.ts)
- [src/assets/data/dungeon.json](/D:/DungeonMaster-codex/src/assets/data/dungeon.json)

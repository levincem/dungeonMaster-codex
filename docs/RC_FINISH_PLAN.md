# 0.9 RC Finish Plan

Etat revu le `2026-05-16`.

Ce document sert de plan de travail court pour fermer la `0.9 release candidate` en une derniere passe utile.

## Objectif

Passer de `0.9.0-rc.1` a une `0.9` publique propre, sans rajouter de gros chantier parasite.

## Priorite 1 - Hall of fame partage

Contexte:

- le jeu stocke deja les stats de run dans la save
- le hall of fame actuel existe deja, mais seulement en `localStorage`
- le site tourne sur un VPS dedie, donc une petite API `Node.js` est une option simple et realiste

Livrable minimum:

- une route `GET /api/hall-of-fame` qui renvoie le tableau global
- une route `POST /api/hall-of-fame` qui ajoute une victoire
- un stockage fichier `hall_of_fame.json` cote serveur
- le front bascule automatiquement de `localStorage` vers l'API si elle est disponible

Implementation recommande:

1. installer `Node.js` sur le VPS
2. ajouter un mini serveur `Express` ou `Fastify`
3. stocker les entrees dans un JSON unique
4. ecrire de facon atomique via `write temp -> rename`
5. exposer le fichier en lecture seule pour debug/admin si besoin

Anti-triche "juste assez" pour un tableau fun:

- rejeter les noms vides ou absurdes
- limiter la taille du payload
- valider quelques bornes simples:
  - temps de jeu positif
  - kills / degats / sorts non negatifs
  - valeurs impossibles ou delirantes rejetees
- enregistrer `buildVersion`, date serveur et un hash simple du payload
- limiter la cadence de soumission par IP
- n'accepter la soumission que depuis une partie finie cote front

Point important:

- ce ne sera jamais infalsifiable sans architecture beaucoup plus lourde
- pour un classement fun, l'objectif est surtout de filtrer la triche triviale et les soumissions absurdes

## Priorite 2 - Derniere passe endgame / fin

A verifier en vrai playtest:

- sequence `Amalgam -> Firestaff (Complete)`
- `Fluxcage / Fuse / Lord Chaos`
- rythme de la sequence `Lord Chaos -> Lord Order -> Grey Lord`
- lisibilite des ecrans `texte -> stats -> hall of fame -> The End`
- confort de lecture en `1920x1080`

Definition de fini:

- la sequence complete se rejoue en dev sans blocage
- aucun bug visuel ou logique evident ne subsiste sur la fin

## Priorite 3 - Dernier polish cible

Seulement si un vrai probleme reste visible:

- overlays decoratifs encore trop grands
- derniers ecarts de presentation tardifs
- petit reliquat perf / warm-up seulement si le gain est evident
- verifier la porte `[g:1,3]` / `LVL 0`:
  elle est redevenue une grille transparente apres la passe portes, alors qu'elle devait rester une porte pleine opaque

Regle:

- ne pas rouvrir des sous-systemes stabilises
- corriger seulement ce qu'un playtest final remonte reellement

## Verification finale avant `0.9`

- `npm.cmd test`
- `npm.cmd run build`
- un run de victoire complet
- verification du resume de version dans `README` et l'ecran titre
- verification du hall of fame partage sur le VPS

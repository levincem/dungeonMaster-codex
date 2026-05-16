# 0.9.x Finish Plan

Etat revu le `2026-05-16`.

Ce document sert de plan de travail court pour refermer proprement la derniere passe utile de stabilisation `0.9.x`.

## Objectif

Stabiliser `0.9.1` sans rouvrir de gros chantiers parasites.

## Priorite 1 - Derniere passe endgame / fin

Contexte:

- la fin de jeu est jouable de bout en bout
- le hall of fame partage est deja actif
- le reliquat utile est surtout de confirmer confort, rythme et lisibilite sur un vrai run complet

A verifier en vrai playtest:

- sequence `Amalgam -> Firestaff (Complete)`
- `Fluxcage / Fuse / Lord Chaos`
- rythme de la sequence `Lord Chaos -> Lord Order -> Grey Lord`
- lisibilite des ecrans `texte -> stats -> hall of fame -> The End`
- confort de lecture en `1920x1080`

Definition de fini:

- la sequence complete se rejoue en dev sans blocage
- aucun bug visuel ou logique evident ne subsiste sur la fin

## Priorite 2 - Hall of fame partage

Statut:

- ferme cote repo et VPS

Ce qui est deja valide:

- `GET /api/hall-of-fame`
- `POST /api/hall-of-fame`
- stockage fichier JSON persistant
- validation basique anti-abus / anti-triche triviale
- fallback `localStorage` cote front si l'API n'est pas disponible

Support de deploiement conserve:

- [docs/HALL_OF_FAME_VPS_SETUP.md](/D:/DungeonMaster-codex/docs/HALL_OF_FAME_VPS_SETUP.md)

## Priorite 3 - Dernier polish cible

Seulement si un vrai probleme reste visible:

- derniers ecarts de presentation tardifs
- petit reliquat perf / warm-up seulement si le gain est evident

Regle:

- ne pas rouvrir des sous-systemes stabilises
- corriger seulement ce qu'un playtest final remonte reellement

Note deja tranchee:

- la porte du Hall pres de `[g:1,3]` reste volontairement rendue comme une porte pleine opaque
- l'extraction runtime locale continue de la resoudre en `Porticullis`, donc il s'agit d'un override remake assume, pas d'une preuve source-backed

## Verification finale avant prochaine passe publique

- `npm.cmd test`
- `npm.cmd run build`
- un run de victoire complet
- verification du resume de version dans `README` et l'ecran titre
- verification rapide du hall of fame partage sur le VPS

# Project State Index

Etat revu le `2026-05-19`.

Ce document sert seulement a dire quel document lire selon le besoin.

## Role des documents principaux

- [README.md](../README.md)
  - vue humaine courte du projet
- [NEXT_PHASE_PLAN.md](./NEXT_PHASE_PLAN.md)
  - uniquement les sujets encore ouverts, ordonnes
- [REMAKE_STATUS.md](./REMAKE_STATUS.md)
  - journal d'etat detaille et historique
- [RC_FINISH_PLAN.md](./RC_FINISH_PLAN.md)
  - plan court de stabilisation `0.9.x`

Regle:

- `README` = resume public
- `NEXT_PHASE_PLAN` = plan courant, pas d'historique
- `REMAKE_STATUS` = memoire longue

## Point d'entree recommande

Si on doit se recaler vite:

1. [NEXT_PHASE_PLAN.md](./NEXT_PHASE_PLAN.md)
2. [REMAKE_STATUS.md](./REMAKE_STATUS.md)
3. [RC_FINISH_PLAN.md](./RC_FINISH_PLAN.md)
4. [FIDELITY_REMAINING_MATRIX.md](./FIDELITY_REMAINING_MATRIX.md)

## Quel document pour quelle question

- Que reste-t-il a faire maintenant:
  - [NEXT_PHASE_PLAN.md](./NEXT_PHASE_PLAN.md)
- Quel est l'etat global du projet:
  - [REMAKE_STATUS.md](./REMAKE_STATUS.md)
- Quel est le plan court pour stabiliser la branche `0.9.x`:
  - [RC_FINISH_PLAN.md](./RC_FINISH_PLAN.md)
- Comment deployer le hall of fame partage sur le VPS:
  - [HALL_OF_FAME_VPS_SETUP.md](./HALL_OF_FAME_VPS_SETUP.md)
- Qu'est-ce qui reste ouvert cote fidelite:
  - [FIDELITY_REMAINING_MATRIX.md](./FIDELITY_REMAINING_MATRIX.md)
- Qu'est-ce qu'on peut affirmer honnetement sur le `100%`:
  - [FIDELITY_100_VERDICT.md](./FIDELITY_100_VERDICT.md)
- Ou regarder pour les generateurs:
  - [GENERATOR_ALIGNMENT_NOTES.md](./GENERATOR_ALIGNMENT_NOTES.md)
- Ou regarder pour l'alignement runtime:
  - [RUNTIME_ALIGNMENT_AUDIT.md](./RUNTIME_ALIGNMENT_AUDIT.md)
- Ou regarder pour l'extraction:
  - [ORIGINAL_DATA_AUDIT.md](./ORIGINAL_DATA_AUDIT.md)
  - [EXTRACTION_AUDIT.md](./EXTRACTION_AUDIT.md)
- Ou regarder pour la structure du code:
  - [CODEBASE_REFERENCE.md](./CODEBASE_REFERENCE.md)
- Ou regarder pour un playtest guide:
  - [PLAYTEST_CHECKLIST_LEVELS_1_TO_3.md](./PLAYTEST_CHECKLIST_LEVELS_1_TO_3.md)

## Lecture honnete actuelle

- extraction: solide sur le contenu principal, avec quelques angles morts semantiques restants
- moteur: largement source-backed sur le coeur du gameplay
- branche publique de travail: `0.9.4`
- principal reste ouvert: petit polish UX/visuel, verification Hall of Fame et ecrans de fin sur quelques environnements, et optimisation seulement si un symptome concret revient
- le `store` n'est plus le chantier prioritaire

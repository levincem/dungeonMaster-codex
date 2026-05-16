# Project State Index

Etat revu le `2026-05-16`.

Ce document sert seulement a dire quel document lire selon le besoin.

## Role des documents principaux

- [README.md](/D:/DungeonMaster-codex/README.md)
  - vue humaine courte du projet
- [docs/NEXT_PHASE_PLAN.md](/D:/DungeonMaster-codex/docs/NEXT_PHASE_PLAN.md)
  - uniquement les sujets encore ouverts, ordonnes
- [docs/REMAKE_STATUS.md](/D:/DungeonMaster-codex/docs/REMAKE_STATUS.md)
  - journal d'etat detaille et historique
- [docs/RC_FINISH_PLAN.md](/D:/DungeonMaster-codex/docs/RC_FINISH_PLAN.md)
  - plan court de stabilisation `0.9.x`

Regle:

- `README` = resume public
- `NEXT_PHASE_PLAN` = plan courant, pas d'historique
- `REMAKE_STATUS` = memoire longue

## Point d'entree recommande

Si on doit se recaler vite:

1. [docs/NEXT_PHASE_PLAN.md](/D:/DungeonMaster-codex/docs/NEXT_PHASE_PLAN.md)
2. [docs/REMAKE_STATUS.md](/D:/DungeonMaster-codex/docs/REMAKE_STATUS.md)
3. [docs/RC_FINISH_PLAN.md](/D:/DungeonMaster-codex/docs/RC_FINISH_PLAN.md)
4. [docs/FIDELITY_REMAINING_MATRIX.md](/D:/DungeonMaster-codex/docs/FIDELITY_REMAINING_MATRIX.md)

## Quel document pour quelle question

- Que reste-t-il a faire maintenant:
  - [docs/NEXT_PHASE_PLAN.md](/D:/DungeonMaster-codex/docs/NEXT_PHASE_PLAN.md)
- Quel est l'etat global du projet:
  - [docs/REMAKE_STATUS.md](/D:/DungeonMaster-codex/docs/REMAKE_STATUS.md)
- Quel est le plan court pour stabiliser la branche `0.9.x`:
  - [docs/RC_FINISH_PLAN.md](/D:/DungeonMaster-codex/docs/RC_FINISH_PLAN.md)
- Comment deployer le hall of fame partage sur le VPS:
  - [docs/HALL_OF_FAME_VPS_SETUP.md](/D:/DungeonMaster-codex/docs/HALL_OF_FAME_VPS_SETUP.md)
- Qu'est-ce qui reste ouvert cote fidelite:
  - [docs/FIDELITY_REMAINING_MATRIX.md](/D:/DungeonMaster-codex/docs/FIDELITY_REMAINING_MATRIX.md)
- Qu'est-ce qu'on peut affirmer honnetement sur le `100%`:
  - [docs/FIDELITY_100_VERDICT.md](/D:/DungeonMaster-codex/docs/FIDELITY_100_VERDICT.md)
- Ou regarder pour les generateurs:
  - [docs/GENERATOR_ALIGNMENT_NOTES.md](/D:/DungeonMaster-codex/docs/GENERATOR_ALIGNMENT_NOTES.md)
- Ou regarder pour l'alignement runtime:
  - [docs/RUNTIME_ALIGNMENT_AUDIT.md](/D:/DungeonMaster-codex/docs/RUNTIME_ALIGNMENT_AUDIT.md)
- Ou regarder pour l'extraction:
  - [docs/ORIGINAL_DATA_AUDIT.md](/D:/DungeonMaster-codex/docs/ORIGINAL_DATA_AUDIT.md)
  - [docs/EXTRACTION_AUDIT.md](/D:/DungeonMaster-codex/docs/EXTRACTION_AUDIT.md)
- Ou regarder pour la structure du code:
  - [docs/CODEBASE_REFERENCE.md](/D:/DungeonMaster-codex/docs/CODEBASE_REFERENCE.md)
- Ou regarder pour un playtest guide:
  - [docs/PLAYTEST_CHECKLIST_LEVELS_1_TO_3.md](/D:/DungeonMaster-codex/docs/PLAYTEST_CHECKLIST_LEVELS_1_TO_3.md)

## Lecture honnete actuelle

- extraction: solide sur le contenu principal, avec quelques angles morts semantiques restants
- moteur: largement source-backed sur le coeur du gameplay
- principal reste ouvert: validation gameplay ciblee, UX/visuel final, et optimisation
- le `store` n'est plus le chantier prioritaire

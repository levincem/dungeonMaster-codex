# Project State Index

Etat pose le `2026-04-18`.

Ce document sert d'index court vers les documents a consulter selon la question qu'on se pose sur le projet.

## Point d'entree recommande

Si on ne doit lire qu'un seul trio pour se recaler vite:

1. [docs/REMAKE_STATUS.md](/D:/DungeonMaster-codex/docs/REMAKE_STATUS.md)
2. [docs/FIDELITY_100_VERDICT.md](/D:/DungeonMaster-codex/docs/FIDELITY_100_VERDICT.md)
3. [docs/FIDELITY_REMAINING_MATRIX.md](/D:/DungeonMaster-codex/docs/FIDELITY_REMAINING_MATRIX.md)

## Quel document pour quelle question

- Etat produit / cap projet:
  - [docs/REMAKE_STATUS.md](/D:/DungeonMaster-codex/docs/REMAKE_STATUS.md)
- Ce qu'on peut affirmer honnetement sur le `100%`:
  - [docs/FIDELITY_100_VERDICT.md](/D:/DungeonMaster-codex/docs/FIDELITY_100_VERDICT.md)
- Ce qui reste vraiment ouvert, hybride ou non valide:
  - [docs/FIDELITY_REMAINING_MATRIX.md](/D:/DungeonMaster-codex/docs/FIDELITY_REMAINING_MATRIX.md)
- Plan de phase suivante `optimisation / maintenabilite / organisation`:
  - [docs/NEXT_PHASE_PLAN.md](/D:/DungeonMaster-codex/docs/NEXT_PHASE_PLAN.md)
- Etat d'alignement runtime et grands recalages gameplay:
  - [docs/RUNTIME_ALIGNMENT_AUDIT.md](/D:/DungeonMaster-codex/docs/RUNTIME_ALIGNMENT_AUDIT.md)
- Focus generateurs:
  - [docs/GENERATOR_ALIGNMENT_NOTES.md](/D:/DungeonMaster-codex/docs/GENERATOR_ALIGNMENT_NOTES.md)
- Etat d'extraction et zones encore decodees partiellement:
  - [docs/ORIGINAL_DATA_AUDIT.md](/D:/DungeonMaster-codex/docs/ORIGINAL_DATA_AUDIT.md)
  - [docs/EXTRACTION_AUDIT.md](/D:/DungeonMaster-codex/docs/EXTRACTION_AUDIT.md)
- Structure du code et modules cles:
  - [docs/CODEBASE_REFERENCE.md](/D:/DungeonMaster-codex/docs/CODEBASE_REFERENCE.md)
- Preparation de playtest debut de jeu:
  - [docs/PLAYTEST_CHECKLIST_LEVELS_1_TO_3.md](/D:/DungeonMaster-codex/docs/PLAYTEST_CHECKLIST_LEVELS_1_TO_3.md)

## Lecture honnete actuelle

- extraction: tres solide, mais `0696.RAW1` n'est pas ferme semantiquement a `100%`
- moteur: largement source-backed sur le gameplay central
- reste runtime majeur: structure des groupes actifs / generateurs
- store central: la grosse extraction des wrappers d'action/orchestration est largement faite, y compris boucle temps, wrappers gameplay top-level, helpers capteurs, etat runtime externe des creatures, runtime party/survie, runtime movement/transport, bootstrap monde/generateurs, bootstrap d'etat initial, helpers champion purs, noyau `champion/combat state`, paquet utilitaire `combat/projectile/item`, noyau spatial `creature occupancy / LOS` et petit noyau `endgame`; le `store` peut maintenant etre considere comme sain dans son role de composition
- autres restes: couches hybrides localisees, fallbacks de presentation, validation en jeu des cas rares et de fin
- dernier audit code/runtime: pas de nouvelle incoherence gameplay centrale trouvee; le reste est surtout structurel, hybride ou de validation

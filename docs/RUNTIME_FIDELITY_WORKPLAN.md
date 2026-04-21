# Runtime Fidelity Workplan

Objectif:

- aucune perte silencieuse entre extraction, packaging runtime et consommateurs runtime
- toute deviation intentionnelle doit etre explicite, testee et documentee
- assets refaits prioritaires, sinon fallback vers l'original exact avec trace de remake

## Phase 1 - References canoniques

Etat:

- creatures: canonique et audite
- doors: canonique et audite
- teleporters: canonique et audite
- original_experience_runtime: canonique documente, package runtime synchronise et audite
- original_item_rules_runtime: package runtime synchronise et premiers consommateurs verifies
- original_skills_runtime: package runtime synchronise et consommateur `skillProgression.ts` verifie
  - listes de skills, mapping `id -> runtime key` et parents hidden/basic maintenant derives directement de la reference packagee
- original_magic_runtime: package runtime synchronise et consommateur `runes.ts` verifie sur les constantes de puissance et la formule de cout
- original_actions_runtime: package runtime synchronise et aligne avec la slice runtime `game_db_weapon_attacks.json`
  - consommation runtime de `skillNumber`, `experienceForAttacking`, `defenseModifier`, `staminaCost` et `disableTime` maintenant verifiee jusqu'a `getWeaponAttackOptions(...)` et `storeAttackFrontRuntime.ts`
- original_action_combos_runtime: package runtime synchronise et aligne avec les classes d'attaque runtime
- original_ui_support_runtime: package runtime synchronise et verifie a l'octet pres
  - premieres constantes runtime maintenant consommees explicitement via `originalUiSupport.ts`
  - `luminousPowerToLuminance` aligne les contributions lumineuses des sorts dans `originalSpells.ts`
- original_champion_progression_runtime: package runtime synchronise et consomme par `originalChampionLeveling.ts`
- original_mirror_recruitment_runtime: package runtime synchronise et consomme par `resurrection.ts`

Reste a etendre au meme niveau de couverture consommateur:

- le reste de `original_ui_support_runtime.json` hors luminance deja raccordee
- les regles de progression / training encore hors du bloc de growth et d'XP initiale maintenant references

## Phase 2 - Tables gameplay runtime

Continuer a transformer les zones encore exprimees en glue runtime vers des tables source-backed testables:

- equipment
  - signaux explicites wear/storage maintenant verifies jusqu'au consommateur runtime
  - les cas a `allowedSlotsMask = 0` sont maintenant reduits a `Zokathra` seul et rendus explicites
- progression / training / level-ups
  - multiplicateurs documentes et regles de menace recente maintenant verifies
  - seeds de competences des champions et XP initiale maintenant verifies jusqu'a `champions.ts` et `championState.ts`
  - growth des quatre branches maintenant reference et verifie jusqu'a `originalChampionLeveling.ts`
  - seuil de niveau `baseExperienceStep` maintenant consomme explicitement par `skillProgression.ts` et la detection legacy de `championState.ts`
  - reste a sortir les autres regles / formules de training de plus long terme dans une reference packagee explicite
- resurrect / reincarnate
  - regles de mirror recruitment et de l'autel `VI` maintenant referencees et verifiees jusqu'aux consommateurs runtime
- consommation / regles d'objet
- formules de magie secondaires encore localement derivees
- regles de defense / mitigation encore codees sans table source unique
- ordre de drop des possessions a la mort
  - maintenant source-backed via `originalAtari.i562.dropOrder -> game_db_items.json -> items.ts -> deathDrops.ts`
  - verrouille par audit de package, verifications consommateur et test de comportement
- bloc de support `i562`
  - `underscoreCharacterString`, `renameChampionInputCharacterString` et `reincarnateSpecialCharacters` preservés jusqu'au slice runtime `game_db_items.json`
  - exposes au runtime via `items.ts` pour eviter toute nouvelle perte silencieuse sur ce sous-bloc

## Phase 3 - Consommateurs runtime

Pour chaque module critique:

- comparer la table source canonique
- comparer le package runtime
- comparer le module runtime charge
- ajouter un test de comportement sur au moins un cas representatif

Priorite suivante:

- regles de consommation et d'usage d'objets
- training / progression encore hors growth et XP initiale deja verifies
- couverture consommateur de `original_ui_support_runtime.json`
  - coherence croisee des constantes de reincarnation avec le bloc `i562` maintenant verifiee
- support UI / panneaux `0696` quand ils pilotent encore des heuristiques visibles
- derniers blocs encore peu references cote consommateurs:
  - le reste de `original_ui_support_runtime.json` hors luminance / reincarnation deja raccordees
  - les regles de training / progression qui ne passent pas encore par les references de progression packagees

## Phase 4 - Assets et presentation

Regle:

- image refaite dediee si elle existe
- sinon BMP original exact
- pas de placeholder generique silencieux

Suivi courant:

- [WALL_OVERLAY_REMAKE_TODO.md](/D:/DungeonMaster-codex/docs/WALL_OVERLAY_REMAKE_TODO.md)

## Gate de fin

Une zone n'est consideree comme "verrouillee" que si:

1. une source canonique est identifiee
2. le package runtime est compare a cette source
3. le consommateur runtime est compare a cette source ou a ce package
4. au moins un test de comportement valide que la donnee est effectivement prise en compte
5. les exceptions volontaires sont documentees explicitement

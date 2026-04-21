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
  - seuils structures de menace recente (`staleThreatTicks`, `recentThreatTicks`, liste des hidden skills concernes) maintenant packages explicitement
- original_item_rules_runtime: package runtime synchronise et premiers consommateurs verifies
  - `originalItemRules.ts` expose maintenant les bits de carry, slots runtime derives et regles canoniques `pouch/consumable`
  - `equipment.ts`, `doors.ts` et `ChampionSheet.tsx` consomment maintenant ce module au lieu de redecoder localement les bits principaux
- original_skills_runtime: package runtime synchronise et consommateur `skillProgression.ts` verifie
  - listes de skills, mapping `id -> runtime key` et parents hidden/basic maintenant derives directement de la reference packagee
- original_magic_runtime: package runtime synchronise et consommateur `runes.ts` verifie sur les constantes de puissance et la formule de cout
- original_actions_runtime: package runtime synchronise et aligne avec la slice runtime `game_db_weapon_attacks.json`
  - consommation runtime de `skillNumber`, `experienceForAttacking`, `defenseModifier`, `staminaCost` et `disableTime` maintenant verifiee jusqu'a `getWeaponAttackOptions(...)` et `storeAttackFrontRuntime.ts`
- original_action_combos_runtime: package runtime synchronise et aligne avec les classes d'attaque runtime
- original_ui_support_runtime: package runtime synchronise et verifie a l'octet pres
  - premieres constantes runtime maintenant consommees explicitement via `originalUiSupport.ts`
  - `luminousPowerToLuminance` aligne les contributions lumineuses des sorts dans `originalSpells.ts`
  - `torchTypePerChargesCount` aligne maintenant aussi les etats visuels et la luminance runtime des torches
  - `paletteBrightnessThresholds` aligne maintenant la quantification de lumiere de scene dans `computeLightLevel(...)`
  - `creatureInjuryMasks` aligne maintenant la traduction `zones de blessure -> wound slots` dans `storeChampionStateRuntime.ts`
  - `orderedPositionsToAttack` aligne maintenant le ciblage des attaques de monstres dans `frontCreatureState.ts`
- original_champion_progression_runtime: package runtime synchronise et consomme par `originalChampionLeveling.ts`
- original_mirror_recruitment_runtime: package runtime synchronise et consomme par `resurrection.ts`
- original_equipment_bonuses_runtime: package runtime synchronise et consomme par `equipment.ts`, `storeChampionRuntime.ts` et `items.ts`

Reste a etendre au meme niveau de couverture consommateur:

- le reliquat de `original_ui_support_runtime.json` hors luminance, torches, palettes, reincarnation, injury-mask mapping et ordre de ciblage deja raccordes
- les regles de progression / training encore hors du bloc de growth et d'XP initiale maintenant references

## Phase 2 - Tables gameplay runtime

Continuer a transformer les zones encore exprimees en glue runtime vers des tables source-backed testables:

- equipment
  - signaux explicites wear/storage maintenant verifies jusqu'au consommateur runtime
  - les cas a `allowedSlotsMask = 0` sont maintenant reduits a `Zokathra` seul et rendus explicites
  - bonus de mastery et de stats portes par l'equipement maintenant packages depuis `Character.cpp`
  - descriptions des objets a bonus speciaux maintenant derivees de cette meme reference canonique
- progression / training / level-ups
  - multiplicateurs documentes et regles de menace recente maintenant verifies
  - frontiere exacte du cas "au moins 150 ticks sans attaque" maintenant verrouillee par test
  - seeds de competences des champions et XP initiale maintenant verifies jusqu'a `champions.ts` et `championState.ts`
  - growth des quatre branches maintenant reference et verifie jusqu'a `originalChampionLeveling.ts`
  - tirage `antiFire` de level-up maintenant consomme depuis la reference de progression au lieu d'un `2` local
  - seuil de niveau `baseExperienceStep` maintenant consomme explicitement par `skillProgression.ts` et la detection legacy de `championState.ts`
  - reste a sortir les autres regles / formules de training de plus long terme dans une reference packagee explicite
- resurrect / reincarnate
  - regles de mirror recruitment et de l'autel `VI` maintenant referencees et verifiees jusqu'aux consommateurs runtime
- consommation / regles d'objet
  - faux shims runtime legacy `Misc 7/40/41` retires des contenants d'eau actifs et de la persistance
  - consommation directe et son `swallowing` maintenant eux aussi bornes par `original_item_rules_runtime.json`
  - slots d'equipement, poches et sémantique consumable maintenant raccroches a `original_item_rules_runtime.json`
- formules de magie secondaires encore localement derivees
- regles de defense / mitigation encore codees sans table source unique
- ordre de drop des possessions a la mort
  - maintenant source-backed via `originalAtari.i562.dropOrder -> game_db_items.json -> items.ts -> deathDrops.ts`
  - verrouille par audit de package, verifications consommateur et test de comportement
- bloc de support `i562`
  - `underscoreCharacterString`, `renameChampionInputCharacterString` et `reincarnateSpecialCharacters` preservés jusqu'au slice runtime `game_db_items.json`
  - exposes au runtime via `items.ts` pour eviter toute nouvelle perte silencieuse sur ce sous-bloc
  - `woundDefenseFactors` n'utilise plus de fallback local arbitraire; le runtime part maintenant directement de la table packagee

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
  - luminance des sorts et torches maintenant source-backed
  - paliers de palette maintenant consommes explicitement par le calcul de lumiere de scene
  - mapping des zones de blessure maintenant source-backed via `creatureInjuryMasks`
  - ordre de ciblage des attaques maintenant aligne sur `DetermineAttackOrder / Byte586`
- support UI / panneaux `0696` quand ils pilotent encore des heuristiques visibles
- derniers blocs encore peu references cote consommateurs:
  - le reste de `original_ui_support_runtime.json` hors luminance / torches / palettes / reincarnation / injury-mask mapping / ordre de ciblage deja raccordes
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

## Reste a faire prioritaire

Pour pouvoir dire "fondations fidelite vraiment solides", le reliquat utile est maintenant:

- finir la couverture consommateur du reliquat de `original_ui_support_runtime.json`
- sortir le long tail des regles de training / progression encore codees localement vers des references packagees explicites
- continuer a traquer les dernieres regles de combat / defense encore exprimees en glue runtime plutot qu'en table canonique unique
- clarifier ce qui reste semantiquement non decode dans `0696` quand cela pilote encore des heuristiques visibles
- refaire ensuite une passe d'audit global pour verifier qu'il ne reste plus de constantes/fallbacks locaux masques

## Bugs a reprendre

- fontaine:
  - symptome: quand on clique sur la fontaine sans contenant, le heros selectionne ne semble pas boire
  - attendu: clic direct sur la fontaine => gain d'eau pour le heros selectionne, comme l'indique deja l'UI
  - note: ne pas patcher au cas par cas; revalider la chaine complete `front wall context -> action runtime -> patch store -> vitals`

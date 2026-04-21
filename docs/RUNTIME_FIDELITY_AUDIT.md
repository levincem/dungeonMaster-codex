# Runtime Fidelity Audit

Etat pose le `2026-04-21` et recale apres la passe `equipment bonuses`.

Ce document se limite a une question precise:

- quelles donnees extraites sont maintenant verifiees jusqu'au runtime
- quels consommateurs runtime sont verifies contre ces donnees
- quelles zones restent encore hors garantie stricte

## Garanties strictes aujourd'hui

Les domaines ci-dessous sont maintenant verifies en chaine complete `donnees extraites -> package runtime -> loader/module runtime`.

### Donjon

- `dungeon.json -> runtime_dungeon.json -> src/assets/runtime/dungeon/bootstrap.json`
- `dungeon.json -> src/assets/runtime/dungeon/maps/level-XX.json`
- `dungeon.json -> getGameMap(...)`
- `dungeon.json -> src/data/champions.ts -> championState.buildInitialChampionXP(...)`

Couverture:

- position de depart
- champions de depart
- seeds de competences des champions
- XP initiale derivee depuis ces seeds
- maps
- tiles
- objets de tiles
- champs bruts conserves au runtime

References:

- [assets/OriginalDataExtraction/audit_runtime_package_consistency.cjs](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/audit_runtime_package_consistency.cjs)
- [tests/runtime-package-consistency.test.ts](/D:/DungeonMaster-codex/tests/runtime-package-consistency.test.ts)
- [tests/runtime-dungeon-fidelity.test.ts](/D:/DungeonMaster-codex/tests/runtime-dungeon-fidelity.test.ts)
- [tests/champion-runtime-fidelity.test.ts](/D:/DungeonMaster-codex/tests/champion-runtime-fidelity.test.ts)

### Teleporteurs

- `dungeon.json` et `original_teleporters_runtime.json`
- reference canonique exportee dans `assets/OriginalDataExtraction/reference_exports/original_teleporters_runtime.json`
- preservation des champs critiques jusqu'au runtime map
- prise en compte runtime du `scope`, de la rotation et du transport d'objets

References:

- [tests/teleporter-data-pipeline.test.ts](/D:/DungeonMaster-codex/tests/teleporter-data-pipeline.test.ts)
- [tests/terrain-transport-scope.test.ts](/D:/DungeonMaster-codex/tests/terrain-transport-scope.test.ts)
- [tests/floor-item-teleporter-effects.test.ts](/D:/DungeonMaster-codex/tests/floor-item-teleporter-effects.test.ts)

### Experience / progression documentee

- `assets/OriginalDataExtraction/reference_exports/original_experience_runtime.json -> src/assets/runtime/reference/original_experience_runtime.json`
- `assets/OriginalDataExtraction/reference_exports/original_champion_progression_runtime.json -> src/assets/runtime/reference/original_champion_progression_runtime.json`
- `assets/OriginalDataExtraction/reference_exports/original_mirror_recruitment_runtime.json -> src/assets/runtime/reference/original_mirror_recruitment_runtime.json`
- verification de la synchronisation dans le package runtime
- verification que `getGameMap(level).difficulty` reste aligne avec les multiplicateurs documentes
- verification que les seuils structures de menace recente (`staleThreatTicks`, `recentThreatTicks`, liste de hidden skills) survivent bien jusqu'au runtime
- verification que `originalChampionLeveling.ts` applique bien:
  - le multiplicateur de niveau quand il est non nul
  - l'alimentation du skill parent
  - la reduction / acceleration des hidden skills selon la menace recente
  - la frontiere exacte du cas "au moins 150 ticks sans attaque"
  - les constantes de gain temporaire
  - les branches de growth `fighter`, `ninja`, `priest`, `wizard`
  - le tirage `antiFire` depuis la table de progression packagee
- verification que `resurrection.ts` et `storePartyRosterRuntime.ts` respectent les regles documentees de `resurrect`, `reincarnate` et de l'autel `VI`

Nuance importante:

- cette reference est `documented_external`, pas un dump extrait brut de l'executable
- elle est donc marquee comme reference canonique documentee, pas comme donnee originale binaire

References:

- [tests/experience-runtime-fidelity.test.ts](/D:/DungeonMaster-codex/tests/experience-runtime-fidelity.test.ts)
- [tests/progression-and-recruitment-reference-consumer-fidelity.test.ts](/D:/DungeonMaster-codex/tests/progression-and-recruitment-reference-consumer-fidelity.test.ts)
- [tests/reference-support-module-fidelity.test.ts](/D:/DungeonMaster-codex/tests/reference-support-module-fidelity.test.ts)

### References documentees packagees en runtime

Les references documentees suivantes sont maintenant synchronisees a l'identique dans `src/assets/runtime/reference`:

- `original_item_rules_runtime.json`
- `original_skills_runtime.json`
- `original_magic_runtime.json`
- `original_actions_runtime.json`
- `original_action_combos_runtime.json`
- `original_ui_support_runtime.json`
- `original_champion_progression_runtime.json`
- `original_mirror_recruitment_runtime.json`
- `original_equipment_bonuses_runtime.json`

Etat d'audit runtime package courant:

- `Top-level checks: 9/9`
- `Runtime references: 13/13`
- `Source -> runtime dungeon maps: 14/14`
- `Runtime dungeon maps: 14/14`
- `Runtime wall overlay maps: 14/14`

References:

- [tests/reference-support-module-fidelity.test.ts](/D:/DungeonMaster-codex/tests/reference-support-module-fidelity.test.ts)

### Game DB package runtime

- `game_db.json -> src/assets/runtime/db/game_db.json`
- `game_db.json -> src/assets/runtime/db/game_db_items.json`
- `game_db.json -> src/assets/runtime/db/game_db_weapon_attacks.json`
- `game_db.json -> src/assets/runtime/db/game_db_creatures.json`
- preservation explicite des champs `originalAtari.i562`, y compris `woundDefenseFactors`, `dropOrder`, `underscoreCharacterString`, `renameChampionInputCharacterString` et `reincarnateSpecialCharacters`

References:

- [assets/OriginalDataExtraction/audit_runtime_package_consistency.cjs](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/audit_runtime_package_consistency.cjs)
- [tests/game-data-module-fidelity.test.ts](/D:/DungeonMaster-codex/tests/game-data-module-fidelity.test.ts)
- [tests/reference-support-module-fidelity.test.ts](/D:/DungeonMaster-codex/tests/reference-support-module-fidelity.test.ts)

### Consommateurs runtime verifies

Ces modules runtime sont verifies contre la donnee extraite ou les slices packagees:

- `items.ts`
  - noms source-backed
  - poids
  - valeurs de nutrition
  - protections d'armure
  - `allowedSlotsMask`
  - `attackClass`
- `weaponAttacks.ts`
  - descripteurs projectiles originaux
  - attaques legales
  - resolution par `weaponIndex`
- `creatures.ts`
  - stats extraites utilisees au runtime
  - resistances
  - flags de comportement
  - portees
- `mechanisms.ts`
  - tous les sensors du donjon source
  - types
  - index
  - face
  - trigger
  - action
  - delay
  - cible
  - exigences d'objet
  - objets stockes
- `originalWallOverlayData.ts`
  - maps split d'overlays muraux
- `doors.ts`
  - definitions runtime des familles de portes
  - regles de vision
  - regles de passage des objets lances
  - choix d'asset par type de porte
- `originalItemRules.ts`
  - export runtime canonique des bits de carry, des slots derives et des regles `pouch/consumable`
  - consommateurs portes / equipement / UI maintenant raccordes a cette reference au lieu de redecoder localement les bits principaux
- `originalWallOverlays.ts`
  - priorite aux assets refaits dedies quand ils existent
  - fallback vers le BMP original exact sinon
  - liste explicite des familles encore a refaire
  - verification d'existence des assets source-backed
  - verification qu'aucun overlay extrait actuel ne retombe sur un fallback generique silencieux
- `equipment.ts`
  - verification des slots equippables contre les signaux de slots explicites de la source
  - verification des priorites de starter auto-equip contre ces memes signaux
  - verification que les familles de slots wear/storage explicites ne se perdent pas entre source et runtime
  - verification explicite du seul cas `allowedSlotsMask = 0` encore present: `Zokathra`
  - familles quiver / pouch / wear maintenant derivees via `originalItemRules.ts`
- `deathDrops.ts`
  - ordre de drop des possessions aligne sur `originalAtari.i562.dropOrder`
  - verification de la preservation du champ jusqu'a `game_db_items.json`, `items.ts` puis au comportement runtime
- `items.ts`
  - preservation runtime de l'ensemble du sous-bloc `originalAtari.i562` encore exploitable
  - exposition source-backed des tableaux de support de reincarnation / renommage au runtime
  - `woundDefenseFactors` initialises depuis la table packagee, sans fallback local arbitraire
- `originalDoorPanelMetrics.ts`
  - proportions du bandeau de porte a bouton
  - dimensions du bouton de porte
  - ratios derives depuis `graphics_panels_0696.json`
- `originalStairPanelMetrics.ts`
  - proportions frontales des decals d'escaliers
  - ratios derives depuis `graphics_db.json`
- `runes.ts`
  - ordre des 24 runes
  - `manaFactor`
  - catalogue runtime des 25 sorts canoniques sans signatures speculatives
  - metadonnees de cast source-backed jusqu'au consommateur runtime
  - alignement des constantes de puissance et de la formule de cout de mana avec `original_magic_runtime.json`
- `originalSpells.ts`
  - descripteurs `i560` des 25 sorts
  - `spellIDHex`
  - signatures
  - skill requis
  - type
  - subtype
  - recovery ticks
- `originalUiSupport.ts`
  - export runtime des seuils de palette, de la table `luminousPowerToLuminance`, de `torchTypePerChargesCount`, des masques d'injury et des constantes de reincarnation
- `storeChampionStateRuntime.ts`
  - traduction des zones de blessure monstres vers les slots de wound maintenant alignee sur `creatureInjuryMasks` via `originalUiSupport.ts`
  - `hands` reste une extension runtime explicite, car elle n'apparait pas dans la table `item 562`
- `frontCreatureState.ts`
  - priorites de ciblage des attaques de monstres maintenant derivees de la table originale `Byte586 / DetermineAttackOrder`
  - permutations d'attaque packagees via `original_ui_support_runtime.json`
  - consommation runtime verifiee sur les quatre directions d'approche
- `originalSpells.ts`
  - contributions de lumiere des sorts calees sur `luminousPowerToLuminance` au lieu d'un ratio local heuristique
- `itemImages.ts`
  - etats visuels des torches cales sur `torchTypePerChargesCount` au lieu d'un decoupage runtime arbitraire en tiers
- `computeLightLevel(...)`
  - luminance des torches calculee depuis les charges restantes et la table canonique `luminousPowerToLuminance`
  - quantification de lumiere de scene maintenant alignee sur `paletteBrightnessThresholds`, au lieu d'un niveau continu purement local
- `champions.ts`
  - preservation des seeds `skills` extraits pour les 24 champions
  - preservation des stats coeur du roster jusqu'au consommateur runtime
- `championState.ts`
  - calcul de l'XP initiale aligne sur les seeds de competences extraits
  - detection de l'ancien schema `basic-only` maintenue distincte du schema source-backed a hidden skills
- `originalUiSupport.ts` et `items.ts`
  - verification croisee des constantes de reincarnation du support UI et du bloc `i562`
  - coherence explicite des caracteres `_`, `space` et de `reincarnateSpecialCharacters`
- `originalChampionProgression.ts`
  - export runtime des constantes documentees de progression, de growth et de temporary XP
- `originalMirrorRecruitment.ts`
  - export runtime des regles documentees de `resurrect`, `reincarnate` et de l'autel `VI`
- `originalChampionLeveling.ts`
  - consommation explicite des references de progression packagees
  - branches de growth testees contre une reference runtime documentee
  - seuils de menace recente des hidden skills maintenant consommes depuis `original_experience_runtime.json`
  - frontiere "at least 150 ticks" verrouillee contre la reference documentee
  - tirage `antiFire` de level-up maintenant aligne sur `antiFireIncreaseMaxExclusive`
- `originalEquipmentBonuses.ts`
  - bonus de mastery portes / talismans / Firestaff maintenant packages dans une reference canonique issue de `Character.cpp`
  - bonus de stats portes / talismans / armes maintenant packages dans cette meme reference
  - penalite de chance des objets maudits alignee sur la branche source `AdjustStatsForItemCarried`
- `equipment.ts`
  - bonus de stats de l'equipement maintenant derives de `original_equipment_bonuses_runtime.json`
- `storeChampionRuntime.ts`
  - bonus de mastery d'equipement maintenant derives de `original_equipment_bonuses_runtime.json`
- `items.ts`
  - descriptions des bijoux / talismans a bonus maintenant derivees de la reference canonique d'equipement, pour eviter tout drift UI/runtime
  - faux contenants d'eau legacy `Misc 7 / 40 / 41` retires du runtime actif
- `waterContainers.ts`, `itemDisplay.ts`, `spellPotionCreation.ts` et `persistence.ts`
  - runtime actif, affichage, creation de potions et chargement des saves maintenant alignes sur les seuls ids canoniques de flasque / outre
  - les vieux placeholders `Misc 40 / 41` ne sont plus reintroduits silencieusement par la persistance
- `ChampionSheet.tsx`
  - affordance "use" et drop bouche maintenant bornee par la semantique source-backed `Consumable`, pas seulement par un filtrage de categories local
- `useItemConsumption.ts` et `storeItemRuntime.ts`
  - consommation directe et son `swallowing` maintenant bornes par le bit canonique `Consumable`, pas seulement par les categories et metadonnees locales
- `originalExperience.ts`
  - export runtime explicite des multiplicateurs documentes et des seuils structures de menace recente
- `skillProgression.ts`
  - `baseExperienceStep` des seuils de niveau maintenant consomme depuis `original_champion_progression_runtime.json`
- `championState.ts`
  - detection legacy `basic-only` maintenant alignee sur ce meme `baseExperienceStep` documente
- `resurrection.ts`
  - consommation explicite des references de recrutement / reincarnation packagees
- `storePartyRosterRuntime.ts`
  - distinction `resurrect` vs `reincarnate` testee contre la reference runtime documentee
- `skillProgression.ts`
  - mapping `original skill index -> runtime skill key`
  - mapping `hidden skill -> parent basic skill`
  - listes `basic`, `hidden` et `all` derivees directement de `original_skills_runtime.json`
  - verification contre `original_skills_runtime.json`
- `doors.ts`
  - verification des regles de passage des objets "pouch" et de l'exception des cles
  - verification contre `original_item_rules_runtime.json`
- slices d'actions / combos runtime
  - `original_actions_runtime.json -> src/assets/runtime/db/game_db_weapon_attacks.json`
  - `original_action_combos_runtime.json -> src/assets/runtime/db/game_db_weapon_attacks.json`
  - variantes documentees et sentinelles de combos vides rendues explicites dans les tests
- `storeAttackFrontRuntime.ts`
  - consommation effective de `skillNumber` et `experienceForAttacking` verifiee sur les chemins projectile et utilitaire
  - verification que les champs source-backed d'action (`defenseModifier`, `staminaCost`, `disableTime`) ne se perdent pas avant `getWeaponAttackOptions(...)`
- `gameDbData.ts`
  - reinitialisation explicite du preload de test pour eviter les faux positifs / faux negatifs d'ordre d'execution sur les slices `game_db`

References:

- [tests/game-data-module-fidelity.test.ts](/D:/DungeonMaster-codex/tests/game-data-module-fidelity.test.ts)
- [tests/reference-support-module-fidelity.test.ts](/D:/DungeonMaster-codex/tests/reference-support-module-fidelity.test.ts)
- [tests/mechanisms-runtime-fidelity.test.ts](/D:/DungeonMaster-codex/tests/mechanisms-runtime-fidelity.test.ts)
- [tests/door-runtime-fidelity.test.ts](/D:/DungeonMaster-codex/tests/door-runtime-fidelity.test.ts)
- [tests/door-panel-metrics-fidelity.test.ts](/D:/DungeonMaster-codex/tests/door-panel-metrics-fidelity.test.ts)
- [tests/stair-panel-metrics-fidelity.test.ts](/D:/DungeonMaster-codex/tests/stair-panel-metrics-fidelity.test.ts)
- [tests/spell-data-runtime-fidelity.test.ts](/D:/DungeonMaster-codex/tests/spell-data-runtime-fidelity.test.ts)
- [tests/wall-overlay-visual-fidelity.test.ts](/D:/DungeonMaster-codex/tests/wall-overlay-visual-fidelity.test.ts)
- [tests/wall-overlay-runtime-consumer-fidelity.test.ts](/D:/DungeonMaster-codex/tests/wall-overlay-runtime-consumer-fidelity.test.ts)
- [tests/equipment-runtime-fidelity.test.ts](/D:/DungeonMaster-codex/tests/equipment-runtime-fidelity.test.ts)
- [tests/experience-runtime-fidelity.test.ts](/D:/DungeonMaster-codex/tests/experience-runtime-fidelity.test.ts)
- [tests/documented-runtime-reference-consumer-fidelity.test.ts](/D:/DungeonMaster-codex/tests/documented-runtime-reference-consumer-fidelity.test.ts)
- [tests/attack-runtime-fidelity.test.ts](/D:/DungeonMaster-codex/tests/attack-runtime-fidelity.test.ts)
- [tests/i562-runtime-consumer-fidelity.test.ts](/D:/DungeonMaster-codex/tests/i562-runtime-consumer-fidelity.test.ts)
- [tests/death-drops.test.ts](/D:/DungeonMaster-codex/tests/death-drops.test.ts)
- [tests/ui-support-runtime-fidelity.test.ts](/D:/DungeonMaster-codex/tests/ui-support-runtime-fidelity.test.ts)
- [tests/front-creature-state.test.ts](/D:/DungeonMaster-codex/tests/front-creature-state.test.ts)
- [tests/champion-runtime-fidelity.test.ts](/D:/DungeonMaster-codex/tests/champion-runtime-fidelity.test.ts)
- [tests/progression-and-recruitment-reference-consumer-fidelity.test.ts](/D:/DungeonMaster-codex/tests/progression-and-recruitment-reference-consumer-fidelity.test.ts)
- [WALL_OVERLAY_REMAKE_TODO.md](/D:/DungeonMaster-codex/docs/WALL_OVERLAY_REMAKE_TODO.md)

## Resultat actuel

Verification executee:

- audit package runtime vert
- suites ciblees vertes: `697 / 697`
- suites ciblees vertes: `698 / 698`
- suites ciblees vertes: `709 / 709`
- suites ciblees vertes: `710 / 710`
- build vert

Resume courant de l'audit package:

- `Top-level checks: 9/9`
- `Runtime references: 13/13`
- `Source -> runtime dungeon maps: 14/14`
- `Runtime dungeon maps: 14/14`
- `Runtime wall overlay maps: 14/14`

Rapport genere:

- [assets/OriginalDataExtraction/output/runtime_package_consistency_audit.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/runtime_package_consistency_audit.json)

## Zones encore hors garantie stricte

Je ne marque pas ces domaines comme "fideles a l'original" tant qu'ils n'ont pas le meme niveau de preuve.

### Rendu / presentation encore partiellement locaux

- rendu des portes
- mapping complet des decors muraux
- certaines decisions d'asset selection ou de composition visuelle

Nuance apres ce pass:

- les familles de portes et de nombreux ornements muraux utilisent maintenant des assets source-backed testes
- les proportions du bandeau bouton des portes ne reposent plus sur des constantes arbitraires
- les decals d'escaliers n'utilisent plus le preset plein mur par defaut
- les overlays muraux extraits actuellement packages ne passent plus par un fallback decal generique silencieux
- le catalogue runtime des sorts n'accepte plus de signatures speculatives hors des 25 sorts canoniques packages
- ce qui reste surtout hors garantie stricte concerne la composition visuelle complete, pas l'identite de base de ces familles

### Regles encore documentees ou derivees, mais pas toutes packagees comme tables runtime source-backed

- certaines couches de training / progression / level-up restent encore codees sans reference packagee dediee
- les references runtime dediees existent maintenant pour la progression champion et le mirror recruitment
- certaines regles de combat, de defense ou de consommation restent encore exprimees par glue runtime plutot que par table source unique
- parties du bloc `0696` encore non decodees semantiquement a 100%
- certains objets a `allowedSlotsMask = 0` restent encore interpretes par des fallbacks runtime de portage / inventaire
  - liste actuelle: [ZERO_SLOT_ITEMS.md](/D:/DungeonMaster-codex/docs/ZERO_SLOT_ITEMS.md)
  - apres ce pass, la liste se reduit a `Misc 51 / Zokathra`
- `original_ui_support_runtime.json` est maintenant package et verifie a l'octet pres, avec consommateurs explicites pour la luminance des sorts, les torches, les paliers de palette, la reincarnation et l'ordre de ciblage des attaques
- les seeds de champions, l'XP initiale, les branches de growth et les regles de mirror recruitment sont maintenant verrouilles jusqu'aux consommateurs runtime
- ce qui reste encore gris dans cette zone concerne surtout la validation long-play et d'eventuelles nuances de version
- `creatureInjuryMasks` n'est plus seulement package: il aligne maintenant explicitement la traduction `zones de blessure -> wound slots`, mais pas encore toute la logique de selection des patterns de coup

### Conclusion honnete

On peut maintenant affirmer sans tricher:

- le pipeline de donnees critique du donjon et des principales tables gameplay packagees est audite de bout en bout
- les oublis silencieux de champs dans ce pipeline sont maintenant testes explicitement
- les domaines non encore garantis sont identifies comme tels, au lieu d'etre laisses dans une zone grise

On ne peut pas encore affirmer honnetement:

- que tout le projet runtime est 100% identique au jeu original sur tous les domaines
- que chaque couche de rendu et chaque regle tardive dispose deja d'une table source-backed complete

# Fidelity Remaining Matrix

Etat pose le `2026-04-17`.

Ce document verifie, a partir du code actuel et des exports actifs, ce qui reste vraiment ouvert avant un claim `100% extraction` ou `100% moteur original`.

## Conclusion executive

Le projet est tres proche d'un etat `quasi complet`, mais pas encore `100%`.

Le vrai reste a faire se concentre sur:

1. un verrou extraction/semantique encore ouvert: `0696.RAW1`
2. quelques couches runtime encore hybrides ou avec fallback
3. une zone structurelle encore emulee sans representation FTL complete: groupes actifs / generateurs
4. la validation en jeu des derniers cas rares et de fin de partie

## Complement d'audit code/runtime - 2026-04-17

La relecture finale du code runtime n'a pas fait remonter de nouvelle incoherence gameplay centrale cachee.

Les conclusions les plus utiles de cette passe sont:

- les blocs sorts `duration / light / shield / projectile impact` passent maintenant bien par des helpers source-backed dans `spellRuntime.ts` et `originalSpells.ts`
- les anciens suffixes `Approx` du gameplay central ont maintenant ete renommes dans `store.ts`; les rares `Approx` encore visibles concernent surtout les generateurs et leur semantique encore structurellement emulee
- le bruit restant vient surtout de trois familles:
  - structure exacte `GROUP/ACTIVE_GROUP`
  - couches data hybrides `items / equipment / creatures / itemImages`
  - presentation / fallback art
- un reliquat trompeur a aussi ete nettoye pendant cette passe:
  - `getOriginalShieldProtectionApprox(...)` n'etait plus utilise par le runtime et a ete supprime

## 1. Extraction: ce qui est effectivement clos

### Monde canonique DM

Le contenu canonique du monde est tres solidement ferme:

- items canoniques: `300 / 300`
- inscriptions: `61 / 61`
- locks: `65 / 65`
- creatures: `225 / 225`
- generators: `50 / 50`

Nuance utile:

- l'audit canonique suit `50` generateurs places dans le monde de reference
- l'export brut et le runtime recales suivent `54` generateurs de sol `type 6`
- ce n'est pas une contradiction, mais une difference de perimetre entre audit canonique et export brut

Source:

- [assets/OriginalDataExtraction/output/canonical_world_content_audit.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/canonical_world_content_audit.json)

### Audit items

L'audit items ne laisse plus de mismatch non explique:

- exacts: `254`
- expliques: `46`
- non resolus: `0`

Les `46` cas restants sont tous classes:

- `wall_adjacent_or_alcove`
- `nearby_reference_offset`

Source:

- [assets/OriginalDataExtraction/output/canonical_item_audit.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/canonical_item_audit.json)

### Tables packagees comparees

La comparaison entre reference Atari packagee et base runtime active est actuellement a `0` difference sur les domaines compares:

- creatures: `0`
- foods: `0`
- weapons: `0`
- clothing: `0`
- spells: `25` compares, `0` difference

Source:

- [assets/OriginalDataExtraction/output/atari_game_db_comparison.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/atari_game_db_comparison.json)

## 2. Extraction: ce qui bloque encore le `100%`

### `0696.RAW1`

Le point principal encore ouvert reste bien `0696`.

Ce qui est prouve:

- le bloc est extrait
- sa structure est exportee
- plusieurs sous-zones sont classees `ui/layout`, `stairs`, `floor-item placement`, `front panels`
- il ne ressemble pas a un bloc Atari `I559` contigu

Ce qui n'est pas encore prouve:

- le sens exact de tous les opcodes
- la semantique exacte de toutes les familles de tuples
- la nature exacte de tout le reliquat helper/template
- si le bloc est purement composition/layout ou s'il porte encore des metadata runtime utiles

Sources:

- [docs/ORIGINAL_DATA_AUDIT.md](/D:/DungeonMaster-codex/docs/ORIGINAL_DATA_AUDIT.md)
- [assets/OriginalDataExtraction/output/graphics_layout_0696_summary.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/graphics_layout_0696_summary.json)
- [assets/OriginalDataExtraction/output/raw_0696_analysis.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/raw_0696_analysis.json)

### Mecanismes

Les mecanismes sont exploitables et tres utiles, mais pas encore une extraction byte-pure de bout en bout:

- des correspondances de requirements restent reconstruites
- les labels `kind` restent des interpretations de haut niveau

Source:

- [docs/EXTRACTION_AUDIT.md](/D:/DungeonMaster-codex/docs/EXTRACTION_AUDIT.md)
- [src/data/mechanisms.ts](/D:/DungeonMaster-codex/src/data/mechanisms.ts)

## 3. Runtime: ce qui est mieux que certains audits ne le disent encore

Certains documents anciens parlent encore de `manual gameplay numbers` de maniere un peu trop large.
Dans le code actuel, c'est deja plus source-backed que cela.

### `src/data/items.ts`

Le fichier reste hybride, mais une partie importante des valeurs vient bien maintenant des donnees extraites:

- poids d'armes via `I559_WEAPONS_BY_INDEX`
- damage / attack class d'armes via les references extraites
- poids / armor / sharpDefense / shield flag d'armures via `I559_CLOTHS_BY_INDEX`
- nutrition des aliments via `I559_FOOD_VALUES`
- allowed slot masks et attack classes exposes via `getSourceItemAllowedSlotsMask` et `getSourceItemAttackClass`

Ce qui reste encore manuel ou derive:

- base tables `OFFICIAL_*` servant encore de squelette/fallback
- semantique des potions runtime (`effect`, `drinkable`, `throwable`)
- aliases de noms et compatibilite, maintenant isoles dans `itemRuntimeCompatibility.ts`

Source:

- [src/data/items.ts](/D:/DungeonMaster-codex/src/data/items.ts)
- [src/data/itemRuntimeCompatibility.ts](/D:/DungeonMaster-codex/src/data/itemRuntimeCompatibility.ts)

### `src/data/creatures.ts`

Le fichier est lui aussi plus source-backed que certaines notes anciennes ne le laissent entendre:

- stats principales lues depuis le dataset original package
- `rawAttack` et `poisonAttack` reconnectes a `I559`
- fixed drops reconstruits a partir d'une table originale de droppings

Ce qui reste encore manuel:

- `ATTACK_TYPE_OVERRIDES`
- la reconstruction des fixed drops reste codee a la main a partir de valeurs extraites plutot qu'importee comme table brute structuree

Source:

- [src/data/creatures.ts](/D:/DungeonMaster-codex/src/data/creatures.ts)

### `src/data/equipment.ts`

La logique essaye d'abord les masques extraits:

- weapons
- armor
- misc
- potions
- scrolls

Mais il reste bien des fallbacks actifs:

- `mapFallbackArmorSlots`
- `mapFallbackMiscSlots`

Donc:

- la couche est deja largement recalee
- mais pas encore `100% source-only`

Source:

- [src/data/equipment.ts](/D:/DungeonMaster-codex/src/data/equipment.ts)

## 4. Runtime: ce qui reste vraiment approxime

### Generateurs

Le cas le plus clairement encore approxime dans le code actif est celui des groupes actifs/generateurs:

- `getApproximateActiveGroupCountOnLevel`
- `canReserveApproximateGeneratorGroupOnLevel`
- `canMaterializeReservedGeneratorSpawnOnLevel`

Le runtime suit l'esprit FTL, mais pas encore la structure interne complete `GROUP/ACTIVE_GROUP`.

Ce qui a deja ete resserre sur ce bloc:

- reservations `new group` vs `reserved retry` distinguees
- reservations differees distinctes d'un meme generateur non plus compressees artificiellement dans une seule entree pending

Source:

- [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts)

### Trace de reprise: ce qui reste ouvert

Pour eviter de perdre les derniers chantiers dans les tours de correction, voici la liste de suivi encore utile.

#### Encore vraiment ouvertes

Il ne reste plus d'approximation gameplay centrale suffixee `Approx` dans `store.ts`.

Le reste moteur ouvert est maintenant surtout:

- la structure interne des groupes actifs / generateurs, surtout la frontiere `active / dormant`
- quelques couches hybrides ou fallbacks runtime
- la validation en jeu des cas rares et de fin de partie

#### Renommage maintenance deja passe

Les anciens wrappers gameplay historiquement suffixes `Approx` ont ete renommes cote `store` pour refleter leur vrai role runtime ou original. Exemples:

- `adjustAttackByAttributeOriginal`, `scaleAttackValueOriginal`, `getPsychicAdjustedAttackOriginal`
- `applyPoisonCharacterOriginal`, `healChampionWoundsOriginal`
- `computeOriginalQuicknessRuntime`, `computeChampionWoundDefenseOriginal`
- `buildChampionSkillExperiencePatchOriginal`
- `resolveChampionIncomingAttackRuntime`, `applyPartyWideIncomingAttackRuntime`
- `getChampionAdjustedAttackFromResistanceOriginal`, `getActiveShieldDefenseOriginal`
- `getMonsterMoveDelaySecondsOriginal`, `getMonsterAttackDelaySecondsOriginal`

#### Wrappers d'orchestration encore presents dans le store

Ces noms ne signalent plus un trou de fidelite, mais un role de cablage/runtime qui meriterait encore d'etre sorti ou simplifie plus tard:

- `computePartyMovementCooldownSecondsRuntime`
- `advanceSurvivalTimeRuntime`
- `buildRegenTickPatch`
- `isPartyRestedRuntime`
- `buildCombatTickPatch`
- `buildEndgameFrameRuntimePatch`
- `buildSleepFrameRuntimePatch`

### Combat / degats / resistances

Le coeur combat du `store` a maintenant des noms plus honnetes:

- les formules source-backed deleguent a des helpers `Original`
- les points d'entree runtime restants sont nommes `Runtime` ou `Patch`

Le vrai travail restant sur cette zone n'est donc plus un renommage d'urgence, mais la poursuite de l'extraction hors `store` des derniers bouts de cablage.

Source:

- [src/engine/store.ts](/D:/DungeonMaster-codex/src/engine/store.ts)

### IA / timings / endgame

Les audits restent coherents avec le code:

- IA creatures encore reconstructive plutot que strictement emulatee
- fin de jeu mieux recalee mais encore a valider en run complete
- generateurs, `Lord Chaos`, `teleporters`, `pits`, `countdowns` encore a verifier dans les cas rares

Source:

- [docs/RUNTIME_ALIGNMENT_AUDIT.md](/D:/DungeonMaster-codex/docs/RUNTIME_ALIGNMENT_AUDIT.md)

## 5. Runtime: petites zones encore hybrides

### Sorts projectiles

Le pipeline de lancement privilegie la reference originale:

- `getOriginalSpellProjectileLaunchProfile(...) ?? getSpellProjectileLaunchProfile(...)`

Donc:

- le coeur est source-backed d'abord
- mais le fallback de lancement existe encore
- le `visualScale` utilise maintenant aussi la reference originale en priorite via `getOriginalSpellPowerLevel(...) ?? 1`

Source:

- [src/engine/systems/spellProjectileCasting.ts](/D:/DungeonMaster-codex/src/engine/systems/spellProjectileCasting.ts)

### Rendu / placeholders

Il reste encore des fallbacks visuels dans le rendu:

- textures safe/fallback
- aliases d'images d'items
- placeholders de portes et d'overlays a finir

Ces points ne bloquent pas le gameplay source-backed, mais ils bloquent un claim `100% original presentation`.

Sources:

- [src/components/Dungeon/Cell.tsx](/D:/DungeonMaster-codex/src/components/Dungeon/Cell.tsx)
- [src/components/Dungeon/DungeonScene.tsx](/D:/DungeonMaster-codex/src/components/Dungeon/DungeonScene.tsx)
- [src/data/itemImages.ts](/D:/DungeonMaster-codex/src/data/itemImages.ts)

## 6. Ce qu'on peut dire honnetement aujourd'hui

Formulation solide:

`Le contenu canonique du donjon DM et les principales tables gameplay utiles sont extraits, croises et packages de facon tres fiable.`

`Le moteur est maintenant largement source-backed, mais il reste quelques zones hybrides, une zone structurelle encore approximative autour des groupes actifs / generateurs, et un dernier verrou de reverse-engineering semantique autour de 0696.RAW1.`

## 7. Ce qu'il faut fermer pour un vrai `100%`

### Pour `100% extraction`

Il faut au minimum:

1. fermer `0696.RAW1` semantiquement
2. remplacer les derniers exports/bridges encore partiellement interpretatifs
3. pouvoir decrire ce qui vient du PC brut, de l'Atari decode, et du source reverse-engineered sans angle mort residuel

### Pour `100% moteur original`

Il faut au minimum:

1. supprimer ou borner plus strictement les fallbacks runtime encore actifs
2. fermer la derniere zone structurelle encore emulee de facon approximative autour des groupes actifs / generateurs
3. valider en jeu les cas rares et la fin complete
4. decider si les divergences volontaires par rapport au binaire original restent assumees

Si ces divergences volontaires restent:

- ne pas dire `100% comme le binaire original`
- preferer `fidelite source-backed tres elevee`

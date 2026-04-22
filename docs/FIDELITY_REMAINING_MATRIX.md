# Fidelity Remaining Matrix

Etat recale le `2026-04-22`.

Ce document ne sert plus d'historique long. Il repond a une seule question:

`qu'est-ce qui empeche encore de dire extraction complete et moteur totalement recale ?`

## Resume court

Le projet est tres avance, mais le reliquat fidelite est maintenant plus borne:

1. une petite couche de compatibilite / interpretation encore explicite et testee
2. de la validation gameplay a finir sur les cas rares, transitions de niveau et endgame
3. quelques ecarts de presentation / placeholders

Le gros bloc `generateurs / groupes actifs` n'est plus un chantier code ouvert.
Il est ferme cote implementation et ne reste plus qu'a le valider en playtest cible.

## Ce qui est ferme

### Monde canonique

Les audits canoniques du contenu DM sont fermes de facon solide:

- items canoniques: `300 / 300`
- inscriptions: `61 / 61`
- locks: `65 / 65`
- creatures: `225 / 225`
- generateurs: `50 / 50`

Source:

- [canonical_world_content_audit.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/canonical_world_content_audit.json)

### Audit items

L'audit items ne laisse plus de mismatch non explique:

- exacts: `254`
- expliques: `46`
- non resolus: `0`

Source:

- [canonical_item_audit.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/canonical_item_audit.json)

### Tables packagees comparees

La comparaison entre reference Atari packagee et base runtime active est propre sur les domaines compares:

- creatures: `0` difference
- foods: `0`
- weapons: `0`
- clothing: `0`
- spells: `25` compares, `0` difference

Source:

- [atari_game_db_comparison.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/atari_game_db_comparison.json)

### Generateurs / groupes actifs

Ce point n'est plus a classer comme "approximation structurelle ouverte" dans le code courant.

Ce qui est maintenant ferme:

- separation explicite `active` / `dormant`
- limite `ACTIVE_GROUP 60/5` appliquee seulement a la map courante de la party
- groupe genere fige avant rematerialisation differree
- retries `move later` sans reroll du groupe
- faux capteurs `COMPASS` sur les floor sensors `type 3` corriges globalement

Ce qui reste:

- playtest cible `teleport / pit / changement de niveau / repop tardif / retour sur niveau quitte`

Sources:

- [generatorCapacity.ts](/D:/DungeonMaster-codex/src/engine/systems/generatorCapacity.ts)
- [generatedCreatureGroups.ts](/D:/DungeonMaster-codex/src/engine/systems/generatedCreatureGroups.ts)
- [pendingWorldEvents.ts](/D:/DungeonMaster-codex/src/engine/systems/pendingWorldEvents.ts)
- [sensorGeneratorRuntime.ts](/D:/DungeonMaster-codex/src/engine/systems/sensorGeneratorRuntime.ts)
- [movementSensors.ts](/D:/DungeonMaster-codex/src/engine/systems/movementSensors.ts)

### `0696.RAW1`

Ce point ne doit plus etre classe comme verrou principal ouvert.

Ce qui est maintenant ferme:

- `0696` est borne comme conteneur post-Atari de composition/layout
- il ne doit plus etre interprete comme candidat principal pour une table gameplay `I559`
- ses grandes familles sont identifiees:
  - layout UI
  - helpers/templates internes
  - composites/panneaux de rendu donjon
  - placements d'items au sol

Ce qui reste seulement provisoire:

- le nom exact de certains helpers
- le nom moteur exact de certains opcodes

Sources:

- [RAW_0696_VERDICT.md](/D:/DungeonMaster-codex/docs/RAW_0696_VERDICT.md)
- [graphics_layout_0696_summary.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/graphics_layout_0696_summary.json)
- [graphics_helper_0696.json](/D:/DungeonMaster-codex/public/graphics_helper_0696.json)
- [graphics_panels_0696.json](/D:/DungeonMaster-codex/public/graphics_panels_0696.json)

## Ce qui reste vraiment ouvert

### 1. Couche de compatibilite / interpretation encore explicite

Le moteur n'a plus de gros bloc fidelity "gris". Le reliquat code est maintenant borne, explicite et sous test.

Ce qu'il reste vraiment:

- [items.ts](/D:/DungeonMaster-codex/src/data/items.ts)
  - reste une couche d'agregation runtime pratique
  - elle garde encore quelques noms canoniques, descriptions et fixups de compatibilite visibles
  - ce n'est plus une zone opaque de gameplay
- [equipment.ts](/D:/DungeonMaster-codex/src/data/equipment.ts)
  - les semantiques de slots sont maintenant source-backed sur tous les cas avec signal extrait
  - l'exception zero-slot restante est explicite et unique: `Zokathra`
- [creatures.ts](/D:/DungeonMaster-codex/src/data/creatures.ts)
  - les champs coeur utilises au runtime sont packages depuis `I559`
  - le seul reliquat volontairement interprete encore utile est la traduction runtime des `attackTypes`
  - cette interpretation est maintenant bornee par une table explicite `ORIGINAL_CREATURE_ATTACK_TYPE_INTERPRETATIONS`

Conclusion pratique:

- on n'a plus ici un chantier de rebranchement massif
- on a surtout un petit reliquat de compatibilite assumee, explicite et verifiee
- ce point ne bloque plus le socle fidelite; il bloque seulement un claim litteral `100% source-only`

### 2. Validation gameplay des cas rares

Le code a beaucoup converge. Ce qu'il manque encore, ce n'est pas tant de la reimplementation que de la verification.

Zones a rejouer:

- transitions de niveau et repops tardifs
- teleporters / pits
- `Zo Kath Ra`, `Firestaff`, `Fuse`, victoire complete
- quelques mecanismes tardifs et rares

Sources:

- [NEXT_PHASE_PLAN.md](/D:/DungeonMaster-codex/docs/NEXT_PHASE_PLAN.md)
- [RUNTIME_ALIGNMENT_AUDIT.md](/D:/DungeonMaster-codex/docs/RUNTIME_ALIGNMENT_AUDIT.md)

### 3. Presentation / placeholders

Il reste des ecarts visuels qui ne remettent pas en cause la logique gameplay, mais empechent un claim `presentation originale complete`.

Exemples:

- aliases / fallbacks d'images d'items
- derniers ecarts de presentation a polir selon retour playtest, plutot que des placeholders generiques encore actifs

Nuance recente:

- plusieurs aliases redondants de potions canoniques ont ete supprimes
- les aliases redondants de `The Firestaff (Complete)` ont aussi ete retires
- plusieurs fallbacks legacy d'images (`weapons`, `armor`, `misc`, `container`) ont encore ete retires quand le nom canonique ou un alias suffisait deja
- les labels runtime/UI residuels ont ete reroutes dans l'i18n, avec manuel francais dedie et detection locale navigateur
- le Hall est maintenant recroise sur tout le roster pour les noms d'items complets, y compris les armures
- les starters Hall problematiques sont maintenant recales sur les noms DM attendus (`Barbarian Hide`, `Robe (Body)`, `Robe (Legs)`)
- les anciens shims d'armure Hall ont ete retires de la couche runtime; il reste surtout un petit reliquat de vieux ids d'images

Sources:

- [itemImages.ts](/D:/DungeonMaster-codex/src/data/itemImages.ts)
- [Cell.tsx](/D:/DungeonMaster-codex/src/components/Dungeon/Cell.tsx)
- [DungeonScene.tsx](/D:/DungeonMaster-codex/src/components/Dungeon/DungeonScene.tsx)

## Formulation honnete actuelle

Formulation solide aujourd'hui:

`Le contenu canonique du donjon DM et les principales tables gameplay utiles sont extraits, croises et packages de facon tres fiable.`

`Le moteur est maintenant largement source-backed. Les gros chantiers structurels cote generateurs / groupes actifs et le bornage semantique de 0696.RAW1 sont fermes. Les stats coeur des creatures ne reposent plus sur une vieille table normalisee. Le reliquat code est maintenant surtout borne a quelques compatibilites explicites, puis a la validation finale des cas rares et a quelques ecarts de presentation.`

## Definition de fini

### Pour pouvoir dire `100% extraction`

Il faut au minimum:

1. borner ou remplacer les derniers exports encore interpretatifs
2. pouvoir expliquer sans angle mort ce qui vient du brut, du decode Atari et du reverse-engineering
3. garder separe ce qui est extraction canoniquement fermee et ce qui reste derive/fallback runtime

### Pour pouvoir dire `100% moteur original`

Il faut au minimum:

1. fermer ou borner les derniers fallbacks runtime
2. valider en jeu les transitions, cas rares et endgame
3. decider clairement quelles divergences volontaires restent assumees

Si des divergences volontaires restent, il faut preferer:

`fidelite source-backed tres elevee`

plutot que:

`identique au binaire original`

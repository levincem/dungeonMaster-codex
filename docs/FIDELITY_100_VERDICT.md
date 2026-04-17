# Fidelity 100 Verdict

Etat pose le `2026-04-17`.

But de ce document:

- separer clairement `extraction presque complete` de `fidelite runtime a 100 pourcent`
- dire ce qu'on peut affirmer honnetement aujourd'hui
- lister les verrous restants avant un vrai claim `100% / 100%`

## Verdict court

On ne peut pas encore affirmer honnetement:

- `l'extraction est a 100 pourcent`
- `le moteur se comporte a 100 pourcent comme l'original`
- `le tout est documente et valide a 100 pourcent`

On peut en revanche affirmer:

- le contenu canonique du monde DM est extrait et audite de facon tres solide
- les grandes tables source-backed utiles au gameplay sont identifiees, decodees et en grande partie branchees
- les ecarts restants sont maintenant localises et documentables
- le projet n'est plus bloque par un manque massif de donnees, mais par les derniers points de semantic decoding, d'integration runtime et de validation en jeu

## Ce qu'on peut considerer comme clos ou presque

### 1. Contenu spatial du donjon

Le donjon actif DM est tres bien recale:

- items canoniques: `300 / 300`
- inscriptions: `61 / 61`
- locks: `65 / 65`
- creatures: `225 / 225`
- generators: `50 / 50` dans l'audit canonique

Nuance utile:

- l'audit canonique suit `50` generateurs places dans le monde de reference
- l'export brut et le runtime recales suivent `54` generateurs de sol `type 6`
- ce n'est pas une contradiction, mais une difference de perimetre entre audit canonique et export brut

Sources:

- [assets/OriginalDataExtraction/output/canonical_world_content_audit.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/canonical_world_content_audit.json)
- [assets/OriginalDataExtraction/output/canonical_item_audit.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/canonical_item_audit.json)

Nuance:

- les `46` mismatches items restants de l'audit canonique sont tous expliques
- ils sont classes `wall_adjacent_or_alcove` ou `nearby_reference_offset`
- il n'y a plus de mismatch item non resolu dans cet audit

### 2. Tables gameplay majeures comparees

Les comparaisons source-backed sont tres rassurantes sur les domaines deja packages:

- creatures comparees: `28`, differences: `0`
- food values: `8`, differences: `0`
- weapons comparees: `20`, differences: `0`
- clothing comparees: `18`, differences: `0`
- spells compares: `25`, differences: `0`

Source:

- [assets/OriginalDataExtraction/output/atari_game_db_comparison.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/atari_game_db_comparison.json)

### 3. Documentation de provenance

Le repo documente deja bien:

- ce qui vient du donjon extrait
- ce qui vient des tables Atari `i559/i560/i561/i562`
- ce qui reste interprete
- ce qui est encore de la glue runtime

Sources principales:

- [docs/EXTRACTION_AUDIT.md](/D:/DungeonMaster-codex/docs/EXTRACTION_AUDIT.md)
- [docs/ORIGINAL_DATA_AUDIT.md](/D:/DungeonMaster-codex/docs/ORIGINAL_DATA_AUDIT.md)
- [docs/RUNTIME_ALIGNMENT_AUDIT.md](/D:/DungeonMaster-codex/docs/RUNTIME_ALIGNMENT_AUDIT.md)

## Ce qui bloque encore le claim `extraction 100%`

### 1. `0696.RAW1` n'est pas decode semantiquement a 100 pourcent

C'est le principal verrou extraction encore ouvert.

Ce qu'on sait deja:

- le bloc est extrait
- sa structure est exportee
- plusieurs sous-zones sont comprises comme layout/composition
- certaines sous-zones sont presque decodees

Ce qu'on ne sait pas encore prouver completement:

- la semantique exacte de tous les opcodes
- la signification precise de tous les templates internes
- si tout le bloc est purement visuel ou s'il contient encore des metadata runtime utiles

Conclusion:

- `0696` n'est plus une boite noire complete
- mais ce n'est pas encore une reconstruction semantique totale

### 2. Certaines extractions restent fonctionnelles mais pas byte-pures

Exemple principal:

- `mechanisms.json` reste partiellement aide par des correspondances manuelles `item -> serrure` et des libelles construits

Conclusion:

- le resultat est exploitable
- mais ce n'est pas encore une extraction brute et parfaitement neutre de bout en bout

### 3. Une partie de la connaissance gameplay reste prouvee par croisement, pas par une seule extraction PC brute

Le projet s'appuie sur:

- donnees PC DM
- tables Atari decodees
- source reverse-engineered
- ReDMCSB

C'est tres solide pour la fidelite pratique.
Mais si on veut dire `100% extrait du PC original seul`, on n'y est pas encore.

## Ce qui bloque encore le claim `moteur 100% original`

### 1. Quelques zones restent encore hybrides, structurelles ou a confirmer en jeu

Points encore ouverts ou explicitement bornes:

- `0696.RAW1` n'est pas decode semantiquement a 100 pourcent
- generateurs: saturation exacte et representation complete des groupes actifs
- quelques couches runtime gardent encore un fallback ou une glue de compatibilite
- quelques mecanismes rares et countdowns
- quelques familles creatures et cas de fin de jeu
- certains cas rares `pits / teleporters / telefrag / chaines`

### 2. Tout n'est pas encore valide en jeu

Le runtime a beaucoup progresse, mais la validation n'est pas encore complete sur:

- `Zokathra -> Amalgam -> Firestaff complete -> Fluxcage -> Fuse`
- IA speciale de `Lord Chaos`
- cas tardifs de fin de jeu
- puzzles temporels rares

### 3. Certaines divergences sont volontaires

Le projet ne cherche pas a reproduire aveuglement certains bugs compileur du binaire original.

Exemple documente:

- comportements autour de `Anti-Magic` / `Anti-Fire`

Conclusion:

- meme avec une extraction parfaite, le claim `100 pourcent comme le binaire original` resterait faux tant que ces divergences volontaires existent

## Formulation honnete qu'on peut deja utiliser

On peut dire quelque chose comme:

`Le contenu canonique du donjon et les grandes tables gameplay utiles sont maintenant extraits, croises, documentes et largement integres.`

`Le projet est tres proche d'une reconstruction source-backed du Dungeon Master original, mais il reste quelques verrous avant un vrai claim 100 pourcent: le decodage semantique complet de 0696.RAW1, la suppression des derniers points de glue et d'interpretation, et la validation en jeu des derniers cas rares et de fin de partie.`

## Conditions minimales pour un vrai claim `100%`

Pour pouvoir l'ecrire sans se mentir, il faudrait fermer au moins:

1. `0696.RAW1`:
   - semantic decoding complet
   - ou preuve solide que le reliquat n'impacte pas la fidelite gameplay/runtime

2. Runtime:
   - plus de zone critique explicitement marquee `interpretee`
   - fermeture de la derniere zone structurelle encore emulee autour des groupes actifs / generateurs
   - reduction ou bornage clair des derniers fallbacks runtime encore actifs

3. Validation:
   - playtest documente des cas tardifs
   - sequence de fin validee
   - cas rares teleporter/pit/generator verifies

4. Position de projet:
   - assumer ou non les divergences volontaires avec le binaire
   - si ces divergences restent, parler de `fidelite source-backed tres elevee` plutot que `100% identique`

## Recommendation

La bonne cible de communication a court terme n'est pas `100%`.

La bonne cible est plutot:

- `contenu du monde: quasi clos`
- `tables gameplay majeures: source-backed et comparees`
- `moteur: tres proche, derniers ecarts documentes`
- `validation: encore en cours sur les cas rares et la fin de jeu`

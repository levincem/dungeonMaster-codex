# Generator Alignment Notes

Etat pose le `2026-04-17`.

Ce document isole le sujet des generateurs de creatures, qui reste le principal point structurel encore non totalement clos cote moteur.

## Verdict court

Les generateurs ne sont plus un gros angle mort de decoding.

Ce qui est maintenant ferme de facon assez solide:

- les configs runtime utiles sont decodees et embarquees
- le type de creature, la case de spawn, le compte brut, le flag de randomisation, le multiplicateur de vie et le delai de reactivation sont lus depuis les donnees extraites
- le runtime suit deja plusieurs regles source-backed importantes autour du spawn, du retry et de la saturation

Ce qui reste encore ouvert:

- la reproduction exacte de la structure interne FTL `GROUP/ACTIVE_GROUP`
- donc, par ricochet, le comptage exact de saturation et certains cas limites de coexistence de groupes

## Ce qui est decode aujourd'hui

La table runtime active des generateurs est dans [originalGenerators.ts](/D:/DungeonMaster-codex/src/data/originalGenerators.ts).

Releve actuel:

- `50` generateurs runtime de groupe au sol `type 6`
- `37` generateurs a compte fixe
- `17` generateurs a compte randomise
- `10` generateurs avec `hpMultiplier > 0`

Repartition par niveau:

- niveau `2`: `2`
- niveau `3`: `8`
- niveau `4`: `2`
- niveau `5`: `8`
- niveau `7`: `6`
- niveau `8`: `2`
- niveau `9`: `5`
- niveau `10`: `5`
- niveau `11`: `5`
- niveau `12`: `11`

Nuance utile:

- l'audit canonique suit `50` generateurs du monde de reference
- le runtime suit `50` generateurs de groupe au sol `type 6`, ce qui recolle au sous-ensemble canonique suivi par l'audit
- l'ancien chiffre `54` venait d'une lecture trop large qui melangeait aussi des `type 6` muraux de type `countdown`

Sources:

- [src/data/originalGenerators.ts](/D:/DungeonMaster-codex/src/data/originalGenerators.ts)
- [assets/OriginalDataExtraction/output/canonical_world_content_audit.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/canonical_world_content_audit.json)
- [assets/OriginalDataExtraction/output/dungeon.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/dungeon.json)

## Ce qui est deja bien aligne cote runtime

Dans [store.ts](/D:/DungeonMaster-codex/src/engine/store.ts), le runtime applique deja:

- lecture directe de la config source-backed via `getOriginalGeneratorConfig(...)`
- `generatedCountRandomized`
  - si le flag est actif, le compte vise suit `1 + randomInt(countRaw)`
  - sinon le compte vise suit `countRaw`
- `generatorHealthMultiplier`
  - si `> 0`, il s'applique au spawn
  - si `== 0`, le runtime retombe sur la difficulte de la map
- delais longs
  - `ticks > 127` devient `(ticks - 126) << 6`
- blocage de spawn
  - si la case est occupee par la party ou une creature, le groupe est differe
- retry `move later`
  - cadence source-backed de `5` ticks
- reservation des groupes en attente
  - les spawns differes comptent maintenant dans la saturation approximate
  - les nouveaux spawns et les retries deja reserves ne passent plus par exactement le meme gate runtime
  - un retry deja reserve peut maintenant se materialiser tant que le budget total de `60` groupes n'est pas depasse, au lieu d'etre rebloque par la marge plus stricte des nouveaux groupes
  - des activations distinctes d'un meme generateur ne sont plus ecrasees dans une seule entree pending si elles correspondent a des reservations differentes
  - la capacite runtime s'applique maintenant au `spawnLevel` lui-meme, y compris quand ce niveau n'est pas celui de la party
    - cela evite qu'un niveau hors ecran contourne totalement la saturation de ses propres groupes
    - la semantique FTL exacte `active / dormant / off-level` reste cependant encore ouverte
- comptage derive d'enregistrements de groupes runtime explicites
  - le remake ne compte plus seulement des `Set<string>` implicites
  - il derive maintenant des groupes `alive` et `reserved` explicites a partir des creatures et spawns en attente du niveau
- creation de groupe runtime partage
  - les creatures d'un meme spawn partagent un `groupId`
  - leur occupation initiale n'est plus un simple empilement centre
- separation des groupes runtime
  - deux groupes distincts ne doivent plus fusionner sur une meme case juste parce qu'ils ont le meme type de creature
  - cela garde mieux la coherence entre occupation de case et comptage approximate des groupes actifs
- mouvement partage par groupe local
  - pendant un tick monstre, les creatures d'un meme groupe encore reunies sur la meme case reutilisent maintenant le meme plan de mouvement runtime
  - cela reduit une autre derive importante ou des membres d'un meme groupe pouvaient se disperser artificiellement juste a cause de tirages independants

## Ce qui n'est plus vraiment obscur

Les points suivants ne doivent plus etre traites comme les grands inconnus du sujet:

- la randomisation du compte
- la lecture de `generatorHealthMultiplier`
- la case de spawn
  - pour les generateurs de groupe au sol, la source originale montre que le spawn se fait sur la case du capteur lui-meme
  - les pseudo-coordonnees `targetX/targetY` decodees depuis le mot final n'etaient pas des cibles valides pour ce type de capteur
- le type de creature generee
- le delai brut de reactivation

Ils peuvent encore meriter du playtest, mais ils ne sont plus le coeur du flou documentaire.

## Ce qui reste le vrai point obscur

Le vrai reste ouvert est structurel:

- FTL a une notion interne de `GROUP/ACTIVE_GROUP`
- le remake n'emule pas encore cette structure complete
- il approxime la saturation par:
  - des enregistrements de groupes runtime `alive` et `reserved`
  - un `groupId` partage quand il existe
  - un fallback de tuile quand il n'existe pas

Cela rend le comportement beaucoup plus credible qu'avant, mais laisse encore des questions ouvertes:

- quels groupes FTL doivent compter comme `actifs` a un instant donne
- quelle est la frontiere exacte entre groupe vivant, groupe reserve, groupe dormant ou groupe hors zone
- a quel moment exact un groupe reserve ou vivant doit cesser ou non de compter comme `actif` quand la party change de niveau ou s'eloigne
- comment se comporte exactement la saturation dans tous les cas limites de coexistence avec party / teleport / morts rapides / retries

Autrement dit:

- on a reduit une vraie derive structurelle en empechant la fusion opportuniste de groupes runtime distincts
- on a aussi reduit la dispersion artificielle des groupes runtime locaux pendant la boucle de deplacement
- on a rendu le comptage approximate lui-meme plus explicite et inspectable
- on distingue maintenant mieux la marge de `5` slots pour les nouveaux groupes du budget total de `60` slots pour les groupes deja reserves
- on ne compresse plus artificiellement plusieurs reservations differees d'un meme generateur en une seule file d'attente
- mais on n'a pas encore reconstitue la vraie representation FTL des groupes actifs

## Ce que montre la structure FTL `ACTIVE_GROUP`

Le point encore ouvert n'est pas abstrait; on sait maintenant beaucoup mieux ce que transporte la structure interne.

Dans le source FTL:

- `GLOBAL_DATA` suit explicitement `CurrentActiveGroupCount` et `MaximumActiveGroupCount`
- un `GROUP` present sur la map de la party reutilise son champ `Cells` comme `ActiveGroupIndex`
- les vraies `Cells` du groupe sont alors deplacees dans la structure `ACTIVE_GROUP`

La structure `ACTIVE_GROUP` contient ensuite plusieurs champs transitoires que le remake ne reproduit pas encore litteralement:

- `Directions`
- `Cells`
- `LastMoveTime`
- `DelayFleeingFromTarget`
- `TargetMapX / TargetMapY`
- `PriorMapX / PriorMapY`
- `HomeMapX / HomeMapY`
- `Aspect[4]`

Et le cycle de vie source-backed est lui aussi explicite:

- `F183_kzzz_GROUP_AddActiveGroup` alloue un slot actif libre, copie `GROUP.Cells` dans `ACTIVE_GROUP.Cells`, initialise `Prior/Home`, `LastMoveTime`, les directions par creature et les `Aspect`
- `F184_ahzz_GROUP_RemoveActiveGroup` reinjecte `ACTIVE_GROUP.Cells` dans `GROUP.Cells`, repasse la direction normalisee sur le `GROUP`, puis libere le slot
- `F195_akzz_GROUP_AddAllActiveGroups` rehydrate les groupes actifs de toute la map de la party au chargement/changement de map

Donc le vrai reliquat fidelite n'est plus:

- "comment decoder les generateurs"

mais plutot:

- "quels etats transitoires FTL doivent exister uniquement quand un groupe est actif sur la map de la party"
- "quand exactemment un groupe doit entrer ou sortir de cette representation active"
- "quels effets ces etats ont encore sur saturation, flee delay, prior/home, direction et rehydratation"

## Formulation honnete a retenir

On peut dire:

`Les generateurs sont maintenant largement decodes et rebranches cote runtime.`

`Le principal reste ouvert n'est plus le decoding des parametres de generateur, mais la reproduction exacte de la structure interne FTL des groupes actifs qui conditionne la saturation et certains cas limites de spawn.`

`En pratique, le gameplay observable des generateurs est deja largement recale; ce qui reste n'est pas un grand trou de donnees, mais un reliquat structurel borne sur la representation transitoire des groupes actifs.`

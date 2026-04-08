# Dungeon Master (FTL 1987) – Research Notes

## Statut du document

Document conservé comme **journal de recherche historique**.

Important :

- plusieurs sections ci-dessous décrivent des hypothèses ou des blocages intermédiaires qui ne sont **plus** l'état actuel du projet
- ce fichier est gardé pour mémoire, pas comme source de vérité finale
- pour l'état actuel, voir plutôt :
  - [docs/I559_STATS_EXTRACTION.md](/D:/DungeonMaster-codex/docs/I559_STATS_EXTRACTION.md)
  - [docs/I560_ATTACKS_EXTRACTION.md](/D:/DungeonMaster-codex/docs/I560_ATTACKS_EXTRACTION.md)
  - [docs/I561_UI_TABLES_EXTRACTION.md](/D:/DungeonMaster-codex/docs/I561_UI_TABLES_EXTRACTION.md)
  - [docs/I562_RUNTIME_TABLES_EXTRACTION.md](/D:/DungeonMaster-codex/docs/I562_RUNTIME_TABLES_EXTRACTION.md)
  - [docs/STATS_PROVENANCE.md](/D:/DungeonMaster-codex/docs/STATS_PROVENANCE.md)
  - [docs/ATARI_STATS_RECONCILIATION.md](/D:/DungeonMaster-codex/docs/ATARI_STATS_RECONCILIATION.md)

## Objectif initial
Extraire toutes les données du jeu vers `output/dungeon.json` et `output/game_db.json`
pour un remake TypeScript/Three.js/Vite.js.
Working directory historique : `c:\Users\Vince\Desktop\DMDisquette\`

---

## Fichiers disponibles

| Fichier | Taille | Description |
|---|---|---|
| `EUDATA/DUNGEON.DAT` | 33 357 o | Données du donjon (LE, parsé dans parse_full.js) |
| `EUDATA/GRAPHICS.DAT` | 398 925 o | Graphismes + noms d'items + tables ObjectInfo (compressés LZW) |
| `EUDATA/SONG.DAT` | 162 482 o | Musique |
| `DM.EXE` | ~20 Ko | Launcher/config DOS, compressé PKLITE/LZ91 |
| `FIRES.EXE` | ~94 Ko | Exécutable principal, compressé PKLITE/LZ91 |
| `FIRES_decompressed.bin` | 167 584 o | FIRES.EXE décompressé (généré par unpklite.js) |
| `unpklite.js` | — | Décompresseur PKLITE/LZ91 maison (fonctionnel) |
| `parse_full.js` | — | Parser DUNGEON.DAT → JSON (note historique : cette ligne n'est plus à jour) |
| `ReDMCSB/SOURCE/ENGINE/` | — | Code source reverse-engineered (Atari ST, MegaMax C) |
| `ReDMCSB/ORIGINAL/` | — | PRG décompressés Atari ST (DM10aEN, DM10bEN, DM11EN, DM12EN, CSB…) |

---

## Ce qui fonctionne

Note historique :

- cette section décrit un état intermédiaire
- `parse_full.js` n'est plus dans l'état “noms d'armes incorrects”
- plusieurs limitations mentionnées plus bas ont depuis été résolues ou fortement réduites

### parse_full.js
- Parse correctement DUNGEON.DAT (little-endian, format PC DOS)
- Extrait : maps, tiles, portes, téléporteurs, textes muraux, capteurs, créatures, armes, armures, parchemins, potions, conteneurs, misc
- Génère `output/dungeon.json` et `output/game_db.json`
- Note historique : le problème de noms d'armes mentionné ici a été corrigé depuis

### unpklite.js
- Décompresse correctement les exécutables PKLITE/LZ91
- Bug corrigé : la boucle de copie en arrière devait fixer `startPos` AVANT la boucle (pas recalculer depuis `out.length` qui grandit pendant la copie)

### Noms d'items dans GRAPHICS.DAT
- **200 noms trouvés en ASCII brut** à l'offset `0x47150` (null-terminés)
- Indexés par numéro d'icône (0-based)
- Vérifiés avec les constantes DEFS.H : icône 4=TORCH ✓, icône 32=DAGGER ✓, icône 40=VORPAL BLADE ✓, icône 38=DELTA ✓, icône 39=DIAMOND EDGE ✓
- En avril 2026, un script d'analyse dédié a été ajouté : `analyze_graphics.cjs`
  - sortie : `output/graphics_analysis.json`
  - confirme automatiquement le bloc des 199 noms à `0x47150`
  - confirme que la séquence attendue par le moteur Atari ST (dernier caractère avec bit 7) **n'apparaît pas en clair** dans le fichier PC DOS
  - les meilleurs candidats `OBJECT_INFO` trouvés par scan brut restent des **faux positifs plausibles**, pas encore des tables exploitables

**Liste complète des noms (index → nom) :**
```
0-3  : COMPASS (×4, N/E/S/O)
4-7  : TORCH (×4, variants)
8    : WATERSKIN
9    : WATER
10-11: JEWEL SYMAL (×2)
12-13: ILLUMULET (×2)
14-15: FLAMITT (×2)
16-17: EYE OF TIME (×2)
18-19: STORMRING (×2)
20-22: STAFF OF CLAWS (×3)
23-24: BOLT BLADE (×2)
25-26: FURY (×2)
27-29: THE FIRESTAFF (×3)
30   : OPEN SCROLL
31   : SCROLL
32   : DAGGER
33   : FALCHION
34   : SWORD
35   : RAPIER
36   : SABRE
37   : SAMURAI SWORD
38   : DELTA
39   : DIAMOND EDGE
40   : VORPAL BLADE
41   : THE INQUISITOR
42   : AXE
43   : HARDCLEAVE
44   : MACE
45   : MACE OF ORDER
46   : MORNINGSTAR
47   : CLUB
48   : STONE CLUB
49   : BOW
50   : CROSSBOW
51   : ARROW
52   : SLAYER
53   : SLING
54   : ROCK
55   : POISON DART
56   : THROWING STAR
57   : STICK
58   : STAFF
59   : WAND
60   : TEOWAND
61   : YEW STAFF
62   : STAFF OF MANAR
63   : SNAKE STAFF
64   : THE CONDUIT
65   : DRAGON SPIT
66   : SCEPTRE OF LYF
67-??: (armures, potions, misc – voir ci-dessous)
```
Armures (à partir de ~67), potions, nourriture, clés, misc : voir hex dump 0x47150–0x4794F.

---

## Ce qui est connu (source code ReDMCSB/DEFS.H)

### Types d'armes avec constantes connues
```c
C02_WEAPON_TORCH         = 2
C08_WEAPON_DAGGER        = 8
C27_WEAPON_ARROW         = 27
C28_WEAPON_SLAYER        = 28
C30_WEAPON_ROCK          = 30
C31_WEAPON_POISON_DART   = 31
C32_WEAPON_THROWING_STAR = 32
```

### Types de junk/misc avec constantes connues
```c
C01_JUNK_WATERSKIN       = 1
C05_JUNK_BONES           = 5
C25_JUNK_BOULDER         = 25
C42_JUNK_MAGICAL_BOX_BLUE  = 42
C43_JUNK_MAGICAL_BOX_GREEN = 43
C51_JUNK_ZOKATHRA        = 51
```

### Indices ObjectInfo
```c
C023_OBJECT_INFO_INDEX_FIRST_WEAPON = 23  → objInfo[23 + weapon.Type]
C069_OBJECT_INFO_INDEX_FIRST_ARMOUR = 69  → objInfo[69 + armour.Type]
C127_OBJECT_INFO_INDEX_FIRST_JUNK   = 127 → objInfo[127 + junk.Type]
```
ObjectInfo[0] = Scroll, ObjectInfo[1] = Container, ObjectInfo[2..22] = Potions.

### Constantes d'icônes (icon → nom attendu)
```c
C000_ICON_JUNK_COMPASS_NORTH          = 0
C004_ICON_WEAPON_TORCH_UNLIT          = 4
C007_ICON_WEAPON_TORCH_LIT            = 7
C008_ICON_JUNK_WATER                  = 8  (waterskin vide → WATERSKIN en jeu DM)
C009_ICON_JUNK_WATERSKIN              = 9  (waterskin pleine → WATER en jeu DM)
C014_ICON_WEAPON_FLAMITT_EMPTY        = 14
C016_ICON_WEAPON_EYE_OF_TIME_EMPTY   = 16
C018_ICON_WEAPON_STORMRING_EMPTY     = 18
C020_ICON_WEAPON_STAFF_OF_CLAWS_EMPTY= 20
C023_ICON_WEAPON_BOLT_BLADE_STORM_EMPTY = 23
C025_ICON_WEAPON_FURY_RA_BLADE_EMPTY = 25
C027_ICON_WEAPON_THE_FIRESTAFF       = 27
C028_ICON_WEAPON_THE_FIRESTAFF_COMPLETE = 28
C030_ICON_SCROLL_SCROLL_OPEN         = 30
C031_ICON_SCROLL_SCROLL_CLOSED       = 31
C032_ICON_WEAPON_DAGGER              = 32
C038_ICON_WEAPON_DELTA_SIDE_SPLITTER = 38
C039_ICON_WEAPON_DIAMOND_EDGE        = 39
C040_ICON_WEAPON_VORPAL_BLADE        = 40
```

### Structure ObjectInfo (6 bytes, big-endian)
```c
typedef struct OBJECT_INFO {
    int  Type;              // 2 bytes BE — index dans G352_apc_ObjectNames (= numéro d'icône)
    unsigned char ObjectAspectIndex;  // 1 byte
    unsigned char ActionSetIndex;     // 1 byte
    int  AllowedSlots;      // 2 bytes BE
};
G237_as_Graphic559_ObjectInfo[180]  // 180 entrées × 6 bytes = 1080 bytes
```

### Logique de lookup nom dans le code source (OBJECT.C)
```c
// F141 retourne l'index ObjectInfo :
//   weapon → C023 + weapon.Type
//   armour → C069 + armour.Type
//   junk   → C127 + junk.Type

// F032 retourne ObjectInfo[index].Type (= icon index)

// G352_apc_ObjectNames[iconIndex] = le nom affiché
```

---

## Ancien problème : table ObjectInfo

Note historique :

- cette section documente un blocage ancien
- aujourd'hui, `0559` et les tables associées ont été décodés proprement côté Atari
- ce n'est plus un “problème non résolu” au sens où ce document le présentait

### Où elle est stockée
La table `G237_as_Graphic559_ObjectInfo[180]` est **chargée à l'exécution** depuis le graphique #559 de GRAPHICS.DAT (code Atari ST) via :
```c
F490_lzzz_MEMORY_LoadDecompressAndExpandGraphic(
    MASK0x8000_NOT_EXPANDED | C559_GRAPHIC_GLOBAL_VARIABLES,
    &G259_i_Graphic559Anchor + 1, 0, 0);
```
Elle est compressée en LZW dans ce graphique. Elle n'est PAS présente en clair dans l'exécutable.

### Ancienne note : format de GRAPHICS.DAT côté PC DOS

Note historique :

- la formule “NON RÉSOLU” n'est plus appropriée comme état global
- le format PC DOS n'a pas été intégralement élégamment spécifié dans tous ses détails internes
- en revanche, le projet n'est plus bloqué sur ce point pour l'extraction utile
- les besoins pratiques ont été couverts par l'extraction Atari canonique, les outils d'analyse et la réconciliation documentée ailleurs

**Ce qu'on sait du code source (Atari ST) :**
```
offset 0      : uint16 BE = N (nombre de graphiques)
offset 2      : N × uint16 BE = tailles compressées
offset 2+N*2  : N × uint16 BE = tailles décompressées
offset 2+N*4  : données graphiques séquentielles (LZW compressé)
offset(graphic[i]) = 2 + N*4 + sum(compressed[0..i-1])
```

**Le problème :**
- EUDATA/GRAPHICS.DAT = version **PC DOS 1994**, probablement format différent de l'Atari ST
- Premiers 2 bytes = `0x0180` = 384 graphiques (BE)
- N=384 → header = 1538 bytes, données = 397 387 bytes
- Mais : `sum(tailles_compressées_BE)` = 6 042 758 ≠ 397 387
- Et : `sum(tailles_compressées_LE)` = 123 443 ≠ 397 387
- Aucune interprétation (BE/LE, avec/sans array décompressé, 2/4 bytes par entrée) ne donne un total cohérent
- Contradiction : le code source dit C550_LOADABLE_GRAPHIC_COUNT_DM=550 (DM a ~550 graphiques) mais le fichier PC a seulement 384 entrées header
- Graphic #559 (index Atari ST pour ObjectInfo) > 383 → n'existe pas dans ce fichier
- Tentative avril 2026 : interprétation du header comme table 32 bits LE/BE → non concluante
  - trop peu de valeurs dans la plage du fichier
  - aucune monotonie exploitable
  - aucun motif crédible d'offsets simples ou de tailles simples
- Tentative avril 2026 : recherche des tableaux de directions de `Graphic 559`
  - aucun motif brut compatible avec `[0,1,0,-1]` / `[1,0,-1,0]` / variantes LE/BE
  - cela renforce l'idée qu'on ne peut pas extraire `Graphic 559` par simple scan brut du fichier PC DOS

**Fausse piste à 0xC2F :**
- Recherche du pattern `torch(icon=4) à entry[25]` + `dagger(icon=32) à entry[31]` (distance 36 bytes)
- Un seul hit dans GRAPHICS.DAT à l'offset `0xC2F`
- MAIS : ObjectInfo[0].Type=46 (MORNINGSTAR) au lieu de 30/31 (SCROLL) → **faux positif**
- Toutes les autres entrées incohérentes

**Recherche dans les PRG décompressés :**
- Testé dans tous les `START.PAK *EN DECOMPRESSED.PRG` → aucun résultat valide
- Normal : la table est chargée de disque à l'exécution, elle n'est pas dans l'exécutable

### Compression LZW utilisée
Standard LZW 9→12 bits, LSB-first dans le buffer (voir `ReDMCSB/SOURCE/ENGINE/LZW.C`)
- `G664_i_LZW_CodeBitCount` commence à 9
- Clear code = 256 (0x100)
- Max code = 4096 (12 bits)

---

## Ce qu'il restait à faire à ce stade

Note historique :

- cette to-do list est conservée comme trace de raisonnement
- elle ne doit plus être lue comme feuille de route actuelle

### Option A — Chercher la DM Encyclopedia
Le site dmwiki.net / dungeon-master.com documente les type numbers de tous les items.
C'est de la connaissance publique sur un jeu de 1987.

### Option B — Vérifier quels types inconnus existent dans le donjon
Lancer parse_full.js et voir quels types W3-W7, W11-W15, W28-W31, W37-W39, W43-W45
apparaissent réellement dans DUNGEON.DAT. Peut-être que certains n'existent pas
(items théoriques non placés).

### Option C — Reconstruire le format GRAPHICS.DAT PC DOS
Chercher si quelqu'un a documenté le format PC DOS de GRAPHICS.DAT (différent de l'Atari ST).
Peut-être que les tailles sont encodées différemment (ex: XOR, offset relatif, autre endianness mixte).

### Option D — Implémenter le décompresseur LZW
Implémenter LZW.C en Node.js, scanner GRAPHICS.DAT pour trouver des streams LZW valides
qui décompressent vers une structure ObjectInfo cohérente.

---

## Piste PC DOS (avril 2026) : `FIRES_decompressed.bin`

L'analyse du binaire PC DOS décompressé apporte quelques éléments concrets :

- `FIRES_decompressed.bin` contient bien la chaîne `EUDATA\GRAPHICS.DAT` à l'offset `0x27EF4`
- On y trouve aussi une petite table de chemins DOS voisins :
  - `EUDATA\DUNGEON~.DAT`
  - `A:DUNGEON~.FTL`
  - `A:DUNGB~.DAT`
  - `A:DMSAVE~.DAT`
  - `A:DMSAVE~.BAK`
  - `EUDATA\GRAPHICS.DAT`
- Les octets juste avant certaines chaînes ressemblent à des pointeurs far 16:16 en mode réel
  - exemple : `F4 2A 40 25` pointe exactement sur `EUDATA\GRAPHICS.DAT`
  - cela indique que le binaire PC manipule bien ces chemins via une vraie table de données

Wrappers DOS identifiés dans `FIRES_decompressed.bin` :
- `0x13FDC` : ouverture en lecture/écriture (`int 21h`, `AH=3Dh`, mode `AL=2`)
- `0x13FEF` : fermeture (`AH=3Eh`)
- `0x14000` : lecture bufferisée (`AH=3Fh`)
- `0x14068` : écriture bufferisée (`AH=40h`)
- `0x140D0` / `0x140EB` / `0x14163` : variantes de `lseek` (`AH=42h`)
- `0x14130` : création (`AH=3Ch`)
- `0x14144` : suppression (`AH=41h`)
- `0x14150` : renommage (`AH=56h`)

Ce que cela prouve :
- la version PC DOS n'utilise pas un simple portage “opaque” : on peut remonter ses accès fichiers
- la logique spécifique PC DOS autour de `GRAPHICS.DAT` est probablement récupérable depuis `FIRES_decompressed.bin`

Ce que cela ne donne pas encore :
- la routine exacte qui parse le conteneur PC DOS de `GRAPHICS.DAT`
- la manière dont la version DOS indexe l'équivalent des graphiques Atari `556`, `559`, etc.

### Découverte utile : les far calls DOS se résolvent bien en adresses linéaires

En avril 2026, vérification faite :
- les adresses de type `segment:offset` du binaire DOS décompressé peuvent être suivies avec la formule :
  `linear = segment * 16 + offset`
- exemples vérifiés :
  - `0367:1405` → `0x4A75`
  - `0563:1F55` → `0x7585`
  - `0D1A:1EA9` → `0xEF49`

Cela permet enfin de suivre les appels inter-segments du binaire PC DOS sans désassembleur externe.

### Routines candidates désormais identifiées

- `0x4A75` (appelée via `0367:1405`)
  - routine commune de dispatch/normalisation
  - contient plusieurs sous-switchs/jump tables
- `0x7585` (appelée via `0563:1F55`)
  - discrimine explicitement les codes `0x20`, `0x21`, `0x25`, `0x26`
  - profil compatible avec une gestion de classes de ressources/fichiers
- `0xEF49` (appelée via `0D1A:1EA9`)
  - travaille sur des structures indexées via `0x2ECE`
  - probablement une routine de lecture/accès structurée

### Indice important sur les types de ressources

Des callsites observés poussent explicitement les valeurs `0x20`, `0x21`, `0x25`, `0x26`
avant d'appeler des routines liées au chargement.  
À ce stade, on ne peut pas encore affirmer quelle valeur correspond à `GRAPHICS.DAT`,
mais ces quatre codes forment très probablement une petite enum interne côté PC DOS.

---

## Ancienne note : noms incorrects dans parse_full.js

Note historique :

- cette correction a depuis été traitée
- la section est conservée pour mémoire sur l'ancien état du parser

La table `WEAPON_NAMES` actuelle dans parse_full.js est fausse :
```js
// FAUX (actuel) :
0:'Vorpal Blade', 2:'Fury', 16:'Torch', 32:'Dagger', 8:'Arrow'

// CORRECT (depuis DEFS.H) :
2:'Torch', 8:'Dagger', 27:'Arrow', 28:'Slayer',
30:'Rock', 31:'Poison Dart', 32:'Throwing Star'
// Les autres types restent inconnus
```

---

## Notes diverses

- FIRES.EXE contient du Turbo C++ runtime et des strings de chemins comme `EUDATA\DUNGEON~.DAT`
  mais PAS les noms d'items en clair.
- Les fichiers DUNGEONF.DAT (français) et DUNGEONG.DAT (allemand) sont des variantes du donjon.
- SONG.DAT = données musicales, non exploré.
- GRA21DM.BIN et GRA21CSB.BIN = petits routines 68K (48/96 bytes), pas des données utiles.
- GRAPH538.BIN = 48 bytes de code 68K, pas des données.
- Le décompresseur PKLITE (unpklite.js) fonctionne et produit FIRES_decompressed.bin (167 584 bytes).

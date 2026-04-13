# Audit d'extraction des données originales

Date : 2026-04-10

Ce document recense l'état complet de l'extraction des données du jeu original (PC DOS, Atari ST), ce qui est correctement extrait, ce qui reste lacunaire, et ce qui existe mais n'est pas encore branché au runtime.

---

## Sources primaires disponibles

| Fichier | Taille | Contenu |
|---|---|---|
| `EUDATA/DUNGEON.DAT` | 33 357 o | Topologie du donjon, objets placés, textes, créatures |
| `EUDATA/GRAPHICS.DAT` | 398 925 o | Graphismes, noms d'items, tables ObjectInfo (compressé LZW) |
| `EUDATA/SONG.DAT` | 162 482 o | Musique (non exploité) |
| `FIRES_decompressed.bin` | 167 584 o | Exécutable principal décompressé (non exploité) |
| `ReDMCSB/SOURCE/` | — | Code source reverse-engineered (Atari ST, MegaMax C) |
| `OriginalAtariGame/` | — | PRG Atari ST décompressés + GRAPHICS.DAT Atari |

---

## Ce qui est correctement extrait

### Topologie du donjon — `parse_full.js` → `public/dungeon.json`

- 14 niveaux, géométrie complète, offsets locaux/globaux
- Types de tiles : Wall, Floor, Pit, Stairs, Door, Teleporter, TrickWall, Empty
- Pools d'objets complets :
  - 170 portes, 179 téléporteurs, 125 textes muraux, 684 senseurs
  - 182 créatures, 107 armes, 121 armures, 35 parchemins, 56 potions, 12 conteneurs, 280 misc
- Placement spatial des objets sur les tiles, avec coordonnées locales et globales
- Données des 24 champions : décodées via senseurs miroirs (type 127) + textes encodés en nibbles hex
- Textes muraux et parchemins : décodés avec table d'échappement 5 bits, fixups appliqués pour les fragments tronqués

Audit de contenu confirmé dans `WORLD_CONTENT_AUDIT.md` :

| Catégorie | Attendu | Extrait |
|---|---|---|
| Items placés | 300 | 300 ✓ |
| Inscriptions murales | 61 | 61 ✓ |
| Serrures | 65 | 65 ✓ |
| Créatures | 225 | 225 ✓ |
| Générateurs | 50 | 50 ✓ |

### Graphismes et noms — `sck` + `parse_sck_graphics.cjs` → `public/graphics_db.json`

- 199 noms d'items en anglais (offset 0x47150 de GRAPHICS.DAT)
- 44 noms d'attaques
- 4 familles de portes : Porticullis, Wooden Door, Iron Door, Ra Door
  - 3 frames par famille (Front 1/2/3), stockées comme BMP extraits par `sck`
- 120 entrées de décorations murales nommées avec dimensions :
  - Vi Altar, Square Alcove, Arched Alcove, tous les types de serrures, switches, leviers, fontaine, porte-torches, miroirs champions, hazards (Fireball Holes, Poison Holes, Dagger Holes, Slime Outlet), décoratifs (Crack, Iron Ring, Manacles, Scratches, Grate…)

### Tables originales Atari ST — `decode_i5*.cjs` → `assets/OriginalDataExtraction/output/`

Ces tables proviennent du GRAPHICS.DAT Atari ST v1.1 via le fichier `.map` de `sck`. Elles sont la source la plus fiable pour les valeurs de gameplay.

**i559 — Tables d'objets et créatures** (`atari_i559_stats.json`)

- 27 descripteurs de créatures : HP de base, attaque, défense, dextérité, vitesse de déplacement/attaque, résistances feu/poison, portées vue/odorat/attaque, expérience, comportement
- 46 descripteurs d'armes : poids, dégâts, classe, kinetic energy, throwGraphic
- 58 descripteurs d'armures/vêtements : poids, protection, défense aux coups tranchants, shield flag
- 180 `objectInfo` : type, graphicClass, attackClass, allowedSlotsMask (avec décomposition par slot : mouth, head, neck, torso, legs, feet, quiver1, quiver2, pouch, hands, chest)
- 8 valeurs nutritionnelles (foodValues)
- 54 poids d'items misc (miscWeightsKg)

**i560 — Attaques et sorts** (`atari_i560_stats.json`)

- 44 descripteurs d'attaques : baseDamage, staminaCost, defenseModifier, strengthRequired, disableTime, skillNumber, experienceForAttacking
- 44 classes légales d'attaque (legalAttackClasses)
- 25 descripteurs de sorts : runeOrdinals, skillRequired, spellType, missileTypeBits, recoveryTicks

**i561 — Tables UI** (`atari_i561_stats.json`)

- Zones de drop, groupes de boutons, deltas directionnels (X/Y), groupes de traduction de touches, 18 boutons de déplacement

**i562 — Tables runtime** (`atari_i562_stats.json`)

- 38 carry-location masks (indique dans quels slots un item peut être porté)
- 30 entrées d'ordre de drop
- 22 entrées sons
- Tables de palettes, luminosité, affichage des icônes, couleurs d'identité

### Mécanismes — `export_mechanisms.js` → `assets/OriginalDataExtraction/output/mechanisms.json`

541 mécanismes répartis sur 14 niveaux :

| Niveau | Mécanismes |
|---|---|
| Hall of Champions | 9 |
| Level 1 | 50 |
| Level 2 | 56 |
| Level 3 | 29 |
| Level 4 | 64 |
| Level 5 | 78 |
| Level 6 | 20 |
| Level 7 | 37 |
| Level 8 | 21 |
| Level 9 | 39 |
| Level 10 | 71 |
| Level 11 | 37 |
| Level 12 | 18 |
| Lord Chaos's Lair | 12 |

Types couverts : dalles de pression, leviers, serrures, faux-murs, téléporteurs conditionnels, capteurs de possession.

### Positions d'overlays muraux — `public/original_wall_overlay_positions.json`

- 417 événements de placement fixes
- 316 faces murales avec overlay fixe identifié
- 3887 faces murales effectives dans le donjon
- 50 familles d'overlays nommées avec positions exactes par level

---

## Lacunes confirmées

### 1. Noms d'armures non résolus dans `dungeon.json` — RÉSOLU

Les 6 noms placeholders ont été résolus via `resolve_armor_names.cjs` → `output/resolved_armor_names.json`.

Méthode : les armures placées sur les cases miroir (sensor type 127) du Hall of Champions sont l'équipement de départ des champions. L'identité du champion (encodée dans `sensor.data`) détermine le nom.

| Type ID | Nom résolu | Champions porteurs |
|---|---|---|
| 11 | Silk Shirt | WuTse, Halk |
| 12 | Gunna | Chani, Sonja, Linflas |
| 20 | Tunic | Stamm, Leyla, Zed |
| 21 | Ghi | Iaido |
| 29 | Barbarian Hide | Azizi |
| 57 | Halter | Azizi, Linflas |

Ces noms doivent être ajoutés à la table `ARMOR_NAMES` dans `parse_full.js`.

### 2. Bloc `0696.RAW1` partiellement opaque

Ce bloc de 9 160 octets est présent dans GRAPHICS.DAT PC DOS et plusieurs portages post-Atari. Il est exporté structurellement dans `public/graphics_layout_0696.json` mais sa sémantique n'est pas complètement décodée.

Ce qui est compris :
- Sections A/B/F/H/I/J/K : données UI/layout
- Section C (850–872) : masques donjon/overlay fragments
- Section D (2900–2947) : placement vue côté escaliers, puis templates internes
- Sections E/C (3000–3394) : templates de placement internes
- Sections G/3812–3963 : anchors muraux + grille de distribution d'items au sol

Ce qui reste opaque :
- La sémantique précise des templates 129–139
- Absence confirmée d'un bloc I559 contigu (les meilleures correspondances ne donnent que 9/180 types exacts)

### 3. `FIRES.EXE` décompressé — analysé

Script : `analyze_fires_exe.cjs` → `output/fires_exe_analysis.json` + `output/fires_exe_strings.txt`.

Résultats :

- Pas de header MZ : `FIRES_decompressed.bin` est un dump brut du segment code+data, pas un EXE complet avec header.
- Compilateur confirmé : **Turbo C++ 1990 (Borland)** — chaîne `"Turbo C++ - Copyright 1990 Borland Intl."` trouvée à 0x025404.
- Chemins de fichiers présents en clair à 0x027E90 :
  - `EUDATA\DUNGEON~.DAT`
  - `EUDATA\GRAPHICS.DAT`
  - `*@%A:DUNGEON~.FTL`, `*@%A:DMSAVE~.DAT`, `*@%A:DMSAVE~.BAK`
- Modes audio détectés : `LIMITED SOUNDS` et `NO SOUNDS` (flags de capacités sonores).
- Table de caractères à 0x026BF2 : `ABCDEFGHIJKLMNOPQRSTUVWXYZ,.;: `.
- Tables de gameplay : la région 0x028100+ est entièrement nulle (buffer BSS ou zone non mappée). Les zones structurées identifiées par variance faible se situent autour de 0x025C00–0x025D00 mais sans correspondance directe prouvée avec les tables Atari.
- **Conclusion** : le binaire PC DOS ne contient pas de tables de gameplay supplémentaires non couvertes par les tables Atari. Les données critiques sont dans `DUNGEON.DAT` et `GRAPHICS.DAT`. `FIRES.EXE` est le code exécutable, pas un fichier de données.

### 4. `SONG.DAT` — extrait

Script : `extract_song.cjs` → `output/song_analysis.json` + `output/songs/song_N.imf`.

Format identifié : stream brut d'événements OPL2/AdLib en format IMF 4 octets par événement `[reg, val, delay_lo, delay_hi]`. Pas de header global. **8 morceaux** délimités par la séquence d'init OPL2 `[0x01, 0x80]` au début de chaque morceau.

| Morceau | Offset | Taille | Événements | Rôle probable |
|---|---|---|---|---|
| 0 | 0x00000 | 3 608 o | 902 | Hall of Champions (court) |
| 1 | 0x00E18 | 43 568 o | 10 892 | Thème donjon A (long) |
| 2 | 0x0B848 | 10 900 o | 2 725 | Thème donjon B |
| 3 | 0x0E2DC | 46 592 o | 11 648 | Thème donjon C (long) |
| 4 | 0x198DC | 20 676 o | 5 169 | Thème donjon D |
| 5 | 0x1E9A0 | 19 992 o | 4 998 | Thème donjon E |
| 6 | 0x237B8 | 8 152 o | 2 038 | Combat / Spécial |
| 7 | 0x25790 | ~8 992 o | 2 248 | Finale / Lord Chaos |

Les `.imf` extraits sont jouables directement via un lecteur AdLib (adplug, imf2wav, etc.). Le taux d'horloge exact du timer FTL n'est pas encore déterminé (560 Hz IMF standard donne des durées aberrantes — le vrai taux est probablement plus élevé).

### 5. Mécanismes — heuristiques résiduelles

Les correspondances `item → serrure` dans `mechanisms.json` sont en partie manuelles. Les `kind` sont des descriptions en français construites à la main, pas des valeurs byte-exactes. Le fichier est fonctionnellement correct mais n'est pas une extraction pure.

---

## Données extraites non encore intégrées au runtime

Ces données existent dans les fichiers JSON mais ne sont pas encore utilisées par le code TypeScript.

| Donnée | Source extraite | Fichier runtime | Statut |
|---|---|---|---|
| `carryLocationMasks` (38 entrées) | `atari_i562_stats.json`, `atari_i559_stats.json` | `src/data/equipment.ts` | Règles de slots encore manuelles |
| Sémantique complète des sorts | `atari_i560_stats.json` (25 sorts) | `src/data/spells.ts` | Liste manuelle, non branchée sur i560 |
| Valeurs nutritionnelles (foodValues) | `atari_i559_stats.json` | `src/engine/store.ts` | Boucle faim/soif non calée sur l'original |
| Rendu des familles de portes | `public/graphics_db.json` (4 familles, 12 frames) | `src/components/Dungeon/Cell.tsx` | Toujours une texture générique |
| Attaques/drops des créatures | `atari_i559_stats.json` | `src/data/creatures.ts` | `BASE_ATTACK_TYPE_MAP` encore manuel |
| Timing original (ticks) | `atari_i562_stats.json` | `src/engine/store.ts` | Faim, buffs, certains sorts hors horloge originale |
| Tables UI / zones de drop | `atari_i561_stats.json` | — | Non utilisé (remake 3D, UI différente) |
| Sons | `atari_i562_stats.json` (22 entrées) | — | Pas de système audio |
| Palettes et données couleur | `atari_i562_stats.json` | — | Non pertinent pour le rendu 3D |

---

## Verdict global

L'extraction est dans un très bon état. La totalité des fichiers source originaux accessibles sont lus. Les tables Atari ST (i559/i560/i561/i562) sont proprement décodées et constituent une base fiable.

Les blocages restants sont :

1. **`0696.RAW1`** — seul vrai verrou extraction encore ouvert, probablement non critique pour le gameplay de base
2. **Intégration runtime** — les données existent, elles ne sont pas encore branchées sur plusieurs systèmes (équipement, sorts, faim, portes)
3. **Noms d'armures** — 12 placeholders à résoudre, effort mineur

Il n'y a plus de manque d'information qui bloque la fidélité du gameplay principal. Le travail prioritaire est désormais l'intégration, pas l'extraction.

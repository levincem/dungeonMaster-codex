# Verdict `0696.RAW1`

Etat recale le `2026-04-20`.

## Conclusion courte

`0696.RAW1` n'est plus a traiter comme un blob inconnu ni comme un verrou extraction majeur.

Conclusion honnete aujourd'hui:

- c'est un conteneur post-Atari de composition et de placement
- il melange surtout:
  - layout UI
  - helpers/templates internes
  - ancrages et composites de rendu donjon
  - tables de placement d'items au sol
- ce n'est pas une table gameplay/cachee de type `I559`

Ce qui reste partiel n'est plus le `quoi`, mais surtout le `comment exact`:

- noms moteur exacts de certains helpers
- noms canoniques de certains opcodes
- correspondance engine-level fine de quelques sous-familles

## Ce qui est etabli

### 1. `0696` n'est pas un bloc stats gameplay

Les points fermes:

- aucune signature convaincante de bloc Atari `I559` contigu dans `0696`
- les scans `OBJECT_INFO / WEAPON_INFO / ARMOUR_INFO` donnent des faux positifs de layout
- la piste productive pour les tables gameplay PC est ailleurs, autour des blocs `0x22f / 0x230 / 0x232`

Sources:

- [docs/I559_STATS_EXTRACTION.md](/D:/DungeonMaster-codex/docs/I559_STATS_EXTRACTION.md)
- [docs/I561_UI_TABLES_EXTRACTION.md](/D:/DungeonMaster-codex/docs/I561_UI_TABLES_EXTRACTION.md)
- [docs/I562_RUNTIME_TABLES_EXTRACTION.md](/D:/DungeonMaster-codex/docs/I562_RUNTIME_TABLES_EXTRACTION.md)

### 2. Le bloc est majoritairement un conteneur de composition

Les sections exportees montrent de facon stable:

- `A`, `B`, `F`, `H`, `I`, `J`, `K`
  - majoritairement `ui/layout`
- `C`
  - masques muraux / fragments de pit / overlays de rendu
- `D`
  - escaliers vue laterale puis templates internes
- `E` et `C(3200..3394)`
  - grilles/templates internes
- `G` puis le tail tardif
  - ancrages muraux, placements d'items au sol, composites frontaux

Source:

- [graphics_layout_0696_summary.json](/D:/DungeonMaster-codex/assets/OriginalDataExtraction/output/graphics_layout_0696_summary.json)

### 3. Les ids `NULL` references sont des helpers, pas des assets manquants

Les familles `129..139`, `150..194`, `207..245`, plus `12` et `81..84`, se comportent comme:

- grilles de placement
- ancres UI
- aides de colonnes/lignes
- strips et offsets incrementaux de panneaux

Source:

- [graphics_helper_0696.json](/D:/DungeonMaster-codex/public/graphics_helper_0696.json)

### 4. Les sous-blocs tardifs sont deja lisibles comme panneaux composites

Sous-blocs deja fermes semantiquement:

- `3812..3940`
  - grille de distribution d'items au sol
- `4340..4416`
  - strip composite de portes frontales
- `4420..4472`
  - panneau teleporter / floor avec helpers
- `4476..4548`
  - panneau mixte frames de porte / mur / ceiling pit
- `4552..4576`
  - panneau frontal d'escaliers

Source:

- [graphics_panels_0696.json](/D:/DungeonMaster-codex/public/graphics_panels_0696.json)

## Formulation a retenir

Formulation solide:

`0696.RAW1 est maintenant borne semantiquement comme un conteneur post-Atari de composition visuelle et de placement, pas comme un bloc gameplay opaque.`

`Il reste des noms provisoires pour certains helpers et opcodes, mais le role du bloc est suffisamment etabli pour ne plus le classer comme verrou principal de reverse-engineering.`

## Ce qui reste eventuellement a raffiner

Seulement si un besoin concret apparait:

- nommer plus finement `opcode 1/2/4/7/9/10/18`
- faire correspondre certains helpers a des symboles moteur plus exacts
- reutiliser davantage ces exports dans le renderer/runtime pour supprimer des placeholders

Ce n'est plus un prerequis pour dire `on sait ce qu'il y a dedans`.

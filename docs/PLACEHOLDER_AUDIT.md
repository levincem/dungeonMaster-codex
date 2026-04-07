# Placeholder Audit

Audit rapide des reliquats encore visibles ou plausiblement visibles en jeu.

## Priorité Haute

- Scroll texts fragmentés dans `public/dungeon.json`
  - plusieurs `Scroll` portent des fragments tronqués au lieu d’un texte complet
  - exemples:
    - map `0` tile `(4,18)`: `E\nWISH.`
    - map `1` tile `(6,3)`: `OUNTAIN\nACCEPTS ONE\nWISH.`
    - map `3` tile `(26,20)`: `RTCUT`
    - map `6` tile `(25,20)`: `.`
    - map `10` tile `(15,25)`: `N\nACCEPTS ONE\nWISH.`
  - cela ressemble à des offsets de texte partagés ou mal résolus dans l’export

- Overlays muraux encore en placeholder textuel
  - les positions sont bonnes, mais plusieurs familles n’ont pas encore de sprite dédié
  - liste détaillée: [MISSING_WALL_OVERLAY_IMAGES.md](D:\DungeonMaster-codex\docs\MISSING_WALL_OVERLAY_IMAGES.md)

## Priorité Moyenne

- Noms d’items encore placeholder dans les données source
  - exemples fréquents:
    - `Misc_29` (`25` occurrences)
    - `Misc_35` (`24`)
    - `Misc_30` (`13`)
    - `Misc_31` (`11`)
    - `Misc_43` (`9`)
    - `(Unknown_7)` (`5`)
    - `Container_121` (`3`)
  - beaucoup sont déjà corrigés au runtime via `resolveItemName`, mais la donnée source reste sale

- Noms d’armures encore placeholder dans les données source
  - exemples:
    - `Armor_13`, `Armor_37`, `Armor_12`, `Armor_20`
  - là aussi, le runtime compense souvent avec les noms canoniques

- Placeholders d’images côté items
  - certaines familles utilisent encore un sprite générique ou approximatif
  - exemples connus:
    - locks multiples réutilisent `serrure.png`
    - certains overlays utilisent encore une plaque textuelle en attendant un vrai sprite

## Priorité Basse

- Reliquats legacy dans le code
  - plusieurs tables `LEGACY_*` sont encore utilisées comme fallback dans:
    - [items.ts](D:\DungeonMaster-codex\src\data\items.ts)
    - [creatures.ts](D:\DungeonMaster-codex\src\data\creatures.ts)
  - ce n’est pas forcément mauvais, mais ça indique que la source originale n’a pas encore remplacé 100 % des heuristiques locales

- Placeholder logique mineur
  - dans [store.ts](D:\DungeonMaster-codex\src\engine\store.ts), l’effet potion `poison` est encore commenté comme placeholder

## Ce Qui Est Déjà Propre

- positions d’overlays muraux fixes: branchées depuis les données originales
- faim / soif: en place
- contenants d’eau / fontaines: en place
- mirrors et inscriptions murales: rendus par des systèmes dédiés

## Suite Recommandée

1. corriger le système de textes de scrolls
2. remplacer progressivement les sprites d’overlays encore manquants
3. nettoyer les placeholders de noms restants dans les catalogues source quand on a les correspondances sûres

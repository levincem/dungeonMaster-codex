# Active Image Placeholders

Liste des placeholders visuels encore vraiment branches dans le runtime.

Verification de reference faite dans le code runtime le 2026-04-15:

- seuls les trois bitmaps originaux ci-dessous ressortent encore comme placeholders directement actifs
- le reste des cas provisoires visibles passe surtout par des images modernes trop generiques, en particulier `serrure.png`

Regle du projet a conserver:

- les assets refaits / modernises sont prioritaires
- les bitmaps originaux ne doivent servir qu'en placeholder temporaire

## Bitmaps originaux encore actifs

- [doorIronOriginal.bmp](/D:/DungeonMaster-codex/public/game/images/textures/doorIronOriginal.bmp)
  - utilise pour les portes `iron`
  - branchement: [src/data/doors.ts](/D:/DungeonMaster-codex/src/data/doors.ts)

- [doorRaOriginal.bmp](/D:/DungeonMaster-codex/public/game/images/textures/doorRaOriginal.bmp)
  - utilise pour les portes `ra`
  - branchement: [src/data/doors.ts](/D:/DungeonMaster-codex/src/data/doors.ts)

- [full_torch_holder.bmp](/D:/DungeonMaster-codex/public/game/images/misc/original/full_torch_holder.bmp)
  - utilise encore pour `Full Torch Holder`
  - branchement: [src/data/originalWallOverlays.ts](/D:/DungeonMaster-codex/src/data/originalWallOverlays.ts)

## Placeholders modernes encore trop generiques

Ces assets ne viennent pas du bitmap original, mais restent trop provisoires pour une finition moderne.

- `serrure.png`
  - reutilise pour de nombreuses familles de locks et trous:
    - `Iron Lock`
    - `Double Iron Lock`
    - `Square Lock`
    - `Winged Lock`
    - `Onyx Lock`
    - `Stone Lock`
    - `Cross Lock`
    - `Topaz Lock`
    - `Skeleton Lock`
    - `Gold Lock`
    - `Tourquoise Lock`
    - `Emerald Lock`
    - `Ruby Lock`
    - `Ra Lock`
    - `Master Lock`
    - `Coin Slot`
    - `Gem Hole`
  - branchement: [src/data/originalWallOverlays.ts](/D:/DungeonMaster-codex/src/data/originalWallOverlays.ts)

## Fichiers originaux presents mais pas prioritaires a refaire

Le repertoire [public/game/images/misc/original](/D:/DungeonMaster-codex/public/game/images/misc/original) contient beaucoup d'autres bitmaps extraits.

Dans l'etat actuel du runtime, ils ne sont pas tous utilises activement.
La priorite de refonte doit donc rester:

1. `doorIronOriginal.bmp`
2. `doorRaOriginal.bmp`
3. `full_torch_holder.bmp`
4. la famille generique `serrure.png`

# Missing Wall Overlay Images

This file tracks the current runtime status of original wall overlay families after the latest asset pass.

Notes:
- [public/misc/serrure.png](D:\DungeonMaster-codex\public\misc\serrure.png) is still intentionally used as a generic lock or slot sprite for many lock families.
- [public/misc/wall_foutain_overlay.png](D:\DungeonMaster-codex\public\misc\wall_foutain_overlay.png) is the active runtime sprite for `Fountain`.
- `Champion Mirror` and wall inscriptions are intentionally excluded here because they are rendered through dedicated systems.

## Runtime Status

The following families now have a dedicated image mapped in [src/data/originalWallOverlays.ts](D:\DungeonMaster-codex\src\data\originalWallOverlays.ts):

- `Fountain`
- `Vi Altar`
- `Lever Up`
- `Lever Down`
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
- `Full Torch Holder`
- `Empty Torch Holder`
- `Square Alcove`
- `Arched Alcove`
- `Small Switch`
- `Tiny Switch`
- `Big Switch In`
- `Big Switch Out`
- `Blue Switch In`
- `Blue Switch Out`
- `Green Switch In`
- `Green Switch Out`
- `Red Switch In`
- `Red Switch Out`
- `Crack Switch In`
- `Crack Switch Out`
- `Eye Switch`
- `Fireball Holes`
- `Dagger Holes`
- `Poison Holes`
- `Slime Outlet`
- `Amalgam (Encased Gem)`
- `Amalgam (Free Gem)`
- `Amalgam (Without Gem)`
- `Lord Order (Outside)`
- `Crack`
- `Iron Ring`
- `Manacles`

## Still Missing

No gameplay-relevant wall overlay family is currently missing a dedicated image asset.

## Files Present But Not Used By Wall Overlay Mapping

These files exist in [public/misc](D:\DungeonMaster-codex\public\misc) but are not currently used by the wall overlay runtime mapping:

- `Dm_logo.png`
- `grille_metal.png`
- `parchemin.png`
- `stairs_down.png`
- `stairs_up.png`
- `wall_crack2.png`

This is not necessarily a problem. Some of these belong to other systems or may be future alternates.

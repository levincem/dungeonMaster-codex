# Active Image Placeholders

Liste des placeholders visuels encore vraiment branches dans le runtime.

Verification de reference faite dans le code runtime le 2026-04-22:

- la dette visuelle restante n'est plus principalement un sujet de bitmap original actif
- la famille de locks dediee, `Coin Slot` et `Gem Hole` ont maintenant leurs PNG modernes branches individuellement
- le reliquat visuel est surtout du polish, pas un placeholder generique encore actif

Regle du projet a conserver:

- les assets refaits / modernises sont prioritaires
- les bitmaps originaux ne doivent servir qu'en placeholder temporaire

Note de composition runtime:

- les tailles d'affichage des overlays modernes ne sont plus laissees a des ratios locaux disperses
- un preset partage de composition existe maintenant dans [src/data/wallDecalPresets.ts](/D:/DungeonMaster-codex/src/data/wallDecalPresets.ts)
- `originalWallOverlays.ts` et `WallDecal.tsx` reutilisent ce meme preset pour garder les ratios aligns entre donnees runtime et rendu 3D
- dernier recalage runtime visible: locks a `0.20`; `Hook`, `Wood Ring`, `Slime` et `Grate` descendent maintenant a un gabarit carre `0.15 x 0.15`; `Full Torch Holder` et `Empty Torch Holder` passent eux aussi par ce preset partage; `Ghoul's Head` garde son remake dedie actuel; la fontaine garde son gabarit dedie
- comportement ferme recent: `Full Torch Holder / Empty Torch Holder` alternent maintenant sans double rendu; la torche visible vient de l'overlay plein, et le ramassage passe par une zone de pickup invisible au meme emplacement

## Rendu energie ferme

- `Ra Door`
  - le rendu visible n'est plus traite comme un bitmap a repeindre
  - la presentation passe maintenant par un panneau energetique procedural + `PhotonsRaDoorCurtain`
  - branchement principal: [src/components/Dungeon/Cell.tsx](/D:/DungeonMaster-codex/src/components/Dungeon/Cell.tsx)
  - note: `doorRaOriginal.bmp` peut encore exister comme fallback legacy sur disque, mais ce n'est plus le rendu cible a finir

## Placeholders modernes generiques fermes

Le bloc suivant n'est plus branche generiquement dans le runtime des overlays muraux:

- famille `serrure.png`
- `Gem Hole` via `eye.png`

Les overlays suivants pointent maintenant chacun vers leur PNG moderne dedie dans [public/game/images/misc](/D:/DungeonMaster-codex/public/game/images/misc):

- toutes les variantes de locks
- `Coin Slot`
- `Gem Hole`

## Prompt pack de refonte

Le CSV de production des prompts image a ete remis a jour ici:

- [docs/wall_overlay_remake_prompts.csv](/D:/DungeonMaster-codex/docs/wall_overlay_remake_prompts.csv)

Il ne contient plus `Ra Door`, qui sort de la pile `assets a peindre` et de la pile `VFX a finaliser`.
Le lot genere puis retouche a ete importe depuis [docs/temp_generated_overlays](/D:/DungeonMaster-codex/docs/temp_generated_overlays).

## Fichiers originaux presents mais pas prioritaires a refaire

Le repertoire [public/game/images/misc/original](/D:/DungeonMaster-codex/public/game/images/misc/original) contient beaucoup d'autres bitmaps extraits.

Dans l'etat actuel du runtime, ils ne sont pas tous utilises activement.
La priorite n'est plus la fermeture de placeholders generiques locks/gem hole, qui est maintenant faite.

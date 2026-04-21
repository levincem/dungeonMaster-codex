# Wall Overlay Remake Todo

Politique courante:

- si une image refaite dediee existe pour une famille d'overlay, elle est prioritaire
- sinon le runtime utilise le BMP original correspondant
- les cas ci-dessous restent volontairement en fallback original pour ne pas perdre la fidelite visuelle

Overlays encore en fallback BMP d'origine:

- aucun actuellement

CSV de production prompts:

- [wall_overlay_remake_prompts.csv](/D:/DungeonMaster-codex/docs/wall_overlay_remake_prompts.csv)

Source de verite runtime:

- [originalWallOverlays.ts](/D:/DungeonMaster-codex/src/data/originalWallOverlays.ts)
- [wall-overlay-visual-fidelity.test.ts](/D:/DungeonMaster-codex/tests/wall-overlay-visual-fidelity.test.ts)

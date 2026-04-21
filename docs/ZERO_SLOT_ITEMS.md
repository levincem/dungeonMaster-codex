# Zero Slot Items

Etat pose le `2026-04-21`.

Liste actuelle des objets source avec `allowedSlotsMask = 0` dans `game_db.json`:

- `Misc 51` : `Zokathra`

Conclusion actuelle:

- il n'existe aucun `Weapon`, `Armor`, `Potion`, `Scroll` ou `Container` source-backed a `0 slot`
- le seul cas runtime encore interprete localement est donc `Zokathra`

Politique runtime actuelle:

- l'exception est explicite dans [equipment.ts](/D:/DungeonMaster-codex/src/data/equipment.ts)
- `Zokathra` reste equipable uniquement en `rightHand` / `leftHand`
- cette exception est testee dans [equipment-runtime-fidelity.test.ts](/D:/DungeonMaster-codex/tests/equipment-runtime-fidelity.test.ts)

Nuance honnete:

- la source ne fournit ici aucun slot exploitable
- le choix `mains uniquement` reste donc une interpretation runtime minimale, pas une preuve binaire extraite
- l'important est qu'elle soit maintenant isolee, nommee et testee, au lieu d'etre portee par un fallback generique silencieux

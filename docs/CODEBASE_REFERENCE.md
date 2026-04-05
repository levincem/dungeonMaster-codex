# DungeonMaster Codex — Référence codebase

Document vivant. Mis à jour à chaque session de travail significative.
Dernière mise à jour : 2026-04-05

---

## Stack technique

| Outil | Rôle |
|---|---|
| React + TypeScript | UI et composants |
| Vite | Build + dev server |
| Three.js + React Three Fiber | Rendu 3D du donjon |
| Zustand | State management global |
| `@react-three/drei` | Helpers R3F (camera, textures…) |

---

## Architecture globale

```
src/
├── App.tsx               — Point d'entrée : affiche LoadingScreen, puis lazy-load GameRoot
├── GameRoot.tsx          — Boucle de jeu (RAF), monte DungeonScene + HUD + popups
├── engine/
│   ├── store.ts          — Store Zustand : TOUT l'état du jeu + toutes les actions
│   ├── sounds.ts         — Chargement et lecture des sons
│   └── constants.ts      — GRID_SIZE, WALL_HEIGHT, etc.
├── components/
│   ├── Dungeon/
│   │   ├── DungeonScene.tsx    — Scène 3D complète (tuiles, créatures, items, fog, interactions)
│   │   ├── Cell.tsx            — Rendu d'une tuile (Floor/Door/etc.) + pressure plates
│   │   ├── InstancedTiles.tsx  — Rendu optimisé des tuiles par instancing Three.js
│   │   ├── CreatureSprite.tsx  — Sprite billboard pour créatures (frames animées)
│   │   ├── FloorItemMesh.tsx   — Mesh pour item posé au sol
│   │   ├── WallDecal.tsx       — Décoration murale (textures alphaMap)
│   │   ├── WallSensor.tsx      — Bouton/levier mural cliquable
│   │   └── Torch.tsx           — Torche murale décorative
│   └── UI/
│       ├── HUD.tsx             — Interface principale : déplacement, combat, runes, inventaire rapide
│       ├── ChampionSheet.tsx   — Fiche détaillée d'un champion (inventaire complet, équipement)
│       ├── MirrorPopup.tsx     — Popup de recrutement via les miroirs du Hall of Champions
│       ├── HeroSelectionScreen.tsx — Écran de sélection (codé mais non branché en prod)
│       ├── LoadingScreen.tsx   — Écran de chargement (précharge dungeon.json + assets)
│       └── RunePanel.tsx       — Panel de lancement de sorts
├── data/
│   ├── champions.ts      — 24 champions DM1 (stats, portraits, classes)
│   ├── creatures.ts      — Types de créatures (HP, vitesse, XP, etc.)
│   ├── items.ts          — WEAPON_TYPES, ARMOR_TYPES, POTION_TYPES, MISC_TYPES
│   ├── itemImages.ts     — Mapping typeId → nom de fichier image (par catégorie)
│   ├── runes.ts          — 24 runes DM1 + définitions de sorts (findSpell, getSkillLevel)
│   ├── spells.ts         — Types TypeScript pour les sorts
│   ├── mapLoader.ts      — Chargement de public/dungeon.json → GameMap[]
│   ├── dungeonData.ts    — Chargement synchrone du JSON (initialisé au boot)
│   ├── mechanisms.ts     — Parsing Old_data/mechanisms.json (leviers, serrures, dalles…)
│   └── level0.ts / level1.ts — Données de niveau (legacy ou supplément ?)
└── types/
    ├── game.ts           — Types principaux : GameMap, GameTile, FloorItem, CreatureInstance, ChampionEquipment…
    ├── items.ts          — WeaponDef, ArmorDef, PotionDef, MiscDef, EquipSlotKey
    └── spells.ts         — Types de sorts
```

---

## src/engine/store.ts — Le cœur

C'est le fichier le plus important. Contient toute la logique de jeu sous forme d'un store Zustand.

### État principal (`GameState`)

| Champ | Type | Description |
|---|---|---|
| `level` | `number` | Index de carte actuel (0 = Hall of Champions) |
| `position` | `[y, x]` | Position du groupe (attention : [y, x], pas [x, y]) |
| `direction` | `Direction` | `'NORTH'` / `'EAST'` / `'SOUTH'` / `'WEST'` |
| `party` | `Champion[]` | Champions vivants dans le groupe (max 4) |
| `selectedChampionIndex` | `number` | Index dans `party` — ramasse les items |
| `creatures` | `CreatureInstance[]` | Toutes les créatures de tous les niveaux |
| `floorItems` | `FloorItem[]` | Items posés au sol (tous niveaux confondus) |
| `championInventories` | `Record<id, FloorItem[]>` | Inventaire par champion |
| `championEquipment` | `Record<id, ChampionEquipment>` | Équipement par champion |
| `championVitals` | `Record<id, ChampionVitals>` | HP / Stamina / Mana en cours |
| `championXP` | `Record<id, ChampionXP>` | XP accumulé par discipline (fighter/ninja/priest/wizard) |
| `championCombat` | `Record<id, ChampionCombat>` | Cooldown d'attaque par champion |
| `deadChampions` | `Record<id, Champion>` | Champions morts, conservés pour résurrection |
| `openDoors` | `Set<string>` | Clés `"level,y,x"` des portes ouvertes |
| `openTeleporters` | `Set<string>` | Téléporteurs actifs |
| `firedSensors` | `Set<string>` | Capteurs déjà activés (oneShot) |
| `visibleTexts` | `Set<string>` | Textes muraux visibles |
| `spellLights` | `SpellLight[]` | Lumières actives (sorts, torches) |
| `projectiles` | `Projectile[]` | Projectiles en vol |
| `activeShields` | `PartyShield[]` | Boucliers magiques actifs |
| `torchBurnStart` | `Record<itemId, ms>` | Timestamp d'allumage des torches |
| `invisibleUntil` | `number` | Timestamp fin d'invisibilité |
| `footprintHistory` | `FootprintEntry[]` | Historique de positions (sort empreintes) |
| `damageEvents` | `DamageEvent[]` | Chiffres de dégâts flottants (UI) |

### Actions importantes

| Action | Description |
|---|---|
| `moveForward/Backward/strafeLeft/strafeRight/turnLeft/turnRight` | Déplacement |
| `addToParty(champion)` | Recruter un champion (via miroir) |
| `removeFromParty(id)` | Retirer un champion (drop son inventaire + équipement) |
| `killChampion(id)` | Tuer un champion à 0 HP : drop os + items, retire du groupe, stocke dans `deadChampions` |
| `resurrectChampion(bonesItemId)` | Ressusciter via autel : champion revient avec 1 HP |
| `pickupItem(id)` | Ramasser un item du sol → inventaire du champion sélectionné |
| `dropItem(itemId, championId)` | Poser un item au sol (si os sur autel → résurrection) |
| `equipItem / unequipItem` | Équipement/déséquipement |
| `giveItem / giveEquippedItem` | Transfert entre champions |
| `attackFront(id)` | Champion attaque les créatures devant |
| `castSpell(id, runeIds)` | Lance un sort |
| `regenTick(delta)` | Régénération HP/Stamina/Mana |
| `tickCombat(delta)` | Cooldowns d'attaque + nettoyage DamageEvents |
| `tickMonsters(delta)` | IA des créatures (mouvement + attaque) + détection morts champions |
| `tickDoors(delta)` | Logique d'écrasement de portes |
| `tickSpells(now)` | Expire les lumières/sorts, avance les projectiles |
| `toggleDoor(x, y)` | Ouvrir/fermer une porte |
| `activateWallSensor(mapIndex, x, y, idx)` | Déclencher un capteur mural |
| `goToLevel(level, pos, dir)` | Changer de niveau |

### Helpers internes clés

| Fonction | Description |
|---|---|
| `getMap(level)` | Retourne le `GameMap` pour un niveau |
| `isAltarTile(level, x, y)` | Vérifie si la tuile contient un objet Text "ALTAR" |
| `buildDeathDrop(state, championId)` | Crée les FloorItems (os + équipement) et met à jour le groupe |
| `creaturesInFront(level, pos, dir, creatures)` | Créatures directement devant le groupe |
| `hasLineOfSight(map, ax, ay, bx, by)` | Rayon de visibilité sur grille |
| `computeLightLevel(...)` | Calcule le niveau de lumière (torches + sorts) |
| `xpToLevel(xp)` | floor(sqrt(xp / 500)) |
| `torchStateIndex(elapsedMs)` | État visuel d'une torche (0=éteinte, 3=neuve) |

### Pub/Sub externes (hors Zustand)

- `subscribePlateActivated(fn)` — callback quand une dalle de pression est activée
- `onCreatureAction(fn)` — callback quand une créature bouge ou attaque (pour animer les sprites)

---

## src/types/game.ts — Types principaux

### `FloorItem`
```typescript
{
  id: string;
  category: 'Weapon' | 'Armor' | 'Potion' | 'Scroll' | 'Misc' | 'Container';
  typeId: number;
  rawName?: string;
  mapIndex: number; x: number; y: number;
  tilePos: CardinalDir;
  championId?: number;  // présent sur les os (Misc typeId 28) → lien champion mort
}
```

### `CreatureInstance`
```typescript
{ id, typeId, mapIndex, x, y, currentHP, alive, side: 'left'|'right' }
```

### `ChampionEquipment`
`Partial<Record<EquipSlotKey, FloorItem>>` — les slots sont : `head, neck, torso, hands, belt, legs, feet, rightHand, leftHand`

### `GameMap` / `GameTile`
- `GameMap` : index, name, level, width, height, `tiles: GameTile[]` (tableau **plat**, pas 2D)
- Accès par grille dans le store : `map.tiles[y]?.[x]` (après chargement, les tiles sont réindexées en 2D)

---

## src/data/

### Champions (champions.ts)
- 24 champions, id 0–23 = portraitId
- Stats sur échelle 0–100 (authentique DM1)
- `CHAMPION_BY_ID: Record<number, Champion>`
- `CLASS_COLORS` : couleurs par classe Fighter/Ninja/Wizard/Priest

### Créatures (creatures.ts)
- `CREATURE_TYPES: Record<number, CreatureDef>`
- Champs : `name, baseHP, exp, moveSpd, atkSpd` (vitesse en "ticks", divisée par 6 pour avoir des secondes)

### Items (items.ts)
- `WEAPON_TYPES` : typeId → WeaponDef (damage, weight, atkSpd, twoHanded…)
- `ARMOR_TYPES` : typeId → ArmorDef (slot, armor, weight)
- `POTION_TYPES` : typeId → PotionDef (effect, restore…)
- `MISC_TYPES` : typeId → MiscDef (usable, food, nutrition…)
  - typeId 24 = 'Ashes' (`ashes.png`)
  - typeId 28 = 'Bones' (`bones.png`) — os d'un champion mort, porte un `championId`

### Images (itemImages.ts)
- `MISC_IMAGES: Record<typeId, filename>` — chemin relatif depuis `public/misc/`
- `WEAPON_IMAGES`, `ARMOR_IMAGES`, `POTION_IMAGES` — idem

### Runes (runes.ts)
- 24 runes : 6 power (Lo→Mon), 6 element (Ya→Des), 6 form (Zo→…), 6 alignment
- `findSpell(runeIds)` → SpellDef ou null
- `getSkillLevel(xp, skill)` → niveau de compétence

### Mécanismes (mechanisms.ts)
- Parse `Old_data/mechanisms.json`
- Kinds présents : leviers, dalles de pression, serrures, alcôves, échangeurs…
- `getMechanismsAt(level, x, y, face)` → `Mechanism[]`

### Map loader (mapLoader.ts)
- Charge `public/dungeon.json` (copie de `Old_data/dungeon.json`, servie au runtime)
- Produit `GAME_MAPS: GameMap[]` et `CHAMPION_START_POSITIONS`
- `getGameMap(level)` → GameMap
- Les tiles sont stockées en `tiles[y][x]` après chargement

---

## Données du donjon (Old_data/)

| Fichier | Contenu |
|---|---|
| `dungeon.json` | 14 maps, tiles, objets (créatures, items, portes, textes, téléporteurs, capteurs) |
| `mechanisms.json` | Mécanismes interactifs (leviers, dalles, serrures…) |
| `game_db.json` | Base de données originale (champions, sorts, créatures, items) |

### Autels de résurrection (Vi Altar)
Représentés comme objets `Text` avec le texte `"ALTAR"` sur une face de tuile :
- Map 0 (Hall of Champions) : tuile (5, 17), face West
- Map 2 (Level 2) : tuile (28, 29), face West
- Map 5 (Level 5) : tuile (24, 28), face East

---

## Boucle de jeu (GameRoot.tsx)

```
requestAnimationFrame → tick(now)
  delta = min((now - lastTime) / 1000, 0.1)  ← capped à 100ms
  regenTick(delta)      ← HP/Stamina/Mana
  tickCombat(delta)     ← cooldowns attaque + nettoyage DamageEvents
  tickMonsters(delta)   ← IA créatures + détection morts champions
  tickDoors(delta)      ← écrasement de portes
  tickSpells(now)       ← expiration sorts + mouvement projectiles
```

---

## Système de combat (store.ts)

### Groupe → Créatures
- `attackFront(championId)` : champion attaque les créatures sur la tuile devant
- Formule : `baseDmg = random(dmgMin, dmgMax)` + bonus STR/DEX
- XP attribuée au champion attaquant + XP de kill partagée entre vivants

### Créatures → Groupe
- `tickMonsters` — pour chaque créature adjacente au groupe :
  - `getTarget(side)` : cible le rang avant de la colonne préférée, fallback rang arrière, fallback colonne opposée
  - Filtre `vitals[c.id].hp > 0` — un champion à 0 HP n'est plus ciblé
  - Dégâts : `exp/8` → `exp/4` aléatoire, réduits par boucliers actifs
  - Si HP → 0 : ajouté à `newlyDead[]`, traité après la boucle (os + items dropés, retiré du groupe)

### Mort d'un champion
1. HP atteint 0 dans `tickMonsters` (ou `killChampion` manuellement)
2. `buildDeathDrop` génère :
   - Tous les items d'inventaire dropés à la position du groupe
   - Tous les items équipés dropés à la position du groupe
   - Un `FloorItem` `{ category:'Misc', typeId:28, championId }` (os, image `bones.png`)
3. Champion retiré de `party`, stocké dans `deadChampions[id]`
4. `selectedChampionIndex` clampé si nécessaire

### Résurrection via Vi Altar
1. Ramasser les os (`pickupItem`) → dans l'inventaire du champion sélectionné
2. Se déplacer sur une tuile d'autel (map 0/2/5)
3. Déposer les os (`dropItem`) OU appeler `resurrectChampion(bonesItemId)`
4. Si `isAltarTile(level, x, y)` → champion ressuscité avec `{ hp:1, stamina:0, mana:0 }`
5. Inventaire/équipement vides (à refaire)
6. Bloqué si groupe déjà à 4 champions

---

## Système de sorts

Règle de cast : rune de puissance EN PREMIER, puis 1–3 runes supplémentaires.

| Rune | Rôle |
|---|---|
| Lo/Um/On/Ee/Pal/Mon | Puissance (factor 8→28, coût mana croissant) |
| Ya/Vi/Oh/Kath/Ful/Des | Élément |
| Zo/… | Forme |
| (row 3) | Alignement |

Sorts implémentés : fireball, lightning, poison cloud, plasma, light (FUL), OH IR RA, shield, fire_shield, invisibility, magic_vision, footprints, potions
Sorts non implémentés : darkness (partiel), certaines potions créées

---

## Slots d'équipement (`EquipSlotKey`)

`head | neck | torso | hands | belt | legs | feet | rightHand | leftHand`

---

## Conventions importantes

- Position : toujours `[y, x]` dans le store (ligne, colonne)
- Tiles : `map.tiles[y][x]` après parsing (le JSON source est plat)
- IDs de créatures : `"mapIndex_x_y_objectIndex"`
- IDs d'items au sol : string unique (UUID-like ou `"bones_championId_timestamp"`)
- Champion `id` = `portraitId` (0–23)
- `CardinalDir` = `'North' | 'East' | 'South' | 'West'` (majuscule — différent de `Direction`)
- `Direction` = `'NORTH' | 'EAST' | 'SOUTH' | 'WEST'` (tout majuscule — utilisé pour le déplacement)

---

## Assets (public/)

```
public/
├── dungeon.json          — Copie runtime de Old_data/dungeon.json
├── portraits/            — Portraits des 24 champions (elija.png, halk.png…)
├── sprites/              — Sprites des créatures (par typeId)
├── textures/             — Textures murales du donjon
├── misc/                 — Images des objets Misc (bones.png, ashes.png, apple.png…)
├── items/                — Images des armes/armures
├── runes/                — Images des runes ({id}_on.png / {id}_off.png)
└── sounds/               — Sons du jeu
```

---

## État d'avancement (par rapport à REMAKE_STATUS.md)

| Phase | État |
|---|---|
| Phase 1 — Build stable | ✅ Terminé |
| Phase 2 — Flow de jeu (game over, victoire) | 🔲 Non commencé |
| Phase 3 — Magie complète | 🔶 Partiel (sorts de base OK, shield/invisibilité/vision OK, reste darkness/potions) |
| Phase 4 — Objets et statuts (faim, soif, poison) | 🔲 Non commencé |
| Phase 5 — Interactions de carte (pits, cordes, serrures) | 🔶 Partiel |
| Phase 6 — Combat et IA | 🔶 Partiel (base solide, formules simplifiées) |
| Phase 7 — Assets et polish | 🔶 En cours |
| Phase 8 — Sauvegarde / menu | 🔲 Non commencé |

### Ajouts session 2026-04-05
- Système de mort de champion : os (`Misc` typeId 28) dropés au sol avec tout le contenu
- Résurrection via Vi Altar : `dropItem` ou `resurrectChampion` sur tuile autel
- `FloorItem.championId` — lien entre os et champion mort
- `GameState.deadChampions` — conservation des données pour résurrection
- `isAltarTile`, `buildDeathDrop` — helpers internes store.ts
- `killChampion`, `resurrectChampion` — actions publiques store.ts
- Fix `getTarget` dans `tickMonsters` : utilise `vitals` (mutable) au lieu de `state.championVitals`
- **Fix murs manquants** : `MIRROR_WALL_MAP` / `MIRROR_FACE_MAP` utilisaient la clé `"x,y"` sans l'index de map → des tuiles murs de Level 1 aux mêmes coordonnées que des miroirs du Hall of Champions (map 0) étaient silencieusement exclues du rendu InstancedTiles. Fix : clé `"mapIndex,x,y"` partout. `ChampionStartPos` inclut maintenant `mapIndex`.

### Conventions — MIRROR_WALL_MAP / MIRROR_FACE_MAP

Les deux Maps exportées depuis `store.ts` utilisent la clé `"${mapIndex},${x},${y}"`.
Tous les accès (InstancedTiles, DungeonScene) doivent inclure l'index de la map dans la clé.
Les miroirs n'existent que sur map 0 (Hall of Champions), mais le filtre s'applique génériquement.

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const ATARI_STATS = path.join(ROOT, "output", "atari_i559_stats.json");
const STATS_REF = path.join(ROOT, "output", "stats_reference.json");
const GAME_DB = path.join(ROOT, "..", "..", "public", "game_db.json");
const OUT_JSON = path.join(ROOT, "output", "atari_game_db_comparison.json");

const FOOD_NAMES = [
  "Apple",
  "Corn",
  "Bread",
  "Cheese",
  "Screamer Slice",
  "Worm Round",
  "Shank",
  "Dragon Steak",
];

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function pick(obj, keys) {
  return Object.fromEntries(keys.map((k) => [k, obj?.[k] ?? null]));
}

function diffEntries(entries, keys) {
  return keys
    .map((key) => {
      const atari = entries.atari?.[key] ?? null;
      const current = entries.current?.[key] ?? null;
      return atari === current ? null : { key, atari, current };
    })
    .filter(Boolean);
}

function main() {
  const atari = readJson(ATARI_STATS);
  const ref = readJson(STATS_REF);
  const game = readJson(GAME_DB);

  const creatures = ref.monsters.map((entry) => {
    const atariEntry = atari.creatures[entry.index] ?? null;
    const currentIndex = entry.matchedDerived?.index;
    const current = currentIndex != null ? game.creatureTypes?.[currentIndex] ?? null : null;
    const atariView = atariEntry
      ? {
          baseHP: atariEntry.baseHealth,
          armor: atariEntry.defense,
          hitProb: atariEntry.dexterity,
          atkSpd: atariEntry.attackTicks,
          moveSpd: atariEntry.movementTicks,
          poisonAttack: atariEntry.poisonAttack,
        }
      : null;
    return {
      index: entry.index,
      name: entry.displayName,
      atari: atariView,
      current,
      differences: diffEntries({ atari: atariView, current }, [
        "baseHP",
        "armor",
        "hitProb",
        "atkSpd",
        "moveSpd",
      ]),
    };
  });

  const foods = FOOD_NAMES.map((name, index) => {
    const current = Object.values(game.miscTypes ?? {}).find((v) => v?.name === name) ?? null;
    return {
      index,
      name,
      atariNutrition: atari.foodValues[index] ?? null,
      currentNutrition: current?.nutrition ?? null,
      currentWeight: current?.weight ?? null,
      different: (atari.foodValues[index] ?? null) !== (current?.nutrition ?? null),
    };
  });

  const weapons = ref.weapons
    .filter((entry) => entry.matchedDerived && atari.weapons[entry.index])
    .map((entry) => {
      const atariEntry = atari.weapons[entry.index];
      const current = game.weaponTypes?.[entry.matchedDerived.index] ?? null;
      const atariView = {
        weight: atariEntry.weightKg,
        damage: atariEntry.damage,
        atkClass: atariEntry.rawClass,
        kineticEnergy: atariEntry.kineticEnergy,
      };
      return {
        index: entry.index,
        name: entry.displayName,
        atari: atariView,
        current: pick(current, ["weight"]),
      };
    });

  const clothing = ref.clothing
    .filter((entry) => entry.matchedDerived && atari.cloths[entry.index])
    .map((entry) => {
      const atariEntry = atari.cloths[entry.index];
      const current = game.armorTypes?.[entry.matchedDerived.index] ?? null;
      const atariView = {
        weight: atariEntry.weightKg,
        armor: atariEntry.protection,
        sharpDefense: atariEntry.sharpDefense,
        isShield: atariEntry.isShield,
      };
      return {
        index: entry.index,
        name: entry.displayName,
        atari: atariView,
        current: pick(current, ["weight", "armor"]),
      };
    });

  const summary = {
    generatedAt: new Date().toISOString(),
    creaturesCompared: creatures.length,
    creaturesWithDifferences: creatures.filter((x) => x.differences.length > 0).length,
    foodsCompared: foods.length,
    foodsWithDifferences: foods.filter((x) => x.different).length,
    weaponsCompared: weapons.length,
    clothingCompared: clothing.length,
  };

  const report = { summary, creatures, foods, weapons, clothing };
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUT_JSON}`);
}

main();

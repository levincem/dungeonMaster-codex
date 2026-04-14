const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const ATARI_STATS = path.join(ROOT, "output", "atari_i559_stats.json");
const ATARI_SPELLS = path.join(ROOT, "output", "atari_i560_stats.json");
const STATS_REF = path.join(ROOT, "output", "stats_reference.json");
const GAME_DB = path.join(ROOT, "..", "..", "src", "assets", "data", "game_db.json");
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
  const atariSpells = readJson(ATARI_SPELLS);
  const ref = readJson(STATS_REF);
  const game = readJson(GAME_DB);
  const copiedI559 = game.originalAtari?.i559 ?? {};
  const copiedI560Spells = game.originalAtari?.i560?.spells ?? [];
  const gameDbSpells = game.spells ?? [];

  const creatures = ref.monsters.map((entry) => {
    const atariEntry = atari.creatures[entry.index] ?? null;
    const currentRaw = copiedI559.creatures?.[entry.index] ?? null;
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
    const current = currentRaw
      ? {
          baseHP: currentRaw.baseHealth ?? null,
          armor: currentRaw.defense ?? null,
          hitProb: currentRaw.dexterity ?? null,
          atkSpd: currentRaw.attackTicks ?? null,
          moveSpd: currentRaw.movementTicks ?? null,
          poisonAttack: currentRaw.poisonAttack ?? null,
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
        "poisonAttack",
      ]),
    };
  });

  const foods = FOOD_NAMES.map((name, index) => {
    const currentNutrition = copiedI559.foodValues?.[index] ?? null;
    return {
      index,
      name,
      atariNutrition: atari.foodValues[index] ?? null,
      currentNutrition,
      different: (atari.foodValues[index] ?? null) !== currentNutrition,
    };
  });

  const weapons = ref.weapons
    .filter((entry) => entry.matchedDerived && atari.weapons[entry.index])
    .map((entry) => {
      const atariEntry = atari.weapons[entry.index];
      const current = copiedI559.weapons?.[entry.index] ?? null;
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
        current: current
          ? {
              weight: current.weightKg ?? null,
              damage: current.damage ?? null,
              atkClass: current.rawClass ?? null,
              kineticEnergy: current.kineticEnergy ?? null,
            }
          : null,
        differences: diffEntries(
          {
            atari: atariView,
            current: current
              ? {
                  weight: current.weightKg ?? null,
                  damage: current.damage ?? null,
                  atkClass: current.rawClass ?? null,
                  kineticEnergy: current.kineticEnergy ?? null,
                }
              : null,
          },
          ["weight", "damage", "atkClass", "kineticEnergy"],
        ),
      };
    });

  const clothing = ref.clothing
    .filter((entry) => entry.matchedDerived && atari.cloths[entry.index])
    .map((entry) => {
      const atariEntry = atari.cloths[entry.index];
      const current = copiedI559.cloths?.[entry.index] ?? null;
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
        current: current
          ? {
              weight: current.weightKg ?? null,
              armor: current.protection ?? null,
              sharpDefense: current.sharpDefense ?? null,
              isShield: current.isShield ?? null,
            }
          : null,
        differences: diffEntries(
          {
            atari: atariView,
            current: current
              ? {
                  weight: current.weightKg ?? null,
                  armor: current.protection ?? null,
                  sharpDefense: current.sharpDefense ?? null,
                  isShield: current.isShield ?? null,
                }
              : null,
          },
          ["weight", "armor", "sharpDefense", "isShield"],
        ),
      };
    });

  const spells = atariSpells.spells.map((entry, index) => {
    const copied = copiedI560Spells[index] ?? null;
    return {
      index,
      atari: {
        runeOrdinals: entry.runeOrdinals ?? [],
        skillRequired: entry.skillRequired ?? null,
        spellType: entry.spellType ?? null,
        missileTypeBits: entry.missileTypeBits ?? null,
        recoveryTicks: entry.recoveryTicks ?? null,
      },
      copied: copied
        ? {
            runeOrdinals: copied.runeOrdinals ?? [],
            skillRequired: copied.skillRequired ?? null,
            spellType: copied.spellType ?? null,
            missileTypeBits: copied.missileTypeBits ?? null,
            recoveryTicks: copied.recoveryTicks ?? null,
          }
        : null,
      copiedDifferences: diffEntries(
        {
          atari: entry
            ? {
                runeOrdinals: JSON.stringify(entry.runeOrdinals ?? []),
                skillRequired: entry.skillRequired ?? null,
                spellType: entry.spellType ?? null,
                missileTypeBits: entry.missileTypeBits ?? null,
                recoveryTicks: entry.recoveryTicks ?? null,
              }
            : null,
          current: copied
            ? {
                runeOrdinals: JSON.stringify(copied.runeOrdinals ?? []),
                skillRequired: copied.skillRequired ?? null,
                spellType: copied.spellType ?? null,
                missileTypeBits: copied.missileTypeBits ?? null,
                recoveryTicks: copied.recoveryTicks ?? null,
              }
            : null,
        },
        ["runeOrdinals", "skillRequired", "spellType", "missileTypeBits", "recoveryTicks"],
      ),
    };
  });
  const catalogSignatures = gameDbSpells.map((spell) => spell.runeStr ?? "");
  const duplicateCatalogSignatures = [...new Set(catalogSignatures.filter((signature, index) => (
    signature && catalogSignatures.indexOf(signature) !== index
  )))];

  const summary = {
    generatedAt: new Date().toISOString(),
    creaturesCompared: creatures.length,
    creaturesWithDifferences: creatures.filter((x) => x.differences.length > 0).length,
    foodsCompared: foods.length,
    foodsWithDifferences: foods.filter((x) => x.different).length,
    weaponsCompared: weapons.length,
    weaponsWithDifferences: weapons.filter((x) => x.differences.length > 0).length,
    clothingCompared: clothing.length,
    clothingWithDifferences: clothing.filter((x) => x.differences.length > 0).length,
    spellsCompared: spells.length,
    copiedSpellsWithDifferences: spells.filter((x) => x.copiedDifferences.length > 0).length,
    runtimeCatalogSpellCount: gameDbSpells.length,
    runtimeCatalogHasExpectedCount: gameDbSpells.length === 25,
    runtimeCatalogDuplicateSignatures: duplicateCatalogSignatures.length,
  };

  const report = {
    summary,
    creatures,
    foods,
    weapons,
    clothing,
    spells,
    runtimeCatalog: {
      count: gameDbSpells.length,
      signatures: catalogSignatures,
      duplicateSignatures: duplicateCatalogSignatures,
    },
  };
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUT_JSON}`);
}

main();

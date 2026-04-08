const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OBJECTS_H = path.join(
  ROOT,
  "sourceCode",
  "Dungeon_Master_FTL_Games_1987_Source_Code",
  "csb",
  "CSBwin_SRC_20190702",
  "src",
  "Objects.h"
);
const GAME_DB = path.join(ROOT, "..", "..", "public", "game_db.json");
const OUTPUT = path.join(ROOT, "output", "stats_reference.json");

const ENUM_RANGES = {
  MONSTERTYPE: "mon_numTypes",
  WEAPONTYPE: "weapon_numTypes",
  CLOTHINGTYPE: "clothing_numTypes",
  MISCTYPE: "misc_numTypes",
};

const MONSTER_ALIASES = {
  Scorpion: "Giant Scorpion",
  SlimeDevil: "Swamp Slime",
  FlyingEye: "Wizard Eye",
  Hellhound: "Pain Rat",
  "5": "Ruster",
  Rive: "Ghost",
  Worm: "Magenta Worm",
  AntMan: "Trolin",
  Muncher: "Giant Wasp",
  DethKnight: "Animated Armour",
  Zytaz: "Materializer",
  Dragon: "Red Dragon",
  "25": "Lord Order",
};

const WEAPON_ALIASES = {
  TheFirestaffA: "The Firestaff",
  TheFirestaffB: "The Firestaff",
  ClawBow: "Bow",
  StaffOfIrra: "Staff Of Irra",
  CrossOfNeta: "Cross Of Neta",
  SerpentStaff: "Snake Staff",
};

const CLOTHING_ALIASES = {
  FineRobeA: "Fine Robe (Body)",
  FineRobeB: "Fine Robe (Legs)",
  Ghi: "Gi",
  CasqueNCoif: "Casque'n Coif",
  NetaShield: "Shield",
  SarShield: "Shield Of Lyte",
  HelmOfRa: "Helm Of Darc",
  PlateOfRa: "Plate Of Darc",
  PoleynOfRa: "Poleyn Of Darc",
  GreaveOfRa: "Greave Of Darc",
  ShieldOfRa: "Shield Of Darc",
};

const MISC_ALIASES = {
  SarCoin: "Copper Coin",
  GorCoin: "Gold Coin",
  TourquoiseKey: "Tourquoise Key",
  RabbitsFoot: "Rabbit's Foot",
  Corbum: "Orange Gem",
  ZokathraSpell: "Zokathra Spell",
};

function humanize(symbol) {
  return symbol
    .replace(/^[a-z]+_/, "")
    .replace(/^The/, "The ")
    .replace(/Of/g, " Of ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\bA\b/g, "A")
    .replace(/\bB\b/g, "B")
    .trim();
}

function normalize(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseEnumBlock(source, enumName) {
  const blockMatch = source.match(new RegExp(`enum\\s+${enumName}\\s*\\{([\\s\\S]*?)\\};`));
  if (!blockMatch) throw new Error(`Missing enum ${enumName}`);
  const endSymbol = ENUM_RANGES[enumName];
  const entries = [];
  let currentValue = 0;
  for (const rawLine of blockMatch[1].split(/\r?\n/)) {
    const line = rawLine.replace(/\/\/.*$/, "").trim();
    if (!line) continue;
    const match = line.match(/^([A-Za-z0-9_]+)\s*(?:=\s*([^,]+))?,?$/);
    if (!match) continue;
    const symbol = match[1];
    if (symbol === endSymbol) break;
    if (match[2]) {
      currentValue = Number(match[2].trim());
    }
    entries.push({ index: currentValue, symbol });
    currentValue += 1;
  }
  return entries;
}

function buildIndexByName(records) {
  const map = new Map();
  for (const [index, value] of Object.entries(records)) {
    if (!value?.name) continue;
    map.set(normalize(value.name), { index: Number(index), ...value });
  }
  return map;
}

function resolveDisplayName(symbol, aliases) {
  return aliases[symbol.replace(/^[a-z]+_/, "")] ?? humanize(symbol);
}

function mapEnum(entries, derivedByName, aliases, kind) {
  return entries.map(({ index, symbol }) => {
    const displayName = resolveDisplayName(symbol, aliases);
    const derived = derivedByName.get(normalize(displayName)) ?? null;
    return {
      index,
      symbol,
      displayName,
      matchedDerived: derived
        ? {
            index: derived.index,
            name: derived.name,
            values: Object.fromEntries(
              Object.entries(derived).filter(([key]) => key !== "index" && key !== "name")
            ),
          }
        : null,
      provenance: derived ? "derived_game_db_matched_by_name" : "missing_in_current_game_db",
      kind,
    };
  });
}

function buildFoodReference(miscMap) {
  const foods = [
    "Apple",
    "Corn",
    "Bread",
    "Cheese",
    "Screamer Slice",
    "Worm Round",
    "Shank",
    "Dragon Steak",
  ];
  return foods.map((name, index) => {
    const derived = miscMap.get(normalize(name)) ?? null;
    return {
      index,
      name,
      nutritionProvenance: derived?.nutrition != null ? "derived_game_db" : "missing_in_current_game_db",
      nutrition: derived?.nutrition ?? null,
      weight: derived?.weight ?? null,
    };
  });
}

function main() {
  const objectsH = fs.readFileSync(OBJECTS_H, "utf8");
  const gameDb = JSON.parse(fs.readFileSync(GAME_DB, "utf8"));

  const monsters = parseEnumBlock(objectsH, "MONSTERTYPE");
  const weapons = parseEnumBlock(objectsH, "WEAPONTYPE");
  const clothing = parseEnumBlock(objectsH, "CLOTHINGTYPE");
  const misc = parseEnumBlock(objectsH, "MISCTYPE");

  const derivedMonsters = buildIndexByName(gameDb.creatureTypes ?? {});
  for (const [sourceName, targetName] of Object.entries(MONSTER_ALIASES)) {
    const target = derivedMonsters.get(normalize(targetName));
    if (target) derivedMonsters.set(normalize(sourceName), target);
  }

  const derivedWeapons = buildIndexByName(gameDb.weaponTypes ?? {});
  for (const [sourceName, targetName] of Object.entries(WEAPON_ALIASES)) {
    const target = derivedWeapons.get(normalize(targetName));
    if (target) derivedWeapons.set(normalize(sourceName), target);
  }

  const derivedClothing = buildIndexByName(gameDb.armorTypes ?? {});
  for (const [sourceName, targetName] of Object.entries(CLOTHING_ALIASES)) {
    const target = derivedClothing.get(normalize(targetName));
    if (target) derivedClothing.set(normalize(sourceName), target);
  }

  const derivedMisc = buildIndexByName(gameDb.miscTypes ?? {});
  for (const [sourceName, targetName] of Object.entries(MISC_ALIASES)) {
    const target = derivedMisc.get(normalize(targetName));
    if (target) derivedMisc.set(normalize(sourceName), target);
  }

  const reference = {
    _meta: {
      source: "Original source-code enum alignment + current derived game_db values",
      generatedAt: new Date().toISOString(),
      exactConstants: {
        initialFood: "1500 + random(256)",
        initialWater: "1500 + random(256)",
        foodWaterCap: 2048,
        waterFlaskRestore: 800,
        waterskinRestore: 1600,
      },
      caveat:
        "Table indexes and field semantics come from original source code; most per-entry numeric stats still come from current derived game_db until byte-perfect table extraction is completed.",
    },
    monsters: mapEnum(monsters, derivedMonsters, MONSTER_ALIASES, "monster"),
    weapons: mapEnum(weapons, derivedWeapons, WEAPON_ALIASES, "weapon"),
    clothing: mapEnum(clothing, derivedClothing, CLOTHING_ALIASES, "clothing"),
    misc: mapEnum(misc, derivedMisc, MISC_ALIASES, "misc"),
    foods: buildFoodReference(derivedMisc),
    sourceCodeFieldLayout: {
      monsterDescriptor: [
        "uByte0",
        "attackSound",
        "word2",
        "word4",
        "movementTicks06",
        "attackTicks07",
        "defense08",
        "baseHealth09",
        "attack10",
        "poisonAttack11",
        "dexterity12",
        "unused13",
        "word14",
        "word16",
        "word18",
        "word20",
        "uByte22[4]",
      ],
      weaponDesc: ["weight", "uByte1", "uByte2", "uByte3", "word4"],
      clothingDesc: ["weight", "uByte1", "uByte2"],
      objectDesc: ["objectType", "graphicClass", "attackClass", "word4"],
    },
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(reference, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUTPUT}`);
}

main();

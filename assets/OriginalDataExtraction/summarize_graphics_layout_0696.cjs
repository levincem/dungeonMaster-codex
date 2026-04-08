const fs = require("fs");
const path = require("path");

const layoutPath = path.resolve(__dirname, "..", "..", "public", "graphics_layout_0696.json");
const graphicsDbPath = path.resolve(__dirname, "..", "..", "public", "graphics_db.json");
const outPath = path.resolve(__dirname, "output", "graphics_layout_0696_summary.json");

const layout = JSON.parse(fs.readFileSync(layoutPath, "utf8"));
const graphicsDb = JSON.parse(fs.readFileSync(graphicsDbPath, "utf8"));
const resourceById = new Map(graphicsDb.resourceIndex.map((entry) => [entry.id, entry]));

function familyFromDescription(description) {
  if (!description) return "unknown";
  if (/Interface|Main Screen|Dialog|Spell|Movement|Viewport/i.test(description)) return "ui";
  if (/Door Graphics|Door Ornate|Porticullis|Wooden Door|Iron Door|Ra Door/i.test(description)) return "door";
  if (/Wall|Wall Decoration|Wall Ornament|Alcove|Grate|Torch Holder/i.test(description)) return "wall";
  if (/Floor|Pit|Teleporter|Fluxcage/i.test(description)) return "floor";
  if (/Stairs/i.test(description)) return "stairs";
  if (/Missile|Lightning|Fireball|Poison|Projectile/i.test(description)) return "missile";
  if (/Creature|Monster|Dragon|Golem|Rat|Ghost|Skeleton|Vexirk|Screamer/i.test(description)) return "creature";
  if (/Item on floor|Items Graphics|Weapons|Clothes|Potion|Scroll|Junk|Key|Coin|Gem/i.test(description)) return "item";
  return "other";
}

function summarizeRecords(records) {
  const opcodeCounts = new Map();
  const familyCounts = new Map();
  const targetCounts = new Map();
  let nullTargetCount = 0;
  let withNegativeCoords = 0;

  for (const record of records) {
    opcodeCounts.set(record.opcode, (opcodeCounts.get(record.opcode) || 0) + 1);
    if (record.targetDescription) {
      const family = familyFromDescription(record.targetDescription);
      familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
      targetCounts.set(record.target, (targetCounts.get(record.target) || 0) + 1);
    } else {
      nullTargetCount += 1;
    }
    if (record.x < 0 || record.y < 0) withNegativeCoords += 1;
  }

  const topTargets = [...targetCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, count]) => ({
      id,
      count,
      description: resourceById.get(id)?.description ?? null,
      family: familyFromDescription(resourceById.get(id)?.description ?? null),
    }));

  return {
    recordCount: records.length,
    topOpcodes: [...opcodeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([opcode, count]) => ({ opcode, count })),
    familyCounts: [...familyCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([family, count]) => ({ family, count })),
    topTargets,
    nullTargetCount,
    withNegativeCoords,
  };
}

function overallGuess(summary) {
  const topFamily = summary.familyCounts[0]?.family ?? "unknown";
  if (topFamily === "ui") return "ui/layout";
  if (topFamily === "door") return "doors";
  if (topFamily === "stairs") return "stairs";
  if (topFamily === "creature") return "creatures";
  if (topFamily === "missile") return "missiles";
  if (topFamily === "item") return "items";
  if (topFamily === "wall" || topFamily === "floor") return "dungeon decorations";
  return "mixed/unknown";
}

const summary = {
  source: layoutPath,
  generatedAt: new Date().toISOString(),
  sectionPairs: layout.sectionPairs.map((pair) => {
    const ranges = pair.ranges.map((range, index) => {
      const rangeSummary = summarizeRecords(range.records4);
      return {
        index,
        startWord: range.startWord,
        endWord: range.endWord,
        lengthWords: range.lengthWords,
        guess: overallGuess(rangeSummary),
        ...rangeSummary,
      };
    });
    return {
      name: pair.name,
      ranges,
    };
  }),
  tailRanges: (layout.tailRanges || []).map((range) => {
    const rangeSummary = summarizeRecords(range.records4);
    return {
      name: range.name,
      label: range.label,
      startWord: range.startWord,
      endWord: range.endWord,
      lengthWords: range.lengthWords,
      guess: overallGuess(rangeSummary),
      ...rangeSummary,
    };
  }),
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ outPath, sectionPairCount: summary.sectionPairs.length }, null, 2));

const fs = require("fs");
const path = require("path");

const rawPath = path.resolve(__dirname, "EUDATA", "out_GRAPHICS.DAT", "0696.RAW1 [Unknown - Unknown Content (Words of data)].dat");
const graphicsDbPath = path.resolve(__dirname, "..", "..", "public", "graphics_db.json");
const outPath = path.resolve(__dirname, "output", "graphics_helper_0696.json");
const publicOutPath = path.resolve(__dirname, "..", "..", "public", "graphics_helper_0696.json");

function readWordsLE(buffer) {
  const words = [];
  for (let i = 0; i < buffer.length; i += 2) {
    words.push(buffer.readUInt16LE(i));
  }
  return words;
}

function signed16(value) {
  return value > 0x7fff ? value - 0x10000 : value;
}

function normalizeMapKeys(map) {
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([value, count]) => ({ value, count }));
}

function roleGuessForId(id) {
  if (id === 12) return { roleGuess: "isolated ui sentinel or marker", confidence: "low" };
  if (id >= 81 && id <= 84) return { roleGuess: "door-or-panel strip helper", confidence: "medium" };
  if (id >= 126 && id <= 128) return { roleGuess: "early screen row/column helper", confidence: "medium" };
  if (id >= 129 && id <= 133) return { roleGuess: "small placement grid template", confidence: "high" };
  if (id >= 134 && id <= 136) return { roleGuess: "medium placement grid template", confidence: "high" };
  if (id >= 137 && id <= 139) return { roleGuess: "large placement grid template", confidence: "high" };
  if (id === 150) return { roleGuess: "four-column ui anchor set", confidence: "medium" };
  if (id >= 151 && id <= 154) return { roleGuess: "absolute ui anchor variants", confidence: "medium" };
  if (id >= 155 && id <= 158) return { roleGuess: "ui origin anchors", confidence: "medium" };
  if (id >= 159 && id <= 162) return { roleGuess: "ui step/increment helpers", confidence: "medium" };
  if (id >= 171 && id <= 174) return { roleGuess: "single-offset ui anchors", confidence: "medium" };
  if (id >= 175 && id <= 178) return { roleGuess: "ui origin anchors (secondary set)", confidence: "medium" };
  if (id >= 183 && id <= 186) return { roleGuess: "ui anchors at x=43", confidence: "medium" };
  if (id >= 187 && id <= 190) return { roleGuess: "absolute ui label/button anchors", confidence: "medium" };
  if (id >= 191 && id <= 194) return { roleGuess: "three-step ui sweep helpers", confidence: "medium" };
  if (id >= 207 && id <= 210) return { roleGuess: "two-column panel anchors", confidence: "medium" };
  if (id === 220) return { roleGuess: "panel origin anchor", confidence: "low" };
  if (id === 221) return { roleGuess: "panel absolute anchor pair", confidence: "medium" };
  if (id === 222) return { roleGuess: "panel column anchors", confidence: "medium" };
  if (id === 223) return { roleGuess: "panel fill-column helpers", confidence: "medium" };
  if (id === 224 || id === 230 || id === 236 || id === 242) return { roleGuess: "panel incremental offset helper", confidence: "medium" };
  if (id === 244) return { roleGuess: "six-column strip helper", confidence: "medium" };
  if (id === 245) return { roleGuess: "panel base anchor", confidence: "medium" };
  return { roleGuess: null, confidence: null };
}

function buildFamilies(words, resourceById) {
  const helperStats = new Map();
  for (let i = 48; i + 3 < words.length; i += 4) {
    const target = words[i + 1];
    if (resourceById.get(target)?.type !== "NULL") continue;
    if (!helperStats.has(target)) {
      helperStats.set(target, {
        id: target,
        type: resourceById.get(target)?.type ?? null,
        description: resourceById.get(target)?.description ?? null,
        count: 0,
        ops: new Map(),
        xs: new Map(),
        ys: new Map(),
        refs: [],
      });
    }
    const entry = helperStats.get(target);
    const opcode = words[i];
    const x = signed16(words[i + 2]);
    const y = signed16(words[i + 3]);
    entry.count += 1;
    entry.ops.set(opcode, (entry.ops.get(opcode) || 0) + 1);
    entry.xs.set(x, (entry.xs.get(x) || 0) + 1);
    entry.ys.set(y, (entry.ys.get(y) || 0) + 1);
    entry.refs.push({
      wordIndex: i,
      opcode,
      x,
      y,
    });
  }

  return [...helperStats.values()]
    .sort((a, b) => a.id - b.id)
    .map((entry) => ({
      id: entry.id,
      type: entry.type,
      description: entry.description,
      ...roleGuessForId(entry.id),
      count: entry.count,
      opcodes: normalizeMapKeys(entry.ops),
      xValues: normalizeMapKeys(entry.xs),
      yValues: normalizeMapKeys(entry.ys),
      refs: entry.refs,
    }));
}

function detectRuns(words, helperIdSet) {
  const runs = [];
  let start = null;
  for (let i = 48; i + 3 < words.length; i += 4) {
    const target = words[i + 1];
    const helper = helperIdSet.has(target);
    if (helper && start === null) start = i;
    if (!helper && start !== null) {
      runs.push({ startWord: start, endWord: i - 4 });
      start = null;
    }
  }
  if (start !== null) {
    runs.push({ startWord: start, endWord: words.length - 4 });
  }
  return runs;
}

const raw = fs.readFileSync(rawPath);
const words = readWordsLE(raw);
const graphicsDb = JSON.parse(fs.readFileSync(graphicsDbPath, "utf8"));
const resourceById = new Map(graphicsDb.resourceIndex.map((entry) => [entry.id, entry]));
const helperIdSet = new Set();
for (let i = 48; i + 3 < words.length; i += 4) {
  const target = words[i + 1];
  if (resourceById.get(target)?.type === "NULL") {
    helperIdSet.add(target);
  }
}

const familyGroups = [
  { name: "misc early nulls", ids: [12, 81, 82, 83, 84] },
  { name: "early screens", ids: [126, 127, 128] },
  { name: "grid templates small", ids: [129, 130, 131, 132, 133] },
  { name: "grid templates medium", ids: [134, 135, 136] },
  { name: "grid templates large", ids: [137, 138, 139] },
  { name: "ui anchors a", ids: [150, 151, 152, 153, 154] },
  { name: "ui anchors b", ids: [155, 156, 157, 158, 159, 160, 161, 162] },
  { name: "ui anchors c", ids: [171, 172, 173, 174, 175, 176, 177, 178] },
  { name: "ui anchors d", ids: [183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194] },
  { name: "ui anchors e", ids: [207, 208, 209, 210, 220, 221, 222, 223, 224, 230, 236, 242, 244, 245] },
];

const exportData = {
  source: {
    rawPath,
    generatedAt: new Date().toISOString(),
    byteLength: raw.length,
    wordCount: words.length,
  },
  notes: [
    "NULL helper ids used by 0696 include the broad 126..245 band and a few smaller earlier ids such as 12 and 81..84.",
    "0696.RAW1 references a structured subset of these NULL resources as layout templates, placement grids and composite helpers.",
    "This export does not claim full semantic decoding, but it groups the helper ids into stable observed families.",
  ],
  helperRuns: detectRuns(words, helperIdSet),
  familyGroups,
  helperFamilies: buildFamilies(words, resourceById),
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(exportData, null, 2));
fs.writeFileSync(publicOutPath, JSON.stringify(exportData, null, 2));

console.log(JSON.stringify({ outPath, publicOutPath, helperCount: exportData.helperFamilies.length }, null, 2));

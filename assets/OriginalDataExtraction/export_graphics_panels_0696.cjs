const fs = require("fs");
const path = require("path");

const rawPath = path.resolve(__dirname, "EUDATA", "out_GRAPHICS.DAT", "0696.RAW1 [Unknown - Unknown Content (Words of data)].dat");
const graphicsDbPath = path.resolve(__dirname, "..", "..", "public", "graphics_db.json");
const outPath = path.resolve(__dirname, "output", "graphics_panels_0696.json");
const publicOutPath = path.resolve(__dirname, "..", "..", "public", "graphics_panels_0696.json");

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

function readRecords(words, start, end, resourceById) {
  const records = [];
  for (let i = start; i + 3 <= end; i += 4) {
    const target = words[i + 1];
    const resource = resourceById.get(target);
    records.push({
      wordIndex: i,
      opcode: words[i],
      target,
      targetDescription: resource?.description ?? null,
      width: resource?.width ?? null,
      height: resource?.height ?? null,
      x: signed16(words[i + 2]),
      y: signed16(words[i + 3]),
    });
  }
  return records;
}

const raw = fs.readFileSync(rawPath);
const words = readWordsLE(raw);
const graphicsDb = JSON.parse(fs.readFileSync(graphicsDbPath, "utf8"));
const resourceById = new Map(graphicsDb.resourceIndex.map((entry) => [entry.id, entry]));

const panels = [
  {
    name: "front-door-strip",
    roleGuess: "front door composite strip with helper spacing and mixed door families",
    confidence: "medium",
    startWord: 4340,
    endWord: 4416,
  },
  {
    name: "teleporter-floor-panel",
    roleGuess: "teleporter or floor-backed front panel with switch-state overlays",
    confidence: "medium",
    startWord: 4420,
    endWord: 4472,
  },
  {
    name: "door-frame-wall-pit-panel",
    roleGuess: "front wall panel combining door frames, wall surface and ceiling-pit strips",
    confidence: "medium",
    startWord: 4476,
    endWord: 4548,
  },
  {
    name: "stairs-front-panel",
    roleGuess: "front stairs composite with menu-door backdrop reference",
    confidence: "medium",
    startWord: 4552,
    endWord: 4576,
  },
  {
    name: "floor-item-grid",
    roleGuess: "floor item distribution grid",
    confidence: "high",
    startWord: 3812,
    endWord: 3940,
  },
];

const exportData = {
  source: {
    rawPath,
    generatedAt: new Date().toISOString(),
    byteLength: raw.length,
    wordCount: words.length,
  },
  notes: [
    "These panel guesses are derived from contiguous late-file ranges in 0696.RAW1.",
    "The goal is to expose reusable front-view composite groups rather than isolated placement tuples.",
    "Names remain descriptive and are not claimed to be original engine symbols.",
  ],
  panels: panels.map((panel) => ({
    ...panel,
    records4: readRecords(words, panel.startWord, panel.endWord, resourceById),
  })),
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(exportData, null, 2));
fs.writeFileSync(publicOutPath, JSON.stringify(exportData, null, 2));

console.log(JSON.stringify({ outPath, publicOutPath, panelCount: exportData.panels.length }, null, 2));

const fs = require("fs");
const path = require("path");

const rawPath = path.resolve(__dirname, "EUDATA", "out_GRAPHICS.DAT", "0696.RAW1 [Unknown - Unknown Content (Words of data)].dat");
const graphicsDbPath = path.resolve(__dirname, "..", "..", "public", "graphics_db.json");
const outPath = path.resolve(__dirname, "output", "graphics_layout_0696.json");
const publicOutPath = path.resolve(__dirname, "..", "..", "public", "graphics_layout_0696.json");

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

function toRecords(words, start, end, resourceById) {
  const records = [];
  for (let i = start; i + 3 <= end; i += 4) {
    const target = words[i + 1];
    records.push({
      wordIndex: i,
      opcode: words[i],
      target,
      targetDescription: resourceById.get(target)?.description ?? null,
      x: signed16(words[i + 2]),
      y: signed16(words[i + 3]),
    });
  }
  return records;
}

const sectionPairs = [
  { name: "A", ranges: [[400, 436], [120, 139]] },
  { name: "B", ranges: [[700, 749], [800, 833]] },
  { name: "C", ranges: [[850, 872], [3200, 3394]] },
  { name: "D", ranges: [[2900, 2947], [2500, 2568]] },
  { name: "E", ranges: [[3000, 3064], [1000, 1138]] },
  { name: "F", ranges: [[1500, 1510], [2000, 2008]] },
  { name: "G", ranges: [[3700, 3809], [1950, 1953]] },
  { name: "H", ranges: [[450, 471], [100, 106]] },
  { name: "I", ranges: [[500, 618], [150, 218]] },
  { name: "J", ranges: [[220, 264], [75, 98]] },
  { name: "K", ranges: [[65, 73], [110, 116]] },
];

const tailRanges = [
  {
    name: "T1",
    label: "floor item distribution",
    start: 3812,
    end: 3940,
  },
  {
    name: "T2",
    label: "wall-anchor continuation",
    start: 3944,
    end: 3960,
  },
  {
    name: "T3",
    label: "anonymous ui templates",
    start: 3964,
    end: 4247,
  },
  {
    name: "T4",
    label: "mixed ui and dungeon composites",
    start: 4248,
    end: 4576,
  },
];

const raw = fs.readFileSync(rawPath);
const words = readWordsLE(raw);
const graphicsDb = JSON.parse(fs.readFileSync(graphicsDbPath, "utf8"));
const resourceById = new Map(graphicsDb.resourceIndex.map((entry) => [entry.id, entry]));

const exportData = {
  source: {
    rawPath,
    generatedAt: new Date().toISOString(),
    byteLength: raw.length,
    wordCount: words.length,
  },
  notes: [
    "0696.RAW1 appears as a shared post-Atari block on PC DOS, Amiga 3.x, FM Towns, PC-98 and X68k mappings in sck.",
    "This export is structural rather than fully semantic: it preserves section boundaries and 4-word record interpretations used during reverse engineering.",
    "Values are little-endian 16-bit words from the PC DOS GRAPHICS.DAT extraction.",
    "Tail ranges beyond the original 11 section pairs are exported separately when they show strong repeated structure or a convincing semantic grouping.",
  ],
  header: {
    firstWords: words.slice(0, 64),
  },
  sectionPairs: sectionPairs.map((pair) => ({
    name: pair.name,
    ranges: pair.ranges.map(([start, end]) => ({
      startWord: start,
      endWord: end,
      lengthWords: end - start + 1,
      rawWords: words.slice(start, end + 1),
      records4: toRecords(words, start, end, resourceById),
    })),
  })),
  tailRanges: tailRanges.map((range) => ({
    name: range.name,
    label: range.label,
    startWord: range.start,
    endWord: range.end,
    lengthWords: range.end - range.start + 1,
    rawWords: words.slice(range.start, range.end + 1),
    records4: toRecords(words, range.start, range.end, resourceById),
  })),
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(exportData, null, 2));
fs.writeFileSync(publicOutPath, JSON.stringify(exportData, null, 2));

console.log(JSON.stringify({ outPath, publicOutPath, sectionPairCount: exportData.sectionPairs.length }, null, 2));

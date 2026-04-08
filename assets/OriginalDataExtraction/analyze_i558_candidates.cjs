const fs = require("fs");
const path = require("path");

const rawPath = path.join(
  "D:",
  "DungeonMaster-codex",
  "assets",
  "OriginalDataExtraction",
  "EUDATA",
  "out_GRAPHICS.DAT",
  "0696.RAW1 [Unknown - Unknown Content (Words of data)].dat"
);
const graphicsDbPath = path.join(
  "D:",
  "DungeonMaster-codex",
  "public",
  "graphics_db.json"
);

const raw = fs.readFileSync(rawPath);
const graphicsDb = JSON.parse(fs.readFileSync(graphicsDbPath, "utf8"));
const resourceById = new Map(graphicsDb.resourceIndex.map((r) => [r.id, r]));

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

const i558Candidates = [
  ["D", "E", "I", "J"],
  ["B", "C", "D", "G", "H", "K"],
  ["A", "B", "E", "H", "I", "K"],
  ["A", "B", "C", "F", "G", "J", "K"],
];

function concatSections(names) {
  const chunks = [];
  for (const name of names) {
    const pair = sectionPairs.find((p) => p.name === name);
    if (!pair) throw new Error(`Unknown section ${name}`);
    for (const [startWord, endWord] of pair.ranges) {
      const startByte = startWord * 2;
      const endByte = (endWord + 1) * 2;
      chunks.push(raw.subarray(startByte, endByte));
    }
  }
  return Buffer.concat(chunks);
}

function decodeI558(buf) {
  let off = 0;
  const take = (len) => {
    const slice = buf.subarray(off, off + len);
    off += len;
    return slice;
  };

  const lightning = take(24);
  const clouds = take(240);
  const creatureCoords = take(330);
  const creatureShifts = take(24);
  const farPalette = take(32);
  const colorBanks = [];
  for (let i = 0; i < 6; i++) colorBanks.push(take(26));
  const priorities = take(26);
  const creatures = [];
  for (let i = 0; i < 27; i++) {
    const rec = take(12);
    creatures.push(Array.from(rec));
  }
  return {
    consumed: off,
    lightning,
    clouds,
    creatureCoords,
    creatureShifts,
    farPalette,
    colorBanks,
    priorities,
    creatures,
    remaining: buf.length - off,
  };
}

function scoreCreatureRecord(bytes) {
  const interesting = [];
  for (const value of bytes) {
    const res = resourceById.get(value);
    if (res) interesting.push({ id: value, desc: res.description, type: res.type });
  }
  return interesting;
}

function summarizeCandidate(names) {
  const joined = concatSections(names);
  const decoded = decodeI558(joined);

  const creatureSummaries = decoded.creatures.map((bytes, index) => {
    const hits = scoreCreatureRecord(bytes).filter((hit) =>
      /Creature|Dungeon Graphics|Door|Wall/i.test(hit.desc || "")
    );
    return {
      index,
      bytes,
      hits,
    };
  });

  const totalInteresting = creatureSummaries.reduce((sum, rec) => sum + rec.hits.length, 0);
  const firstHits = creatureSummaries
    .filter((rec) => rec.hits.length)
    .slice(0, 8)
    .map((rec) => ({
      index: rec.index,
      bytes: rec.bytes,
      hits: rec.hits,
    }));

  return {
    sections: names,
    byteLength: joined.length,
    consumed: decoded.consumed,
    remaining: decoded.remaining,
    totalInterestingCreatureRefs: totalInteresting,
    firstInterestingCreatureRecords: firstHits,
    firstLightning: Array.from(decoded.lightning.slice(0, 12)),
    firstClouds: Array.from(decoded.clouds.slice(0, 16)),
    firstCreatureCoords: Array.from(decoded.creatureCoords.slice(0, 24)),
    firstCreatureShifts: Array.from(decoded.creatureShifts),
    firstPriorities: Array.from(decoded.priorities),
  };
}

const results = i558Candidates.map(summarizeCandidate);
console.log(JSON.stringify(results, null, 2));


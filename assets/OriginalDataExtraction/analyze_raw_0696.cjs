const fs = require('fs');
const path = require('path');

const rawPath = path.resolve(__dirname, 'EUDATA', 'out_GRAPHICS.DAT', '0696.RAW1 [Unknown - Unknown Content (Words of data)].dat');
const graphicsDbPath = path.resolve(__dirname, '..', '..', 'public', 'graphics_db.json');

function readWordsLE(filePath) {
  const buf = fs.readFileSync(filePath);
  const words = [];
  for (let i = 0; i < buf.length; i += 2) {
    words.push(buf.readUInt16LE(i));
  }
  return words;
}

function signed16(value) {
  return value > 0x7fff ? value - 0x10000 : value;
}

function getSectionPairs(words) {
  const pairs = [];
  for (let i = 4; i < 48; i += 4) {
    pairs.push({
      headerWordIndex: i,
      a: { start: words[i], end: words[i + 1] },
      b: { start: words[i + 2], end: words[i + 3] },
    });
  }
  return pairs;
}

function summarizeRange(words, descById, start, end) {
  const opcodeCounts = new Map();
  const targetCounts = new Map();
  const samples = [];
  for (let i = start; i + 3 <= end; i += 4) {
    const opcode = words[i];
    const target = words[i + 1];
    const x = signed16(words[i + 2]);
    const y = signed16(words[i + 3]);
    opcodeCounts.set(opcode, (opcodeCounts.get(opcode) || 0) + 1);
    targetCounts.set(target, (targetCounts.get(target) || 0) + 1);
    if (samples.length < 10) {
      samples.push({
        wordIndex: i,
        opcode,
        target,
        description: descById.get(target) || null,
        x,
        y,
      });
    }
  }

  return {
    start,
    end,
    lengthWords: end - start + 1,
    approximateTupleCount: Math.floor((end - start + 1) / 4),
    topOpcodes: [...opcodeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([opcode, count]) => ({ opcode, count })),
    topTargets: [...targetCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, count]) => ({
        id,
        count,
        description: descById.get(id) || null,
      })),
    samples,
  };
}

function main() {
  const words = readWordsLE(rawPath);
  const db = JSON.parse(fs.readFileSync(graphicsDbPath, 'utf8'));
  const descById = new Map(db.resourceIndex.map((r) => [r.id, r.description]));

  const opcodeSummary = new Map();
  for (let i = 0; i + 3 < words.length; i += 4) {
    const opcode = words[i];
    const resourceId = words[i + 1];
    const x = signed16(words[i + 2]);
    const y = signed16(words[i + 3]);
    if (!opcodeSummary.has(opcode)) {
      opcodeSummary.set(opcode, {
        count: 0,
        resourceIds: new Map(),
        samples: [],
      });
    }
    const summary = opcodeSummary.get(opcode);
    summary.count += 1;
    summary.resourceIds.set(resourceId, (summary.resourceIds.get(resourceId) || 0) + 1);
    if (summary.samples.length < 12) {
      summary.samples.push({
        resourceId,
        description: descById.get(resourceId) || null,
        x,
        y,
      });
    }
  }

  const dimMap = new Map();
  for (const resource of db.resourceIndex) {
    if (resource.width && resource.height) {
      const key = `${resource.width}x${resource.height}`;
      if (!dimMap.has(key)) dimMap.set(key, []);
      dimMap.get(key).push({
        id: resource.id,
        description: resource.description,
      });
    }
  }

  const dimensionMatches = [];
  for (let i = 0; i + 1 < words.length; i += 1) {
    const key = `${words[i]}x${words[i + 1]}`;
    if (dimMap.has(key)) {
      dimensionMatches.push({
        wordIndex: i,
        pair: key,
        resources: dimMap.get(key).slice(0, 5),
      });
    }
  }

  const report = {
    source: rawPath,
    wordCount: words.length,
    probableHeader: {
      firstWords: words.slice(0, 4),
      sectionPairs: getSectionPairs(words).map((pair) => ({
        headerWordIndex: pair.headerWordIndex,
        a: summarizeRange(words, descById, pair.a.start, pair.a.end),
        b: summarizeRange(words, descById, pair.b.start, pair.b.end),
      })),
    },
    opcodeSummary: [...opcodeSummary.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([opcode, summary]) => ({
        opcode,
        count: summary.count,
        topResourceIds: [...summary.resourceIds.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([id, count]) => ({
            id,
            count,
            description: descById.get(id) || null,
          })),
        samples: summary.samples,
      })),
    notableRanges: [
      summarizeRange(words, descById, 2900, 2947),
      summarizeRange(words, descById, 3000, 3064),
      summarizeRange(words, descById, 3200, 3394),
      summarizeRange(words, descById, 3700, 3809),
      summarizeRange(words, descById, 3812, 3963),
      summarizeRange(words, descById, 3964, 4247),
      summarizeRange(words, descById, 4248, 4327),
    ],
    dimensionMatches: dimensionMatches.slice(0, 200),
  };

  console.log(JSON.stringify(report, null, 2));
}

main();

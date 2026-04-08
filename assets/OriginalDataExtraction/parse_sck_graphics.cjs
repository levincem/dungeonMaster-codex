const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname);
const extractedDir = path.join(root, 'EUDATA', 'out_GRAPHICS.DAT');
const xmlPath = path.join(extractedDir, 'GRAPHICS.DAT.xml');
const outputDir = path.join(root, 'output');
const outputPath = path.join(outputDir, 'graphics_db.json');
const publicPath = path.resolve(root, '..', '..', 'public', 'graphics_db.json');

function readText(name) {
  return fs.readFileSync(path.join(extractedDir, name), 'utf8').replace(/\r\n/g, '\n');
}

function parseItemsXml(xml) {
  const items = [];
  const itemRegex = /<item id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const id = Number(match[1]);
    const body = match[2];
    const type = /<type>([^<]+)<\/type>/.exec(body)?.[1] ?? null;
    const description = /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/.exec(body)?.[1] ?? null;
    const longDescription = /<long_description><!\[CDATA\[([\s\S]*?)\]\]><\/long_description>/.exec(body)?.[1] ?? null;
    const fileMatches = [...body.matchAll(/<file>([^<]+)<\/file>/g)].map((m) => m[1]);
    const width = Number(/<width>(\d+)<\/width>/.exec(body)?.[1] ?? 0) || null;
    const height = Number(/<height>(\d+)<\/height>/.exec(body)?.[1] ?? 0) || null;
    const size = Number(/uncompressed_raw_size="(\d+)"/.exec(match[0])?.[1] ?? 0);
    items.push({
      id,
      type,
      description,
      longDescription,
      files: fileMatches,
      width,
      height,
      uncompressedRawSize: size,
    });
  }
  return items;
}

function linesFromFile(name) {
  return readText(name)
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

function summarizeResources(items) {
  const byId = Object.fromEntries(items.map((item) => [item.id, item]));
  const doorGraphics = {};
  for (let setId = 0; setId < 4; setId += 1) {
    const base = 246 + setId * 3;
    const labelMatch = byId[base]?.files?.[0]?.match(/- ([^\]]+)\]\.bmp$/);
    const label = labelMatch?.[1] ?? null;
    doorGraphics[setId] = {
      label,
      frames: [base, base + 1, base + 2].map((id) => ({
        id,
        description: byId[id]?.description ?? null,
        file: byId[id]?.files?.[0] ?? null,
      })),
    };
  }

  const wallDecorations = items
    .filter((item) => item.description?.startsWith('Wall Ornate'))
    .map((item) => ({
      id: item.id,
      description: item.description,
      longDescription: item.longDescription,
      file: item.files[0] ?? null,
      width: item.width,
      height: item.height,
    }));

  const rawResources = items
    .filter((item) => item.type === 'RAW1')
    .map((item) => ({
      id: item.id,
      description: item.description,
      file: item.files[0] ?? null,
      uncompressedRawSize: item.uncompressedRawSize,
    }));

  return {
    byId,
    doorGraphics,
    wallDecorations,
    rawResources,
  };
}

function main() {
  if (!fs.existsSync(xmlPath)) {
    throw new Error(`Missing extracted XML: ${xmlPath}`);
  }

  const xml = fs.readFileSync(xmlPath, 'utf8');
  const items = parseItemsXml(xml);
  const resources = summarizeResources(items);

  const graphicsDb = {
    source: {
      extractedDir,
      xmlPath,
      generatedAt: new Date().toISOString(),
      itemCount: items.length,
    },
    itemNames: {
      en: linesFromFile('0694.TXT2 [Items Names (English)].txt'),
      fr: linesFromFile('0735.TXT2 [Items Names (French)].txt'),
      de: linesFromFile('0745.TXT2 [Items Names (German)].txt'),
    },
    attackNames: {
      en: linesFromFile('0699.TXT2 [Attacks Names (English)].txt'),
      fr: linesFromFile('0736.TXT2 [Attacks Names (French)].txt'),
      de: linesFromFile('0746.TXT2 [Attacks Names (German)].txt'),
    },
    miscTexts: {
      en: linesFromFile('0700.TXT2 [Miscellaneous Texts (English)].txt'),
      fr: linesFromFile('0737.TXT2 [Miscellaneous Texts (French)].txt'),
      de: linesFromFile('0747.TXT2 [Miscellaneous Texts (German)].txt'),
    },
    doorGraphics: resources.doorGraphics,
    wallDecorations: resources.wallDecorations,
    rawResources: resources.rawResources,
    resourceIndex: items.map((item) => ({
      id: item.id,
      type: item.type,
      description: item.description,
      longDescription: item.longDescription,
      width: item.width,
      height: item.height,
      uncompressedRawSize: item.uncompressedRawSize,
      file: item.files[0] ?? null,
    })),
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(graphicsDb, null, 2));
  fs.writeFileSync(publicPath, JSON.stringify(graphicsDb, null, 2));

  console.log(`Wrote ${outputPath}`);
  console.log(`Wrote ${publicPath}`);
  console.log(`Parsed ${items.length} resources`);
}

main();

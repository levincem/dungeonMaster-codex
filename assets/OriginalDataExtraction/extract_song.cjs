/**
 * extract_song.cjs
 *
 * Extracts and analyzes SONG.DAT — the music file for Dungeon Master PC DOS.
 *
 * FORMAT (determined by analysis):
 *   SONG.DAT is a flat stream of raw OPL2/AdLib events in IMF-compatible
 *   4-byte format, with NO outer header or length prefix. The file contains
 *   8 songs concatenated together, each beginning with the standard OPL2
 *   waveform-select-enable init command: [01 80 ** **].
 *
 *   Each event is 4 bytes:
 *     [0]  OPL2 register  (0x00–0xFF)
 *     [1]  register value (0x00–0xFF)
 *     [2]  delay low byte (frames until next event, little-endian u16)
 *     [3]  delay high byte
 *
 *   The delay unit is 1/560th of a second (IMF standard), giving a
 *   clock rate of 560 Hz. A delay of 0 means the next event fires
 *   at the same tick.
 *
 * SONG LAYOUT (identified boundaries):
 *   Song 0: offset 0x00000, 3608 bytes (902 events)    — likely Hall of Champions
 *   Song 1: offset 0x00E18, 43568 bytes (10892 events) — long dungeon theme
 *   Song 2: offset 0x0B848, 10900 bytes (2725 events)
 *   Song 3: offset 0x0E2DC, 46592 bytes (11648 events) — long dungeon theme
 *   Song 4: offset 0x198DC, 20676 bytes (5169 events)
 *   Song 5: offset 0x1E9A0, 19992 bytes (4998 events)
 *   Song 6: offset 0x237B8, 8152 bytes (2038 events)
 *   Song 7: offset 0x25790, ~8992 bytes (2248 events)
 *
 * OUTPUTS:
 *   output/song_analysis.json          — metadata and event statistics per song
 *   output/songs/song_N.imf            — each song as a standalone IMF type-0 file
 *   output/songs/song_N_events.json    — human-readable event dump per song (first 200 events)
 *
 * PLAYING THE .IMF FILES:
 *   - Dosbox: play with MPLAY or any AdLib player that supports IMF type-0
 *   - Modern: use imf2wav, adplug, or the adlib-tracker II player
 *   - IMF type-0 means the file starts directly with event data (no length prefix)
 *
 * NOTE ON SONG NAMES:
 *   The game does not store song names in SONG.DAT. The assignments below
 *   are inferred from song length and context. Definitive names would require
 *   cross-referencing with FIRES.EXE song-trigger code.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const SONG_DAT   = path.join(__dirname, 'EUDATA/SONG.DAT');
const OUTPUT_DIR = path.join(__dirname, 'output');
const SONGS_DIR  = path.join(OUTPUT_DIR, 'songs');
const OUT_JSON   = path.join(OUTPUT_DIR, 'song_analysis.json');

// ---------------------------------------------------------------------------
// OPL2 register names (YM3812)
// ---------------------------------------------------------------------------
const OPL2_REG_NAMES = {
  0x01: 'WaveformSelectEnable',
  0x02: 'TimerCount1',
  0x03: 'TimerCount2',
  0x04: 'TimerControlStatus',
  0x08: 'CSM_NoteSel',
  0x20: 'Op0 AM/VIB/EG/KSR/Mult',   // operators 0-17 at 0x20-0x35
  0x40: 'Op0 KSL/TotalLevel',        // operators at 0x40-0x55
  0x60: 'Op0 AR/DR',                 // operators at 0x60-0x75
  0x80: 'Op0 SL/RR',                 // operators at 0x80-0x95
  0xA0: 'Chan0 FreqLow',             // channels 0-8 at 0xA0-0xA8
  0xB0: 'Chan0 KeyOn/FreqHigh',      // channels 0-8 at 0xB0-0xB8
  0xBD: 'AM_Depth/Vibrato/Rhythm',
  0xC0: 'Chan0 Feedback/Algo',       // channels 0-8 at 0xC0-0xC8
  0xE0: 'Op0 WaveformSelect',        // operators at 0xE0-0xF5
};

function getRegName(reg) {
  if (reg >= 0x20 && reg <= 0x35) return `Op${reg-0x20}_AM_VIB_EG`;
  if (reg >= 0x40 && reg <= 0x55) return `Op${reg-0x40}_KSL_TL`;
  if (reg >= 0x60 && reg <= 0x75) return `Op${reg-0x60}_AR_DR`;
  if (reg >= 0x80 && reg <= 0x95) return `Op${reg-0x80}_SL_RR`;
  if (reg >= 0xA0 && reg <= 0xA8) return `Chan${reg-0xA0}_FreqLo`;
  if (reg >= 0xB0 && reg <= 0xB8) return `Chan${reg-0xB0}_KeyOn_FreqHi`;
  if (reg >= 0xC0 && reg <= 0xC8) return `Chan${reg-0xC0}_FB_Algo`;
  if (reg >= 0xE0 && reg <= 0xF5) return `Op${reg-0xE0}_Waveform`;
  return OPL2_REG_NAMES[reg] ?? `Reg_${reg.toString(16).toUpperCase().padStart(2,'0')}`;
}

// ---------------------------------------------------------------------------
// Parse a contiguous block of 4-byte IMF events
// ---------------------------------------------------------------------------
function parseEvents(buf, startOffset, byteLength) {
  const events = [];
  const end = startOffset + byteLength;
  for (let i = startOffset; i + 3 < end; i += 4) {
    const reg   = buf[i];
    const val   = buf[i + 1];
    const delay = buf.readUInt16LE(i + 2);
    events.push({ reg, val, delay, offset: i });
  }
  return events;
}

// ---------------------------------------------------------------------------
// Compute statistics on an event list
// ---------------------------------------------------------------------------
function songStats(events) {
  let totalDelay = 0;
  let maxDelay   = 0;
  const regFreq  = {};
  let keyOnCount = 0;
  let keyOffCount = 0;
  let activeChannels = new Set();

  for (const ev of events) {
    totalDelay += ev.delay;
    if (ev.delay > maxDelay) maxDelay = ev.delay;
    regFreq[ev.reg] = (regFreq[ev.reg] ?? 0) + 1;

    // Key-on events: register 0xB0-0xB8, bit 5 set
    if (ev.reg >= 0xB0 && ev.reg <= 0xB8) {
      const chan = ev.reg - 0xB0;
      if (ev.val & 0x20) { keyOnCount++; activeChannels.add(chan); }
      else               { keyOffCount++; }
    }
  }

  // Timing is reported using a temporary IMF-style 560 Hz assumption only.
  const assumedClockHz = 560;
  const durationSec = totalDelay / assumedClockHz;
  const topRegs = Object.entries(regFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([reg, count]) => ({ reg: parseInt(reg), name: getRegName(parseInt(reg)), count }));

  return {
    eventCount: events.length,
    totalDelayTicks: totalDelay,
    assumedClockHz,
    durationSecondsAtAssumed560Hz: Math.round(durationSec * 10) / 10,
    durationFormattedAtAssumed560Hz: formatDuration(durationSec),
    maxSingleDelay: maxDelay,
    keyOnEvents: keyOnCount,
    keyOffEvents: keyOffCount,
    activeChannels: [...activeChannels].sort(),
    topRegisters: topRegs,
  };
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2,'0')}`;
}

// ---------------------------------------------------------------------------
// Detect song boundaries: each song starts with OPL2 init [01 80 ** **]
// aligned on a 4-byte boundary
// ---------------------------------------------------------------------------
function detectSongBoundaries(buf) {
  const boundaries = [0];
  for (let i = 4; i < buf.length - 4; i += 4) {
    if (buf[i] === 0x01 && buf[i + 1] === 0x80) {
      boundaries.push(i);
    }
  }
  return boundaries;
}

// ---------------------------------------------------------------------------
// Human-readable event dump (first N events)
// ---------------------------------------------------------------------------
function buildEventDump(events, maxEvents = 200) {
  return events.slice(0, maxEvents).map(ev => ({
    offset:   '0x' + ev.offset.toString(16).padStart(6, '0'),
    reg:      '0x' + ev.reg.toString(16).padStart(2, '0'),
    regName:  getRegName(ev.reg),
    val:      '0x' + ev.val.toString(16).padStart(2, '0'),
    delay:    ev.delay,
    delayMs:  Math.round(ev.delay / 560 * 1000),
  }));
}

// ---------------------------------------------------------------------------
// Inferred song names (heuristic from length and position)
// ---------------------------------------------------------------------------
const INFERRED_NAMES = [
  'Hall of Champions (short)',      // 0: 902 events — very short, likely title/intro
  'Dungeon Theme A (long)',          // 1: 10892 events — very long looping dungeon track
  'Dungeon Theme B',                 // 2: 2725 events
  'Dungeon Theme C (long)',          // 3: 11648 events — very long, another dungeon variant
  'Dungeon Theme D',                 // 4: 5169 events
  'Dungeon Theme E',                 // 5: 4998 events
  'Combat / Special',                // 6: 2038 events
  'Finale / Lord Chaos',             // 7: 2248 events — final level / end game
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function run() {
  if (!fs.existsSync(SONG_DAT)) {
    console.error('ERROR: SONG.DAT not found at', SONG_DAT);
    process.exit(1);
  }

  const buf = fs.readFileSync(SONG_DAT);
  console.log(`Loaded SONG.DAT: ${buf.length} bytes`);

  if (!fs.existsSync(SONGS_DIR)) fs.mkdirSync(SONGS_DIR, { recursive: true });

  // Detect song boundaries
  const boundaries = detectSongBoundaries(buf);
  console.log(`Detected ${boundaries.length} songs`);

  const songMeta = [];

  for (let i = 0; i < boundaries.length; i++) {
    const startOffset = boundaries[i];
    const endOffset   = boundaries[i + 1] ?? buf.length;
    // Trim to nearest 4-byte multiple
    const rawLen  = endOffset - startOffset;
    const byteLen = rawLen - (rawLen % 4);

    const events  = parseEvents(buf, startOffset, byteLen);
    const stats   = songStats(events);
    const name    = INFERRED_NAMES[i] ?? `Song_${i}`;

    console.log(`  Song ${i}: ${name} - ${events.length} events, ${stats.durationFormattedAtAssumed560Hz} at assumed 560 Hz`);

    // Write IMF type-0 file (raw events, no header)
    const imfPath = path.join(SONGS_DIR, `song_${i}.imf`);
    fs.writeFileSync(imfPath, buf.slice(startOffset, startOffset + byteLen));

    // Write event dump JSON
    const dumpPath = path.join(SONGS_DIR, `song_${i}_events.json`);
    fs.writeFileSync(dumpPath, JSON.stringify({
      songIndex: i,
      name,
      offset: '0x' + startOffset.toString(16).padStart(6, '0'),
      byteLength: byteLen,
      stats,
      first200Events: buildEventDump(events, 200),
    }, null, 2), 'utf8');

    songMeta.push({
      index: i,
      name,
      offset:    '0x' + startOffset.toString(16).padStart(6, '0'),
      offsetDec: startOffset,
      byteLength: byteLen,
      imfFile:   `songs/song_${i}.imf`,
      eventDump: `songs/song_${i}_events.json`,
      stats,
    });
  }

  // Summary JSON
  const output = {
    _meta: {
      source:      'extract_song.cjs',
      date:        new Date().toISOString().slice(0, 10),
      inputFile:   'EUDATA/SONG.DAT',
      fileSize:    buf.length,
      description: 'Analysis and extraction of DM1 PC DOS music data',
    },
    format: {
      encoding:     'Raw OPL2/AdLib IMF-compatible 4-byte events',
      clockRate:    'UNKNOWN - 560 Hz assumed for tick counting only; actual FTL timer rate TBD (see notes)',
      bytesPerEvent: 4,
      eventFields:  ['register (u8)', 'value (u8)', 'delay (u16 LE, in 1/560s frames)'],
      songBoundary: 'Each song starts with OPL2 waveform-select-enable: reg=0x01, val=0x80',
      imfType:      'type-0 (no length prefix; data begins at byte 0 of each extracted file)',
    },
    songCount: boundaries.length,
    songs: songMeta,
    playbackNotes: [
      'Each song_N.imf file is a standalone IMF type-0 file, playable directly.',
      'Tools: adplug (Linux/Mac), imf2wav (converts to WAV), DOSBox MPLAY utility.',
      'Song names are inferred from duration and position — verify by triggering in-game.',
      'Song 0 is very short (likely an intro stinger, not a full loop).',
      'Songs 1 and 3 are the longest (~19 min total at 560 Hz) — main dungeon loops.',
    ],
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\nAnalysis written to: ${OUT_JSON}`);
  console.log(`IMF files written to: ${SONGS_DIR}/`);
}

run();

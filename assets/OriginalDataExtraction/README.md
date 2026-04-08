# OriginalDataExtraction Archive Guide

This folder keeps the original reverse-engineering base used to rebuild authoritative Dungeon Master data.

## Keep

- `EUDATA/`
  - primary PC extraction base used by the local parsers
- `OriginalAtariGame/`
  - canonical Atari ST source used for proven `0558..0562` extraction
- `sourceCode/`
  - original source drop used to confirm structure and runtime semantics
- `ReDMCSB/`
  - engine source mirror used for field meaning and behavior checks
- `sck/`
  - companion extraction/mapping project used for graphics and format inspection
- `DM1GDED/`
  - spec files for DM1 `GRAPHICS.DAT` mappings
- `DMExtract v1.01 Source/`
  - source reference for graphics extraction logic
- `docs/`
  - local research notes and archive notes
- `output/`
  - generated proven exports and audit outputs that support the current conclusions
- `original-pc-runtime/`
  - copied loose PC runtime files retained as archival input material
- `generated/`
  - generated intermediate artifacts such as decompressed binaries and legacy helper exports
- top-level scripts `*.cjs`, `*.js`
  - local extraction, decoding, comparison, and audit tooling

## Generated And Regenerable

- `generated/decompressed/DM_decompressed.bin`
- `generated/decompressed/FIRES_decompressed.bin`
- `generated/legacy/dungeon_maps.json`
- most JSON files inside `output/`

These are useful to keep for reproducibility and open-source sharing, but they can be regenerated from the scripts and source material.

Removed from the curated archive:

- `output/audio/`
  - temporary sound conversion tests
- `output/graphics_extract_test/`
  - ad hoc extraction probes no longer needed by the core workflow

## Historical Notes

- `docs/RESEARCH_NOTES.md`
- `docs/SCK_NOTES.md`

These were kept because they explain earlier hypotheses, dead ends, and naming choices. They are still useful context even when later results supersede them.

## Current Recommended Structure

- source material stays in the large third-party/reference directories
- local scripts stay at the top level of `assets/OriginalDataExtraction`
- generated artifacts live under `generated/` or `output/`
- local explanatory notes live under `docs/`

## Safe Cleanup Targets

Once all path references are updated and verified, the following old top-level duplicates can be removed:

- `ANIM`
- `DM.EXE`
- `DMSAVE.BAK`
- `DMSAVE.DAT`
- `EGA`
- `END`
- `FIRES`
- `IBMIO`
- `SELECTOR`
- `SWOOSH`
- `TANDY`
- `TITLE`
- `VGA`
- `DM_decompressed.bin`
- `FIRES_decompressed.bin`
- `dungeon_maps.json`
- `RESEARCH_NOTES.md`
- `SCK_NOTES.md`
- `parse_full.cjs`
- `parse_full_tmp.cjs`
- `DMExtract v1.01/`
- `DM1GDED/DM1GDED.exe`
- `skProject/`

The organized copies are under `original-pc-runtime/`, `generated/`, and `docs/`.

## Open-Source Sharing

For a public archive, the high-value pieces are:

- the original-source references that are legally shareable in this workspace
- the extraction scripts
- the decoded JSON outputs and audits
- the archive docs that explain provenance and certainty

If size becomes a concern, keep `output/`, `docs/`, scripts, and the minimum necessary source inputs, then archive the heavier third-party directories separately.



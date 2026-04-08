# SCK Notes

## Command

```powershell
"C:\Program Files\Java\jdk-17\bin\java.exe" -jar sck.jar extract EUDATA\GRAPHICS.DAT
```

## Result

- detected format: `DMCSB2`
- detected resource count: `748`
- extraction directory: `EUDATA/out_GRAPHICS.DAT/`
- XML index: `EUDATA/out_GRAPHICS.DAT/GRAPHICS.DAT.xml`

## Useful confirmed PC DOS data

- item names in English, French, and German
- attack names
- miscellaneous in-game texts
- explicit door graphics families:
  - `0 = Porticullis`
  - `1 = Wooden Door`
  - `2 = Iron Door`
  - `3 = Ra Door`
- explicit wall ornaments:
  - `Grate`
  - `Empty Torch Holder`
  - `Full Torch Holder`
  - `Champion Mirror`
  - `Lever Up`
  - `Lever Down`

## Local parser

The repo now contains `parse_sck_graphics.cjs`.

It reads the extracted `sck` XML/text output and writes:

- `assets/DMDisquette/output/graphics_db.json`
- `public/graphics_db.json`

## Important takeaway

`sck` confirms that the PC DOS `GRAPHICS.DAT` is fully parseable, but its resource organization should not be assumed to match the Atari ST `Graphic 559` mental model one-to-one.

The remaining notable opaque block is:

- `0696.RAW1 [Unknown - Unknown Content (Words of data)].dat`

Its size is `9160` bytes and it looks like structured binary data, so it is currently the best candidate for additional logic metadata still missing from the remake export.

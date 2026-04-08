# World Content Audit

Audit date: 2026-04-07

Reference data:
- [public/original_level_content.json](D:\DungeonMaster-codex\public\original_level_content.json)
- [public/original_wall_overlay_positions.json](D:\DungeonMaster-codex\public\original_wall_overlay_positions.json)
- [public/dungeon.json](D:\DungeonMaster-codex\public\dungeon.json)

Generated report:
- [assets/OriginalDataExtraction/output/canonical_world_content_audit.json](D:\DungeonMaster-codex\assets\OriginalDataExtraction\output\canonical_world_content_audit.json)

## Summary

- Items:
  - `300 / 300` canonical item tiles match exactly after extractor cleanup
- Inscriptions:
  - `61 / 61` canonical inscriptions match
- Locks:
  - `65 / 65` canonical lock positions now match semantically
- Creatures:
  - `223 / 225` canonical creature entries match exactly
  - generator presence:
    - `50 / 50` canonical generator positions contain a generator-like sensor
  - generator type confidence:
    - `50 / 50`

## Interpretation

### Inscriptions

The inscription layer is now clean.

Important details:

- visible wall-text placements match after punctuation and line-break normalization
- hidden or disabled inscriptions are still recoverable from the original text objects in `dungeon.json`
  - the hidden “Reading room Keep out” case on Level 6

So inscription coverage is no longer a blocker for content accuracy.

### Locks

The lock layer is now in good shape.

Important improvement:

- lock auditing no longer relies only on nearby wall overlays
- nearby wall sensors are now decoded with their `requiredObjectName`
- this closes the gap for generic-looking lock art, fountains used as wish receptacles, and Mirror of Dawn style cases

So even when the visible wall ornament is generic or decorative, the underlying required object semantics are now recovered correctly from the original data.

### Creatures

Creature placement is now in very good shape.

Reliable today:

- exact creature matches reach `223 / 225`
- every canonical generator position contains a generator sensor
- every canonical generator now decodes to the correct creature family

The remaining two mismatches look like edge cases of:

- canonical group-size notation versus the single extracted group instance shape
- a multi-square canonical note such as `spanning (5,11)-(6,12)`

So the main generator-type reverse-engineering gap is now closed.

## Best Next Steps

1. Normalize remaining creature edge cases
   - group-size presentation
   - multi-square canonical wording
2. Investigate whether the remaining two creature mismatches are true extraction gaps or just canonical presentation differences



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
  - `225 / 225` canonical creature entries are now accepted by the audit
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

- exact creature matches now reach `225 / 225`
- every canonical generator position contains a generator sensor
- every canonical generator now decodes to the correct creature family

Important nuance:

- the last two historical mismatches were not extractor failures anymore
- they were canonical presentation edge cases:
  - group-size notation versus single extracted group instance shape
  - a multi-square canonical note such as `spanning (5,11)-(6,12)`

The audit now tolerates those presentation differences without pretending the raw extraction contains richer per-case prose than it really does.

So the main generator-type reverse-engineering gap is now closed.

## Best Next Steps

1. Keep this audit as the spatial-content trust baseline.
2. Focus future work on runtime integration rather than further world-content extraction.



import { SPELLS, findSpell } from '../../data/runes';

const CANONICAL_SPELL_NAMES = new Set(
    SPELLS.map((spell) => spell.name.trim()).filter((name) => name.length > 0),
);

const SPELL_STATS_UI_SUFFIX_PATTERNS = [
    /\s+fails\.$/i,
    /\s+casts with difficulty\.$/i,
];

export function normalizePersistedSpellStatsName(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (CANONICAL_SPELL_NAMES.has(trimmed)) return trimmed;

    const dashedPrefix = trimmed.split(' - ')[0]?.trim();
    if (dashedPrefix && CANONICAL_SPELL_NAMES.has(dashedPrefix)) {
        return dashedPrefix;
    }

    for (const pattern of SPELL_STATS_UI_SUFFIX_PATTERNS) {
        const stripped = trimmed.replace(pattern, '').trim();
        if (CANONICAL_SPELL_NAMES.has(stripped)) {
            return stripped;
        }
    }

    return null;
}

export function resolveCanonicalSpellStatsName(runeIds: string[]): string | null {
    return normalizePersistedSpellStatsName(findSpell(runeIds)?.name ?? null);
}

export function resolveSpellStatsName(runeIds: string[], fallbackMessage?: string | null): string {
    const canonicalName = resolveCanonicalSpellStatsName(runeIds);
    if (canonicalName) return canonicalName;

    const fallbackName = fallbackMessage?.split(' (')[0]?.trim();
    const normalizedFallbackName = normalizePersistedSpellStatsName(fallbackName);
    if (normalizedFallbackName) return normalizedFallbackName;
    if (fallbackName) return fallbackName;

    return runeIds.join(' ');
}

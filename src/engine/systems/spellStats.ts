import { findSpell } from '../../data/runes';

export function resolveSpellStatsName(runeIds: string[], fallbackMessage?: string | null): string {
    const canonicalName = findSpell(runeIds)?.name?.trim();
    if (canonicalName) return canonicalName;

    const fallbackName = fallbackMessage?.split(' (')[0]?.trim();
    if (fallbackName) return fallbackName;

    return runeIds.join(' ');
}

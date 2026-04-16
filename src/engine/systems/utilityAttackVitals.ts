import type { ChampionVitals } from '../runtimeTypes';

export function applyUtilityHeal(
    currentVitals: ChampionVitals | undefined,
    championHealth: number,
    healAmount = 25,
): ChampionVitals | null {
    if (!currentVitals) return null;

    return {
        ...currentVitals,
        hp: Math.min(championHealth, currentVitals.hp + healAmount),
    };
}

export function applySpellHeal(
    currentVitals: ChampionVitals | undefined,
    championHealth: number,
    manaCost: number,
): ChampionVitals | null {
    if (!currentVitals) return null;

    return {
        ...currentVitals,
        hp: Math.min(championHealth, currentVitals.hp + Math.round(manaCost * 10)),
    };
}

import type { ChampionVitals } from '../runtimeTypes';
import type { ChampionWoundSlot } from '../../data/equipment';

export function healOriginalChampionWounds(
    vitals: ChampionVitals,
    iterations: number,
    randomInt: (maxExclusive: number) => number,
): ChampionVitals {
    let current = vitals;
    for (let i = 0; i < iterations; i += 1) {
        const woundedSlots = (Object.entries(current.wounds) as [ChampionWoundSlot, boolean][])
            .filter(([, wounded]) => wounded)
            .map(([slot]) => slot);
        if (woundedSlots.length === 0) break;
        const healedSlot = woundedSlots[randomInt(woundedSlots.length)];
        if (!healedSlot) break;
        current = {
            ...current,
            wounds: {
                ...current.wounds,
                [healedSlot]: false,
            },
        };
    }
    return current;
}

export function applyOriginalPoisonCharacter(
    vitals: ChampionVitals,
    poisonStrength: number,
    poisonTickIntervalSec: number,
): ChampionVitals {
    if (poisonStrength <= 0) return vitals;
    const immediateDamage = Math.max(1, Math.floor(poisonStrength / 64));
    const remaining = poisonStrength - 1;
    return {
        ...vitals,
        hp: Math.max(0, vitals.hp - immediateDamage),
        poisonEntries: remaining > 0
            ? [...vitals.poisonEntries, { remaining, nextTickIn: poisonTickIntervalSec }]
            : vitals.poisonEntries,
    };
}

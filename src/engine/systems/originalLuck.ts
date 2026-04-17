import type { Champion } from '../../types/champion';
import type { ChampionVitals } from '../runtimeTypes';

export function isOriginalLuckSuccessful(
    currentLuck: number,
    luckNeeded: number,
    randomInt: (maxExclusive: number) => number,
): boolean {
    if (randomInt(2) !== 0 && randomInt(100) > luckNeeded) {
        return true;
    }
    if (currentLuck <= 0) {
        return false;
    }
    return randomInt(currentLuck) > luckNeeded;
}

export function applyOriginalLuckCheck(
    champion: Champion,
    vitals: ChampionVitals,
    luckNeeded: number,
    randomInt: (maxExclusive: number) => number,
): { success: boolean; nextVitals: ChampionVitals } {
    if (randomInt(2) !== 0 && randomInt(100) > luckNeeded) {
        return { success: true, nextVitals: vitals };
    }

    const currentLuck = vitals.currentStats.luck ?? champion.luck;
    const roll = currentLuck <= 0 ? 0 : randomInt(currentLuck);
    const success = roll > luckNeeded;
    const nextLuck = success
        ? Math.max(0, currentLuck - 2)
        : Math.min(170, currentLuck + (currentLuck > 150 ? 1 : 2));

    return {
        success,
        nextVitals: nextLuck === currentLuck
            ? vitals
            : {
                ...vitals,
                currentStats: {
                    ...vitals.currentStats,
                    luck: nextLuck,
                },
            },
    };
}

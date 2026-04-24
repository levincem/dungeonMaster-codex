import type { ChampionVitals, ChampionTemporaryXP } from '../runtimeTypes';

type AdvanceSurvivalResult = {
    championVitals: Record<number, ChampionVitals>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    damageEvents?: unknown[];
    elapsedGameTimeTicks: number;
    lastSurvivalEffectGameTick: number;
    freezeLifeRemainingTicks: number;
};

type TickRegenStateArgs = {
    delta: number;
    regenTickRemainder: number;
    originalTimerTickSeconds: number;
    advanceSurvivalTime: (stepCount: number) => AdvanceSurvivalResult;
};

export type TickRegenStateResult = AdvanceSurvivalResult & {
    regenTickRemainder: number;
};

export function tickRegenState({
    delta,
    regenTickRemainder,
    originalTimerTickSeconds,
    advanceSurvivalTime,
}: TickRegenStateArgs): TickRegenStateResult | null {
    let nextRemainder = regenTickRemainder + delta;
    const stepCount = Math.floor(nextRemainder / originalTimerTickSeconds);
    nextRemainder -= stepCount * originalTimerTickSeconds;

    if (stepCount <= 0) {
        return nextRemainder !== regenTickRemainder
            ? { regenTickRemainder: nextRemainder } as TickRegenStateResult
            : null;
    }

    return {
        ...advanceSurvivalTime(stepCount),
        regenTickRemainder: nextRemainder,
    };
}

type TickMovementCooldownArgs = {
    movementCooldown: number;
    delta: number;
};

export function tickMovementCooldown({
    movementCooldown,
    delta,
}: TickMovementCooldownArgs): { movementCooldown: number } | null {
    if (!Number.isFinite(movementCooldown)) {
        return { movementCooldown: 0 };
    }
    if (movementCooldown <= 0) return null;
    return { movementCooldown: Math.max(0, movementCooldown - delta) };
}

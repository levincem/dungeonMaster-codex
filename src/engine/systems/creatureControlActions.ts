export type CreatureControlAction = 'Confuse' | 'Fluxcage';

export type CreatureTimers = {
    mt: number;
    at: number;
};

type CreatureControlActionDeps = {
    quantizeDurationMs: (durationMs: number) => number;
};

export function resolveCreatureControlAction(
    action: CreatureControlAction,
    now: number,
    timers: CreatureTimers | undefined,
    deps: CreatureControlActionDeps,
): {
    expiresAt: number;
    nextTimers: CreatureTimers | undefined;
} {
    if (action === 'Confuse') {
        return {
            expiresAt: now + deps.quantizeDurationMs(90_000),
            nextTimers: timers
                ? {
                    mt: Math.max(timers.mt, 0.75),
                    at: Math.max(timers.at, 1.25),
                }
                : undefined,
        };
    }

    return {
        expiresAt: now + deps.quantizeDurationMs(120_000),
        nextTimers: timers
            ? {
                mt: Math.max(timers.mt, 1.5),
                at: Math.max(timers.at, 0.6),
            }
            : undefined,
    };
}

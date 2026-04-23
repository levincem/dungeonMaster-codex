type SleepFrameStateBase = {
    sleeping: boolean;
    pendingSensorEvents: unknown[];
    pendingGeneratorSpawns: unknown[];
    championVitals: Record<number, unknown>;
    championTemporaryXP: Record<number, unknown>;
};

type AdvancedSleepState<TState extends SleepFrameStateBase> = {
    championVitals: TState['championVitals'];
    championTemporaryXP: TState['championTemporaryXP'];
    elapsedGameTimeTicks: number;
    lastSurvivalEffectGameTick: number;
    freezeLifeRemainingTicks: number;
    advancedMs: number;
};

type SensorPatch<TState extends SleepFrameStateBase> = {
    sensorChanges: Partial<TState>;
    pendingSensorEvents: TState['pendingSensorEvents'];
};

type GeneratorPatch<TState extends SleepFrameStateBase> = {
    sensorChanges: Partial<TState>;
    pendingGeneratorSpawns: TState['pendingGeneratorSpawns'];
};

type SleepFrameDeps<TState extends SleepFrameStateBase> = {
    advanceSurvivalTime: (state: TState, stepCount: number) => AdvancedSleepState<TState>;
    ageTimedEffectsByMs: (state: TState, advanceMs: number, now: number) => Partial<TState>;
    processPendingSensorEvents: (deltaSeconds: number, state: TState) => SensorPatch<TState>;
    processPendingGeneratorSpawns: (deltaSeconds: number, state: TState) => GeneratorPatch<TState>;
    applyCombatTick: (state: TState, delta: number, now: number) => Partial<TState> | null;
    isPartyRested: (state: TState) => boolean;
};

export function buildSleepFramePatch<TState extends SleepFrameStateBase>(
    state: TState,
    now: number,
    deps: SleepFrameDeps<TState>,
): Partial<TState> | null {
    if (!state.sleeping) return null;

    const advanced = deps.advanceSurvivalTime(state, 1);
    const advancedState = {
        ...state,
        championVitals: advanced.championVitals,
        championTemporaryXP: advanced.championTemporaryXP,
        elapsedGameTimeTicks: advanced.elapsedGameTimeTicks,
        lastSurvivalEffectGameTick: advanced.lastSurvivalEffectGameTick,
        freezeLifeRemainingTicks: advanced.freezeLifeRemainingTicks,
    };
    const timedEffects = deps.ageTimedEffectsByMs(advancedState as TState, advanced.advancedMs, now);
    const afterTimedEffects = {
        ...advancedState,
        ...timedEffects,
    };
    const combatPatch = deps.applyCombatTick(afterTimedEffects as TState, 0, now);
    const afterCombat = combatPatch
        ? {
            ...afterTimedEffects,
            ...combatPatch,
        }
        : afterTimedEffects;
    const pendingPatch = deps.processPendingSensorEvents(advanced.advancedMs / 1000, afterCombat as TState);
    const afterPending = {
        ...afterCombat,
        ...(Object.keys(pendingPatch.sensorChanges).length > 0
            ? pendingPatch.sensorChanges
            : {}),
        ...(pendingPatch.pendingSensorEvents !== afterCombat.pendingSensorEvents
            ? { pendingSensorEvents: pendingPatch.pendingSensorEvents }
            : {}),
    };
    const generatorPatch = deps.processPendingGeneratorSpawns(advanced.advancedMs / 1000, afterPending as TState);
    const hasPendingPatch =
        Object.keys(pendingPatch.sensorChanges).length > 0 ||
        pendingPatch.pendingSensorEvents !== afterCombat.pendingSensorEvents;
    const hasGeneratorPatch =
        Object.keys(generatorPatch.sensorChanges).length > 0 ||
        generatorPatch.pendingGeneratorSpawns !== afterPending.pendingGeneratorSpawns;
    const restedState = {
        ...afterPending,
        ...(hasGeneratorPatch
            ? {
                ...generatorPatch.sensorChanges,
                pendingGeneratorSpawns: generatorPatch.pendingGeneratorSpawns,
            }
            : {}),
    };

    return {
        championVitals: advanced.championVitals,
        championTemporaryXP: advanced.championTemporaryXP,
        elapsedGameTimeTicks: advanced.elapsedGameTimeTicks,
        lastSurvivalEffectGameTick: advanced.lastSurvivalEffectGameTick,
        freezeLifeRemainingTicks: advanced.freezeLifeRemainingTicks,
        regenTickRemainder: 0,
        ...timedEffects,
        ...(combatPatch ?? {}),
        ...(hasPendingPatch
            ? { ...pendingPatch.sensorChanges, pendingSensorEvents: pendingPatch.pendingSensorEvents }
            : {}),
        ...(hasGeneratorPatch
            ? { ...generatorPatch.sensorChanges, pendingGeneratorSpawns: generatorPatch.pendingGeneratorSpawns }
            : {}),
        sleeping: !deps.isPartyRested(restedState as TState),
    } as Partial<TState>;
}

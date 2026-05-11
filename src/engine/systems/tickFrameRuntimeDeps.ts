type TickFrameRuntimeDepsParams<
    TState extends { gamePhase: unknown },
    TSensorState,
    TPendingSensorEvent,
    TPendingGeneratorSpawn,
    TPendingSensorDeps,
    TPendingGeneratorDeps,
> = {
    shouldEnterGameOver: (args: {
        phase: TState['gamePhase'];
        partySize: number;
        deadChampionCount: number;
    }) => boolean;
    applyEndgameFrame: (state: TState, now: number) => Partial<TState> | null;
    applySleepFrame: (state: TState, now: number) => Partial<TState> | null;
    applyRegenTick: (state: TState, delta: number) => Partial<TState> | null;
    applyMovementTick: (state: TState, delta: number) => Partial<TState> | null;
    applyCombatTick: (state: TState, delta: number, now: number) => Partial<TState> | null;
    buildSensorStateSnapshot: (state: TState) => TSensorState;
    processPendingSensorEvents: (
        delta: number,
        pendingSensorEvents: TPendingSensorEvent[],
        sensorState: TSensorState,
        deps: TPendingSensorDeps,
    ) => {
        sensorChanges: Partial<TState>;
        pendingSensorEvents: TPendingSensorEvent[];
    };
    buildPendingWorldEventDeps: () => TPendingSensorDeps;
    processPendingGeneratorSpawns: (
        delta: number,
        pendingGeneratorSpawns: TPendingGeneratorSpawn[],
        sensorState: TSensorState,
        deps: TPendingGeneratorDeps,
    ) => {
        sensorChanges: Partial<TState>;
        pendingGeneratorSpawns: TPendingGeneratorSpawn[];
    };
    generatorRuntimeDeps: TPendingGeneratorDeps;
    applyImmediateTransportSquareEffects: (state: TState, patch: Partial<TState>, now: number) => Partial<TState>;
};

export function createStoreTickFrameRuntimeDeps<
    TState extends { gamePhase: unknown },
    TSensorState,
    TPendingSensorEvent,
    TPendingGeneratorSpawn,
    TPendingSensorDeps,
    TPendingGeneratorDeps,
>(
    params: TickFrameRuntimeDepsParams<
        TState,
        TSensorState,
        TPendingSensorEvent,
        TPendingGeneratorSpawn,
        TPendingSensorDeps,
        TPendingGeneratorDeps
    >,
) {
    return {
        shouldEnterGameOver: params.shouldEnterGameOver,
        applyEndgameFrame: params.applyEndgameFrame,
        applySleepFrame: params.applySleepFrame,
        applyRegenTick: params.applyRegenTick,
        applyMovementTick: params.applyMovementTick,
        applyCombatTick: params.applyCombatTick,
        buildSensorStateSnapshot: params.buildSensorStateSnapshot,
        processPendingSensorEvents: (
            delta: number,
            pendingSensorEvents: TPendingSensorEvent[],
            sensorState: TSensorState,
        ) => params.processPendingSensorEvents(
            delta,
            pendingSensorEvents,
            sensorState,
            params.buildPendingWorldEventDeps(),
        ),
        processPendingGeneratorSpawns: (
            delta: number,
            pendingGeneratorSpawns: TPendingGeneratorSpawn[],
            sensorState: TSensorState,
        ) => params.processPendingGeneratorSpawns(
            delta,
            pendingGeneratorSpawns,
            sensorState,
            params.generatorRuntimeDeps,
        ),
        applyImmediateTransportSquareEffects: (state: TState, patch: Partial<TState>, now: number) =>
            params.applyImmediateTransportSquareEffects(state, patch, now),
    };
}

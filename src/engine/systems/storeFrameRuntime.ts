import type { ChampionTemporaryXP, ChampionVitals } from '../runtimeTypes';
import { processTickFrame } from './tickFrameState';
import { createStoreTickFrameRuntimeDeps } from './tickFrameRuntimeDeps';
import { buildStoreRegenTickPatch } from './storeTimeRuntime';
import { tickMovementCooldown } from './timeStateTicks';

type StoreFrameGamePhase =
    | 'title'
    | 'exploration'
    | 'mirror_open'
    | 'endgame'
    | 'victory'
    | 'game_over';

type StoreFrameStateBase = {
    optionsModalOpen: boolean;
    gamePhase: StoreFrameGamePhase;
    party: unknown[];
    deadChampions: Record<number, unknown>;
    sleeping: boolean;
    paused: boolean;
    activeMirrorChampionId: number | null;
    activePartyMemberId: number | null;
    endgameSequence: unknown | null;
    lastCastResult: unknown | null;
    damageEvents: unknown[];
    spellVisualEvents: unknown[];
    activeFloorDrag: unknown | null;
    pendingSensorEvents: unknown[];
    pendingGeneratorSpawns: unknown[];
    regenTickRemainder: number;
    movementCooldown: number;
};

type AdvanceSurvivalResult = {
    championVitals: Record<number, ChampionVitals>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    damageEvents?: unknown[];
    elapsedGameTimeTicks: number;
    lastSurvivalEffectGameTick: number;
    freezeLifeRemainingTicks: number;
};

type StoreExplorationRegenDeps<TState> = {
    originalTimerTickSeconds: number;
    advanceSurvivalTime: (state: TState, stepCount: number) => AdvanceSurvivalResult;
};

type StoreTickFrameDeps<
    TState extends StoreFrameStateBase,
    TSensorState,
    TPendingSensorDeps,
    TPendingGeneratorDeps,
> = StoreExplorationRegenDeps<TState> & {
    shouldEnterGameOver: (args: {
        phase: TState['gamePhase'];
        partySize: number;
        deadChampionCount: number;
    }) => boolean;
    applyEndgameFrame: (state: TState, now: number) => Partial<TState> | null;
    applySleepFrame: (state: TState, now: number) => Partial<TState> | null;
    applyCombatTick: (state: TState, delta: number, now: number) => Partial<TState> | null;
    buildSensorStateSnapshot: (state: TState) => TSensorState;
    processPendingSensorEvents: (
        delta: number,
        pendingSensorEvents: TState['pendingSensorEvents'],
        sensorState: TSensorState,
        deps: TPendingSensorDeps,
    ) => {
        sensorChanges: Partial<TState>;
        pendingSensorEvents: TState['pendingSensorEvents'];
    };
    buildPendingWorldEventDeps: () => TPendingSensorDeps;
    processPendingGeneratorSpawns: (
        delta: number,
        pendingGeneratorSpawns: TState['pendingGeneratorSpawns'],
        sensorState: TSensorState,
        deps: TPendingGeneratorDeps,
    ) => {
        sensorChanges: Partial<TState>;
        pendingGeneratorSpawns: TState['pendingGeneratorSpawns'];
    };
    generatorRuntimeDeps: TPendingGeneratorDeps;
    applyImmediateTransportSquareEffects: (
        state: TState,
        patch: Partial<TState>,
    ) => Partial<TState>;
};

export function buildStoreMovementTickPatch<TState extends Pick<StoreFrameStateBase, 'movementCooldown'>>(
    state: TState,
    delta: number,
): Partial<TState> | null {
    return tickMovementCooldown({
        movementCooldown: state.movementCooldown,
        delta,
    }) as Partial<TState> | null;
}

export function buildStoreExplorationRegenPatch<
    TState extends Pick<StoreFrameStateBase, 'regenTickRemainder'>,
>(
    state: TState,
    delta: number,
    deps: StoreExplorationRegenDeps<TState>,
): Partial<TState> | null {
    return buildStoreRegenTickPatch(
        state,
        delta,
        {
            originalTimerTickSeconds: deps.originalTimerTickSeconds,
            advanceSurvivalTime: (currentState, stepCount) =>
                deps.advanceSurvivalTime(currentState, stepCount),
        },
    );
}

export function buildStoreTickFramePatch<
    TState extends StoreFrameStateBase,
    TSensorState,
    TPendingSensorDeps,
    TPendingGeneratorDeps,
>(
    state: TState,
    delta: number,
    now: number,
    deps: StoreTickFrameDeps<
        TState,
        TSensorState,
        TPendingSensorDeps,
        TPendingGeneratorDeps
    >,
): TState | Partial<TState> {
    return processTickFrame(
        state,
        delta,
        now,
        createStoreTickFrameRuntimeDeps({
            shouldEnterGameOver: deps.shouldEnterGameOver,
            applyEndgameFrame: deps.applyEndgameFrame,
            applySleepFrame: deps.applySleepFrame,
            applyRegenTick: (regenState, regenDelta) =>
                buildStoreExplorationRegenPatch(regenState, regenDelta, {
                    originalTimerTickSeconds: deps.originalTimerTickSeconds,
                    advanceSurvivalTime: deps.advanceSurvivalTime,
                }),
            applyMovementTick: (movementState, movementDelta) =>
                buildStoreMovementTickPatch(movementState, movementDelta),
            applyCombatTick: deps.applyCombatTick,
            buildSensorStateSnapshot: deps.buildSensorStateSnapshot,
            processPendingSensorEvents: deps.processPendingSensorEvents,
            buildPendingWorldEventDeps: deps.buildPendingWorldEventDeps,
            processPendingGeneratorSpawns: deps.processPendingGeneratorSpawns,
            generatorRuntimeDeps: deps.generatorRuntimeDeps,
            applyImmediateTransportSquareEffects: deps.applyImmediateTransportSquareEffects,
        }),
    );
}

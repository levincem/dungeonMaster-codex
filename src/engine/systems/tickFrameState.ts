type TickFrameStateBase = {
    optionsModalOpen: boolean;
    gamePhase: 'title' | 'exploration' | 'mirror_open' | 'endgame' | 'victory' | 'game_over';
    party: unknown[];
    deadChampions: Record<number, unknown>;
    sleeping: boolean;
    paused: boolean;
    lastMonsterAttackDebug?: unknown | null;
    activeMirrorChampionId: number | null;
    activePartyMemberId: number | null;
    endgameSequence: unknown | null;
    lastCastResult: unknown | null;
    damageEvents: unknown[];
    spellVisualEvents: unknown[];
    activeFloorDrag: unknown | null;
    pendingSensorEvents: unknown[];
    pendingGeneratorSpawns: unknown[];
};

type PendingTickPatch<TState extends TickFrameStateBase> = {
    sensorChanges: Partial<TState>;
    pendingSensorEvents: TState['pendingSensorEvents'];
};

type GeneratorTickPatch<TState extends TickFrameStateBase> = {
    sensorChanges: Partial<TState>;
    pendingGeneratorSpawns: TState['pendingGeneratorSpawns'];
};

type TickFrameDeps<TState extends TickFrameStateBase, TSensorState> = {
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
        pendingSensorEvents: TState['pendingSensorEvents'],
        sensorState: TSensorState,
    ) => PendingTickPatch<TState>;
    processPendingGeneratorSpawns: (
        delta: number,
        pendingGeneratorSpawns: TState['pendingGeneratorSpawns'],
        sensorState: TSensorState,
    ) => GeneratorTickPatch<TState>;
    applyImmediateTransportSquareEffects: (
        state: TState,
        patch: Partial<TState>,
    ) => Partial<TState>;
};

function buildGameOverPatch<TState extends TickFrameStateBase>(): Partial<TState> {
    return {
        gamePhase: 'game_over',
        activeMirrorChampionId: null,
        activePartyMemberId: null,
        sleeping: false,
        paused: false,
        lastMonsterAttackDebug: null,
        optionsModalOpen: false,
        endgameSequence: null,
        lastCastResult: null,
        damageEvents: [],
        spellVisualEvents: [],
        activeFloorDrag: null,
    } as unknown as Partial<TState>;
}

export function processTickFrame<TState extends TickFrameStateBase, TSensorState>(
    state: TState,
    delta: number,
    now: number,
    deps: TickFrameDeps<TState, TSensorState>,
): TState | Partial<TState> {
    if (state.optionsModalOpen) return state;

    if (deps.shouldEnterGameOver({
        phase: state.gamePhase,
        partySize: state.party.length,
        deadChampionCount: Object.keys(state.deadChampions).length,
    })) {
        return buildGameOverPatch<TState>();
    }

    if (state.gamePhase === 'game_over') return state;
    if (state.gamePhase === 'endgame') {
        return deps.applyEndgameFrame(state, now) ?? state;
    }
    if (state.sleeping) {
        return deps.applySleepFrame(state, now) ?? state;
    }

    const regenPatch = deps.applyRegenTick(state, delta);
    const afterRegen = regenPatch ? { ...state, ...regenPatch } : state;

    const movementPatch = deps.applyMovementTick(afterRegen, delta);
    const afterMovement = movementPatch ? { ...afterRegen, ...movementPatch } : afterRegen;

    const combatPatch = deps.applyCombatTick(afterMovement, delta, now);
    const afterCombat = combatPatch ? { ...afterMovement, ...combatPatch } : afterMovement;

    const pendingPatch = deps.processPendingSensorEvents(
        delta,
        afterCombat.pendingSensorEvents,
        deps.buildSensorStateSnapshot(afterCombat),
    );
    const generatorPatch = deps.processPendingGeneratorSpawns(
        delta,
        afterCombat.pendingGeneratorSpawns,
        deps.buildSensorStateSnapshot(afterCombat),
    );

    const hasPendingPatch =
        Object.keys(pendingPatch.sensorChanges).length > 0 ||
        pendingPatch.pendingSensorEvents !== afterCombat.pendingSensorEvents;
    const hasGeneratorPatch =
        Object.keys(generatorPatch.sensorChanges).length > 0 ||
        generatorPatch.pendingGeneratorSpawns !== afterCombat.pendingGeneratorSpawns;

    if (!regenPatch && !movementPatch && !combatPatch && !hasPendingPatch && !hasGeneratorPatch) {
        return state;
    }

    const nextPatchBase = {
        ...(regenPatch ?? {}),
        ...(movementPatch ?? {}),
        ...(combatPatch ?? {}),
        ...(hasPendingPatch
            ? {
                ...pendingPatch.sensorChanges,
                pendingSensorEvents: pendingPatch.pendingSensorEvents,
            }
            : {}),
        ...(hasGeneratorPatch
            ? {
                ...generatorPatch.sensorChanges,
                pendingGeneratorSpawns: generatorPatch.pendingGeneratorSpawns,
            }
            : {}),
    } as Partial<TState>;

    const nextPatch = deps.applyImmediateTransportSquareEffects(afterCombat, nextPatchBase);

    const nextParty = (nextPatch.party ?? afterCombat.party) as TState['party'];
    const nextDeadChampions = (nextPatch.deadChampions ?? afterCombat.deadChampions) as TState['deadChampions'];

    if (deps.shouldEnterGameOver({
        phase: afterCombat.gamePhase,
        partySize: nextParty.length,
        deadChampionCount: Object.keys(nextDeadChampions).length,
    })) {
        return {
            ...nextPatch,
            ...buildGameOverPatch<TState>(),
        };
    }

    return nextPatch;
}

type EndgameSequenceLike = {
    startedAt: number;
    level: number;
    x: number;
    y: number;
    lordChaosId: string;
    processedStepCount: number;
    hideFluxcages: boolean;
    shownMessageCount: number;
    messages: string[];
};

type EndgameCreatureLike = {
    id: string;
    mapIndex: number;
    alive: boolean;
    typeId: number;
    currentHP: number;
    cell: string;
};

type EndgameAction<TEffect extends string> = {
    step: number;
    effects?: Array<{ effect: TEffect; scale: number }>;
    switchTypeId?: number;
    buzz?: boolean;
    hideFluxcages?: boolean;
    purgeOtherCreatures?: boolean;
};

type EndgameFrameState<
    TSequence extends EndgameSequenceLike,
    TCreature extends EndgameCreatureLike,
    TSpellVisualEvent,
    TCastResult,
> = {
    endgameSequence: TSequence | null;
    creatures: TCreature[];
    spellVisualEvents: TSpellVisualEvent[];
    lastCastResult: TCastResult | null;
};

type EndgameFrameDeps<
    TEffect extends string,
    TSpellVisualEvent,
    TCastResult,
> = {
    fuseUpdateMs: number;
    messageIntervalMs: number;
    finalDelayMs: number;
    actions: readonly EndgameAction<TEffect>[];
    playBuzz: () => void;
    buildSpellEvent: (
        effect: TEffect,
        level: number,
        x: number,
        y: number,
        now: number,
        scale: number,
    ) => TSpellVisualEvent;
    buildMessageResult: (message: string) => TCastResult;
};

export function buildEndgameFramePatch<
    TEffect extends string,
    TSequence extends EndgameSequenceLike,
    TCreature extends EndgameCreatureLike,
    TSpellVisualEvent,
    TCastResult,
>(
    state: EndgameFrameState<TSequence, TCreature, TSpellVisualEvent, TCastResult>,
    now: number,
    deps: EndgameFrameDeps<TEffect, TSpellVisualEvent, TCastResult>,
): {
    patch: Record<string, unknown> | null;
    reachedVictory: boolean;
} {
    const sequence = state.endgameSequence;
    if (!sequence) return { patch: null, reachedVictory: false };

    const age = now - sequence.startedAt;
    const elapsedStepCount = Math.floor(age / deps.fuseUpdateMs);
    const messagePhaseStartedAt = 41 * deps.fuseUpdateMs;
    const messagePhaseAge = Math.max(0, age - messagePhaseStartedAt);
    const nextMessageCount = Math.min(
        sequence.messages.length,
        Math.floor(messagePhaseAge / deps.messageIntervalMs),
    );

    let nextSequence = sequence;
    let spellVisualEvents = state.spellVisualEvents;
    let creatures = state.creatures;
    let lastCastResult = state.lastCastResult;
    let changed = false;

    if (elapsedStepCount > nextSequence.processedStepCount) {
        for (const action of deps.actions) {
            if (action.step > elapsedStepCount || action.step <= nextSequence.processedStepCount) continue;
            if (action.buzz) deps.playBuzz();
            if (action.effects?.length) {
                spellVisualEvents = [
                    ...spellVisualEvents,
                    ...action.effects.map((effect) =>
                        deps.buildSpellEvent(effect.effect, sequence.level, sequence.x, sequence.y, now, effect.scale),
                    ),
                ];
            }
            if (action.switchTypeId !== undefined) {
                const targetIndex = creatures.findIndex((creature) => creature.id === sequence.lordChaosId);
                if (targetIndex >= 0) {
                    if (creatures === state.creatures) creatures = [...creatures];
                    creatures[targetIndex] = {
                        ...creatures[targetIndex]!,
                        typeId: action.switchTypeId,
                        currentHP: Math.max(creatures[targetIndex]!.currentHP, 10000),
                        alive: true,
                        cell: 'center',
                    };
                }
            }
            if (action.hideFluxcages && !nextSequence.hideFluxcages) {
                nextSequence = { ...nextSequence, hideFluxcages: true };
            }
            if (action.purgeOtherCreatures) {
                creatures = creatures.filter((creature) =>
                    creature.id === sequence.lordChaosId ||
                    creature.mapIndex !== sequence.level ||
                    !creature.alive,
                );
            }
        }
        nextSequence = { ...nextSequence, processedStepCount: elapsedStepCount };
        changed = true;
    }

    if (nextMessageCount > nextSequence.shownMessageCount) {
        const nextMessage = nextSequence.messages[nextMessageCount - 1];
        if (nextMessage) {
            lastCastResult = deps.buildMessageResult(nextMessage);
        }
        nextSequence = { ...nextSequence, shownMessageCount: nextMessageCount };
        changed = true;
    }

    if (age >= messagePhaseStartedAt + (sequence.messages.length * deps.messageIntervalMs) + deps.finalDelayMs) {
        return {
            reachedVictory: true,
            patch: {
                ...(creatures !== state.creatures ? { creatures } : {}),
                ...(spellVisualEvents !== state.spellVisualEvents ? { spellVisualEvents } : {}),
                ...(lastCastResult !== state.lastCastResult ? { lastCastResult } : {}),
            },
        };
    }

    return {
        reachedVictory: false,
        patch: changed
            ? {
                ...(creatures !== state.creatures ? { creatures } : {}),
                ...(spellVisualEvents !== state.spellVisualEvents ? { spellVisualEvents } : {}),
                endgameSequence: nextSequence,
                ...(lastCastResult !== state.lastCastResult ? { lastCastResult } : {}),
            }
            : null,
    };
}

type ApplyEndgameFrameState<
    TSequence extends EndgameSequenceLike,
    TCreature extends EndgameCreatureLike,
    TSpellVisualEvent,
    TCastResult,
> = EndgameFrameState<TSequence, TCreature, TSpellVisualEvent, TCastResult> & {
    gamePhase: 'title' | 'exploration' | 'mirror_open' | 'endgame' | 'alternate_ending' | 'victory' | 'game_over';
    activeMirrorChampionId: number | null;
    activePartyMemberId: number | null;
    sleeping: boolean;
};

type ApplyEndgameFrameDeps<TEffect extends string, TSpellVisualEvent, TCastResult> =
    EndgameFrameDeps<TEffect, TSpellVisualEvent, TCastResult>;

export function applyEndgameFrameState<
    TEffect extends string,
    TSequence extends EndgameSequenceLike,
    TCreature extends EndgameCreatureLike,
    TSpellVisualEvent,
    TCastResult,
>(
    state: ApplyEndgameFrameState<TSequence, TCreature, TSpellVisualEvent, TCastResult>,
    now: number,
    deps: ApplyEndgameFrameDeps<TEffect, TSpellVisualEvent, TCastResult>,
): Partial<ApplyEndgameFrameState<TSequence, TCreature, TSpellVisualEvent, TCastResult>> | null {
    const endgameFrame = buildEndgameFramePatch(state, now, deps);

    if (endgameFrame.reachedVictory) {
        return {
            ...(endgameFrame.patch ?? {}),
            gamePhase: 'victory',
            endgameSequence: null,
            activeMirrorChampionId: null,
            activePartyMemberId: null,
            sleeping: false,
        };
    }

    return endgameFrame.patch as Partial<ApplyEndgameFrameState<TSequence, TCreature, TSpellVisualEvent, TCastResult>> | null;
}

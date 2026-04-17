import type { Champion } from '../../types/champion';
import type { ChampionEquipment } from '../../types/game';
import type {
    ActivePotionBoost,
    ChampionTemporaryXP,
    ChampionVitals,
} from '../runtimeTypes';
import { applyEndgameFrameState } from './endgameFrame';
import { buildSleepFramePatch } from './sleepFrameState';
import { tickRegenState } from './timeStateTicks';

type RegenState = {
    regenTickRemainder: number;
};

type RegenDeps<TState> = {
    originalTimerTickSeconds: number;
    advanceSurvivalTime: (state: TState, stepCount: number) => {
        championVitals: Record<number, ChampionVitals>;
        championTemporaryXP: Record<number, ChampionTemporaryXP>;
        elapsedGameTimeTicks: number;
        lastSurvivalEffectGameTick: number;
        freezeLifeRemainingTicks: number;
    };
};

type EndgameState = {
    endgameSequence: object | null;
    creatures: unknown[];
    spellVisualEvents: unknown[];
    lastCastResult: unknown | null;
    gamePhase: 'title' | 'exploration' | 'mirror_open' | 'endgame' | 'victory' | 'game_over';
    activeMirrorChampionId: number | null;
    activePartyMemberId: number | null;
    sleeping: boolean;
};

type EndgameDeps = {
    fuseUpdateMs: number;
    messageIntervalMs: number;
    finalDelayMs: number;
    actions: readonly unknown[];
    playBuzz: () => void;
    buildSpellEvent: (
        effect: 'open' | 'fireball' | 'lightning' | 'slime' | 'poison_cloud' | 'poison_bolt' | 'disrupt_nonmaterial',
        level: number,
        x: number,
        y: number,
        now: number,
        scale: number,
    ) => unknown;
    buildMessageResult: (message: string) => unknown;
};

type SleepState = {
    sleeping: boolean;
    pendingSensorEvents: unknown[];
    pendingGeneratorSpawns: unknown[];
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    championEquipment: Record<number, ChampionEquipment>;
    activePotionBoosts: ActivePotionBoost[];
};

type SleepDeps<TState extends SleepState> = {
    advanceSurvivalTime: (state: TState, stepCount: number) => {
        championVitals: Record<number, ChampionVitals>;
        championTemporaryXP: Record<number, ChampionTemporaryXP>;
        elapsedGameTimeTicks: number;
        lastSurvivalEffectGameTick: number;
        freezeLifeRemainingTicks: number;
        advancedMs: number;
    };
    ageTimedEffectsByMs: (state: TState, advanceMs: number, now: number) => Partial<TState>;
    processPendingSensorEvents: (
        deltaSeconds: number,
        state: TState,
    ) => { sensorChanges: Partial<TState>; pendingSensorEvents: TState['pendingSensorEvents'] };
    processPendingGeneratorSpawns: (
        deltaSeconds: number,
        state: TState,
    ) => { sensorChanges: Partial<TState>; pendingGeneratorSpawns: TState['pendingGeneratorSpawns'] };
    applyCombatTick: (state: TState, delta: number, now: number) => Partial<TState> | null;
    isPartyRested: (state: TState) => boolean;
};

export function buildStoreRegenTickPatch<TState extends RegenState>(
    state: TState,
    delta: number,
    deps: RegenDeps<TState>,
): Partial<TState> | null {
    return tickRegenState({
        delta,
        regenTickRemainder: state.regenTickRemainder,
        originalTimerTickSeconds: deps.originalTimerTickSeconds,
        advanceSurvivalTime: (stepCount) => deps.advanceSurvivalTime(state, stepCount),
    }) as Partial<TState> | null;
}

export function buildStoreEndgameFramePatch<TState extends EndgameState>(
    state: TState,
    now: number,
    deps: EndgameDeps,
): Partial<TState> | null {
    return applyEndgameFrameState(
        state as never,
        now,
        deps as never,
    ) as Partial<TState> | null;
}

export function buildStoreSleepFramePatch<TState extends SleepState>(
    state: TState,
    now: number,
    deps: SleepDeps<TState>,
): Partial<TState> | null {
    return buildSleepFramePatch(
        state,
        now,
        {
            advanceSurvivalTime: (sleepState, stepCount) => deps.advanceSurvivalTime(sleepState, stepCount),
            ageTimedEffectsByMs: deps.ageTimedEffectsByMs,
            processPendingSensorEvents: deps.processPendingSensorEvents,
            processPendingGeneratorSpawns: deps.processPendingGeneratorSpawns,
            applyCombatTick: deps.applyCombatTick,
            isPartyRested: deps.isPartyRested,
        },
    ) as Partial<TState> | null;
}

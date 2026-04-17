import type { CreatureDef } from '../../data/creatures';
import type { CreatureInstance } from '../../types/game';
import { resolveCreaturePerceptionState, type CreaturePerceptionState } from './creaturePerceptionState';
import { buildCreatureRuntimeStateArgs, resolveCreatureRuntimeState, type CreatureRuntimeState } from './creatureRuntimeState';

export type MonsterTimers = {
    mt: number;
    at: number;
};

export type MonsterLastSeenPartyPosition = {
    x: number;
    y: number;
    expiresAt: number;
};

type MonsterTurnStateArgs = {
    creature: CreatureInstance;
    creatureDef: CreatureDef;
    currentTimers: MonsterTimers | undefined;
    deltaSeconds: number;
    nowMs: number;
    partyPosition: [number, number];
    invisibleUntil: number;
    lastSeen: MonsterLastSeenPartyPosition | undefined;
    confusedUntilMs: number;
    fluxcageUntilMs: number;
    frightenedUntilMs: number;
};

type MonsterTurnStateDeps = {
    randomFraction: () => number;
    nextMonsterMoveDelaySeconds: (moveTicks: number) => number;
    nextMonsterAttackDelaySeconds: (attackTicks: number) => number;
    hasLineOfSight: () => boolean;
};

export type MonsterMemoryUpdate =
    | { kind: 'none' }
    | { kind: 'clear' }
    | { kind: 'set'; value: MonsterLastSeenPartyPosition };

export type MonsterTurnState = {
    moveTimer: number;
    attackTimer: number;
    perception: CreaturePerceptionState;
    runtimeState: CreatureRuntimeState;
    memoryUpdate: MonsterMemoryUpdate;
};

export function resolveMonsterTurnState(
    args: MonsterTurnStateArgs,
    deps: MonsterTurnStateDeps,
): MonsterTurnState {
    const timers = args.currentTimers ?? {
        mt: deps.randomFraction() * deps.nextMonsterMoveDelaySeconds(args.creatureDef.moveSpd),
        at: deps.randomFraction() * deps.nextMonsterAttackDelaySeconds(args.creatureDef.atkSpd),
    };
    const moveTimer = Math.max(0, timers.mt - args.deltaSeconds);
    const attackTimer = Math.max(0, timers.at - args.deltaSeconds);

    const perception = resolveCreaturePerceptionState(
        {
            creaturePosition: [args.creature.x, args.creature.y],
            partyPosition: args.partyPosition,
            nowMs: args.nowMs,
            invisibleUntil: args.invisibleUntil,
            sightRange: args.creatureDef.sightRange ?? 8,
            seeInvisible: args.creatureDef.seeInvisible,
            lastSeen: args.lastSeen,
        },
        { hasLineOfSight: deps.hasLineOfSight },
    );
    const runtimeState = resolveCreatureRuntimeState(
        buildCreatureRuntimeStateArgs(args.creatureDef, args.nowMs, {
            confusedUntilMs: args.confusedUntilMs,
            fluxcageUntilMs: args.fluxcageUntilMs,
            frightenedUntilMs: args.frightenedUntilMs,
        }),
    );

    const memoryUpdate: MonsterMemoryUpdate = perception.canDetectParty && perception.nextRememberedTarget
        ? { kind: 'set', value: perception.nextRememberedTarget }
        : perception.shouldClearExpiredMemory
            ? { kind: 'clear' }
            : { kind: 'none' };

    return {
        moveTimer,
        attackTimer,
        perception,
        runtimeState,
        memoryUpdate,
    };
}

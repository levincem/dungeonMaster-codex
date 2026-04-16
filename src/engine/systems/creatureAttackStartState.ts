export type CreatureAttackStartStateArgs = {
    shouldAttemptAttack: boolean;
    confused: boolean;
    currentAttackTimer: number;
    nextAttackDelaySeconds: number;
    nowMs: number;
    attackWindowMs: number;
    confusedSkipRoll: number;
};

export type CreatureAttackStartStateResult =
    | {
        kind: 'idle';
        nextAttackTimer: number;
    }
    | {
        kind: 'blocked';
        nextAttackTimer: number;
    }
    | {
        kind: 'started';
        nextAttackTimer: number;
        attackWindowExpiresAt: number;
    };

export function resolveCreatureAttackStartState(
    args: CreatureAttackStartStateArgs,
): CreatureAttackStartStateResult {
    if (!args.shouldAttemptAttack) {
        return {
            kind: 'idle',
            nextAttackTimer: args.currentAttackTimer,
        };
    }

    const nextAttackTimer = args.nextAttackDelaySeconds;
    if (args.confused && args.confusedSkipRoll === 0) {
        return {
            kind: 'blocked',
            nextAttackTimer,
        };
    }

    return {
        kind: 'started',
        nextAttackTimer,
        attackWindowExpiresAt: args.nowMs + args.attackWindowMs,
    };
}

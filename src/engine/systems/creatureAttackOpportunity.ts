type ResolveCreatureAttackOpportunityArgs = {
    attackReach: number;
    distanceAfterMove: number;
    canDetectParty: boolean;
    movedThisTick: boolean;
    frightened: boolean;
    atkTimer: number;
    projectileEffectAvailable: boolean;
    adjacentAfterMove: boolean;
    isContactCell: boolean;
    attackWindowSeconds: number;
};

type ResolveCreatureAttackOpportunityDeps = {
    randomInt: (maxExclusive: number) => number;
};

export type CreatureAttackOpportunity = {
    nextAttackTimer: number;
    canUseMeleeAttack: boolean;
    canUseRangedAttack: boolean;
    shouldAttemptAttack: boolean;
    shouldLaunchProjectile: boolean;
};

export function resolveCreatureAttackOpportunity(
    args: ResolveCreatureAttackOpportunityArgs,
    deps: ResolveCreatureAttackOpportunityDeps,
): CreatureAttackOpportunity {
    const canUseRangedAttack =
        args.attackReach > 1 &&
        args.distanceAfterMove > 1 &&
        args.distanceAfterMove <= args.attackReach &&
        args.canDetectParty &&
        args.projectileEffectAvailable;

    const nextAttackTimer = args.movedThisTick && args.canDetectParty
        ? Math.max(args.atkTimer, args.attackWindowSeconds)
        : args.atkTimer;

    const canUseMeleeAttack =
        args.adjacentAfterMove &&
        args.isContactCell;

    const shouldAttemptAttack =
        !args.frightened &&
        !args.movedThisTick &&
        nextAttackTimer === 0 &&
        (canUseMeleeAttack || canUseRangedAttack) &&
        args.canDetectParty;

    const shouldLaunchProjectile =
        args.projectileEffectAvailable &&
        args.attackReach > 1 &&
        args.distanceAfterMove <= args.attackReach &&
        args.canDetectParty &&
        (args.distanceAfterMove > 1 || deps.randomInt(2) !== 0);

    return {
        nextAttackTimer,
        canUseMeleeAttack,
        canUseRangedAttack,
        shouldAttemptAttack,
        shouldLaunchProjectile,
    };
}

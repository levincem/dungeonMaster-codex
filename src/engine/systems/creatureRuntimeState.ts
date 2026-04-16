import type { CreatureDef } from '../../data/creatures';

type ResolveCreatureRuntimeStateArgs = {
    nowMs: number;
    confusedUntilMs: number;
    fluxcageUntilMs: number;
    frightenedUntilMs: number;
    attackRange?: number;
    preferBackRow: boolean;
    nonMaterial: boolean;
    levitates: boolean;
    attackTypes: readonly string[];
};

export type CreatureRuntimeState = {
    confused: boolean;
    fluxcaged: boolean;
    frightened: boolean;
    attackReach: number;
    prefersRangedSpacing: boolean;
};

export function resolveCreatureRuntimeState(
    args: ResolveCreatureRuntimeStateArgs,
): CreatureRuntimeState {
    const attackReach = Math.max(1, args.attackRange ?? 1);
    return {
        confused: args.confusedUntilMs > args.nowMs,
        fluxcaged: args.fluxcageUntilMs > args.nowMs,
        frightened: args.frightenedUntilMs > args.nowMs,
        attackReach,
        prefersRangedSpacing:
            args.preferBackRow ||
            (attackReach > 1 && (args.nonMaterial || args.attackTypes.includes('Magic') || args.levitates)),
    };
}

export function buildCreatureRuntimeStateArgs(
    def: CreatureDef,
    nowMs: number,
    timers: {
        confusedUntilMs: number;
        fluxcageUntilMs: number;
        frightenedUntilMs: number;
    },
): ResolveCreatureRuntimeStateArgs {
    return {
        nowMs,
        confusedUntilMs: timers.confusedUntilMs,
        fluxcageUntilMs: timers.fluxcageUntilMs,
        frightenedUntilMs: timers.frightenedUntilMs,
        attackRange: def.attackRange,
        preferBackRow: def.preferBackRow,
        nonMaterial: def.nonMaterial,
        levitates: def.levitates,
        attackTypes: def.attackTypes,
    };
}

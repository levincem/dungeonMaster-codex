import type { CreatureMovementStateResult } from './creatureMovementState';

type RuntimeGroupedCreatureLike = {
    groupId?: string;
    mapIndex: number;
    x: number;
    y: number;
};

export function getRuntimeGroupMovementPlanKey(
    creature: RuntimeGroupedCreatureLike,
): string | null {
    if (!creature.groupId) return null;
    return `${creature.groupId}|${creature.mapIndex}|${creature.x}|${creature.y}`;
}

export function resolveSharedRuntimeGroupMovement(
    creature: RuntimeGroupedCreatureLike,
    plannedMoves: Map<string, CreatureMovementStateResult>,
    computeMovement: () => CreatureMovementStateResult,
): CreatureMovementStateResult {
    const planKey = getRuntimeGroupMovementPlanKey(creature);
    if (!planKey) return computeMovement();

    const existing = plannedMoves.get(planKey);
    if (existing) return existing;

    const computed = computeMovement();
    plannedMoves.set(planKey, computed);
    return computed;
}

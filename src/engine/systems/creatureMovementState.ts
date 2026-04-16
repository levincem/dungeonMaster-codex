import type { Direction } from '../runtimeTypes';
import type { CreatureInstance } from '../../types/game';
import { getOppositeDirection, getPrimaryDirectionTowardTarget, getSecondaryDirectionTowardTarget } from './directionState';

type RememberedTarget = {
    x: number;
    y: number;
};

type CreatureMovementStateArgs = {
    creature: CreatureInstance;
    canDetectParty: boolean;
    rememberedTarget: RememberedTarget | null;
    partyPosition: [number, number];
    currentDistance: number;
    frightened: boolean;
    prefersRangedSpacing: boolean;
    attackReach: number;
    isArchenemy: boolean;
};

type CreatureMovementStateDeps = {
    randomInt: (maxExclusive: number) => number;
    monsterWalkable: (level: number, y: number, x: number) => boolean;
    tileAvailable: (x: number, y: number) => boolean;
    canArchenemyDoubleMove: (
        creature: CreatureInstance,
        level: number,
        x: number,
        y: number,
        direction: Direction,
    ) => { x: number; y: number } | null;
};

export type CreatureMovementStateResult =
    | { kind: 'none' }
    | { kind: 'hold' }
    | { kind: 'move'; x: number; y: number; usesTeleport?: boolean };

export function resolveCreatureMovementState(
    args: CreatureMovementStateArgs,
    deps: CreatureMovementStateDeps,
): CreatureMovementStateResult {
    const { creature } = args;
    const [partyY, partyX] = args.partyPosition;

    if (args.canDetectParty || args.rememberedTarget) {
        const targetX = args.canDetectParty ? partyX : args.rememberedTarget!.x;
        const targetY = args.canDetectParty ? partyY : args.rememberedTarget!.y;
        const targetDx = targetX - creature.x;
        const targetDy = targetY - creature.y;

        if (args.frightened) {
            const fleeOptions = [[1, 0], [-1, 0], [0, 1], [0, -1]]
                .map(([ddx, ddy]) => [creature.x + ddx, creature.y + ddy] as [number, number])
                .filter(([cx, cy]) => deps.monsterWalkable(creature.mapIndex, cy, cx) && deps.tileAvailable(cx, cy))
                .map(([cx, cy]) => ({
                    x: cx,
                    y: cy,
                    distance: Math.abs(targetX - cx) + Math.abs(targetY - cy),
                }))
                .filter((candidate) => candidate.distance > args.currentDistance)
                .sort((a, b) => b.distance - a.distance);
            if (fleeOptions.length > 0) {
                return { kind: 'move', x: fleeOptions[0]!.x, y: fleeOptions[0]!.y };
            }
        }

        if (args.prefersRangedSpacing && args.canDetectParty && args.currentDistance <= args.attackReach && args.currentDistance > 1) {
            return { kind: 'hold' };
        }

        const candidates: [number, number][] = [];
        if (targetDx !== 0) candidates.push([creature.x + Math.sign(targetDx), creature.y]);
        if (targetDy !== 0) candidates.push([creature.x, creature.y + Math.sign(targetDy)]);
        const valid = candidates.filter(
            ([cx, cy]) => deps.monsterWalkable(creature.mapIndex, cy, cx) && deps.tileAvailable(cx, cy),
        );
        if (valid.length > 0) {
            const [x, y] = valid[deps.randomInt(valid.length)]!;
            return { kind: 'move', x, y };
        }

        if (args.isArchenemy) {
            const primaryDirection = getPrimaryDirectionTowardTarget(creature.x, creature.y, targetX, targetY);
            const secondaryDirection = getSecondaryDirectionTowardTarget(creature.x, creature.y, targetX, targetY);
            const doubleMoveDirections: Direction[] = [
                primaryDirection,
                secondaryDirection,
                getOppositeDirection(secondaryDirection),
                getOppositeDirection(primaryDirection),
            ];
            for (const direction of doubleMoveDirections) {
                const teleported = deps.canArchenemyDoubleMove(
                    creature,
                    creature.mapIndex,
                    creature.x,
                    creature.y,
                    direction,
                );
                if (!teleported) continue;
                return { kind: 'move', x: teleported.x, y: teleported.y, usesTeleport: true };
            }
        }

        if (args.canDetectParty) {
            const roamCandidates = [[1, 0], [-1, 0], [0, 1], [0, -1]]
                .map(([ddx, ddy]) => [creature.x + ddx, creature.y + ddy] as [number, number])
                .filter(([cx, cy]) =>
                    deps.monsterWalkable(creature.mapIndex, cy, cx) &&
                    deps.tileAvailable(cx, cy) &&
                    !(cx === partyX && cy === partyY),
                );
            const patrol = roamCandidates.filter(([cx, cy]) => {
                const nextDist = Math.abs(targetX - cx) + Math.abs(targetY - cy);
                return nextDist >= Math.max(2, args.attackReach) && nextDist <= args.currentDistance + 2;
            });
            const fallbackPatrol = patrol.length > 0 ? patrol : roamCandidates;
            if (fallbackPatrol.length > 0) {
                const [x, y] = fallbackPatrol[deps.randomInt(fallbackPatrol.length)]!;
                return { kind: 'move', x, y };
            }
        }

        return { kind: 'none' };
    }

    const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const valid = dirs
        .map(([ddx, ddy]) => [creature.x + ddx, creature.y + ddy] as [number, number])
        .filter(([cx, cy]) => deps.monsterWalkable(creature.mapIndex, cy, cx) && deps.tileAvailable(cx, cy));
    if (valid.length === 0) {
        return { kind: 'none' };
    }
    const [x, y] = valid[deps.randomInt(valid.length)]!;
    return { kind: 'move', x, y };
}

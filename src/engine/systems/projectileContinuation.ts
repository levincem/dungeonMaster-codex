import type { FloorItem } from '../../types/game';
import type { Direction, Projectile } from '../runtimeTypes';
import { buildProjectileDroppedItem } from './projectileDroppedItem';

type ProjectileContinuationDeps = {
    projectileStepMs: number;
    physicalProjectileStepMs: number;
    buildDroppedItem: (item: FloorItem, level: number, x: number, y: number) => FloorItem;
};

export type ProjectileContinuationResult = {
    floorItems: FloorItem[];
    keepProjectile?: Projectile;
};

export function resolveProjectileContinuation(
    projectile: Projectile,
    location: {
        level: number;
        x: number;
        y: number;
        direction: Direction;
    },
    now: number,
    floorItems: FloorItem[],
    deps: ProjectileContinuationDeps,
): ProjectileContinuationResult {
    if (projectile.effect === 'open') {
        const nextRemainingRange = projectile.remainingRange === undefined
            ? undefined
            : Math.max(0, projectile.remainingRange - (projectile.stepDecay ?? 1));
        if (nextRemainingRange !== undefined && nextRemainingRange <= 0) {
            return { floorItems };
        }
        return {
            floorItems,
            keepProjectile: {
                ...projectile,
                level: location.level,
                x: location.x,
                y: location.y,
                direction: location.direction,
                nextMoveAt: now + deps.projectileStepMs,
                remainingRange: nextRemainingRange,
            },
        };
    }

    if (projectile.effect === 'physical') {
        const remainingRange = (projectile.remainingRange ?? 1) - 1;
        const remainingAttack = Math.max(0, (projectile.remainingAttack ?? projectile.damage[1]) - (projectile.stepDecay ?? 1));
        let nextFloorItems = floorItems;
        if (remainingRange <= 0 || remainingAttack <= 0) {
            if (projectile.physicalItem) {
                nextFloorItems = [
                    ...floorItems,
                    buildProjectileDroppedItem(
                        projectile.physicalItem,
                        location.level,
                        location.x,
                        location.y,
                        location.direction,
                        deps.buildDroppedItem,
                    ),
                ];
            }
            return { floorItems: nextFloorItems };
        }
        return {
            floorItems,
            keepProjectile: {
                ...projectile,
                level: location.level,
                x: location.x,
                y: location.y,
                direction: location.direction,
                nextMoveAt: now + deps.physicalProjectileStepMs,
                remainingRange,
                remainingAttack,
            },
        };
    }

    const nextRemainingAttack = projectile.remainingAttack === undefined
        ? undefined
        : Math.max(0, projectile.remainingAttack - (projectile.stepDecay ?? 1));
    const nextMagicRange = projectile.remainingRange === undefined
        ? undefined
        : Math.max(0, projectile.remainingRange - (projectile.stepDecay ?? 1));
    if ((nextMagicRange !== undefined && nextMagicRange <= 0) ||
        (nextRemainingAttack !== undefined && nextRemainingAttack <= 0)) {
        return { floorItems };
    }

    return {
        floorItems,
        keepProjectile: {
            ...projectile,
            level: location.level,
            x: location.x,
            y: location.y,
            direction: location.direction,
            nextMoveAt: now + deps.projectileStepMs,
            remainingRange: nextMagicRange,
            remainingAttack: nextRemainingAttack,
        },
    };
}

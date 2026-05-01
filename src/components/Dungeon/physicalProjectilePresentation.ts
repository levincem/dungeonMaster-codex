import { GRID_SIZE } from '../../engine/constants';
import { PHYSICAL_PROJECTILE_STEP_MS } from '../../engine/time';
import type { Direction } from '../../engine/runtimeTypes';

export function stepForward(direction: Direction, x: number, y: number): { x: number; y: number } {
    if (direction === 'NORTH') return { x, y: y - 1 };
    if (direction === 'SOUTH') return { x, y: y + 1 };
    if (direction === 'EAST') return { x: x + 1, y };
    return { x: x - 1, y };
}

export function stepBackward(direction: Direction, x: number, y: number): { x: number; y: number } {
    if (direction === 'NORTH') return { x, y: y + 1 };
    if (direction === 'SOUTH') return { x, y: y - 1 };
    if (direction === 'EAST') return { x: x - 1, y };
    return { x: x + 1, y };
}

export function resolveLinearProjectilePosition(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    progress: number,
): [number, number, number] {
    const worldX = (fromX + (toX - fromX) * progress) * GRID_SIZE;
    const worldZ = (fromY + (toY - fromY) * progress) * GRID_SIZE;
    return [worldX, GRID_SIZE * 0.14, worldZ];
}

export function getPhysicalProjectileTravelProgress(nextMoveAt: number, now: number, stepMs = PHYSICAL_PROJECTILE_STEP_MS): number {
    if (stepMs <= 0) return 1;
    const segmentStartAt = nextMoveAt - stepMs;
    return Math.max(0, Math.min(1, (now - segmentStartAt) / stepMs));
}

export function resolvePhysicalProjectilePosition(args: {
    x: number;
    y: number;
    direction: Direction;
    now: number;
    nextMoveAt: number;
    stepMs?: number;
}): [number, number, number] {
    const { x, y, direction, now, nextMoveAt } = args;
    const stepMs = args.stepMs ?? PHYSICAL_PROJECTILE_STEP_MS;
    const progress = getPhysicalProjectileTravelProgress(nextMoveAt, now, stepMs);
    const previousTile = stepBackward(direction, x, y);
    return resolveLinearProjectilePosition(previousTile.x, previousTile.y, x, y, progress);
}

export function resolvePhysicalProjectileLaunchPosition(args: {
    x: number;
    y: number;
    direction: Direction;
    now: number;
    startedAt: number;
    stepMs?: number;
}): [number, number, number] {
    const { x, y, direction, now, startedAt } = args;
    const stepMs = args.stepMs ?? PHYSICAL_PROJECTILE_STEP_MS;
    const progress = getPhysicalProjectileTravelProgress(startedAt + stepMs, now, stepMs);
    const nextTile = stepForward(direction, x, y);
    return resolveLinearProjectilePosition(x, y, nextTile.x, nextTile.y, progress);
}

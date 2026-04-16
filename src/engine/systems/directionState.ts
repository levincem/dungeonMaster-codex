import type { Direction } from '../runtimeTypes';

export function getPrimaryDirectionTowardTarget(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
): Direction {
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0 ? 'EAST' : 'WEST';
    }
    return dy >= 0 ? 'SOUTH' : 'NORTH';
}

export function getSecondaryDirectionTowardTarget(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
): Direction {
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (Math.abs(dx) >= Math.abs(dy)) {
        return dy >= 0 ? 'SOUTH' : 'NORTH';
    }
    return dx >= 0 ? 'EAST' : 'WEST';
}

export function getDirectionStep(direction: Direction): [number, number] {
    switch (direction) {
        case 'NORTH': return [0, -1];
        case 'SOUTH': return [0, 1];
        case 'EAST': return [1, 0];
        case 'WEST': return [-1, 0];
    }
}

export function getOppositeDirection(direction: Direction): Direction {
    switch (direction) {
        case 'NORTH': return 'SOUTH';
        case 'SOUTH': return 'NORTH';
        case 'EAST': return 'WEST';
        case 'WEST': return 'EAST';
    }
}

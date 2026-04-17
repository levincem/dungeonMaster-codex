import type { CreatureInstance } from '../../types/game';
import type { Direction } from '../runtimeTypes';
import { getDirectionStep } from './directionState';

export function resolveOriginalArchenemyDoubleMoveDestination(
    mover: CreatureInstance,
    level: number,
    x: number,
    y: number,
    direction: Direction,
    creatures: CreatureInstance[],
    monsterWalkable: (level: number, y: number, x: number) => boolean,
    canCreatureShareTile: (
        mover: CreatureInstance,
        level: number,
        x: number,
        y: number,
        creatures: CreatureInstance[],
    ) => boolean,
): { x: number; y: number } | null {
    const [stepX, stepY] = getDirectionStep(direction);
    const destinationX = x + (stepX * 2);
    const destinationY = y + (stepY * 2);
    const teleportedMover: CreatureInstance = {
        ...mover,
        mapIndex: level,
        x: destinationX,
        y: destinationY,
    };

    if (!monsterWalkable(level, destinationY, destinationX)) return null;
    if (!canCreatureShareTile(teleportedMover, level, destinationX, destinationY, creatures)) return null;

    return { x: destinationX, y: destinationY };
}

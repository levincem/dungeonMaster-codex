import type { CreatureCell, CreatureInstance } from '../../types/game';
import type { Direction } from '../runtimeTypes';

export type CreatureColumn = 'left' | 'right' | 'center';

const CREATURE_CELL_PRIORITY: Record<CreatureCell, number> = {
    center: 0,
    frontLeft: 1,
    frontRight: 2,
    backLeft: 3,
    backRight: 4,
};

export function compareCreatureCells(a: CreatureCell, b: CreatureCell): number {
    return CREATURE_CELL_PRIORITY[a] - CREATURE_CELL_PRIORITY[b];
}

export function getCreatureColumn(cell: CreatureCell): CreatureColumn {
    if (cell === 'center') return 'center';
    return cell.endsWith('Left') ? 'left' : 'right';
}

export function isCreatureContactCell(cell: CreatureCell): boolean {
    return cell === 'center' || cell === 'frontLeft' || cell === 'frontRight';
}

export function selectFrontCreatureTarget(
    front: CreatureInstance[],
    preferredColumn: CreatureColumn,
): CreatureInstance | null {
    const contact = front.filter((creature) => isCreatureContactCell(creature.cell));
    const columnMatches = (creature: CreatureInstance, column: CreatureColumn): boolean =>
        column === 'center'
            ? true
            : getCreatureColumn(creature.cell) === column || getCreatureColumn(creature.cell) === 'center';

    return (
        contact.find((creature) => columnMatches(creature, preferredColumn)) ??
        contact[0] ??
        front.find((creature) => columnMatches(creature, preferredColumn)) ??
        front[0] ??
        null
    );
}

export function creaturesInFront(
    level: number,
    position: [number, number],
    direction: Direction,
    creatures: CreatureInstance[],
): CreatureInstance[] {
    const [y, x] = position;
    const ty = direction === 'NORTH' ? y - 1 : direction === 'SOUTH' ? y + 1 : y;
    const tx = direction === 'EAST' ? x + 1 : direction === 'WEST' ? x - 1 : x;

    return creatures
        .filter((creature) => creature.alive && creature.mapIndex === level && creature.y === ty && creature.x === tx)
        .sort((a, b) => compareCreatureCells(a.cell, b.cell));
}

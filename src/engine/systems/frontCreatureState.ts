import type { CreatureCell, CreatureInstance } from '../../types/game';
import type { Champion } from '../../types/champion';
import type { Direction } from '../runtimeTypes';
import type { ChampionVitals } from '../runtimeTypes';

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

export function selectCreatureAttackTarget(
    party: Champion[],
    vitals: Record<number, ChampionVitals>,
    cell: CreatureCell,
    attackAnyChampion = false,
    attackFromAllSides = false,
    randomInt: (maxExclusive: number) => number = Math.floor,
): Champion | null {
    const livingChampions = party.filter((champion) => (vitals[champion.id]?.hp ?? 0) > 0);
    if (livingChampions.length === 0) return null;

    if (attackAnyChampion || attackFromAllSides) {
        return livingChampions[randomInt(livingChampions.length)] ?? null;
    }

    const preferredColumn = getCreatureColumn(cell);
    const priority = preferredColumn === 'right'
        ? [1, 0, 3, 2]
        : [0, 1, 2, 3];

    for (const index of priority) {
        const champion = party[index];
        if (champion && (vitals[champion.id]?.hp ?? 0) > 0) {
            return champion;
        }
    }

    return null;
}

export function resolveCreatureContactAdvance(
    creature: CreatureInstance,
    creatures: CreatureInstance[],
    options: {
        frightened: boolean;
        movedThisTick: boolean;
        adjacentAfterMove: boolean;
        attackReach: number;
        creatureSizeOnTile: number;
    },
    deps: {
        isCreatureCellOccupiedOnTile: (
            creaturesOnLevel: CreatureInstance[],
            originCreature: CreatureInstance,
            targetCell: CreatureCell,
        ) => boolean;
        nextMonsterMoveDelaySeconds: () => number;
    },
): { targetCell: CreatureCell; nextMoveTimer: number } | null {
    if (
        options.frightened ||
        options.movedThisTick ||
        !options.adjacentAfterMove ||
        options.attackReach !== 1 ||
        options.creatureSizeOnTile !== 0 ||
        isCreatureContactCell(creature.cell)
    ) {
        return null;
    }

    const preferredContactCells: CreatureCell[] = creature.cell === 'backRight'
        ? ['frontRight', 'frontLeft']
        : ['frontLeft', 'frontRight'];
    const targetCell = preferredContactCells.find((cell) => !deps.isCreatureCellOccupiedOnTile(creatures, creature, cell));
    if (!targetCell) return null;

    return {
        targetCell,
        nextMoveTimer: Math.max(0.1, deps.nextMonsterMoveDelaySeconds() / 2),
    };
}

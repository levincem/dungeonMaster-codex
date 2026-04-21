import type { CreatureCell, CreatureInstance } from '../../types/game';
import type { Champion } from '../../types/champion';
import type { Direction } from '../runtimeTypes';
import type { ChampionVitals } from '../runtimeTypes';
import { ORIGINAL_ORDERED_POSITIONS_TO_ATTACK } from '../../data/originalUiSupport';

export type CreatureColumn = 'left' | 'right' | 'center';

type AttackDirection = 'North' | 'East' | 'South' | 'West';

const CREATURE_CELL_PRIORITY: Record<CreatureCell, number> = {
    center: 0,
    frontLeft: 1,
    frontRight: 2,
    backLeft: 3,
    backRight: 4,
};

const ORIGINAL_ATTACK_ABSOLUTE_POSITION_TO_PARTY_SLOT = [0, 1, 3, 2] as const;
const DEFAULT_ORIGINAL_ATTACK_ORDER = [0, 1, 3, 2] as const;

function getExposedPartySlotIndexes(
    localTileDelta: { x: number; y: number },
): readonly number[] {
    if (localTileDelta.y < 0 && Math.abs(localTileDelta.y) >= Math.abs(localTileDelta.x)) {
        return [0, 1];
    }
    if (localTileDelta.y > 0 && Math.abs(localTileDelta.y) >= Math.abs(localTileDelta.x)) {
        return [2, 3];
    }
    if (localTileDelta.x < 0 && Math.abs(localTileDelta.x) > Math.abs(localTileDelta.y)) {
        return [0, 2];
    }
    if (localTileDelta.x > 0 && Math.abs(localTileDelta.x) > Math.abs(localTileDelta.y)) {
        return [1, 3];
    }
    return [0, 1, 2, 3];
}

function resolveAttackDirection(localTileDelta: { x: number; y: number }): AttackDirection {
    if (localTileDelta.y < 0 && Math.abs(localTileDelta.y) >= Math.abs(localTileDelta.x)) {
        return 'North';
    }
    if (localTileDelta.x > 0 && Math.abs(localTileDelta.x) > Math.abs(localTileDelta.y)) {
        return 'East';
    }
    if (localTileDelta.y > 0 && Math.abs(localTileDelta.y) >= Math.abs(localTileDelta.x)) {
        return 'South';
    }
    return 'West';
}

function getOriginalAttackOrderIndex(
    attackDirection: AttackDirection,
    cellOffset: { x: number; y: number },
): number {
    switch (attackDirection) {
        case 'North':
            return cellOffset.x > 0 ? 1 : 0;
        case 'East':
            return cellOffset.y > 0 ? 3 : 2;
        case 'South':
            return cellOffset.x > 0 ? 5 : 4;
        case 'West':
        default:
            return cellOffset.y > 0 ? 7 : 6;
    }
}

function resolveOriginalAttackPriority(
    localTileDelta: { x: number; y: number },
    cell: CreatureCell,
): readonly number[] {
    const attackDirection = resolveAttackDirection(localTileDelta);
    const cellOffset = getCreatureCellLocalOffset(cell);
    const orderIndex = getOriginalAttackOrderIndex(attackDirection, cellOffset);
    const absolutePositions = ORIGINAL_ORDERED_POSITIONS_TO_ATTACK[orderIndex] ?? DEFAULT_ORIGINAL_ATTACK_ORDER;
    return absolutePositions.map((absolutePosition) =>
        ORIGINAL_ATTACK_ABSOLUTE_POSITION_TO_PARTY_SLOT[absolutePosition] ?? absolutePosition,
    );
}

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

function rotateWorldDeltaToPartyLocal(
    dx: number,
    dy: number,
    direction: Direction,
): { x: number; y: number } {
    switch (direction) {
        case 'EAST':
            return { x: dy, y: -dx };
        case 'SOUTH':
            return { x: -dx, y: -dy };
        case 'WEST':
            return { x: -dy, y: dx };
        case 'NORTH':
        default:
            return { x: dx, y: dy };
    }
}

function getCreatureCellLocalOffset(cell: CreatureCell): { x: number; y: number } {
    if (cell === 'center') {
        return { x: 0, y: 0 };
    }

    return {
        x: getCreatureColumn(cell) === 'left' ? -1 : 1,
        y: cell.startsWith('front') ? -1 : 1,
    };
}

export function selectCreatureAttackTarget(
    party: Champion[],
    vitals: Record<number, ChampionVitals>,
    cell: CreatureCell,
    attackAnyChampion = false,
    attackFromAllSides = false,
    randomInt: (maxExclusive: number) => number = Math.floor,
    context?: {
        partyPosition: [number, number];
        attackerPosition: { x: number; y: number };
        partyDirection: Direction;
    },
): Champion | null {
    const livingChampions = party.filter((champion) => (vitals[champion.id]?.hp ?? 0) > 0);
    if (livingChampions.length === 0) return null;

    if (attackAnyChampion || attackFromAllSides) {
        return livingChampions[randomInt(livingChampions.length)] ?? null;
    }

    if (context) {
        const [partyY, partyX] = context.partyPosition;
        const localTileDelta = rotateWorldDeltaToPartyLocal(
            context.attackerPosition.x - partyX,
            context.attackerPosition.y - partyY,
            context.partyDirection,
        );
        const exposedIndexes = new Set(getExposedPartySlotIndexes(localTileDelta));
        const originalPriority = resolveOriginalAttackPriority(localTileDelta, cell);
        for (const index of originalPriority) {
            const champion = party[index];
            if (!champion || !exposedIndexes.has(index)) continue;
            if ((vitals[champion.id]?.hp ?? 0) > 0) {
                return champion;
            }
        }
        for (const index of originalPriority) {
            const champion = party[index];
            if (champion && (vitals[champion.id]?.hp ?? 0) > 0) {
                return champion;
            }
        }
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

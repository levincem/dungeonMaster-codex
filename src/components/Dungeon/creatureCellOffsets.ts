import { GRID_SIZE } from '../../engine/constants';
import type { CreatureCell } from '../../types/game';

const CELL_OFFSET_X = GRID_SIZE * 0.22;
const CELL_OFFSET_Z = GRID_SIZE * 0.18;

export function getCreatureCellOffsetXZ(direction: string, cell: CreatureCell): [number, number] {
    if (cell === 'center') return [0, 0];

    const lateral = cell.endsWith('Left') ? -CELL_OFFSET_X : CELL_OFFSET_X;
    const depth = cell.startsWith('back') ? CELL_OFFSET_Z : -CELL_OFFSET_Z;

    switch (direction) {
        case 'NORTH': return [-lateral, depth];
        case 'SOUTH': return [lateral, -depth];
        case 'EAST': return [-depth, -lateral];
        case 'WEST': return [depth, lateral];
        default: return [0, 0];
    }
}

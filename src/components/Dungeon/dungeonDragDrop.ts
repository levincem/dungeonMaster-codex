export type DungeonDragDropDestination = 'current' | 'front' | 'throw';

export type DungeonDragDropBand = {
    destination: DungeonDragDropDestination;
    startRatio: number;
    endRatio: number;
};

type DungeonDragDropActionHandlers = {
    dropCurrent: () => boolean | void;
    dropFront: () => boolean | void;
    throwItem: () => boolean | void;
};

const CURRENT_TILE_DROP_RATIO = 0.72;
const FRONT_TILE_DROP_RATIO = 0.42;

export const DUNGEON_DRAG_DROP_BANDS: DungeonDragDropBand[] = [
    { destination: 'throw', startRatio: 0, endRatio: FRONT_TILE_DROP_RATIO },
    { destination: 'front', startRatio: FRONT_TILE_DROP_RATIO, endRatio: CURRENT_TILE_DROP_RATIO },
    { destination: 'current', startRatio: CURRENT_TILE_DROP_RATIO, endRatio: 1 },
];

export function resolveDungeonDragDropDestination(
    pointerY: number,
    viewportHeight: number,
): DungeonDragDropDestination {
    if (pointerY >= viewportHeight * CURRENT_TILE_DROP_RATIO) {
        return 'current';
    }
    if (pointerY >= viewportHeight * FRONT_TILE_DROP_RATIO) {
        return 'front';
    }
    return 'throw';
}

export function isPointerInsideDungeonViewport(
    pointerX: number,
    viewportWidth: number,
): boolean {
    return pointerX <= viewportWidth * 0.67;
}

export function performDungeonDragDropAction(
    destination: DungeonDragDropDestination,
    handlers: DungeonDragDropActionHandlers,
): boolean {
    if (destination === 'throw') {
        return handlers.throwItem() !== false;
    }
    if (destination === 'front' && handlers.dropFront() !== false) {
        return true;
    }
    return handlers.dropCurrent() !== false;
}

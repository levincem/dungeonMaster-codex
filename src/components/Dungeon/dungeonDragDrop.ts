export type DungeonDragDropDestination = 'current' | 'front' | 'throw';
export type DungeonWallDropTarget =
    | { kind: 'altar'; wallX: number; wallY: number; wallFace: 'North' | 'East' | 'South' | 'West' }
    | { kind: 'front-wall' };

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

const CURRENT_TILE_DROP_RATIO = 0.73;
const FRONT_TILE_DROP_RATIO = 0.45;

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

export function resolveDungeonWallDropTarget(element: Element | null): DungeonWallDropTarget | null {
    const wallDrop = element?.closest?.('[data-dm-wall-drop="true"]') as { dataset?: Record<string, string | undefined> } | null;
    if (!wallDrop?.dataset) return null;

    const kind = wallDrop.dataset.dmWallDropKind;
    if (kind === 'altar') {
        const wallX = Number(wallDrop.dataset.dmWallDropX);
        const wallY = Number(wallDrop.dataset.dmWallDropY);
        const wallFace = wallDrop.dataset.dmWallDropFace;
        if (
            Number.isFinite(wallX) &&
            Number.isFinite(wallY) &&
            (wallFace === 'North' || wallFace === 'East' || wallFace === 'South' || wallFace === 'West')
        ) {
            return { kind: 'altar', wallX, wallY, wallFace };
        }
    }

    return { kind: 'front-wall' };
}

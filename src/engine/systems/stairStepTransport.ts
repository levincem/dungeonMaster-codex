import type { Direction } from '../runtimeTypes';

type StairLink = {
    toLevel: number;
    toY: number;
    toX: number;
    dir: Direction;
    requireGate: boolean;
};

type StairStepTransportState = {
    gateOpen: boolean;
    elapsedGameTimeTicks: number;
};

type StairStepTransportDeps<TState extends StairStepTransportState> = {
    computeMovementCooldown: (state: TState) => number;
    buildLevelHydrationPatch: (state: TState, level: number) => Partial<TState> | null;
};

const DIR_STEP: Record<Direction, [number, number]> = {
    NORTH: [-1, 0],
    SOUTH: [1, 0],
    EAST: [0, 1],
    WEST: [0, -1],
};

export function resolveStairStepTransport<TState extends StairStepTransportState, TPatch extends object>(
    state: TState,
    link: StairLink | undefined,
    movedChampionVitalsPatch: Partial<TPatch> | null,
    deps: StairStepTransportDeps<TState>,
): { patch: TPatch } | null {
    if (!link) return null;
    if (link.requireGate && !state.gateOpen) return null;

    const [dy, dx] = DIR_STEP[link.dir];
    const hydrationPatch = deps.buildLevelHydrationPatch(state, link.toLevel);
    return {
        patch: {
            ...(hydrationPatch ?? {}),
            level: link.toLevel,
            position: [link.toY + dy, link.toX + dx] as [number, number],
            direction: link.dir,
            activeFloorDrag: null,
            lastPartyMoveGameTick: state.elapsedGameTimeTicks,
            movementCooldown: deps.computeMovementCooldown(state),
            ...(movedChampionVitalsPatch ?? {}),
        } as TPatch,
    };
}

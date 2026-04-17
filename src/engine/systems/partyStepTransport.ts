import type { ChampionVitals } from '../runtimeTypes';

type TileLike = {
    type: string;
};

type PartyStepTransportState = {
    level: number;
    position: [number, number];
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
};

type PartyStepTransportDeps<
    TState extends PartyStepTransportState,
    TPatch extends object,
    TTile extends TileLike,
    TStairLink,
> = {
    getTile: (level: number, x: number, y: number) => TTile | undefined;
    isWalkable: (
        level: number,
        y: number,
        x: number,
        openDoors: Set<string>,
        openWalls: Set<string>,
        openPits: Set<string>,
    ) => boolean;
    resolveOpenPitEntryTransport: (
        state: TState,
        x: number,
        y: number,
        ny: number,
        nx: number,
        movedVitals: Record<number, ChampionVitals> | null,
    ) => { patch: TPatch; fellThroughPit: true } | null;
    findStairLink: (level: number, y: number, x: number) => TStairLink | undefined;
    resolveStairStepTransport: (
        state: TState,
        link: TStairLink | undefined,
        movedChampionVitalsPatch: Partial<TPatch> | null,
    ) => { patch: TPatch } | null;
    resolveTeleporterStepTransport: (
        state: TState,
        ny: number,
        nx: number,
        movedVitals: Record<number, ChampionVitals> | null,
    ) => { patch: TPatch; blockedMessage?: string } | null;
    resolveStandardStepTransport: (
        state: TState,
        x: number,
        y: number,
        nx: number,
        ny: number,
        movedVitals: Record<number, ChampionVitals> | null,
    ) => { patch: TPatch; blockedMessage?: string };
};

export function resolvePartyStepTransport<
    TState extends PartyStepTransportState,
    TPatch extends object,
    TTile extends TileLike,
    TStairLink,
>(
    state: TState,
    ny: number,
    nx: number,
    movedVitals: Record<number, ChampionVitals> | null,
    deps: PartyStepTransportDeps<TState, TPatch, TTile, TStairLink>,
): {
    patch: TPatch | TState;
    blockedMessage?: string;
    fellThroughPit?: boolean;
} {
    const [y, x] = state.position;
    const targetTile = deps.getTile(state.level, nx, ny);
    if (!targetTile) {
        return { patch: movedVitals ? ({ championVitals: movedVitals } as TPatch) : state };
    }

    if (targetTile.type === 'Pit' && state.openPits.has(`${state.level},${ny},${nx}`)) {
        const openPitEntry = deps.resolveOpenPitEntryTransport(
            state,
            x,
            y,
            ny,
            nx,
            movedVitals,
        );
        if (openPitEntry) {
            return openPitEntry;
        }
        return { patch: movedVitals ? ({ championVitals: movedVitals } as TPatch) : state };
    }

    if (!deps.isWalkable(state.level, ny, nx, state.openDoors, state.openWalls, state.openPits)) {
        return { patch: movedVitals ? ({ championVitals: movedVitals } as TPatch) : state };
    }

    if (targetTile.type === 'Stairs') {
        const link = deps.findStairLink(state.level, ny, nx);
        const stairStep = deps.resolveStairStepTransport(
            state,
            link,
            movedVitals ? ({ championVitals: movedVitals } as unknown as Partial<TPatch>) : null,
        );
        if (stairStep) {
            return stairStep;
        }
        if (link) {
            return { patch: movedVitals ? ({ championVitals: movedVitals } as TPatch) : state };
        }
    }

    if (targetTile.type === 'Teleporter') {
        const teleporterStep = deps.resolveTeleporterStepTransport(
            state,
            ny,
            nx,
            movedVitals,
        );
        if (teleporterStep) {
            return teleporterStep;
        }
    }

    return deps.resolveStandardStepTransport(
        state,
        x,
        y,
        nx,
        ny,
        movedVitals,
    );
}

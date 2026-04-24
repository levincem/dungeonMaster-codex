import type { CardinalDir } from '../../types/game';
import type { ChampionVitals } from '../runtimeTypes';

export type PartyMoveCommand = 'forward' | 'backward' | 'strafeLeft' | 'strafeRight';

export type PartyMoveState = {
    gamePhase: string;
    movementCooldown: number;
    level: number;
    position: [number, number];
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
    pendingSensorEvents: unknown[];
    party: unknown[];
    championVitals: Record<number, ChampionVitals>;
};

type PartyMoveTarget = { y: number; x: number };

type ForwardBlockedResolution = {
    sensorChanges: Record<string, unknown>;
    pendingSensorEvents: unknown[];
};

export type PartyMoveCommandDeps<TState extends PartyMoveState> = {
    applyPartyMoveFatigue: (state: TState) => Record<number, ChampionVitals> | null;
    isPartyStepBlockedByCreature: (state: TState, level: number, x: number, y: number) => boolean;
    getTile: (level: number, x: number, y: number) => { type: string } | undefined;
    isWalkable: (
        level: number,
        y: number,
        x: number,
        openDoors: Set<string>,
        openWalls: Set<string>,
        openPits: Set<string>,
    ) => boolean;
    buildSensorStateSnapshot: (state: TState) => unknown;
    triggerWallPushSensors: (
        level: number,
        x: number,
        y: number,
        direction: CardinalDir | 'NORTH' | 'EAST' | 'SOUTH' | 'WEST',
        sensorState: unknown,
        pendingSensorEvents: unknown[],
    ) => ForwardBlockedResolution;
    applyFrontRowWallBumpDamage: (
        state: TState,
        championVitals: Record<number, ChampionVitals>,
        now: number,
    ) => Record<string, unknown> | null;
    applyImmediateTransportSquareEffects: (
        state: TState,
        patch: Record<string, unknown>,
    ) => Record<string, unknown>;
    resolvePartyStepTransport: (
        state: TState,
        y: number,
        x: number,
        movedVitals: Record<number, ChampionVitals> | null,
    ) => {
        patch: Record<string, unknown> | TState;
        blockedMessage?: string;
        fellThroughPit?: boolean;
    };
};

export type PartyMoveCommandResult<TState extends PartyMoveState> = {
    patch: Record<string, unknown> | TState;
    blockedMessage?: string;
    shouldPlayWallBump: boolean;
    shouldPlayFallingAndDying: boolean;
};

export function resolvePartyMoveTarget(
    position: [number, number],
    direction: PartyMoveState['direction'],
    command: PartyMoveCommand,
): PartyMoveTarget {
    const [y, x] = position;
    switch (command) {
        case 'forward':
            if (direction === 'NORTH') return { y: y - 1, x };
            if (direction === 'SOUTH') return { y: y + 1, x };
            if (direction === 'EAST') return { y, x: x + 1 };
            return { y, x: x - 1 };
        case 'backward':
            if (direction === 'NORTH') return { y: y + 1, x };
            if (direction === 'SOUTH') return { y: y - 1, x };
            if (direction === 'EAST') return { y, x: x - 1 };
            return { y, x: x + 1 };
        case 'strafeLeft':
            if (direction === 'NORTH') return { y, x: x - 1 };
            if (direction === 'SOUTH') return { y, x: x + 1 };
            if (direction === 'EAST') return { y: y - 1, x };
            return { y: y + 1, x };
        case 'strafeRight':
            if (direction === 'NORTH') return { y, x: x + 1 };
            if (direction === 'SOUTH') return { y, x: x - 1 };
            if (direction === 'EAST') return { y: y + 1, x };
            return { y: y - 1, x };
    }
}

export function resolvePartyMoveCommand<TState extends PartyMoveState>(
    state: TState,
    command: PartyMoveCommand,
    now: number,
    deps: PartyMoveCommandDeps<TState>,
): PartyMoveCommandResult<TState> {
    if (state.gamePhase !== 'exploration') {
        return { patch: state, shouldPlayWallBump: false, shouldPlayFallingAndDying: false };
    }

    if (Number.isFinite(state.movementCooldown) && state.movementCooldown > 0) {
        return { patch: state, shouldPlayWallBump: false, shouldPlayFallingAndDying: false };
    }

    const movedVitals = deps.applyPartyMoveFatigue(state);
    const target = resolvePartyMoveTarget(state.position, state.direction, command);
    if (deps.isPartyStepBlockedByCreature(state, state.level, target.x, target.y)) {
        return {
            patch: movedVitals ? { championVitals: movedVitals } : state,
            shouldPlayWallBump: false,
            shouldPlayFallingAndDying: false,
        };
    }

    if (command === 'forward') {
        const targetTile = deps.getTile(state.level, target.x, target.y);
        const steppingIntoOpenPit =
            targetTile?.type === 'Pit' && state.openPits.has(`${state.level},${target.y},${target.x}`);

        if (!steppingIntoOpenPit && !deps.isWalkable(
            state.level,
            target.y,
            target.x,
            state.openDoors,
            state.openWalls,
            state.openPits,
        )) {
            const postFatigueVitals = movedVitals ?? state.championVitals;
            const wallBumpChanges = targetTile && (targetTile.type === 'Wall' || targetTile.type === 'TrickWall')
                ? deps.applyFrontRowWallBumpDamage(state, postFatigueVitals, now)
                : null;
            // In FTL, touching/clicking the front wall is a separate command path.
            // A blocked forward move should only resolve the bump branch here.
            if (!wallBumpChanges) {
                return {
                    patch: movedVitals ? { championVitals: movedVitals } : state,
                    shouldPlayWallBump: false,
                    shouldPlayFallingAndDying: false,
                };
            }
            return {
                patch: deps.applyImmediateTransportSquareEffects(state, {
                    ...(movedVitals ? { championVitals: movedVitals } : {}),
                    ...wallBumpChanges,
                }),
                shouldPlayWallBump: Boolean(wallBumpChanges) && state.party.length > 0,
                shouldPlayFallingAndDying: false,
            };
        }
    }

    const stepResult = deps.resolvePartyStepTransport(state, target.y, target.x, movedVitals);
    return {
        patch: stepResult.patch,
        blockedMessage: stepResult.blockedMessage,
        shouldPlayWallBump: false,
        shouldPlayFallingAndDying: Boolean(stepResult.fellThroughPit) && state.party.length > 0,
    };
}

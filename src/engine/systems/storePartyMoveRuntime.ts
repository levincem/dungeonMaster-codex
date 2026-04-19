import type { CardinalDir } from '../../types/game';
import type { ChampionVitals } from '../runtimeTypes';
import {
    resolvePartyMoveCommand,
    type PartyMoveCommand,
    type PartyMoveCommandDeps,
    type PartyMoveCommandResult,
    type PartyMoveState,
} from './partyMoveCommand';

type StorePartyMoveRuntimeDepsParams<
    TState extends PartyMoveState,
    TWallPushDeps,
    TPartyDamageState,
> = Omit<
    PartyMoveCommandDeps<TState>,
    'triggerWallPushSensors' | 'applyFrontRowWallBumpDamage'
> & {
    buildWallPushSensorDeps: () => TWallPushDeps;
    triggerWallPushSensorsSystem: (
        level: number,
        x: number,
        y: number,
        direction: CardinalDir | 'NORTH' | 'EAST' | 'SOUTH' | 'WEST',
        sensorState: unknown,
        pendingSensorEvents: unknown[],
        deps: TWallPushDeps,
    ) => ReturnType<PartyMoveCommandDeps<TState>['triggerWallPushSensors']>;
    buildPartyDamageState: (state: TState) => TPartyDamageState;
    applyFrontRowWallBumpDamageState: (
        state: TPartyDamageState,
        championVitals: Record<number, ChampionVitals>,
        now: number,
    ) => Record<string, unknown> | null;
    enableFrontWallBumpDamage?: boolean;
};

type PartyMoveSideEffectDeps = {
    playWallBump: () => void;
    showTransientMessage: (message: string) => void;
};

type StoreMovementActionDeps<TState extends PartyMoveState> = {
    applyState: (updater: (state: TState) => TState | Partial<TState>) => void;
    buildDeps: () => PartyMoveCommandDeps<TState>;
    now: number;
    command: PartyMoveCommand;
} & PartyMoveSideEffectDeps;

export function createStorePartyMoveRuntimeDeps<
    TState extends PartyMoveState,
    TWallPushDeps,
    TPartyDamageState,
>(
    params: StorePartyMoveRuntimeDepsParams<TState, TWallPushDeps, TPartyDamageState>,
): PartyMoveCommandDeps<TState> {
    return {
        applyPartyMoveFatigue: params.applyPartyMoveFatigue,
        isPartyStepBlockedByCreature: params.isPartyStepBlockedByCreature,
        getTile: params.getTile,
        isWalkable: params.isWalkable,
        buildSensorStateSnapshot: params.buildSensorStateSnapshot,
        triggerWallPushSensors: (level, x, y, direction, sensorState, pendingSensorEvents) =>
            params.triggerWallPushSensorsSystem(
                level,
                x,
                y,
                direction,
                sensorState,
                pendingSensorEvents,
                params.buildWallPushSensorDeps(),
            ),
        applyFrontRowWallBumpDamage: params.enableFrontWallBumpDamage === false
            ? () => null
            : (state, championVitals, now) =>
                params.applyFrontRowWallBumpDamageState(
                    params.buildPartyDamageState(state),
                    championVitals,
                    now,
                ),
        applyImmediateTransportSquareEffects: params.applyImmediateTransportSquareEffects,
        resolvePartyStepTransport: params.resolvePartyStepTransport,
    };
}

export function runStorePartyMoveCommand<TState extends PartyMoveState>(
    state: TState,
    command: PartyMoveCommand,
    now: number,
    deps: PartyMoveCommandDeps<TState>,
): PartyMoveCommandResult<TState> {
    return resolvePartyMoveCommand(state, command, now, deps);
}

export function applyStorePartyMoveSideEffects(
    result: { blockedMessage?: string; shouldPlayWallBump: boolean },
    deps: PartyMoveSideEffectDeps,
) {
    if (result.shouldPlayWallBump) deps.playWallBump();
    if (result.blockedMessage) deps.showTransientMessage(result.blockedMessage);
}

export function runStoreMovementAction<TState extends PartyMoveState>(
    deps: StoreMovementActionDeps<TState>,
) {
    let moveResult: PartyMoveCommandResult<TState> | null = null;
    deps.applyState((state) => {
        moveResult = runStorePartyMoveCommand(
            state,
            deps.command,
            deps.now,
            deps.buildDeps(),
        );
        return moveResult.patch as TState | Partial<TState>;
    });

    if (moveResult) {
        applyStorePartyMoveSideEffects(moveResult, {
            playWallBump: deps.playWallBump,
            showTransientMessage: deps.showTransientMessage,
        });
    }
}

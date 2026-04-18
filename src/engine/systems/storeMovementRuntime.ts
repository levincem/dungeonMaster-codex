import type { ChampionVitals } from '../runtimeTypes';
import { applyImmediateTransportSquareEffects as applyImmediateTransportSquareEffectsSystem } from './partyImmediateTransportEffects';
import { resolvePartyStepTransport as resolvePartyStepTransportSystem } from './partyStepTransport';
import { createStorePartyMoveRuntimeDeps } from './storePartyMoveRuntime';

type PendingSensorEventLike = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type MovementRuntimeState = {
    level: number;
    position: [number, number];
    direction: string;
    party: unknown[];
    selectedChampionIndex: number;
    openDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    creatures: unknown[];
    floorItems: unknown[];
    championInventories: Record<number, unknown[]>;
    championEquipment: Record<number, unknown>;
    championVitals: Record<number, ChampionVitals>;
    damageEvents: unknown[];
    spellVisualEvents: unknown[];
    deadChampions: Record<number, unknown>;
    activeShields: unknown[];
    activePotionBoosts: unknown[];
    championCombat: Record<number, unknown>;
    pendingSensorEvents: PendingSensorEventLike[];
};

type StoreMovementRuntimeParams<
    TState extends MovementRuntimeState,
    TSensorState,
    TWallPushDeps,
    TStairLink,
> = {
    applyPartyMoveFatigue: (state: TState) => Record<number, ChampionVitals> | null;
    getTile: (level: number, x: number, y: number) => { type: string } | undefined;
    isWalkable: (
        level: number,
        y: number,
        x: number,
        openDoors: Set<string>,
        openWalls: Set<string>,
        openPits: Set<string>,
    ) => boolean;
    buildSensorStateSnapshot: (state: TState) => TSensorState;
    buildWallPushSensorDeps: () => TWallPushDeps;
    triggerWallPushSensorsSystem: (
        level: number,
        x: number,
        y: number,
        direction: string,
        sensorState: TSensorState,
        pendingSensorEvents: PendingSensorEventLike[],
        deps: TWallPushDeps,
    ) => {
        sensorChanges: Record<string, unknown>;
        pendingSensorEvents: PendingSensorEventLike[];
    };
    buildPartyDamageDeps: () => {
        applyFrontRowWallBumpDamage: (
            state: TState,
            championVitals: Record<number, ChampionVitals>,
            now: number,
        ) => Record<string, unknown> | null;
    };
    applyOpenedPitEffects: (state: TState, openedPitKeys: string[]) => object;
    applyOpenedTeleporterEffects: (state: TState, openedTeleporterKeys: string[]) => object;
    resolveOpenPitEntryTransport: (
        state: TState,
        x: number,
        y: number,
        ny: number,
        nx: number,
        movedVitals: Record<number, ChampionVitals> | null,
    ) => { patch: Partial<TState>; fellThroughPit: true } | null;
    findStairLink: (level: number, y: number, x: number) => TStairLink | undefined;
    resolveStairStepTransport: (
        state: TState,
        link: TStairLink | undefined,
        movedChampionVitalsPatch: Partial<Partial<TState>> | null,
    ) => { patch: Partial<TState> } | null;
    resolveTeleporterStepTransport: (
        state: TState,
        ny: number,
        nx: number,
        movedVitals: Record<number, ChampionVitals> | null,
    ) => { patch: Partial<TState>; blockedMessage?: string } | null;
    resolveStandardStepTransport: (
        state: TState,
        x: number,
        y: number,
        nx: number,
        ny: number,
        movedVitals: Record<number, ChampionVitals> | null,
    ) => { patch: Partial<TState>; blockedMessage?: string };
};

export function createStoreMovementRuntime<
    TState extends MovementRuntimeState,
    TSensorState,
    TWallPushDeps,
    TStairLink,
>(
    params: StoreMovementRuntimeParams<TState, TSensorState, TWallPushDeps, TStairLink>,
) {
    const applyImmediateTransportSquareEffects = (
        state: TState,
        basePatch: Partial<TState>,
    ): Partial<TState> => applyImmediateTransportSquareEffectsSystem(
        state as any,
        basePatch as any,
        {
            applyOpenedPitEffects: (transportState, openedPitKeys) =>
                params.applyOpenedPitEffects(transportState as TState, openedPitKeys) as any,
            applyOpenedTeleporterEffects: (transportState, openedTeleporterKeys) =>
                params.applyOpenedTeleporterEffects(transportState as TState, openedTeleporterKeys) as any,
        },
    ) as Partial<TState>;

    const resolvePartyStepTransport = (
        state: TState,
        ny: number,
        nx: number,
        movedVitals: Record<number, ChampionVitals> | null,
    ): {
        patch: Partial<TState> | TState;
        blockedMessage?: string;
        fellThroughPit?: boolean;
    } => resolvePartyStepTransportSystem(
        state,
        ny,
        nx,
        movedVitals,
        {
            getTile: params.getTile,
            isWalkable: params.isWalkable,
            resolveOpenPitEntryTransport: params.resolveOpenPitEntryTransport,
            findStairLink: params.findStairLink,
            resolveStairStepTransport: params.resolveStairStepTransport,
            resolveTeleporterStepTransport: params.resolveTeleporterStepTransport,
            resolveStandardStepTransport: params.resolveStandardStepTransport,
        },
    ) as {
        patch: Partial<TState> | TState;
        blockedMessage?: string;
        fellThroughPit?: boolean;
    };

    const buildPartyMoveDeps = (enableFrontWallBumpDamage: boolean) =>
        createStorePartyMoveRuntimeDeps({
            applyPartyMoveFatigue: (state: any) => params.applyPartyMoveFatigue(state as TState),
            getTile: params.getTile,
            isWalkable: params.isWalkable,
            buildSensorStateSnapshot: (state: any) => params.buildSensorStateSnapshot(state as TState),
            buildWallPushSensorDeps: params.buildWallPushSensorDeps,
            triggerWallPushSensorsSystem: (
                level: any,
                x: any,
                y: any,
                direction: any,
                sensorState: any,
                pendingSensorEvents: any,
                deps: any,
            ) =>
                params.triggerWallPushSensorsSystem(
                    level,
                    x,
                    y,
                    direction,
                    sensorState as TSensorState,
                    pendingSensorEvents as PendingSensorEventLike[],
                    deps,
                ),
            buildPartyDamageState: (state: any) => state as TState,
            applyFrontRowWallBumpDamageState: enableFrontWallBumpDamage
                ? (state: any, championVitals: any, now: any) =>
                    params.buildPartyDamageDeps().applyFrontRowWallBumpDamage(
                        state as TState,
                        championVitals,
                        now,
                    )
                : () => null,
            enableFrontWallBumpDamage,
            applyImmediateTransportSquareEffects: (state: any, patch: any) =>
                applyImmediateTransportSquareEffects(state as TState, patch as Partial<TState>),
            resolvePartyStepTransport: (state: any, ny: any, nx: any, movedVitals: any) =>
                resolvePartyStepTransport(state as TState, ny, nx, movedVitals),
        } as any) as ReturnType<typeof createStorePartyMoveRuntimeDeps<any, TWallPushDeps, TState>>;

    return {
        applyImmediateTransportSquareEffects,
        buildPartyMoveDeps,
        resolvePartyStepTransport,
    };
}

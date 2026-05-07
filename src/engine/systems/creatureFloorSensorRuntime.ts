import { collectCreatureFloorSensorTransitions } from './creatureSensorTransitions';

type PendingSensorEventLike = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type CreatureLike = {
    id: string;
    mapIndex: number;
    x: number;
    y: number;
    alive?: boolean;
};

type CreatureFloorSensorRuntimeState<TPendingSensorEvent extends PendingSensorEventLike> = {
    level: number;
    position: [number, number];
    hydratedLevels: Set<number>;
    creatures: CreatureLike[];
    floorItems: unknown[];
    championInventories: Record<number, unknown[]>;
    championEquipment: Record<number, unknown>;
    pendingSensorEvents: TPendingSensorEvent[];
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
};

type CreatureFloorSensorRuntimeDeps<
    TState extends CreatureFloorSensorRuntimeState<TPendingSensorEvent>,
    TPendingSensorEvent extends PendingSensorEventLike,
> = {
    triggerCreatureFloorSensors: (
        state: TState,
        level: number,
        x: number,
        y: number,
        mode: 'enter' | 'leave',
    ) => {
        sensorChanges: Partial<TState>;
        pendingSensorEvents: TPendingSensorEvent[];
    };
    applyCreaturesStandingOnOpenPit: (
        state: TState,
        level: number,
        x: number,
        y: number,
    ) => Partial<TState> | null;
    applyFloorItemsStandingOnOpenPit: (
        state: TState,
        level: number,
        x: number,
        y: number,
    ) => Partial<TState> | null;
    applyCreaturesStandingOnOpenTeleporter: (
        state: TState,
        level: number,
        x: number,
        y: number,
    ) => Partial<TState> | null;
};

function applyPatch<TState>(currentPatch: Partial<TState>, nextPatch: Partial<TState> | null): Partial<TState> {
    if (!nextPatch) return currentPatch;
    return {
        ...currentPatch,
        ...nextPatch,
    };
}

export function applyCreatureFloorSensorRuntimeEffects<
    TState extends CreatureFloorSensorRuntimeState<TPendingSensorEvent>,
    TPendingSensorEvent extends PendingSensorEventLike,
>(
    state: TState,
    patch: Partial<TState> | null,
    deps: CreatureFloorSensorRuntimeDeps<TState, TPendingSensorEvent>,
): Partial<TState> | null {
    if (!patch) return patch;

    const nextCreatures = patch.creatures ?? state.creatures;
    if (nextCreatures === state.creatures) return patch;

    const transitionQueue = [...collectCreatureFloorSensorTransitions(state.creatures, nextCreatures)];
    if (transitionQueue.length === 0) return patch;

    let currentPatch: Partial<TState> = {
        ...patch,
        creatures: nextCreatures,
    };
    let currentPendingSensorEvents = currentPatch.pendingSensorEvents ?? state.pendingSensorEvents;

    for (let transitionIndex = 0; transitionIndex < transitionQueue.length; transitionIndex += 1) {
        const transition = transitionQueue[transitionIndex];
        const beforeOpenPits = currentPatch.openPits ?? state.openPits;
        const beforeOpenTeleporters = currentPatch.openTeleporters ?? state.openTeleporters;

        const sensorInputState = {
            ...state,
            ...currentPatch,
        } as TState;
        const sensorResult = deps.triggerCreatureFloorSensors(
            sensorInputState,
            transition.level,
            transition.x,
            transition.y,
            transition.type,
        );
        currentPendingSensorEvents = sensorResult.pendingSensorEvents;
        currentPatch = {
            ...currentPatch,
            ...sensorResult.sensorChanges,
            pendingSensorEvents: currentPendingSensorEvents,
        };

        let transportState = {
            ...state,
            ...currentPatch,
        } as TState;
        const creaturesBeforeImmediateEffects = transportState.creatures;

        const openedPitKeys = [...(transportState.openPits ?? state.openPits)].filter((key) => !beforeOpenPits.has(key));
        for (const key of openedPitKeys) {
            const [levelRaw, yRaw, xRaw] = key.split(',');
            const level = Number(levelRaw);
            const y = Number(yRaw);
            const x = Number(xRaw);
            if (!Number.isFinite(level) || !Number.isFinite(y) || !Number.isFinite(x)) continue;

            currentPatch = applyPatch(
                currentPatch,
                deps.applyCreaturesStandingOnOpenPit(transportState, level, x, y),
            );
            transportState = {
                ...state,
                ...currentPatch,
            } as TState;
            currentPatch = applyPatch(
                currentPatch,
                deps.applyFloorItemsStandingOnOpenPit(transportState, level, x, y),
            );
            transportState = {
                ...state,
                ...currentPatch,
            } as TState;
        }

        const openedTeleporterKeys = [...(transportState.openTeleporters ?? state.openTeleporters)].filter((key) => !beforeOpenTeleporters.has(key));
        for (const key of openedTeleporterKeys) {
            const [levelRaw, yRaw, xRaw] = key.split(',');
            const level = Number(levelRaw);
            const y = Number(yRaw);
            const x = Number(xRaw);
            if (!Number.isFinite(level) || !Number.isFinite(y) || !Number.isFinite(x)) continue;

            currentPatch = applyPatch(
                currentPatch,
                deps.applyCreaturesStandingOnOpenTeleporter(transportState, level, x, y),
            );
            transportState = {
                ...state,
                ...currentPatch,
            } as TState;
        }

        const creaturesAfterImmediateEffects = transportState.creatures;
        if (creaturesAfterImmediateEffects !== creaturesBeforeImmediateEffects) {
            transitionQueue.push(
                ...collectCreatureFloorSensorTransitions(
                    creaturesBeforeImmediateEffects,
                    creaturesAfterImmediateEffects,
                ),
            );
        }
    }

    return currentPatch;
}
